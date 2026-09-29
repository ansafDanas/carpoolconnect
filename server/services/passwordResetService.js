import crypto from "node:crypto";

import PasswordResetToken, { hashResetToken } from "../models/PasswordResetToken.js";

// One hour is long enough to be usable and short enough to limit exposure.
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Issue a fresh single-use reset grant for a user.
 *
 * Any previously issued, unused grants for the same account are deleted
 * first, so only the most recent emailed link can ever be redeemed.
 *
 * @returns {{ token: string, expiresAt: Date }}
 */
export const createPasswordResetToken = async (userId, { ttlMs = RESET_TOKEN_TTL_MS } = {}) => {
  await PasswordResetToken.deleteMany({ user: userId, usedAt: null });

  // 256 bits of entropy from a CSPRNG. The token is only ever emailed.
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);

  await PasswordResetToken.create({
    user: userId,
    tokenHash: hashResetToken(token),
    expiresAt,
  });

  return { token, expiresAt };
};

/**
 * Look up a valid, unused, unexpired grant for a raw token.
 *
 * @returns the token document, or null. Returning null deliberately keeps
 *          "unknown", "expired" and "already used" indistinguishable to a
 *          caller, which avoids turning this endpoint into a token oracle.
 */
export const findValidResetToken = async (token) => {
  if (typeof token !== "string" || !token.trim()) {
    return null;
  }

  const record = await PasswordResetToken.findOne({
    tokenHash: hashResetToken(token.trim()),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  return record || null;
};

/**
 * Atomically claim a grant so two concurrent redemptions cannot both succeed.
 * Returns the consumed document, or null if it was already used or expired.
 */
export const consumeResetToken = async (tokenId) => {
  if (!tokenId) {
    return null;
  }

  return PasswordResetToken.findOneAndUpdate(
    { _id: tokenId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" }
  );
};

/** Remove all outstanding grants for an account. */
export const revokeAllResetTokens = async (userId) =>
  PasswordResetToken.deleteMany({ user: userId });

export { PasswordResetToken, hashResetToken };
