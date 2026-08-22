import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Teacher from "../models/Teacher.js";
import AttendanceSession from "../models/AttendanceSession.js";
import { env } from "../config/env.js";

// One-time migration: courseCode was merged into courseName.
// Copies legacy courseCode values into empty courseName fields, then removes courseCode.
async function run() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Connected to MongoDB");

    const teachers = await Teacher.updateMany(
      { "assignments.courseCode": { $exists: true } },
      [
        {
          $set: {
            assignments: {
              $map: {
                input: "$assignments",
                as: "a",
                in: {
                  $mergeObjects: [
                    "$$a",
                    {
                      courseName: {
                        $cond: [
                          { $eq: [{ $ifNull: ["$$a.courseName", ""] }, ""] },
                          { $ifNull: ["$$a.courseCode", ""] },
                          "$$a.courseName",
                        ],
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        { $unset: ["assignments.courseCode"] },
      ]
    );
    console.log(`Teachers updated: ${teachers.modifiedCount}`);

    const sessions = await AttendanceSession.updateMany(
      { courseCode: { $exists: true } },
      [
        {
          $set: {
            courseName: {
              $cond: [
                { $eq: [{ $ifNull: ["$courseName", ""] }, ""] },
                { $ifNull: ["$courseCode", ""] },
                "$courseName",
              ],
            },
          },
        },
        { $unset: ["courseCode"] },
      ]
    );
    console.log(`Attendance sessions updated: ${sessions.modifiedCount}`);

    console.log("Migration complete");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
