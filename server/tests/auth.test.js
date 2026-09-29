import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, createdUserIds, makeUniqueEmail } from "./setup.js";

describe("Authentication API", () => {
  it("POST /api/auth/register with valid data returns 201", async () => {
    const email = makeUniqueEmail("register");

    const response = await request(app).post("/api/auth/register").send({
      name: "Test Driver",
      email,
      password: "secret123",
      role: "driver",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeTruthy();
    expect(response.body.data.email).toBe(email);

    const createdUser = await User.findOne({ email });
    expect(createdUser).not.toBeNull();
    createdUserIds.push(createdUser._id);
  });

  it.each([
    ["missing name", { email: makeUniqueEmail("missing-name"), password: "secret123" }],
    ["missing email", { name: "Missing Email", password: "secret123" }],
    ["missing password", { name: "Missing Password", email: makeUniqueEmail("missing-password") }],
    ["malformed email", { name: "Malformed Email", email: "not-an-email", password: "secret123" }],
    ["short password", { name: "Short Password", email: makeUniqueEmail("short-password"), password: "12345" }],
    ["short name", { name: "A", email: makeUniqueEmail("short-name"), password: "secret123" }],
    ["long name", { name: "N".repeat(51), email: makeUniqueEmail("long-name"), password: "secret123" }],
  ])("POST /api/auth/register rejects %s with a controlled 400", async (_label, payload) => {
    const response = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBeTruthy();
  });

  it("POST /api/auth/register hashes the password and normalizes unsupported roles", async () => {
    const email = makeUniqueEmail("register-role-safety");

    const response = await request(app).post("/api/auth/register").send({
      name: "Role Safety User",
      email,
      password: "secret123",
      roles: ["admin"],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.roles).toEqual(["passenger"]);

    const createdUser = await User.findOne({ email }).select("+password");
    createdUserIds.push(createdUser._id);

    expect(createdUser.password).not.toBe("secret123");
    expect(await createdUser.matchPassword("secret123")).toBe(true);
  });

  it("POST /api/auth/register rejects duplicate email with a 400 response", async () => {
    const email = makeUniqueEmail("duplicate");

    await request(app).post("/api/auth/register").send({
      name: "First User",
      email,
      password: "secret123",
      role: "rider",
    });

    const response = await request(app).post("/api/auth/register").send({
      name: "Second User",
      email,
      password: "secret123",
      role: "rider",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/user already exists|already exists/i);
  });

  it("POST /api/auth/login succeeds for a passenger with email + password only", async () => {
    const email = makeUniqueEmail("login-passenger");
    const password = "secret123";

    const created = await User.create({
      name: "Passenger Login User",
      email,
      password,
      roles: ["passenger"],
    });
    createdUserIds.push(created._id);

    const response = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.token).toBeTruthy();
    expect(response.body.data.email).toBe(email);
    expect(response.body.data.roles).toEqual(expect.arrayContaining(["passenger"]));
  });

  it("POST /api/auth/login succeeds for a driver with email + password only", async () => {
    const email = makeUniqueEmail("login-driver");
    const password = "secret123";

    const created = await User.create({
      name: "Driver Login User",
      email,
      password,
      roles: ["driver"],
    });
    createdUserIds.push(created._id);

    const response = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.roles).toEqual(expect.arrayContaining(["driver"]));
  });

  it("POST /api/auth/login succeeds for an admin with email + password only", async () => {
    const email = makeUniqueEmail("login-admin");
    const password = "secret123";

    const created = await User.create({
      name: "Admin Login User",
      email,
      password,
      roles: ["admin"],
    });
    createdUserIds.push(created._id);

    const response = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.roles).toEqual(expect.arrayContaining(["admin"]));
  });

  it("POST /api/auth/login rejects incorrect password with 401 and ignores any supplied client role", async () => {
    const email = makeUniqueEmail("wrong-password");

    const created = await User.create({
      name: "Bad Password User",
      email,
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(created._id);

    const response = await request(app).post("/api/auth/login").send({
      email,
      password: "wrong-password",
      role: "driver",
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/invalid email or password/i);
  });

  it.each([
    ["missing email", { password: "secret123" }],
    ["missing password", { email: makeUniqueEmail("missing-login-password") }],
    ["empty credentials", { email: "", password: "" }],
  ])("POST /api/auth/login rejects %s with 401", async (_label, payload) => {
    const response = await request(app).post("/api/auth/login").send(payload);

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/invalid email or password/i);
  });

  it("POST /api/auth/login does not allow a client-supplied role to override stored roles", async () => {
    const passengerUser = await User.create({
      name: "Role Passenger",
      email: makeUniqueEmail("role-passenger"),
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(passengerUser._id);

    const driverUser = await User.create({
      name: "Role Driver",
      email: makeUniqueEmail("role-driver"),
      password: "secret123",
      roles: ["driver"],
    });
    createdUserIds.push(driverUser._id);

    const passengerLogin = await request(app).post("/api/auth/login").send({
      email: passengerUser.email,
      password: "secret123",
      role: "driver",
    });
    expect(passengerLogin.status).toBe(200);
    expect(passengerLogin.body.data.roles).toEqual(["passenger"]);
    expect(passengerLogin.body.data.roles).not.toContain("driver");

    const driverLogin = await request(app).post("/api/auth/login").send({
      email: driverUser.email,
      password: "secret123",
      role: "admin",
    });
    expect(driverLogin.status).toBe(200);
    expect(driverLogin.body.data.roles).toEqual(["driver"]);
    expect(driverLogin.body.data.roles).not.toContain("admin");
  });

  it("preserves multi-role accounts and admin authorization still depends on stored roles", async () => {
    const passengerUser = await User.create({
      name: "Normal Passenger",
      email: makeUniqueEmail("normal-passenger"),
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(passengerUser._id);

    const driverUser = await User.create({
      name: "Normal Driver",
      email: makeUniqueEmail("normal-driver"),
      password: "secret123",
      roles: ["driver"],
    });
    createdUserIds.push(driverUser._id);

    const passengerToken = (await request(app).post("/api/auth/login").send({
      email: passengerUser.email,
      password: "secret123",
      role: "driver",
    })).body.token;

    const driverToken = (await request(app).post("/api/auth/login").send({
      email: driverUser.email,
      password: "secret123",
      role: "admin",
    })).body.token;

    const passengerAdminResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${passengerToken}`);
    expect(passengerAdminResponse.status).toBe(403);

    const driverAdminResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${driverToken}`);
    expect(driverAdminResponse.status).toBe(403);

    const adminUser = await User.create({
      name: "Admin User",
      email: makeUniqueEmail("admin-user"),
      password: "secret123",
      roles: ["driver", "admin"],
    });
    createdUserIds.push(adminUser._id);

    const adminLogin = await request(app).post("/api/auth/login").send({
      email: adminUser.email,
      password: "secret123",
      role: "passenger",
    });
    expect(adminLogin.status).toBe(200);
    expect(adminLogin.body.data.roles).toEqual(expect.arrayContaining(["driver", "admin"]));

    const adminResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminLogin.body.token}`);

    expect(adminResponse.status).toBe(200);
  });

  it("JWT payload is user-id based and protect middleware still loads the current user", async () => {
    const email = makeUniqueEmail("jwt");
    const user = await User.create({
      name: "JWT User",
      email,
      password: "secret123",
      roles: ["driver"],
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);
    const decoded = jwt.decode(token);

    expect(decoded).toMatchObject({ id: user._id.toString() });
    expect(decoded).not.toHaveProperty("role");
    expect(decoded).not.toHaveProperty("roles");

    const response = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(email);
  });

  it("GET /api/users/me rejects an expired JWT with 401", async () => {
    const user = await User.create({
      name: "Expired Token User",
      email: makeUniqueEmail("expired-token"),
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(user._id);

    const expiredToken = jwt.sign(
      { id: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );

    const response = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/not authorized/i);
  });

  it("Protected endpoint rejects missing or invalid authentication token with 401", async () => {
    const noTokenResponse = await request(app).get("/api/users/me");
    expect(noTokenResponse.status).toBe(401);

    const invalidTokenResponse = await request(app)
      .get("/api/users/me")
      .set("Authorization", "Bearer invalid-token");

    expect(invalidTokenResponse.status).toBe(401);
  });
});
