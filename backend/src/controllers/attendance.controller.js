import mongoose from "mongoose";
import AttendanceSession from "../models/AttendanceSession.js";
import AcademicSession from "../models/AcademicSession.js";
import Student from "../models/Student.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";

export const submitAttendance = asyncHandler(async (req, res) => {
  // Admin cannot change student attendance
  if (req.teacher.role === "admin") {
    throw ApiError.forbidden("Admins cannot submit or modify student attendance. Attendance is marked by teachers.");
  }

  const { date, department, batch, section, courseName = "", records, sessionName } = req.body;

  if (!Array.isArray(records) || records.length === 0) {
    throw ApiError.badRequest("At least one attendance record is required");
  }

  // Check active academic session
  const activeAcademicSession = await AcademicSession.findOne({ isActive: true });
  if (!activeAcademicSession) {
    throw ApiError.badRequest("No active academic session found. Admin must create or activate a session first.");
  }

  // Verify student roster match
  const studentIds = records.map((r) => r.student);
  const validCount = await Student.countDocuments({
    _id: { $in: studentIds },
    department,
    batch,
    section,
    isActive: true,
  });
  if (validCount !== studentIds.length) {
    throw ApiError.badRequest("One or more students do not match the selected department/batch/section");
  }

  // Upsert session record
  const session = await AttendanceSession.findOneAndUpdate(
    { date, department, batch, section, courseName },
    {
      date,
      academicSession: activeAcademicSession._id,
      sessionName: sessionName || activeAcademicSession.name,
      department,
      batch,
      section,
      courseName,
      takenBy: req.teacher._id,
      records,
    },
    { new: true, upsert: true, runValidators: true }
  );

  return sendOk(res, { session }, "Attendance submitted successfully");
});

export const getSession = asyncHandler(async (req, res) => {
  const { department, batch, section, date, courseName = "" } = req.query;
  if (!department || !batch || !section || !date) {
    throw ApiError.badRequest("department, batch, section, and date are required");
  }

  const session = await AttendanceSession.findOne({ department, batch, section, date, courseName })
    .populate("records.student", "studentId name")
    .populate("takenBy", "name");

  return sendOk(res, { session: session || null });
});

export const getSummary = asyncHandler(async (req, res) => {
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

  const sessions = await AttendanceSession.find(match)
    .populate("takenBy", "name email")
    .populate("records.student", "studentId name")
    .sort({ date: 1 });

  const roster = await Student.find({ department, batch, section, isActive: true }).sort({ studentId: 1 });
  const filteredRoster = studentId
    ? roster.filter((s) => String(s.studentId || "").trim() === String(studentId).trim())
    : roster;

  const totalsByStudent = new Map(
    filteredRoster.map((s) => [
      s._id.toString(),
      { student: s, present: 0, absent: 0, total: 0 },
    ])
  );

  for (const session of sessions) {
    for (const record of session.records) {
      const studentObj = record.student;
      const key = studentObj && studentObj._id ? studentObj._id.toString() : record.student.toString();
      const entry = totalsByStudent.get(key);
      if (!entry) continue;
      entry.total += 1;
      if (record.status === "present") entry.present += 1;
      else entry.absent += 1;
    }
  }

  const summary = Array.from(totalsByStudent.values()).map((e) => ({
    student: { id: e.student._id, studentId: e.student.studentId, name: e.student.name, email: e.student.email },
    present: e.present,
    absent: e.absent,
    total: e.total,
    percentage: e.total > 0 ? Math.round((e.present / e.total) * 1000) / 10 : 0,
  }));

  // Build date-wise map for the calendar widget
  const datesMap = {};
  for (const s of sessions) {
    datesMap[s.date] = {
      id: s._id,
      date: s.date,
      takenBy: s.takenBy ? { name: s.takenBy.name } : null,
      presentCount: s.records.filter((r) => r.status === "present").length,
      absentCount: s.records.filter((r) => r.status === "absent").length,
      totalCount: s.records.length,
      records: s.records.map((r) => ({
        studentId: r.student?.studentId || "",
        studentName: r.student?.name || "",
        status: r.status,
      })),
    };
  }

  return sendOk(res, {
    summary,
    sessions,
    datesMap,
    sessionCount: sessions.length,
    filters: { department, batch, section, from: from || null, to: to || null, sessionName: sessionName || null, courseName: courseName || null },
  });
});

// GET /attendance/history  — list all sessions for a dept/batch/section/courseName
export const getHistory = asyncHandler(async (req, res) => {
  const { department, batch, section, courseName } = req.query;
  if (!department || !batch || !section) {
    throw ApiError.badRequest("department, batch, and section are required");
  }

  const match = { department, batch, section };
  if (courseName) match.courseName = courseName;

  const sessions = await AttendanceSession.find(match)
    .populate("takenBy", "name")
    .populate("records.student", "studentId name")
    .sort({ date: -1 });

  return sendOk(res, { sessions });
});

const TERM_RANK = { Spring: 1, Summer: 2, Fall: 3 };
const parseSessionName = (name = "") => {
  const idx = name.lastIndexOf("-");
  if (idx === -1) return { year: 0, term: 0 };
  return {
    year: parseInt(name.slice(idx + 1), 10) || 0,
    term: TERM_RANK[name.slice(0, idx)] || 0,
  };
};

// GET /attendance/history/overview — academic sessions: assigned ones for teachers, all for admin
export const getHistoryOverview = asyncHandler(async (req, res) => {
  const isAdminUser = req.teacher.role === "admin";

  let baseSessions;
  if (isAdminUser) {
    baseSessions = await AcademicSession.find({}).select("name isActive").lean();
  } else {
    baseSessions = Array.from(
      new Set((req.teacher.assignments || []).map((a) => a.sessionName).filter(Boolean))
    ).map((name) => ({ name }));
  }

  const active = await AcademicSession.findOne({ isActive: true }).select("name").lean();
  const activeName = active?.name || null;

  const counts = await AttendanceSession.aggregate([
    { $match: isAdminUser ? {} : { takenBy: req.teacher._id } },
    { $group: { _id: "$sessionName", classCount: { $sum: 1 }, latestDate: { $max: "$date" } } },
  ]);
  const countMap = Object.fromEntries(
    counts.map((c) => [c._id, { classCount: c.classCount, latestDate: c.latestDate }])
  );

  const sessions = baseSessions
    .map((s) => ({
      name: s.name,
      isActive: s.isActive != null ? Boolean(s.isActive) : s.name === activeName,
      classCount: countMap[s.name]?.classCount || 0,
      latestDate: countMap[s.name]?.latestDate || null,
    }))
    .filter((s) => s.name)
    .sort((a, b) => {
      const pa = parseSessionName(a.name);
      const pb = parseSessionName(b.name);
      return pb.year - pa.year || pb.term - pa.term;
    });

  return sendOk(res, { sessions, scope: isAdminUser ? "all" : "assigned" });
});

// GET /attendance/history/records?sessionName=Summer-26
// Teachers see only attendance they took; admins see every teacher's records
export const getHistoryRecords = asyncHandler(async (req, res) => {
  const { sessionName } = req.query;
  if (!sessionName) throw ApiError.badRequest("sessionName is required");

  const match = { sessionName };
  if (req.teacher.role !== "admin") match.takenBy = req.teacher._id;

  const records = await AttendanceSession.aggregate([
    { $match: match },
    { $sort: { date: -1 } },
    {
      $lookup: {
        from: "teachers",
        localField: "takenBy",
        foreignField: "_id",
        as: "takenByTeacher",
      },
    },
    {
      $project: {
        date: 1,
        sessionName: 1,
        department: 1,
        batch: 1,
        section: 1,
        courseName: 1,
        total: { $size: { $ifNull: ["$records", []] } },
        present: {
          $size: {
            $filter: {
              input: { $ifNull: ["$records", []] },
              as: "r",
              cond: { $eq: ["$$r.status", "present"] },
            },
          },
        },
        takenByName: { $arrayElemAt: ["$takenByTeacher.name", 0] },
      },
    },
  ]);

  return sendOk(res, { records });
});

// GET /attendance/history/session/:id — full attendance detail for one class-day
export const getHistoryDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid session id");
  }

  const session = await AttendanceSession.findById(id)
    .populate("records.student", "studentId name email")
    .populate("takenBy", "name");
  if (!session) throw ApiError.notFound("Attendance session not found");

  if (req.teacher.role !== "admin" && String(session.takenBy?._id || "") !== String(req.teacher._id)) {
    const isAssignedToClass = (req.teacher.assignments || []).some(
      (a) =>
        a.department === session.department &&
        a.batch === session.batch &&
        a.section === session.section &&
        (a.courseName || "") === (session.courseName || "")
    );
    if (!isAssignedToClass) {
      throw ApiError.forbidden("You do not have access to this attendance record");
    }
  }

  return sendOk(res, { session });
});

// PUT /attendance/session/:id  — edit an existing attendance session
export const updateSession = asyncHandler(async (req, res) => {
  if (req.teacher.role === "admin") {
    throw ApiError.forbidden("Admins cannot modify attendance records.");
  }

  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw ApiError.badRequest("Invalid session id");
  }

  const session = await AttendanceSession.findById(id);
  if (!session) throw ApiError.notFound("Attendance session not found");

  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    throw ApiError.badRequest("records array is required");
  }

  session.records = records;
  session.takenBy = req.teacher._id;
  await session.save();

  const populated = await session.populate([
    { path: "records.student", select: "studentId name" },
    { path: "takenBy", select: "name" },
  ]);

  return sendOk(res, { session: populated }, "Attendance updated successfully");
});
