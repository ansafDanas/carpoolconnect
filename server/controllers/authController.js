import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import validator from "validator";

import { sendPasswordResetEmail } from "../services/emailService.js";
import {
  RESET_TOKEN_TTL_MS,
  consumeResetToken,
  createPasswordResetToken,
  findValidResetToken,
  revokeAllResetTokens,
} from "../services/passwordResetService.js";

// Optional, self-declared profile fields accepted at registration.
// Anything not listed here is ignored, so this can never be used to
// escalate roles.
const PROFILE_FIELDS = [
  "bio",
  "conversationStarter",
  "vibeTags",
  "languages",
  "gender",
  "womenOnly",
];

export const registerUser = async (
  req,
  res
) => {
  try {
    if (!req.body || typeof req.body !== "object") {
      return res.status(400).json({
        success: false,
        message: "Registration data is required",
      });
    }

    const { name, email, password, role, roles } = req.body;
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedName) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    if (normalizedName.length < 2 || normalizedName.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 2 and 50 characters",
      });
    }

    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email",
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const requestedRoles = Array.isArray(roles) ? roles : [role];
    const normalizedRoles = [
      ...new Set(
        requestedRoles
          .map((requestedRole) =>
            requestedRole === "rider" ? "passenger" : requestedRole
          )
          .filter((requestedRole) =>
            ["passenger", "driver"].includes(requestedRole)
          )
      ),
    ];

    const userExists =
      await User.findOne({ email: normalizedEmail });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message:
          "User already exists",
      });
    }

    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      password,
      roles: normalizedRoles.length ? normalizedRoles : ["passenger"],
      // Optional self-declared profile details, so a women-only preference
      // or language can be set at signup rather than after.
      ...(PROFILE_FIELDS.reduce((acc, field) => {
        if (req.body[field] !== undefined) {
          acc[field] = req.body[field];
        }
        return acc;
      }, {})),
    });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.roles.includes("driver") ? "driver" : "passenger",
        roles: user.roles,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while registering user",
    });
  }
};

export const loginUser = async (
  req,
  res
) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (typeof password !== "string" || password.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // A suspended account must not be able to start a session at all.
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message:
          user.suspendedReason ||
          "This account has been suspended. Contact support if you think this is a mistake.",
      });
    }

    const storedRoles = Array.isArray(user.roles) ? user.roles : [];
    const primaryRole = storedRoles.includes("admin")
      ? "admin"
      : storedRoles.includes("driver")
        ? "driver"
        : storedRoles.includes("passenger")
          ? "passenger"
          : storedRoles[0] || "passenger";

    return res.json({
      success: true,
      token: generateToken(user._id),
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: primaryRole,
        roles: storedRoles,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while logging in",
    });
  }
};

/**
 * Where the emailed link points. Falls back to a sane default so the flow
 * still works in development, and is fully controlled by an env var in
 * production rather than being derived from request headers.
 */
const resolveClientUrl = (req) => {
  const configured = process.env.CLIENT_URL || process.env.FRONTEND_URL;
  if (configured) {
    return configured.replace(/\/+$/, "");
  }
  return "http://localhost:5173";
};

/**
 * Returning the real reset link in the response is a development and test
 * convenience only. It is gated behind an explicit opt-in rather than
 * "anything that is not production", so a misconfigured staging environment
 * (NODE_ENV unset or "staging") can never leak a live token to a caller.
 */
const shouldExposeResetToken = () =>
  process.env.EXPOSE_RESET_TOKEN_IN_RESPONSE === "true";

/**
 * Start a password reset.
 *
 * Always responds 200 with the same message whether or not the address is
 * registered. That is deliberate: telling an anonymous caller which emails
 * exist would turn this into an account-enumeration oracle.
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body || {};
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    const GENERIC_RESPONSE = {
      success: true,
      message:
        "If an account exists for that email, a password reset link is on its way.",
    };

    if (!validator.isEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(200).json(GENERIC_RESPONSE);
    }

    // A suspended account cannot log in, so it cannot reset into a session
    // it would then be denied. Fail as if the account did not exist.
    if (user.isSuspended) {
      return res.status(200).json(GENERIC_RESPONSE);
    }

    const { token, expiresAt } = await createPasswordResetToken(user._id);
    const resetUrl = `${resolveClientUrl(req)}/reset-password?token=${token}`;

    // Email failure must not turn into a 500 that reveals the account exists.
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      expiresInMinutes: Math.round(RESET_TOKEN_TTL_MS / 60000),
    }).catch(() => null);

    return res.status(200).json({
      ...GENERIC_RESPONSE,
      // Explicitly opt-in only, so the link is never returned by accident in
      // an environment that was not deliberately configured for it.
      ...(shouldExposeResetToken()
        ? { devResetUrl: resetUrl, devExpiresAt: expiresAt }
        : {}),
    });
  } catch (error) {
    console.error("Request password reset error:", error.message);
    return res.status(500).json({
      success: false,
      message: "We could not start a password reset. Please try again.",
    });
  }
};

/**
 * Redeem a reset token and set a new password.
 *
 * The grant is claimed atomically before the password is written, so a
 * token can never be redeemed twice even under concurrent requests.
 */
export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: "This reset link is missing or invalid. Please request a new one.",
      });
    }

    if (typeof password !== "string" || typeof confirmPassword !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please enter and confirm your new password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "The two passwords do not match",
      });
    }

    const record = await findValidResetToken(token);

    if (!record) {
      // Unknown, expired and already-used all look the same on purpose.
      return res.status(400).json({
        success: false,
        code: "INVALID_RESET_TOKEN",
        message:
          "This reset link is no longer valid. It may have expired or already been used. Please request a new one.",
      });
    }

    const user = await User.findById(record.user);

    if (!user) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RESET_TOKEN",
        message:
          "This reset link is no longer valid. It may have expired or already been used. Please request a new one.",
      });
    }

    // Changing a password should not leave a suspended account able to log in.
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SUSPENDED",
        message:
          user.suspendedReason ||
          "This account has been suspended. Contact support if you think this is a mistake.",
      });
    }

    // Claim the grant first: a second concurrent request loses here.
    const consumed = await consumeResetToken(record._id);

    if (!consumed) {
      return res.status(400).json({
        success: false,
        code: "INVALID_RESET_TOKEN",
        message:
          "This reset link has already been used. Please request a new one.",
      });
    }

    // The pre-save hook re-hashes with a fresh salt.
    user.password = password;
    await user.save();

    // Nothing else should remain redeemable from the same request.
    await revokeAllResetTokens(user._id);

    return res.status(200).json({
      success: true,
      message:
        "Your password has been updated. You can now sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error.message);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Invalid password",
      });
    }

    return res.status(500).json({
      success: false,
      message: "We could not update your password. Please try again.",
    });
  }
};
