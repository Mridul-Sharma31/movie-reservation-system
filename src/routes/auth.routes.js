import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rateLimiter.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateCredentialsSchema,
} from "../validators/auth.validator.js";

const router = Router();

// Public routes (no login needed)

// Apply strict limiter to auth routes
router.post("/register", authLimiter, validate(registerSchema), registerUser);
router.post("/login", authLimiter, validate(loginSchema), loginUser);
router.post("/refresh-token", refreshAccessToken);
// Protected routes (must be logged in)
router.post("/logout", verifyJWT, logoutUser);

export default router;
