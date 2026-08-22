import mongoose from "mongoose";

// Students personally enrolled by a teacher into one of their assigned
// courses. These live OUTSIDE the main Student collection — only the
// enrolling teacher can edit/remove them; admins get read-only visibility.
const courseStudentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    // Course context — mirrors the teacher assignment shape
    sessionName: { type: String, required: true, trim: true }, // e.g. "Summer-26"
    department: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    courseName: { type: String, trim: true, default: "" },

    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
  },
  { timestamps: true }
);

// A teacher cannot enroll the same roll ID twice in the same course
courseStudentSchema.index(
  { enrolledBy: 1, sessionName: 1, department: 1, batch: 1, section: 1, courseName: 1, studentId: 1 },
  { unique: true }
);
courseStudentSchema.index({ sessionName: 1, department: 1, batch: 1, section: 1 });

export default mongoose.model("CourseStudent", courseStudentSchema);
