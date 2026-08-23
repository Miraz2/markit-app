import bcrypt from "bcryptjs";
import AcademicSession from "../models/AcademicSession.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Student from "../models/Student.js";
import Teacher from "../models/Teacher.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import {
  signStudentAccessToken,
  generateStudentRefreshToken,
  hashToken,
  compareToken,
  setStudentAuthCookies,
  clearStudentAuthCookies,
} from "../services/token.service.js";
import { validateProfileImage } from "../utils/validateProfileImage.js";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// POST /student-auth/login  { studentId, password, rememberMe }
export const studentLogin = asyncHandler(async (req, res) => {
  const { password, rememberMe } = req.body;
  const rawId = String(req.body.studentId || "").trim();

  const genericFail = () => ApiError.unauthorized("Invalid student ID or password");

  // IDs are unique per department/batch/section — in practice they are globally
  // unique, but if a duplicate ever exists we only accept a login when exactly
  // one account matches the password, never an arbitrary one.
  const candidates = await Student.find({
    studentId: { $regex: `^${escapeRegex(rawId)}$`, $options: "i" },
    isActive: true,
  }).select("+passwordHash +refreshTokenHash +failedLoginAttempts +lockUntil");

  if (candidates.length === 0) throw genericFail();

  // Any candidate for this ID being locked blocks the login — we cannot tell
  // which duplicate the student means, so treat them as one identity.
  if (candidates.some((c) => c.isLocked())) {
    throw ApiError.tooMany("Account temporarily locked due to repeated failed attempts. Try again later.");
  }

  let matched = null;
  let ambiguous = false;
  for (const candidate of candidates) {
    const ok = await candidate.comparePassword(password);
    if (!ok) continue;
    if (matched) {
      ambiguous = true;
      break;
    }
    matched = candidate;
  }

  if (ambiguous) {
    throw ApiError.unauthorized(
      "This student ID exists in more than one class. Please contact your administrator."
    );
  }

  if (!matched) {
    // Count failures against every account sharing this ID so brute-forcing
    // the shared identifier still trips the lockout.
    await Promise.all(
      candidates.map((c) => {
        c.failedLoginAttempts = (c.failedLoginAttempts || 0) + 1;
        if (c.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
          c.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
          c.failedLoginAttempts = 0;
        }
        return c.save().catch(() => {});
      })
    );
    throw genericFail();
  }

  matched.failedLoginAttempts = 0;
  matched.lockUntil = null;
  matched.lastLoginAt = new Date();
  matched.rememberMe = Boolean(rememberMe);

  const accessToken = signStudentAccessToken(matched);
  const refreshToken = generateStudentRefreshToken(matched._id.toString());
  matched.refreshTokenHash = await hashToken(refreshToken);
  matched.prevRefreshTokenHash = null;
  await matched.save();

  setStudentAuthCookies(res, { accessToken, refreshToken, remember: Boolean(rememberMe) });
  return sendOk(res, { student: matched.toSafeObject() }, "Signed in successfully");
});

// POST /student-auth/refresh-token
export const studentRefreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw ApiError.unauthorized("No refresh token provided");

  // Token format is "<studentId>.<secret>" — the id routes us to the right
  // document, the secret part is what actually gets compared.
  const dotIdx = token.indexOf(".");
  const idPart = dotIdx > 0 ? token.slice(0, dotIdx) : "";
  const secret = dotIdx > 0 ? token.slice(dotIdx + 1) : "";
  if (!/^[0-9a-fA-F]{24}$/.test(idPart) || !secret) {
    clearStudentAuthCookies(res);
    throw ApiError.unauthorized("Session invalid, please sign in again");
  }

  const student = await Student.findById(idPart).select(
    "+refreshTokenHash +prevRefreshTokenHash +rememberMe +isActive"
  );
  // The stored hash covers the FULL token ("id.secret"), same as the teacher
  // flow — only the id prefix is stripped for routing, not for comparison.
  const valid =
    student &&
    student.isActive &&
    ((await compareToken(token, student.refreshTokenHash)) ||
      (await compareToken(token, student.prevRefreshTokenHash)));

  if (!valid) {
    clearStudentAuthCookies(res);
    throw ApiError.unauthorized("Session invalid, please sign in again");
  }

  const newAccessToken = signStudentAccessToken(student);
  const newRefreshToken = generateStudentRefreshToken(student._id.toString());
  // Keep the just-used hash around briefly so a racing second refresh
  // (another tab) still validates instead of clearing the new cookie.
  student.prevRefreshTokenHash = student.refreshTokenHash;
  student.refreshTokenHash = await hashToken(newRefreshToken);
  await student.save();

  setStudentAuthCookies(res, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    remember: student.rememberMe,
  });
  return sendOk(res, null, "Token refreshed");
});

// POST /student-auth/logout
export const studentLogout = asyncHandler(async (req, res) => {
  if (req.student) {
    req.student.refreshTokenHash = null;
    req.student.prevRefreshTokenHash = null;
    await req.student.save();
  }
  clearStudentAuthCookies(res);
  return sendOk(res, null, "Signed out");
});

// GET /student-auth/me
export const studentMe = asyncHandler(async (req, res) => {
  return sendOk(res, { student: req.student.toSafeObject() });
});

// PUT /student-auth/profile-image  { profileImage: dataURL | "" | null }
// Students may only change their picture — enrollment details stay with the office.
export const updateMyProfileImage = asyncHandler(async (req, res) => {
  const { profileImage } = req.body;
  if (profileImage === undefined) {
    throw ApiError.badRequest("profileImage is required");
  }

  const student = await Student.findById(req.student._id);
  if (!student) throw ApiError.notFound("Student not found");

  if (profileImage === null || profileImage === "") {
    student.profileImage = null;
  } else {
    validateProfileImage(profileImage);
    student.profileImage = String(profileImage);
  }

  await student.save();
  return sendOk(res, { student: student.toSafeObject() }, "Profile picture updated");
});

// PUT /student-auth/password  { currentPassword, newPassword }
export const changeMyPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const student = await Student.findById(req.student._id).select("+passwordHash");
  if (!student) throw ApiError.notFound("Student not found");

  const valid = await student.comparePassword(currentPassword || "");
  if (!valid) throw ApiError.badRequest("Current password is incorrect");

  if (String(newPassword || "").length < 8) {
    throw ApiError.badRequest("New password must be at least 8 characters");
  }
  if (await bcrypt.compare(newPassword, student.passwordHash)) {
    throw ApiError.badRequest("New password must be different from the current one");
  }

  student.passwordHash = await bcrypt.hash(newPassword, 12);
  student.mustChangePassword = false;
  await student.save();

  return sendOk(res, { student: student.toSafeObject() }, "Password updated successfully");
});

// GET /student-auth/me/summary
// Per-course attendance totals for the signed-in student, grouped by academic
// session, plus an overall figure across everything recorded so far.
export const getMySummary = asyncHandler(async (req, res) => {
  const student = req.student;

  const sessions = await AttendanceSession.find({ "records.student": student._id })
    .select("date sessionName courseName records")
    .sort({ date: -1 })
    .lean();

  const courseMap = new Map();
  const overall = { present: 0, absent: 0, total: 0 };
  const sessionNames = new Set();
  let lastMarkedDate = null;

  for (const session of sessions) {
    const own = (session.records || []).find((r) => String(r.student) === String(student._id));
    if (!own) continue;

    sessionNames.add(session.sessionName);
    if (!lastMarkedDate || session.date > lastMarkedDate) lastMarkedDate = session.date;

    const key = `${session.sessionName}||${session.courseName || ""}`;
    if (!courseMap.has(key)) {
      courseMap.set(key, {
        sessionName: session.sessionName,
        courseName: session.courseName || "",
        present: 0,
        absent: 0,
        total: 0,
        firstDate: session.date,
        lastDate: session.date,
      });
    }
    const entry = courseMap.get(key);
    entry.total += 1;
    if (session.date < entry.firstDate) entry.firstDate = session.date;
    if (session.date > entry.lastDate) entry.lastDate = session.date;
    if (own.status === "present") entry.present += 1;
    else entry.absent += 1;

    overall.total += 1;
    if (own.status === "present") overall.present += 1;
    else overall.absent += 1;
  }

  const pct = (e) => (e.total > 0 ? Math.round((e.present / e.total) * 1000) / 10 : 0);
  const courses = Array.from(courseMap.values())
    .map((e) => ({ ...e, percentage: pct(e) }))
    .sort((a, b) => b.sessionName.localeCompare(a.sessionName) || a.courseName.localeCompare(b.courseName));

  return sendOk(res, {
    overall: { ...overall, percentage: pct(overall) },
    courses,
    sessionNames: Array.from(sessionNames).sort().reverse(),
    lastMarkedDate,
  });
});

// GET /student-auth/me/courses
// Every course the student's class is taking — derived from teacher
// assignments matching the student's department/batch/section, regardless of
// whether any attendance has been recorded for them yet.
export const getMyCourses = asyncHandler(async (req, res) => {
  const { department, batch, section } = req.student;

  const teachers = await Teacher.find({
    "assignments.department": department,
    "assignments.batch": batch,
    "assignments.section": section,
  })
    .select("name assignments")
    .lean();

  const courseMap = new Map();
  for (const teacher of teachers) {
    for (const a of teacher.assignments || []) {
      if (a.department !== department || a.batch !== batch || a.section !== section) continue;
      const courseName = a.courseName || "";
      if (!courseName) continue;
      const key = `${a.sessionName}||${courseName}`;
      if (!courseMap.has(key)) {
        courseMap.set(key, { sessionName: a.sessionName, courseName, teachers: [] });
      }
      const entry = courseMap.get(key);
      if (!entry.teachers.includes(teacher.name)) entry.teachers.push(teacher.name);
    }
  }

  const activeSession = await AcademicSession.findOne({ isActive: true }).select("name").lean();
  const courses = Array.from(courseMap.values())
    .map((c) => ({ ...c, isActiveSession: c.sessionName === activeSession?.name }))
    .sort((a, b) => b.sessionName.localeCompare(a.sessionName) || a.courseName.localeCompare(b.courseName));

  return sendOk(res, { courses, count: courses.length });
});

// GET /student-auth/me/history
// Flat day-by-day list of every recorded class for the student, newest first.
export const getMyHistory = asyncHandler(async (req, res) => {
  const student = req.student;

  const sessions = await AttendanceSession.find({ "records.student": student._id })
    .select("date sessionName department batch section courseName takenBy records")
    .populate("takenBy", "name")
    .sort({ date: -1 })
    .lean();

  const history = [];
  for (const session of sessions) {
    const own = (session.records || []).find((r) => String(r.student) === String(student._id));
    if (!own) continue;
    history.push({
      id: session._id,
      date: session.date,
      sessionName: session.sessionName,
      courseName: session.courseName || "",
      status: own.status,
      markedBy: session.takenBy?.name || null,
      department: session.department,
      batch: session.batch,
      section: session.section,
    });
  }

  return sendOk(res, { history, count: history.length });
});
