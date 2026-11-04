import { ApiError } from "../utils/ApiError.js";
import { CSRF_COOKIE, verifyCsrfToken } from "../utils/cookies.js";

export function requireCsrf(req, _res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const valid = verifyCsrfToken(req.cookies?.[CSRF_COOKIE], req.get("x-csrf-token"));
  if (!valid) return next(new ApiError(403, "Invalid CSRF token"));
  next();
}
