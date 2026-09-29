import mongoose from "mongoose";
import crypto from "node:crypto";

/**
 * A single-use password reset grant.
 *
 * Security properties this schema is responsible for:
 *  - Only a SHA-256 hash of the token is stored, never the token itself, so a
 *    database leak cannot be turned into account takeover.
 *  - expiresAt is enforced by MongoDB's TTL index, not only by app checks.
 *  - usedAt records the moment of redemption, which makes reuse detectable
 *    and auditable.
 */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Hard expiry at the database level, so an unused grant is deleted on its own.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const hashResetToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

const PasswordResetToken = mongoose.model(
  "PasswordResetToken",
  passwordResetTokenSchema
);

export default PasswordResetToken;
