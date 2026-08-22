import mongoose from "mongoose";

// University course catalog. Documents are managed externally (seeded into
// the "courses" collection), so the schema only maps what we read.
const courseSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // e.g. "SOC-4102"
    department: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
  },
  { collection: "courses", versionKey: false }
);

courseSchema.index({ department: 1 });

export default mongoose.model("Course", courseSchema);
