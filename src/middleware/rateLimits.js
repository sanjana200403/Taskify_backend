import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.nodeEnv === "test" ? 10000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    errors: [],
  },
});
