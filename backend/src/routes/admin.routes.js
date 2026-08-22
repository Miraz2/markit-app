import { Router } from "express";
import { body } from "express-validator";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  createTeacher,
  bulkEnrollTeachers,
  listTeachers,
  updateTeacher,
  deleteTeacher,
  createAcademicSession,
  listAcademicSessions,
  setActiveSession,
  assignTeacherSections,
} from "../controllers/admin.controller.js";

const router = Router();

// All routes require authenticated Admin
router.use(requireAuth, requireRole("admin"));

// Teacher management routes
router.get("/teachers", listTeachers);
router.post(
  "/teachers",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
    body("department").trim().notEmpty().withMessage("Department is required"),
  ],
  validate,
  createTeacher
);
router.put("/teachers/:id", updateTeacher);
router.delete("/teachers/:id", deleteTeacher);
router.post("/teachers/bulk", bulkEnrollTeachers);

// Academic session management routes
router.get("/sessions", listAcademicSessions);
router.post(
  "/sessions",
  [
    body("term").isIn(["Spring", "Summer", "Fall"]).withMessage("Term must be Spring, Summer, or Fall"),
    body("year").trim().notEmpty().withMessage("Year is required (e.g. 26)"),
  ],
  validate,
  createAcademicSession
);
router.put("/sessions/:id/activate", setActiveSession);

// Section assignments
router.post("/assignments", assignTeacherSections);

export default router;
