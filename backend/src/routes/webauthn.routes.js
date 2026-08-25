import { Router } from "express";
import { body, query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, requireStudent } from "../middleware/auth.middleware.js";
import {
  getClassQr,
  getRecentScans,
  closeClassQr,
  postRegisterOptions,
  postRegisterVerify,
  postAuthenticateOptions,
  postAuthenticateVerify,
} from "../controllers/webauthn.controller.js";

const router = Router();

// Teacher endpoints
router.get(
  "/class-qr",
  requireAuth,
  [
    query("latitude").optional().isFloat({ min: -90, max: 90 }),
    query("longitude").optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  getClassQr
);
router.post(
  "/class-qr/close",
  requireAuth,
  [body("ticketId").trim().notEmpty().withMessage("ticketId is required")],
  validate,
  closeClassQr
);
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
    body("ticket").trim().notEmpty().withMessage("ticket is required"),
    body("latitude").optional().isFloat({ min: -90, max: 90 }),
    body("longitude").optional().isFloat({ min: -180, max: 180 }),
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
