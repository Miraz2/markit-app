import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const assignmentSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "AcademicSession", required: true },
    sessionName: { type: String, required: true }, // cached for easy querying e.g. "Summer-26"
    department: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    courseName: { type: String, trim: true, default: "" },
  },
  { _id: true }
);

const teacherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    passwordHash: { type: String, required: true, select: false },
    designation: { type: String, trim: true, maxlength: 100, default: "" },
    department: { type: String, trim: true, maxlength: 100, default: "" },
    role: { type: String, enum: ["teacher", "admin"], default: "teacher" },

    assignments: { type: [assignmentSchema], default: [] },

    isVerified: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },

    refreshTokenHash: { type: String, select: false, default: null },
    rememberMe: { type: Boolean, default: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

teacherSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

teacherSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

teacherSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    _id: this._id,
    name: this.name,
    email: this.email,
    designation: this.designation,
    department: this.department,
    role: this.role,
    assignments: this.assignments || [],
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Teacher", teacherSchema);
