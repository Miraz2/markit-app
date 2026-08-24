import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import AttendanceSession from "../models/AttendanceSession.js";
import Student from "../models/Student.js";
import { generateSummaryPdf } from "../services/pdf.service.js";
import { generateSummaryCsv } from "../services/csv.service.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/summary/pdf",
  asyncHandler(async (req, res) => {
    const { department, batch, section, from, to, studentId, sessionName, courseName } = req.query;
    if (!department || !batch || !section) {
      throw ApiError.badRequest("department, batch, and section are required");
    }

    const match = { department, batch, section };
    if (sessionName) match.sessionName = sessionName;
    if (courseName) match.courseName = courseName;
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = from;
      if (to) match.date.$lte = to;
    }

    const sessions = await AttendanceSession.find(match).populate("takenBy", "name");
    const roster = await Student.find({ department, batch, section, isActive: true }).sort({ studentId: 1 });
    const filteredRoster = studentId ? roster.filter((s) => s._id.toString() === studentId) : roster;

    const totals = new Map(
      filteredRoster.map((s) => [s._id.toString(), { student: s, present: 0, absent: 0, total: 0 }])
    );
    for (const session of sessions) {
      for (const record of session.records) {
        const entry = totals.get(record.student.toString());
        if (!entry) continue;
        entry.total += 1;
        if (record.status === "present") entry.present += 1;
        else entry.absent += 1;
      }
    }

    const summary = Array.from(totals.values()).map((e) => ({
      student: { studentId: e.student.studentId, name: e.student.name },
      present: e.present,
      absent: e.absent,
      total: e.total,
      percentage: e.total > 0 ? Math.round((e.present / e.total) * 1000) / 10 : 0,
    }));

    const pdfBuffer = await generateSummaryPdf({
      filters: { department, batch, section, from, to, sessionName: sessionName || null, courseName: courseName || null },
      summary,
      teacherName: req.teacher.name,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-summary-${department}-${batch}-${section}.pdf"`
    );
    res.send(pdfBuffer);
  })
);

router.get(
  "/summary/csv",
  asyncHandler(async (req, res) => {
    const { department, batch, section, from, to, studentId, sessionName, courseName } = req.query;
    if (!department || !batch || !section) {
      throw ApiError.badRequest("department, batch, and section are required");
    }

    const match = { department, batch, section };
    if (sessionName) match.sessionName = sessionName;
    if (courseName) match.courseName = courseName;
    if (from || to) {
      match.date = {};
      if (from) match.date.$gte = from;
      if (to) match.date.$lte = to;
    }

    const sessions = await AttendanceSession.find(match).populate("takenBy", "name");
    const roster = await Student.find({ department, batch, section, isActive: true }).sort({ studentId: 1 });
    const filteredRoster = studentId ? roster.filter((s) => s._id.toString() === studentId) : roster;

    const totals = new Map(
      filteredRoster.map((s) => [s._id.toString(), { student: s, present: 0, absent: 0, total: 0 }])
    );
    for (const session of sessions) {
      for (const record of session.records) {
        const entry = totals.get(record.student.toString());
        if (!entry) continue;
        entry.total += 1;
        if (record.status === "present") entry.present += 1;
        else entry.absent += 1;
      }
    }

    const summary = Array.from(totals.values()).map((e) => ({
      student: { studentId: e.student.studentId, name: e.student.name },
      present: e.present,
      absent: e.absent,
      total: e.total,
      percentage: e.total > 0 ? Math.round((e.present / e.total) * 1000) / 10 : 0,
    }));

    const csvContent = generateSummaryCsv({
      department,
      batch,
      section,
      sessionName,
      summary,
      sessions,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-summary-${department}-${batch}-${section}.csv"`
    );
    res.send(csvContent);
  })
);

export default router;
