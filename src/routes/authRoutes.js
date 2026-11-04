import { Router } from "express";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import { authRateLimit } from "../middleware/rateLimits.js";
import { validate } from "../middleware/validate.js";
import { loginValidation, registerValidation } from "../validators/authValidators.js";

export const authRouter = Router();

authRouter.post("/register", authRateLimit, registerValidation, validate, register);
authRouter.post("/login", authRateLimit, loginValidation, validate, login);
authRouter.get("/me", requireAuth, me);
authRouter.post("/logout", requireAuth, requireCsrf, logout);
