import express from "express";
import {
  authLimiter,
  passwordResetLimiter,
} from "../middleware/rateLimitMiddleware.js";

import {
  loginUser,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "../controllers/authController.js";

const router = express.Router();

router.post(
  "/register",
  authLimiter,
  registerUser
);

router.post(
  "/login",
  authLimiter,
  loginUser
);

// Password recovery. Both endpoints are unauthenticated by necessity, so both
// are written to avoid revealing whether an address is registered.
router.post(
  "/forgot-password",
  passwordResetLimiter,
  requestPasswordReset
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  resetPassword
);

export default router;
