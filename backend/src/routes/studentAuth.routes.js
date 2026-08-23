import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireStudent } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import {
  studentLogin,
  studentRefreshToken,
  studentLogout,
  studentMe,
  updateMyProfileImage,
  changeMyPassword,
  getMySummary,
  getMyHistory,
  getMyCourses,
} from "../controllers/studentAuth.controller.js";

const router = Router();

router.post(
  "/login",
  authLimiter,
  [
    body("studentId").trim().notEmpty().withMessage("Student ID is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  studentLogin
);

router.post("/refresh-token", studentRefreshToken);
router.post("/logout", requireStudent, studentLogout);
router.get("/me", requireStudent, studentMe);
router.put("/profile-image", requireStudent, updateMyProfileImage);
router.put(
  "/password",
  requireStudent,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
  ],
  validate,
  changeMyPassword
);

// Attendance visible only to the signed-in student
router.get("/me/summary", requireStudent, getMySummary);
router.get("/me/courses", requireStudent, getMyCourses);
router.get("/me/history", requireStudent, getMyHistory);

export default router;
