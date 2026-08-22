import mongoose from "mongoose";

const academicSessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true }, // e.g. "Summer-26", "Spring-26", "Fall-25"
    term: { type: String, required: true, enum: ["Spring", "Summer", "Fall"] },
    year: { type: String, required: true, trim: true }, // e.g. "26" or "2026"
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  },
  { timestamps: true }
);

// Middleware to ensure only one session is active at a time if isActive is true
academicSessionSchema.pre("save", async function (next) {
  if (this.isModified("isActive") && this.isActive) {
    await this.constructor.updateMany({ _id: { $ne: this._id } }, { isActive: false });
  }
  next();
});

export default mongoose.model("AcademicSession", academicSessionSchema);
