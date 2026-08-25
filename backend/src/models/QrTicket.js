import mongoose from "mongoose";

// Short-lived opaque tickets behind the projected dynamic QR. The id doubles
// as the primary key so every scan is a single indexed read; MongoDB's TTL
// sweeper plus the explicit expiry check on read handle cleanup.
const qrTicketSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  ctx: {
    department: { type: String, required: true },
    batch: { type: String, required: true },
    section: { type: String, required: true },
    courseName: { type: String, default: "" },
    date: { type: String, required: true },
  },
  expiresAt: { type: Date, required: true },
});

qrTicketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const QrTicket = mongoose.model("QrTicket", qrTicketSchema);
export default QrTicket;
