import Student from "../models/Student.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";
import { getDefaultStudentPasswordHash } from "../utils/studentDefaults.js";

export const enrollStudent = asyncHandler(async (req, res) => {
  const { studentId, name, department, batch, section, email, phone } = req.body;

  const student = await Student.create({
    studentId: studentId.trim(),
    name,
    department,
    batch,
    section,
    email,
    phone,
    enrolledBy: req.teacher._id,
    passwordHash: await getDefaultStudentPasswordHash(),
    mustChangePassword: true,
  });

  return sendOk(res, { student }, "Student enrolled", 201);
});

export const bulkEnrollStudents = asyncHandler(async (req, res) => {
  const { students } = req.body; // array of { studentId, name, department, batch, section, email?, phone? }
  if (!Array.isArray(students) || students.length === 0) {
    throw ApiError.badRequest("Provide a non-empty array of students");
  }
  if (students.length > 500) {
    throw ApiError.badRequest("Bulk import is limited to 500 students per request");
  }

  const docs = students.map((s) => ({
    studentId: String(s.studentId || "").trim(),
    name: String(s.name || "").trim(),
    department: String(s.department || "").trim(),
    batch: String(s.batch || "").trim(),
    section: String(s.section || "").trim(),
    email: s.email || "",
    phone: s.phone || "",
    enrolledBy: req.teacher._id,
  }));

  const invalid = docs.find((d) => !d.studentId || !d.name || !d.department || !d.batch || !d.section);
  if (invalid) throw ApiError.badRequest("Every row needs studentId, name, department, batch, and section");

  const defaultPasswordHash = await getDefaultStudentPasswordHash();
  for (const doc of docs) {
    doc.passwordHash = defaultPasswordHash;
    doc.mustChangePassword = true;
  }

  const result = await Student.insertMany(docs, { ordered: false }).catch((err) => {
    // insertMany with ordered:false still throws on duplicate keys after inserting the rest
    if (err.writeErrors) return err.insertedDocs || [];
    throw err;
  });

  return sendOk(res, { inserted: result.length ?? students.length }, "Bulk enrollment complete", 201);
});

export const listStudents = asyncHandler(async (req, res) => {
  const { department, batch, section, search, page = 1, limit = 50 } = req.query;

  const filter = { isActive: true };
  if (department) filter.department = department;
  if (batch) filter.batch = batch;
  if (section) filter.section = section;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { studentId: { $regex: search, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));

  const [students, total] = await Promise.all([
    Student.find(filter)
      .sort({ studentId: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Student.countDocuments(filter),
  ]);

  return sendOk(res, {
    students,
    pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
  });
});

export const getStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ _id: req.params.id, isActive: true });
  if (!student) throw ApiError.notFound("Student not found");
  return sendOk(res, { student });
});

export const updateStudent = asyncHandler(async (req, res) => {
  const allowed = ["name", "department", "batch", "section", "email", "phone", "studentId"];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }

  const student = await Student.findOneAndUpdate(
    { _id: req.params.id, isActive: true },
    updates,
    { new: true, runValidators: true }
  );
  if (!student) throw ApiError.notFound("Student not found");

  return sendOk(res, { student }, "Student updated");
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const student = await Student.findOneAndDelete({ _id: req.params.id, isActive: true });
  if (!student) throw ApiError.notFound("Student not found");

  return sendOk(res, null, "Student removed");
});

export const bulkDeleteStudents = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw ApiError.badRequest("Provide a non-empty array of student ids");
  }
  if (ids.length > 500) {
    throw ApiError.badRequest("Bulk delete is limited to 500 students per request");
  }
  if (ids.some((id) => !/^[0-9a-fA-F]{24}$/.test(String(id)))) {
    throw ApiError.badRequest("One or more ids are invalid");
  }

  const result = await Student.deleteMany({ _id: { $in: ids }, isActive: true });

  return sendOk(
    res,
    { deleted: result.deletedCount ?? 0 },
    `${result.deletedCount ?? 0} student(s) removed`
  );
});
