import mongoose from "mongoose";

const recordSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
  },
  { _id: false }
);

const attendanceSessionSchema = new mongoose.Schema(
  {
    date: { type: String, required: true }, // YYYY-MM-DD
    academicSession: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession" },
    sessionName: { type: String, trim: true, default: "" }, // e.g. "Summer-26"
    department: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    courseName: { type: String, trim: true, default: "" },

    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    records: { type: [recordSchema], default: [] },
  },
  { timestamps: true }
);

attendanceSessionSchema.index(
  { date: 1, department: 1, batch: 1, section: 1, courseName: 1 },
  { unique: true }
);

attendanceSessionSchema.virtual("presentCount").get(function () {
  return this.records.filter((r) => r.status === "present").length;
});
attendanceSessionSchema.virtual("absentCount").get(function () {
  return this.records.filter((r) => r.status === "absent").length;
});

attendanceSessionSchema.set("toJSON", { virtuals: true });

export default mongoose.model("AttendanceSession", attendanceSessionSchema);
