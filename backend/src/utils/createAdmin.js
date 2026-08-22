import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

import Teacher from "../models/Teacher.js";
import { env } from "../config/env.js";

async function run() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Connected to MongoDB");

    // 1. Promote existing user 'miraz@gmail.com' to admin if exists
    const miraz = await Teacher.findOne({ email: "miraz@gmail.com" });
    if (miraz) {
      miraz.role = "admin";
      await miraz.save();
      console.log("Promoted miraz@gmail.com to Admin!");
    }

    // 2. Also ensure dedicated admin account exists
    const adminEmail = "admin@bu.edu";
    let admin = await Teacher.findOne({ email: adminEmail });
    if (!admin) {
      const passwordHash = await bcrypt.hash("Admin123456", 12);
      admin = await Teacher.create({
        name: "System Administrator",
        email: adminEmail,
        passwordHash,
        role: "admin",
        department: "Administration",
        designation: "Super Admin",
      });
      console.log(`Created default Admin account: ${adminEmail} (password: Admin123456)`);
    } else {
      admin.role = "admin";
      await admin.save();
      console.log(`Admin account ${adminEmail} is active.`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
