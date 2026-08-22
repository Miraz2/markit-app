import CourseStudent from "../models/CourseStudent.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendOk } from "../utils/ApiResponse.js";

// Teachers see only the students they personally enrolled;
// admins see everyone's personal enrollments (read-only view).
export const listCourseStudents = asyncHandler(async (req, res) => {
  const { sessionName, department, batch, section, courseName } = req.query;

  const filter = {};
  if (sessionName) filter.sessionName = sessionName;
  if (department) filter.department = department;
  if (batch) filter.batch = batch;
  if (section) filter.section = section;
  if (courseName) filter.courseName = courseName;

  if (req.teacher.role !== "admin") {
    filter.enrolledBy = req.teacher._id;
  }

  const students = await CourseStudent.find(filter)
    .populate("enrolledBy", "name designation")
    .sort({ studentId: 1 });

  return sendOk(res, { students });
});

export const createCourseStudent = asyncHandler(async (req, res) => {
  const { studentId, name, email = "", phone = "", sessionName, department, batch, section, courseName = "" } = req.body;

  if (req.teacher.role === "admin") {
    throw ApiError.forbidden("Personal enrollment is only available to assigned teachers");
  }

  // A teacher may only personally enroll into a course they are assigned to
  const isAssigned = (req.teacher.assignments || []).some(
    (a) =>
      a.sessionName === sessionName &&
      a.department === department &&
      a.batch === batch &&
      a.section === section &&
      (a.courseName || "") === (courseName || "")
  );
  if (!isAssigned) throw ApiError.forbidden("You are not assigned to this course");

  try {
    const student = await CourseStudent.create({
      studentId: String(studentId).trim(),
      name: String(name).trim(),
      email,
      phone,
      sessionName,
      department,
      batch,
      section,
      courseName,
      enrolledBy: req.teacher._id,
    });
    return sendOk(res, { student }, "Student personally enrolled", 201);
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict("This roll ID is already personally enrolled in this course");
    }
    throw err;
  }
});

export const updateCourseStudent = asyncHandler(async (req, res) => {
  const student = await CourseStudent.findById(req.params.id);
  if (!student) throw ApiError.notFound("Personal student not found");

  if (String(student.enrolledBy) !== String(req.teacher._id)) {
    throw ApiError.forbidden("You can only edit students you enrolled yourself");
  }

  const allowed = ["studentId", "name", "email", "phone"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) student[key] = req.body[key];
  }

  try {
    await student.save();
  } catch (err) {
    if (err.code === 11000) {
      throw ApiError.conflict("This roll ID is already personally enrolled in this course");
    }
    throw err;
  }

  return sendOk(res, { student }, "Student updated");
});

export const deleteCourseStudent = asyncHandler(async (req, res) => {
  const existing = await CourseStudent.findById(req.params.id);
  if (!existing) throw ApiError.notFound("Personal student not found");

  if (String(existing.enrolledBy) !== String(req.teacher._id)) {
    throw ApiError.forbidden("You can only remove students you enrolled yourself");
  }

  await existing.deleteOne();
  return sendOk(res, null, "Student removed");
});
