import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import {
  signAccessToken,
  generateRefreshToken,
  hashToken,
  compareToken,
  setAuthCookies,
  clearAuthCookies,
} from "../services/token.service.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export const getSetupStatus = asyncHandler(async (req, res) => {
  const userCount = await Teacher.countDocuments({});
  return sendOk(res, { isFirstRun: userCount === 0 });
});

export const signup = asyncHandler(async (req, res) => {
  const userCount = await Teacher.countDocuments({});
  if (userCount > 0) {
    throw ApiError.forbidden("Public registration is disabled. Accounts can only be created by an Admin.");
  }

  const { name, email, password, designation, department } = req.body;

  const existing = await Teacher.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict("An account with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = await Teacher.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    designation,
    department,
    role: "admin", // The first user is automatically Super Admin
  });

  return sendOk(res, { teacher: teacher.toSafeObject() }, "Admin account created. Please sign in.", 201);
});

export const signin = asyncHandler(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const teacher = await Teacher.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash +refreshTokenHash"
  );

  const genericFail = () => ApiError.unauthorized("Invalid email or password");

  if (!teacher) throw genericFail();

  if (teacher.isLocked()) {
    throw ApiError.tooMany("Account temporarily locked due to repeated failed attempts. Try again later.");
  }

  const valid = await teacher.comparePassword(password);
  if (!valid) {
    teacher.failedLoginAttempts += 1;
    if (teacher.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      teacher.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
      teacher.failedLoginAttempts = 0;
    }
    await teacher.save();
    throw genericFail();
  }

  teacher.failedLoginAttempts = 0;
  teacher.lockUntil = null;
  teacher.lastLoginAt = new Date();
  teacher.rememberMe = Boolean(rememberMe);

  const accessToken = signAccessToken(teacher);
  const refreshToken = generateRefreshToken();
  teacher.refreshTokenHash = await hashToken(refreshToken);
  await teacher.save();

  setAuthCookies(res, { accessToken, refreshToken, remember: Boolean(rememberMe) });
  return sendOk(res, { teacher: teacher.toSafeObject() }, "Signed in successfully");
});

export const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw ApiError.unauthorized("No refresh token provided");

  const candidates = await Teacher.find({ refreshTokenHash: { $ne: null } }).select(
    "+refreshTokenHash"
  );

  let matchedTeacher = null;
  for (const candidate of candidates) {
    if (await compareToken(token, candidate.refreshTokenHash)) {
      matchedTeacher = candidate;
      break;
    }
  }

  if (!matchedTeacher) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Session invalid, please sign in again");
  }

  const newAccessToken = signAccessToken(matchedTeacher);
  const newRefreshToken = generateRefreshToken();
  matchedTeacher.refreshTokenHash = await hashToken(newRefreshToken);
  await matchedTeacher.save();

  setAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    remember: matchedTeacher.rememberMe,
  });
  return sendOk(res, null, "Token refreshed");
});

export const signout = asyncHandler(async (req, res) => {
  if (req.teacher) {
    req.teacher.refreshTokenHash = null;
    await req.teacher.save();
  }
  clearAuthCookies(res);
  return sendOk(res, null, "Signed out");
});

export const me = asyncHandler(async (req, res) => {
  return sendOk(res, { teacher: req.teacher.toSafeObject() });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, designation, department, currentPassword, newPassword } = req.body;

  const teacher = await Teacher.findById(req.teacher._id).select("+passwordHash");
  if (!teacher) throw ApiError.notFound("Teacher not found");

  const wantsInfoChange =
    name !== undefined || designation !== undefined || department !== undefined;

  // Teachers are limited to password change — their personal details are
  // managed by admins via Teacher Management. Admins may edit their own.
  if (wantsInfoChange && teacher.role !== "admin") {
    throw ApiError.forbidden("Only administrators can change your account information");
  }

  if (teacher.role === "admin") {
    if (name !== undefined) teacher.name = String(name).trim();
    if (designation !== undefined) teacher.designation = String(designation).trim();
    if (department !== undefined) teacher.department = String(department).trim();
  }

  if (newPassword) {
    if (!currentPassword) throw ApiError.badRequest("Current password required to change password");
    const valid = await teacher.comparePassword(currentPassword);
    if (!valid) throw ApiError.badRequest("Current password is incorrect");
    if (String(newPassword).length < 8) {
      throw ApiError.badRequest("New password must be at least 8 characters");
    }
    teacher.passwordHash = await bcrypt.hash(newPassword, 12);
  }

  await teacher.save();
  return sendOk(res, { teacher: teacher.toSafeObject() }, "Profile updated successfully");
});
