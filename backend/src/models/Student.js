import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const studentSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true, trim: true, maxlength: 40 },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    batch: { type: String, required: true, trim: true, maxlength: 50 },
    section: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },

    // Stored as a data URL (base64) — same approach as teacher accounts.
    profileImage: { type: String, default: null },

    enrolledBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher", required: true },
    isActive: { type: Boolean, default: true },

    // Student portal credentials. Students cannot sign up; an admin enrolls
    // them and a shared temporary password is assigned until they change it.
    passwordHash: { type: String, select: false, default: null },
    mustChangePassword: { type: Boolean, select: false, default: false },

    refreshTokenHash: { type: String, select: false, default: null },
    prevRefreshTokenHash: { type: String, select: false, default: null },
    rememberMe: { type: Boolean, select: false, default: false },
    failedLoginAttempts: { type: Number, select: false, default: 0 },
    lockUntil: { type: Date, select: false, default: null },
    lastLoginAt: { type: Date, select: false, default: null },
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

studentSchema.methods.isLocked = function () {
  return Boolean(this.lockUntil && this.lockUntil > new Date());
};

studentSchema.methods.comparePassword = function (plain) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

studentSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    _id: this._id,
    studentId: this.studentId,
    name: this.name,
    department: this.department,
    batch: this.batch,
    section: this.section,
    email: this.email,
    phone: this.phone,
    profileImage: this.profileImage || null,
    mustChangePassword: Boolean(this.mustChangePassword),
    createdAt: this.createdAt,
  };
};

export default mongoose.model("Student", studentSchema);
