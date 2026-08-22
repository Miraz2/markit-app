import { Router } from "express";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
  listCourseStudents,
  createCourseStudent,
  updateCourseStudent,
  deleteCourseStudent,
} from "../controllers/courseStudent.controller.js";

const router = Router();

router.use(requireAuth);

router.get(
  "/",
  [
    query("sessionName").optional().trim(),
    query("department").optional().trim(),
    query("batch").optional().trim(),
    query("section").optional().trim(),
    query("courseName").optional().trim(),
  ],
  validate,
  listCourseStudents
);

router.post(
  "/",
  [
    body("studentId").trim().notEmpty().withMessage("Student ID is required").isLength({ max: 40 }),
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
    body("email").optional({ checkFalsy: true }).isEmail().withMessage("Invalid email"),
    body("phone").optional({ checkFalsy: true }).isLength({ max: 20 }),
    body("sessionName").trim().notEmpty().withMessage("Session is required"),
    body("department").trim().notEmpty().withMessage("Department is required"),
    body("batch").trim().notEmpty().withMessage("Batch is required"),
    body("section").trim().notEmpty().withMessage("Section is required"),
    body("courseName").optional({ checkFalsy: true }).trim(),
  ],
  validate,
  createCourseStudent
);

router.put(
  "/:id",
  [
    param("id").isMongoId(),
    body("email").optional({ checkFalsy: true }).isEmail(),
    body("studentId").optional().trim().notEmpty().isLength({ max: 40 }),
    body("name").optional().trim().notEmpty().isLength({ max: 100 }),
    body("phone").optional({ checkFalsy: true }).isLength({ max: 20 }),
  ],
  validate,
  updateCourseStudent
);

router.delete("/:id", [param("id").isMongoId()], validate, deleteCourseStudent);

export default router;
