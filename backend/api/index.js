import app from "../src/app.js";
import { connectDB } from "../src/config/db.js";

let dbPromise;

export default async function handler(req, res) {
  if (!dbPromise) {
    dbPromise = connectDB();
  }
  await dbPromise;
  return app(req, res);
}