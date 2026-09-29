import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, Ride, createdUserIds, createdRideIds, makeUniqueEmail } from "./setup.js";

describe("Ride API", () => {
  it("authenticated user can create a ride", async () => {
    const email = makeUniqueEmail("ride-create");
    const user = await User.create({
      name: "Ride Creator",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);
    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: `Route-${Math.random().toString(16).slice(2, 8)}`,
        destination: `City-${Math.random().toString(16).slice(2, 8)}`,
        date: new Date(Date.now() + 3600000).toISOString(),
        seatsAvailable: 3,
        price: 250,
        vehicle: "Sedan",
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/ride created successfully/i);
    expect(response.body.ride.driver.toString()).toBe(user._id.toString());
    createdRideIds.push(response.body.ride._id);
  });

  it("invalid ride data is rejected", async () => {
    const email = makeUniqueEmail("ride-invalid");
    const user = await User.create({
      name: "Ride Invalid User",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const token = generateToken(user._id);
    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "",
        destination: "",
        date: "",
        seatsAvailable: undefined,
        price: undefined,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/provide all required ride details/i);
  });

  it.each([
    ["invalid source type", { source: 123, destination: "Destination" }],
    ["invalid destination type", { source: "Source", destination: 123 }],
    ["invalid date", { source: "Source", destination: "Destination", date: "not-a-date" }],
    ["fractional seats", { source: "Source", destination: "Destination", seatsAvailable: 1.5 }],
    ["zero seats", { source: "Source", destination: "Destination", seatsAvailable: 0 }],
    ["negative seats", { source: "Source", destination: "Destination", seatsAvailable: -1 }],
    ["invalid price", { source: "Source", destination: "Destination", price: "free" }],
    ["negative price", { source: "Source", destination: "Destination", price: -1 }],
    ["invalid vehicle type", { source: "Source", destination: "Destination", vehicle: 123 }],
    ["excessive source length", { source: "S".repeat(101), destination: "Destination" }],
    ["excessive vehicle length", { source: "Source", destination: "Destination", vehicle: "V".repeat(101) }],
  ])("invalid ride input: %s returns 400", async (_label, overrides) => {
    const user = await User.create({
      name: "Ride Validation User",
      email: makeUniqueEmail("ride-validation"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({
        source: "Source",
        destination: "Destination",
        date: new Date(Date.now() + 3600000).toISOString(),
        seatsAvailable: 2,
        price: 100,
        vehicle: "Car",
        ...overrides,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toBeTruthy();
  });

  it("GET /api/rides returns rides", async () => {
    const email = makeUniqueEmail("ride-list");
    const user = await User.create({
      name: "Ride List User",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const ride = await Ride.create({
      driver: user._id,
      source: `List-${Math.random().toString(16).slice(2, 8)}`,
      destination: `Dest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 7200000),
      seatsAvailable: 2,
      price: 300,
      vehicle: "SUV",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const response = await request(app).get("/api/rides");

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);
    expect(response.body.rides.some((item) => item._id.toString() === ride._id.toString())).toBe(true);
  });

  it("GET /api/rides/:id returns the correct ride", async () => {
    const email = makeUniqueEmail("ride-read");
    const user = await User.create({
      name: "Ride Reader",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const ride = await Ride.create({
      driver: user._id,
      source: `Read-${Math.random().toString(16).slice(2, 8)}`,
      destination: `Reach-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10800000),
      seatsAvailable: 4,
      price: 180,
      vehicle: "Van",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const response = await request(app).get(`/api/rides/${ride._id}`);

    expect(response.status).toBe(200);
    expect(response.body.ride._id.toString()).toBe(ride._id.toString());
    expect(response.body.ride.source).toBe(ride.source);
    expect(response.body.ride.destination).toBe(ride.destination);
  });

  it("authenticated driver can update their own ride", async () => {
    const email = makeUniqueEmail("ride-update");
    const user = await User.create({
      name: "Ride Updater",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const ride = await Ride.create({
      driver: user._id,
      source: `Old-${Math.random().toString(16).slice(2, 8)}`,
      destination: `OldDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 150,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(user._id);
    const response = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        seatsAvailable: 4,
        price: 200,
      });

    expect(response.status).toBe(200);
    expect(response.body.ride.seatsAvailable).toBe(4);
    expect(response.body.ride.price).toBe(200);
  });

  it("unrelated user cannot modify another driver's ride", async () => {
    const driverEmail = makeUniqueEmail("ride-other-driver");
    const driver = await User.create({
      name: "Other Driver",
      email: driverEmail,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherDriverEmail = makeUniqueEmail("ride-other-driver-2");
    const otherDriver = await User.create({
      name: "Another Driver",
      email: otherDriverEmail,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(otherDriver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Other-${Math.random().toString(16).slice(2, 8)}`,
      destination: `Target-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 172800000),
      seatsAvailable: 2,
      price: 120,
      vehicle: "Bike",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(otherDriver._id);
    const response = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ seatsAvailable: 1 });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only update your own rides/i);
  });

  it("unauthenticated protected ride operation is rejected", async () => {
    const email = makeUniqueEmail("ride-unauth");
    const user = await User.create({
      name: "Unauth Ride User",
      email,
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(user._id);

    const ride = await Ride.create({
      driver: user._id,
      source: `NoAuth-${Math.random().toString(16).slice(2, 8)}`,
      destination: `NoAuthDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 259200000),
      seatsAvailable: 3,
      price: 220,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const response = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .send({ seatsAvailable: 5 });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/not authorized|token/i);
  });

  it("GET /api/rides filters by source and destination", async () => {
    const driver = await User.create({
      name: "Filter Driver",
      email: makeUniqueEmail("ride-filter-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const matchingRide = await Ride.create({
      driver: driver._id,
      source: "Bengaluru",
      destination: "Coimbatore",
      date: new Date(Date.now() + 3600000),
      seatsAvailable: 3,
      price: 450,
      vehicle: "Sedan",
      status: "active",
    });
    createdRideIds.push(matchingRide._id);

    const otherRide = await Ride.create({
      driver: driver._id,
      source: "Chennai",
      destination: "Hyderabad",
      date: new Date(Date.now() + 7200000),
      seatsAvailable: 2,
      price: 500,
      vehicle: "SUV",
      status: "active",
    });
    createdRideIds.push(otherRide._id);

    const sourceResponse = await request(app).get("/api/rides").query({ source: "Bengaluru" });
    expect(sourceResponse.status).toBe(200);
    expect(sourceResponse.body.rides.some((ride) => ride._id.toString() === matchingRide._id.toString())).toBe(true);
    expect(sourceResponse.body.rides.some((ride) => ride._id.toString() === otherRide._id.toString())).toBe(false);

    const destinationResponse = await request(app).get("/api/rides").query({ destination: "Coimbatore" });
    expect(destinationResponse.status).toBe(200);
    expect(destinationResponse.body.rides.some((ride) => ride._id.toString() === matchingRide._id.toString())).toBe(true);
  });

  it("GET /api/rides/my-rides returns only the authenticated driver's rides", async () => {
    const driver = await User.create({
      name: "My Ride Driver",
      email: makeUniqueEmail("my-rides-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherDriver = await User.create({
      name: "Other Driver",
      email: makeUniqueEmail("my-rides-other-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(otherDriver._id);

    const ownRide = await Ride.create({
      driver: driver._id,
      source: "Mumbai",
      destination: "Pune",
      date: new Date(Date.now() + 10800000),
      seatsAvailable: 2,
      price: 300,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ownRide._id);

    const otherRide = await Ride.create({
      driver: otherDriver._id,
      source: "Delhi",
      destination: "Jaipur",
      date: new Date(Date.now() + 21600000),
      seatsAvailable: 1,
      price: 350,
      vehicle: "Taxi",
      status: "active",
    });
    createdRideIds.push(otherRide._id);

    const token = generateToken(driver._id);
    const response = await request(app)
      .get("/api/rides/my-rides")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.some((ride) => ride._id.toString() === ownRide._id.toString())).toBe(true);
    expect(response.body.data.some((ride) => ride._id.toString() === otherRide._id.toString())).toBe(false);
  });

  it("GET /api/rides/:id rejects invalid IDs and nonexistent rides", async () => {
    const invalidResponse = await request(app).get("/api/rides/not-a-valid-id");
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.message).toMatch(/invalid ride id/i);

    const validButMissingId = "507f1f77bcf86cd799439011";
    const missingResponse = await request(app).get(`/api/rides/${validButMissingId}`);
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body.message).toMatch(/ride not found/i);
  });
});
