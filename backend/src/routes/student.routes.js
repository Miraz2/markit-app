import { Router } from "express";
import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import {
  enrollStudent,
  bulkEnrollStudents,
  listStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  bulkDeleteStudents,
} from "../controllers/student.controller.js";

const router = Router();

router.use(requireAuth);

const studentFields = [
  body("studentId").trim().notEmpty().withMessage("Student ID is required").isLength({ max: 40 }),
  body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
  body("department").trim().notEmpty().withMessage("Department is required"),
  body("batch").trim().notEmpty().withMessage("Batch is required"),
  body("section").trim().notEmpty().withMessage("Section is required"),
  body("email").optional({ checkFalsy: true }).isEmail().withMessage("Invalid email"),
  body("phone").optional({ checkFalsy: true }).isLength({ max: 20 }),
];

router.get(
  "/",
  [
    query("department").optional().trim(),
    query("batch").optional().trim(),
    query("section").optional().trim(),
    query("page").optional().isInt({ min: 1 }),
    query("limit").optional().isInt({ min: 1, max: 1000 }),
  ],
  validate,
  listStudents
);

router.post("/", requireRole("admin"), studentFields, validate, enrollStudent);
router.post("/bulk", requireRole("admin"), bulkEnrollStudents);
router.post(
  "/bulk-delete",
  requireRole("admin"),
  [body("ids").isArray({ min: 1, max: 500 }).withMessage("Provide 1-500 student ids")],
  validate,
  bulkDeleteStudents
);

router.get("/:id", [param("id").isMongoId()], validate, getStudent);
router.put(
  "/:id",
  requireRole("admin"),
  [
    param("id").isMongoId(),
    body("email").optional({ checkFalsy: true }).isEmail(),
    body("password").optional({ checkFalsy: true }).isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  updateStudent
);
router.delete("/:id", requireRole("admin"), [param("id").isMongoId()], validate, deleteStudent);

export default router;
