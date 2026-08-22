import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import Student from "../models/Student.js";
import AcademicSession from "../models/AcademicSession.js";
import Course from "../models/Course.js";

const router = Router();

// Public — the department list is non-sensitive and needed on the
// pre-auth signup screen.
router.get(
  "/departments",
  asyncHandler(async (req, res) => {
    const [studentDepts, courseDepts] = await Promise.all([
      Student.distinct("department", { isActive: true }),
      Course.distinct("department"),
    ]);
    const departments = [...new Set([...studentDepts, ...courseDepts])].sort();
    return sendOk(res, { departments });
  })
);

router.use(requireAuth);

router.get(
  "/courses",
  asyncHandler(async (req, res) => {
    const { department } = req.query;
    const filter = department ? { department } : {};
    const courses = await Course.find(filter).sort({ name: 1 }).lean();
    return sendOk(res, { courses });
  })
);

router.get(
  "/batches",
  asyncHandler(async (req, res) => {
    const { department } = req.query;
    const filter = { isActive: true };
    if (department) filter.department = department;
    const batches = await Student.distinct("batch", filter);
    return sendOk(res, { batches: batches.sort() });
  })
);

router.get(
  "/sections",
  asyncHandler(async (req, res) => {
    const { department, batch } = req.query;
    const filter = { isActive: true };
    if (department) filter.department = department;
    if (batch) filter.batch = batch;
    const sections = await Student.distinct("section", filter);
    return sendOk(res, { sections: sections.sort() });
  })
);

router.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const sessions = await AcademicSession.find({}).sort({ createdAt: -1 });
    const activeSession = sessions.find((s) => s.isActive) || null;
    return sendOk(res, { sessions, activeSession });
  })
);

export default router;
