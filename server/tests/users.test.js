import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, createdUserIds, makeUniqueEmail } from "./setup.js";

describe("User profile API", () => {
  it("GET /api/users/me with valid JWT returns 200", async () => {
    const email = makeUniqueEmail("profile-get");
    const user = await User.create({
      name: "Profile User",
      email,
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);

    const response = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.email).toBe(email);
  });

  it("GET /api/users/me without JWT returns 401", async () => {
    const response = await request(app).get("/api/users/me");
    expect(response.status).toBe(401);
  });

  it("PATCH /api/users/me with valid JWT returns 200 and persists the update", async () => {
    const email = makeUniqueEmail("profile-patch");
    const user = await User.create({
      name: "Profile Patch User",
      email,
      password: "secret123",
      role: "driver",
      phone: "0000000000",
      vehicleInfo: {
        make: "Toyota",
        model: "Corolla",
        color: "Blue",
        plateNumber: "ABC123",
      },
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${token}`)
      .send({
        name: "Updated Profile User",
        phone: "9876543210",
        vehicleInfo: {
          make: "Honda",
          model: "Civic",
          color: "Red",
          plateNumber: "XYZ456",
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe("Updated Profile User");
    expect(response.body.data.phone).toBe("9876543210");

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.name).toBe("Updated Profile User");
    expect(refreshedUser.phone).toBe("9876543210");
    expect(refreshedUser.vehicleInfo.make).toBe("Honda");
    expect(refreshedUser.vehicleInfo.model).toBe("Civic");
    expect(refreshedUser.vehicleInfo.color).toBe("Red");
    expect(refreshedUser.vehicleInfo.plateNumber).toBe("XYZ456");
  });

  it("PATCH /api/users/me ignores role and roles escalation fields", async () => {
    const email = makeUniqueEmail("profile-role-mutation");
    const user = await User.create({
      name: "Profile Role User",
      email,
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);

    for (const payload of [
      { role: "admin", name: "Updated Role User" },
      { roles: ["admin"], phone: "9876543210" },
    ]) {
      const response = await request(app)
        .patch("/api/users/me")
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

      expect(response.status).toBe(200);
    }

    const refreshedUser = await User.findById(user._id);
    expect(refreshedUser.roles).toEqual(["passenger"]);
    expect(refreshedUser.role).toBeUndefined();
    expect(refreshedUser.name).toBe("Updated Role User");
    expect(refreshedUser.phone).toBe("9876543210");
  });
});
