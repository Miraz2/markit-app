import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import AcademicSession from "../models/AcademicSession.js";
import Student from "../models/Student.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";

// --- TEACHER MANAGEMENT ---

export const createTeacher = asyncHandler(async (req, res) => {
  const { name, email, password, department, designation } = req.body;

  const existing = await Teacher.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const passwordHash = await bcrypt.hash(password, 12);
  const teacher = await Teacher.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    department: department || "",
    designation: designation || "",
    role: "teacher",
  });

  return sendOk(res, { teacher: teacher.toSafeObject() }, "Teacher enrolled successfully", 201);
});

export const bulkEnrollTeachers = asyncHandler(async (req, res) => {
  const { teachers } = req.body; // array of { name, email, password, department, designation? }
  if (!Array.isArray(teachers) || teachers.length === 0) {
    throw ApiError.badRequest("Provide a non-empty array of teachers");
  }
  if (teachers.length > 100) {
    throw ApiError.badRequest("Bulk import is limited to 100 teachers per request");
  }

  const docs = teachers.map((t) => ({
    name: String(t.name || "").trim(),
    email: String(t.email || "").trim().toLowerCase(),
    password: String(t.password || ""),
    department: String(t.department || "").trim(),
    designation: String(t.designation || "").trim(),
    role: "teacher",
  }));

  const invalid = docs.find(
    (d) => !d.name || !d.email || d.password.length < 8 || !d.department
  );
  if (invalid) {
    throw ApiError.badRequest(
      "Every row needs name, valid email, password (8+ chars), and department"
    );
  }

  // Skip emails that already exist or repeat within the batch
  const existing = await Teacher.find({ email: { $in: docs.map((d) => d.email) } }).select("email");
  const existingEmails = new Set(existing.map((t) => t.email));
  const seen = new Set();
  const toInsert = [];
  let skipped = 0;
  for (const d of docs) {
    if (existingEmails.has(d.email) || seen.has(d.email)) {
      skipped += 1;
      continue;
    }
    seen.add(d.email);
    toInsert.push(d);
  }

  for (const d of toInsert) {
    d.passwordHash = await bcrypt.hash(d.password, 12);
    delete d.password;
  }

  const insertedDocs = await Teacher.insertMany(toInsert, { ordered: false }).catch((err) => {
    // ordered:false still throws on unique violations after inserting the rest
    if (err.writeErrors) {
      skipped += err.writeErrors.length;
      return err.insertedDocs || [];
    }
    throw err;
  });

  return sendOk(
    res,
    { inserted: insertedDocs.length, skipped },
    "Bulk enrollment complete",
    201
  );
});
export const listTeachers = asyncHandler(async (req, res) => {
  const teachers = await Teacher.find({ role: "teacher" }).sort({ createdAt: -1 });
  const safeTeachers = teachers.map((t) => t.toSafeObject());
  return sendOk(res, { teachers: safeTeachers });
});

export const updateTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, department, designation, password, email } = req.body;

  const teacher = await Teacher.findById(id);
  if (!teacher) throw ApiError.notFound("Teacher not found");

  if (name !== undefined) teacher.name = name;
  if (department !== undefined) teacher.department = department;
  if (designation !== undefined) teacher.designation = designation;
  if (email !== undefined) teacher.email = email.toLowerCase();
  if (password && password.trim().length >= 8) {
    teacher.passwordHash = await bcrypt.hash(password, 12);
  }

  await teacher.save();
  return sendOk(res, { teacher: teacher.toSafeObject() }, "Teacher details updated");
});

export const deleteTeacher = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const teacher = await Teacher.findById(id);
  if (!teacher) throw ApiError.notFound("Teacher not found");
  if (teacher.role === "admin") {
    throw ApiError.badRequest("Cannot delete admin account");
  }

  await Teacher.findByIdAndDelete(id);
  return sendOk(res, null, "Teacher account deleted");
});

// --- ACADEMIC SESSION MANAGEMENT ---

export const createAcademicSession = asyncHandler(async (req, res) => {
  const { term, year } = req.body; // e.g. term = "Summer", year = "26"
  if (!term || !year) throw ApiError.badRequest("Term and Year are required");

  const sessionName = `${term}-${year}`;

  const existing = await AcademicSession.findOne({ name: sessionName });
  if (existing) throw ApiError.conflict(`Session ${sessionName} already exists`);

  // Deactivate all existing sessions
  await AcademicSession.updateMany({}, { isActive: false });

  const session = await AcademicSession.create({
    name: sessionName,
    term,
    year,
    isActive: true,
    createdBy: req.teacher._id,
  });

  return sendOk(res, { session }, `Academic Session ${sessionName} created and set active`, 201);
});

export const listAcademicSessions = asyncHandler(async (req, res) => {
  const sessions = await AcademicSession.find({}).sort({ createdAt: -1 });
  const activeSession = sessions.find((s) => s.isActive) || null;
  return sendOk(res, { sessions, activeSession });
});

export const setActiveSession = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const target = await AcademicSession.findById(id);
  if (!target) throw ApiError.notFound("Academic session not found");

  await AcademicSession.updateMany({}, { isActive: false });
  target.isActive = true;
  await target.save();

  return sendOk(res, { session: target }, `Session ${target.name} set as active`);
});

// --- TEACHER SECTION ASSIGNMENTS ---

export const assignTeacherSections = asyncHandler(async (req, res) => {
  const { teacherId, sessionId, assignments } = req.body;
  // assignments: array of { department, batch, section, courseName }

  const teacher = await Teacher.findById(teacherId);
  if (!teacher) throw ApiError.notFound("Teacher not found");

  const session = await AcademicSession.findById(sessionId);
  if (!session) throw ApiError.notFound("Academic session not found");

  // Filter out assignments for this session and replace with new set
  teacher.assignments = teacher.assignments.filter((a) => a.session.toString() !== sessionId.toString());

  if (Array.isArray(assignments) && assignments.length > 0) {
    for (const a of assignments) {
      teacher.assignments.push({
        session: session._id,
        sessionName: session.name,
        department: a.department,
        batch: a.batch,
        section: a.section,
        courseName: a.courseName || "",
      });
    }
  }

  await teacher.save();
  return sendOk(res, { teacher: teacher.toSafeObject() }, "Teacher section assignments updated");
});
