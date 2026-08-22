import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    batch: { type: String, required: true, trim: true, maxlength: 50 },
    section: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// A studentId must be unique within its department+batch+section, not globally —
// two departments may legitimately reuse the same roll numbering.
studentSchema.index(
  { studentId: 1, department: 1, batch: 1, section: 1 },
  { unique: true }
);
studentSchema.index({ department: 1, batch: 1, section: 1, isActive: 1 });

export default mongoose.model("Student", studentSchema);
