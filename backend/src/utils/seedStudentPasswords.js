import mongoose from "mongoose";
import Student from "../models/Student.js";
import { env } from "../config/env.js";
import { getDefaultStudentPasswordHash } from "./studentDefaults.js";

// One-off migration: gives every student without a password the shared
// temporary password so they can sign in to the portal.
//   node src/utils/seedStudentPasswords.js
async function run() {
  try {
    await mongoose.connect(env.mongoUri);
    const hash = await getDefaultStudentPasswordHash();

    const result = await Student.updateMany(
      { $or: [{ passwordHash: null }, { passwordHash: { $exists: false } }] },
      { $set: { passwordHash: hash, mustChangePassword: true } }
    );

    console.log(`Seeded temporary passwords for ${result.modifiedCount} student(s).`);
    if (result.matchedCount !== result.modifiedCount) {
      console.log(`${result.matchedCount - result.modifiedCount} student(s) already had a password and were left untouched.`);
    }
    console.log("Students should change their password after first sign-in.");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
