import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";

export function signAccessToken(teacher) {
  return jwt.sign({ sub: teacher._id.toString(), role: teacher.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

// Refresh tokens are opaque random strings (not JWTs) — we only ever store
// their bcrypt hash, so a leaked DB dump can't be replayed as a session.
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

export function hashToken(token) {
  return bcrypt.hash(token, 10);
}

export function compareToken(token, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(token, hash);
}

const baseCookieOpts = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: "strict",
  path: "/",
};

// `remember` decides whether auth survives a browser restart:
//   true  → persistent cookies (refresh valid for its full lifetime)
//   false → session cookies, dropped when the browser closes
export function setAuthCookies(res, { accessToken, refreshToken, remember = false }) {
  const lifetime = (ms) => (remember ? { maxAge: ms } : {});
  res.cookie("accessToken", accessToken, {
    ...baseCookieOpts,
    ...lifetime(15 * 60 * 1000), // 15 minutes
  });
  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOpts,
    path: "/api/auth", // only sent to auth routes (refresh/signout)
    ...lifetime(7 * 24 * 60 * 60 * 1000), // 7 days
  });
}

export function clearAuthCookies(res) {
  res.clearCookie("accessToken", baseCookieOpts);
  res.clearCookie("refreshToken", { ...baseCookieOpts, path: "/api/auth" });
}

// --- Student portal sessions ---
// Student refresh tokens embed the student id ("${id}.${random}") so the
// refresh route can locate the account directly instead of scanning every
// student row — the roster is far too large for the teacher-style scan.
export function signStudentAccessToken(student) {
  return jwt.sign({ sub: student._id.toString(), kind: "student" }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpires,
  });
}

export function generateStudentRefreshToken(studentId) {
  return `${studentId}.${crypto.randomBytes(48).toString("hex")}`;
}

export function setStudentAuthCookies(res, { accessToken, refreshToken, remember = false }) {
  const lifetime = (ms) => (remember ? { maxAge: ms } : {});
  res.cookie("accessToken", accessToken, {
    ...baseCookieOpts,
    ...lifetime(15 * 60 * 1000), // 15 minutes
  });
  res.cookie("refreshToken", refreshToken, {
    ...baseCookieOpts,
    path: "/api/student-auth",
    ...lifetime(7 * 24 * 60 * 60 * 1000), // 7 days
  });
}

export function clearStudentAuthCookies(res) {
  res.clearCookie("accessToken", baseCookieOpts);
  res.clearCookie("refreshToken", { ...baseCookieOpts, path: "/api/student-auth" });
}
