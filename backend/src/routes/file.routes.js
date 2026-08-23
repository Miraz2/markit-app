import { Router } from "express";
import { param } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth, requireRole } from "../middleware/auth.middleware.js";
import { downloadFile, listFiles } from "../controllers/file.controller.js";

const router = Router();

// Public: serves only files explicitly flagged public (e.g. the presentation)
router.get(
  "/:filename",
  [param("filename").trim().notEmpty().isLength({ max: 200 })],
  validate,
  downloadFile
);

// Authenticated inventory of stored files
router.get("/", requireAuth, requireRole("admin"), listFiles);

export default router;
