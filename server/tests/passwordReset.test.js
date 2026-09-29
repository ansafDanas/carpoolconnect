import { describe, expect, it } from "vitest";
import request from "supertest";

import {
  PasswordResetToken,
  User,
  app,
  createdUserIds,
  makeUniqueEmail,
} from "./setup.js";
import {
  createPasswordResetToken,
  findValidResetToken,
  hashResetToken,
} from "../services/passwordResetService.js";

const createUser = async (overrides = {}) => {
  const email = makeUniqueEmail("reset");
  const user = await User.create({
    name: "Reset Tester",
    email,
    password: "originalpass123",
    roles: ["passenger"],
    ...overrides,
  });

  createdUserIds.push(user._id);
  return user;
};

const extractToken = (resetUrl) => new URL(resetUrl).searchParams.get("token");

describe("Password reset API", () => {
  it("never reveals whether an email belongs to an account", async () => {
    const known = await createUser();

    const knownResponse = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: known.email });

    const unknownResponse = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: makeUniqueEmail("nobody") });

    expect(knownResponse.status).toBe(200);
    expect(unknownResponse.status).toBe(200);
    // Identical messaging is what closes the enumeration route.
    expect(unknownResponse.body.message).toBe(knownResponse.body.message);
  });

  it("rejects a malformed email address", async () => {
    const response = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: "not-an-email" });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/valid email/i);
  });

  it("issues a single-use token that updates the password and allows login", async () => {
    const user = await createUser();

    const start = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });

    const token = extractToken(start.body.devResetUrl);
    expect(token).toBeTruthy();

    const reset = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "brandnewpass456", confirmPassword: "brandnewpass456" });

    expect(reset.status).toBe(200);

    const oldLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "originalpass123" });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "brandnewpass456" });
    expect(newLogin.status).toBe(200);
    expect(newLogin.body.token).toBeTruthy();
  });

  it("rejects a reset token that is reused", async () => {
    const user = await createUser();
    const { token } = await createPasswordResetToken(user._id);

    const first = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "firstpass123", confirmPassword: "firstpass123" });
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "secondpass123", confirmPassword: "secondpass123" });

    expect(second.status).toBe(400);
    expect(second.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects an expired reset token", async () => {
    const user = await createUser();
    const { token } = await createPasswordResetToken(user._id, { ttlMs: -1000 });

    expect(await findValidResetToken(token)).toBeNull();

    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "expiredpass1", confirmPassword: "expiredpass1" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects an unknown reset token", async () => {
    const response = await request(app)
      .post("/api/auth/reset-password")
      .send({
        token: "0".repeat(64),
        password: "whatever123",
        confirmPassword: "whatever123",
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_RESET_TOKEN");
  });

  it("rejects a missing token and mismatched or short passwords", async () => {
    const missing = await request(app)
      .post("/api/auth/reset-password")
      .send({ password: "abcdef123", confirmPassword: "abcdef123" });
    expect(missing.status).toBe(400);

    const user = await createUser();
    const { token } = await createPasswordResetToken(user._id);

    const mismatch = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "abcdef123", confirmPassword: "different123" });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.message).toMatch(/do not match/i);

    const tooShort = await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "abc", confirmPassword: "abc" });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.message).toMatch(/at least 6/i);
  });

  it("stores only a hash of the token, never the token itself", async () => {
    const user = await createUser();
    const { token } = await createPasswordResetToken(user._id);

    const stored = await PasswordResetToken.findOne({ user: user._id });

    expect(stored.tokenHash).toBe(hashResetToken(token));
    expect(stored.tokenHash).not.toBe(token);
    // The raw token must not be recoverable from the stored document.
    expect(JSON.stringify(stored.toObject())).not.toContain(token);
  });

  it("invalidates earlier tokens when a new one is issued", async () => {
    const user = await createUser();
    const first = await createPasswordResetToken(user._id);
    const second = await createPasswordResetToken(user._id);

    expect(await findValidResetToken(first.token)).toBeNull();
    expect(await findValidResetToken(second.token)).not.toBeNull();
  });

  it("refuses to issue a reset token for a suspended account", async () => {
    const user = await createUser({
      isSuspended: true,
      suspendedReason: "Under review",
    });

    const start = await request(app)
      .post("/api/auth/forgot-password")
      .send({ email: user.email });
    expect(start.status).toBe(200);

    const grants = await PasswordResetToken.countDocuments({ user: user._id });
    expect(grants).toBe(0);
  });

  it("clears every outstanding grant once a password is reset", async () => {
    const user = await createUser();
    const { token } = await createPasswordResetToken(user._id);

    await request(app)
      .post("/api/auth/reset-password")
      .send({ token, password: "clearedpass1", confirmPassword: "clearedpass1" });

    expect(await PasswordResetToken.countDocuments({ user: user._id })).toBe(0);
  });
});
