import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SESSION_COOKIE } from "../utils/cookies.js";

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) throw new ApiError(401, "Authentication required");

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new ApiError(401, "Session is invalid or expired");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, "User account no longer exists");
  req.user = user;
  next();
});
