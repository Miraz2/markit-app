import mongoose from "mongoose";

const userCredentialSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    credentialID: { type: String, required: true },
    credentialPublicKey: { type: String, required: true },
    counter: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },

    lastScanAt: { type: Date, default: null },
    lastScanKey: { type: String, default: null, index: true },
  },
  { timestamps: false }
);

userCredentialSchema.index({ credentialID: 1 }, { unique: true });
userCredentialSchema.index({ student: 1, credentialID: 1 }, { unique: true });
userCredentialSchema.index({ lastScanKey: 1, lastScanAt: -1 });

export default mongoose.model("UserCredential", userCredentialSchema);
