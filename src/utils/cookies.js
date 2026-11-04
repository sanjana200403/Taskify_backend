import crypto from "node:crypto";
import { env } from "../config/env.js";

export const SESSION_COOKIE = "todo_session";
export const CSRF_COOKIE = "todo_csrf";

function cookieBaseOptions() {
  const production = env.nodeEnv === "production";
  return {
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
  };
}

function signCsrfToken(token) {
  return crypto.createHmac("sha256", env.cookieSecret).update(token).digest("hex");
}

export function issueAuthCookies(res, jwt) {
  res.cookie(SESSION_COOKIE, jwt, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  });
  return issueCsrfCookie(res);
}

export function issueCsrfCookie(res) {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const signedCsrf = `${csrfToken}.${signCsrfToken(csrfToken)}`;
  res.cookie(CSRF_COOKIE, signedCsrf, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
  });
  return csrfToken;
}

export function clearAuthCookies(res) {
  const options = cookieBaseOptions();
  res.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...options, httpOnly: true });
}

export function verifyCsrfToken(cookieValue, submittedToken) {
  if (!cookieValue || !submittedToken) return false;
  const [token, signature] = cookieValue.split(".");
  if (!token || !signature || token !== submittedToken) return false;
  const expected = signCsrfToken(token);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function readCsrfToken(cookieValue) {
  if (!cookieValue) return null;
  const [token] = cookieValue.split(".");
  return verifyCsrfToken(cookieValue, token) ? token : null;
}
