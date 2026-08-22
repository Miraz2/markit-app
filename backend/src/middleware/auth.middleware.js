import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import Teacher from "../models/Teacher.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Verifies the short-lived access token (read from httpOnly cookie) and
// attaches the authenticated teacher document to req.teacher.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.accessToken;
  if (!token) throw ApiError.unauthorized("Not authenticated");

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.accessSecret);
  } catch {
    throw ApiError.unauthorized("Session expired, please sign in again");
  }

  const teacher = await Teacher.findById(payload.sub);
  if (!teacher) throw ApiError.unauthorized("Account no longer exists");

  req.teacher = teacher;
  next();
});

// Restricts a route to specific roles, e.g. requireRole("admin").
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.teacher || !roles.includes(req.teacher.role)) {
      return next(ApiError.forbidden("You do not have permission to do this"));
    }
    next();
  };
