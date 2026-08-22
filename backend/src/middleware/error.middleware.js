import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// Must be registered LAST. Never leaks stack traces outside development.
export function errorHandler(err, req, res, next) {
  let error = err;

  // Translate common Mongoose errors into clean ApiErrors
  if (err.name === "ValidationError") {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest("Validation failed", details);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {}).join(", ") || "field";
    error = ApiError.conflict(`A record with this ${field} already exists`);
  } else if (err.name === "CastError") {
    error = ApiError.badRequest("Invalid identifier supplied");
  } else if (!err.isApiError) {
    error = ApiError.internal(env.nodeEnv === "development" ? err.message : "Something went wrong");
  }

  if (env.nodeEnv === "development" && !err.isApiError) {
    console.error(err);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details,
    ...(env.nodeEnv === "development" ? { stack: err.stack } : {}),
  });
}
