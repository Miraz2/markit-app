import mongoose from "mongoose";

// Binary blobs stored directly in MongoDB. Fine for small files (<16MB);
// the serverless filesystem cannot persist uploads, so the DB is the store.
const storedFileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true, select: false },
    size: { type: Number, default: 0 },
    public: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("StoredFile", storedFileSchema);
