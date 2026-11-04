import { loginUser, registerUser } from "../services/authService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { clearAuthCookies, CSRF_COOKIE, issueAuthCookies, issueCsrfCookie, readCsrfToken } from "../utils/cookies.js";
import { successResponse } from "../utils/response.js";

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt };
}

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerUser(req.body);
  const csrfToken = issueAuthCookies(res, token);
  return successResponse(res, {
    statusCode: 201,
    message: "Account created successfully",
    data: { user: publicUser(user), csrfToken },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  const csrfToken = issueAuthCookies(res, token);
  return successResponse(res, { message: "Logged in successfully", data: { user: publicUser(user), csrfToken } });
});

export const me = asyncHandler(async (req, res) => {
  const csrfToken = readCsrfToken(req.cookies?.[CSRF_COOKIE]) || issueCsrfCookie(res);
  return successResponse(res, {
    message: "Current user loaded",
    data: { user: publicUser(req.user), csrfToken },
  });
});

export const logout = asyncHandler(async (_req, res) => {
  clearAuthCookies(res);
  return successResponse(res, { message: "Logged out successfully", data: null });
});
