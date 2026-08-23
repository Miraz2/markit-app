import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import StoredFile from "../models/StoredFile.js";
import { env } from "../config/env.js";

// Usage: node src/utils/uploadFile.js <filePath> [publicFilename]
const filePath = process.argv[2];
const publicName = process.argv[3] || path.basename(filePath || "");

if (!filePath || !fs.existsSync(filePath)) {
  console.error("Usage: node src/utils/uploadFile.js <filePath> [publicFilename]");
  process.exit(1);
}

const MIME = {
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

async function run() {
  try {
    await mongoose.connect(env.mongoUri);
    console.log("Connected to MongoDB");

    const data = fs.readFileSync(filePath);
    const ext = path.extname(publicName).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";

    await StoredFile.findOneAndUpdate(
      { filename: publicName },
      {
        filename: publicName,
        contentType,
        data,
        size: data.length,
        public: true,
      },
      { upsert: true, new: true }
    );

    console.log(`Uploaded "${publicName}" (${(data.length / 1024).toFixed(1)} KB)`);
    console.log(`Download URL: /api/files/${encodeURIComponent(publicName)}`);
    console.log(`Local dev URL: http://localhost:5000/api/files/${encodeURIComponent(publicName)}`);
    process.exit(0);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

run();
