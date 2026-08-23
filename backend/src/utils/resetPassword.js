import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Teacher from "../models/Teacher.js";
import { env } from "../config/env.js";

const email = process.argv[2]?.toLowerCase();
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("Usage: node src/utils/resetPassword.js <email> <newPassword>");
  process.exit(1);
}

async function run() {
  try {
    await mongoose.connect(env.mongoUri);
    const teacher = await Teacher.findOne({ email }).select("+passwordHash");
    if (!teacher) {
      console.log(`No account found for ${email}`);
      process.exit(1);
    }
    teacher.passwordHash = await bcrypt.hash(newPassword, 12);
    teacher.failedLoginAttempts = 0;
    teacher.lockUntil = null;
    await teacher.save();
    console.log(`Password reset OK for ${email}. Account unlocked.`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
