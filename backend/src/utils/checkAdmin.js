import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Teacher from "../models/Teacher.js";
import { env } from "../config/env.js";

async function check() {
  try {
    await mongoose.connect(env.mongoUri);
    const teachers = await Teacher.find({});
    console.log("=== USERS IN DATABASE ===");
    console.log("Total users:", teachers.length);
    teachers.forEach((t) => {
      console.log(`- Email: ${t.email} | Name: ${t.name} | Role: ${t.role}`);
    });
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

check();
