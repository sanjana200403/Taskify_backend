import mongoose from "mongoose";

export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}`, errors: [] });
}

export function errorHandler(error, _req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error";
  let errors = error.errors || [];

  if (error instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
  }

  if (error?.code === 11000) {
    statusCode = 409;
    message = "A record with that value already exists";
    errors = Object.keys(error.keyPattern || {}).map((field) => ({ field, message: `${field} must be unique` }));
  }

  const payload = { success: false, message, errors };
  if (process.env.NODE_ENV !== "production" && statusCode === 500) payload.stack = error.stack;
  res.status(statusCode).json(payload);
}
