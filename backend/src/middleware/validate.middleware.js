import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

// Runs after an array of express-validator checks; short-circuits with a
// 400 + field-level details if any check failed.
export function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({
    field: e.path,
    message: e.msg,
  }));
  next(ApiError.badRequest("Validation failed", details));
}
