import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { submitAttendance, getSession, getSummary, getHistory, getHistoryOverview, getHistoryRecords, getHistoryDetail, updateSession } from "../controllers/attendance.controller.js";

const router = Router();

router.use(requireAuth);

router.post(
  "/",
  [
    body("date").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("date must be YYYY-MM-DD"),
    body("department").trim().notEmpty(),
    body("batch").trim().notEmpty(),
    body("section").trim().notEmpty(),
    body("records").isArray({ min: 1 }),
    body("records.*.student").isMongoId(),
    body("records.*.status").isIn(["present", "absent"]),
  ],
  validate,
  submitAttendance
);

router.get("/session", getSession);
router.get("/summary", getSummary);
router.get("/history", getHistory);
router.get("/history/overview", getHistoryOverview);
router.get("/history/records", getHistoryRecords);
router.get("/history/session/:id", getHistoryDetail);
router.put("/session/:id", updateSession);

export default router;
