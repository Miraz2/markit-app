import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, requireStudent } from "../middleware/auth.middleware.js";
import {
  getClassQr,
  getRecentScans,
  postRegisterOptions,
  postRegisterVerify,
  postAuthenticateOptions,
  postAuthenticateVerify,
} from "../controllers/webauthn.controller.js";

const router = Router();

// Teacher endpoints
router.get("/class-qr", requireAuth, getClassQr);
router.get("/recent-scans", requireAuth, getRecentScans);

// Student: one-time device registration
router.post("/register/options", requireStudent, postRegisterOptions);
router.post(
  "/register/verify",
  requireStudent,
  [body("response").notEmpty().withMessage("Missing WebAuthn response")],
  validate,
  postRegisterVerify
);

// Student: QR scan + biometric verification
router.post(
  "/authenticate/options",
  requireStudent,
  [
    body("classId").trim().notEmpty().withMessage("classId is required"),
    body("token").trim().notEmpty().withMessage("token is required"),
  ],
  validate,
  postAuthenticateOptions
);
router.post(
  "/authenticate/verify",
  requireStudent,
  [body("response").notEmpty().withMessage("Missing WebAuthn response")],
  validate,
  postAuthenticateVerify
);

export default router;
