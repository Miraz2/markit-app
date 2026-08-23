import { ApiError } from "./ApiError.js";

const PROFILE_IMAGE_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=\s]+$/;
const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024; // 1MB decoded

// Shared by teacher/admin and student accounts — images are stored inline as
// data URLs so uploads survive on serverless filesystems.
export function validateProfileImage(value) {
  if (!PROFILE_IMAGE_RE.test(String(value))) {
    throw ApiError.badRequest("Profile image must be a PNG, JPG or WebP image");
  }
  const base64 = String(value).split(",")[1] || "";
  if (Buffer.byteLength(base64, "base64") > MAX_PROFILE_IMAGE_BYTES) {
    throw ApiError.badRequest("Image is too large. Please choose one under 1MB.");
  }
}
