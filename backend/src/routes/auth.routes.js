import { Router } from "express";
import { body } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { authLimiter } from "../middleware/rateLimit.middleware.js";
import { getSetupStatus, signup, signin, refreshToken, signout, me, updateProfile } from "../controllers/auth.controller.js";

const router = Router();

router.get("/setup-status", getSetupStatus);

router.post(
  "/signup",
  authLimiter,
  [
    body("name").trim().notEmpty().withMessage("Name is required").isLength({ max: 100 }),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  signup
);

router.post(
  "/signin",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  signin
);

router.post("/refresh-token", refreshToken);
router.post("/signout", requireAuth, signout);
router.get("/me", requireAuth, me);
router.put("/profile", requireAuth, updateProfile);

export default router;
