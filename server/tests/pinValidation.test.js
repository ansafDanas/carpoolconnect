import request from "supertest";
import { describe, it, expect } from "vitest";
import {
  app,
  generateToken,
  User,
  createdUserIds,
  createdRideIds,
  makeUniqueEmail,
} from "./setup.js";
import {
  findLocality,
  isInsideIndia,
  validateDistanceConsistency,
  validatePin,
} from "../services/placeValidation.js";

const KOCHI = { latitude: 9.9312, longitude: 76.2673 };
// Somewhere in Tamil Nadu, far from the Kerala coast.
const CHENNAI = { latitude: 13.0827, longitude: 80.2707 };

const makeDriver = async () => {
  const driver = await User.create({
    name: "Pin Driver",
    email: makeUniqueEmail("pin-driver"),
    password: "secret123",
    roles: ["driver"],
  });
  createdUserIds.push(driver._id);
  return driver;
};

const baseRide = {
  source: "Kochi",
  destination: "Alappuzha",
  date: new Date(Date.now() + 86400000).toISOString(),
  seatsAvailable: 3,
  price: 0,
};

describe("Pin validation", () => {
  it("recognises a Kerala locality and its aliases", () => {
    expect(findLocality("Kochi")?.name).toBe("kochi");
    expect(findLocality("fort kochi")?.name).toBe("fort kochi");
    expect(findLocality("Trivandrum")?.name).toBe("thiruvananthapuram");
    expect(findLocality("Calicut")?.name).toBe("kozhikode");
    expect(findLocality("nowhere at all xyz")).toBeNull();
  });

  it("rejects pins outside India", () => {
    expect(isInsideIndia(KOCHI)).toBe(true);
    expect(isInsideIndia(CHENNAI)).toBe(true);
    expect(isInsideIndia({ latitude: 51.5, longitude: -0.12 })).toBe(false);
  });

  it("accepts a pin that sits near the typed place", () => {
    const result = validatePin({ text: "Kochi", point: { latitude: 9.965, longitude: 76.24 } });
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(true);
  });

  it("rejects a pin dropped far from the typed place", () => {
    const result = validatePin({ text: "Kochi", point: CHENNAI });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Kochi/);
  });

  it("stays permissive for place names it does not recognise", () => {
    const result = validatePin({ text: "Some Village", point: KOCHI });
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(false);
  });

  it("catches a declared distance shorter than the straight line", () => {
    const result = validateDistanceConsistency({
      startPoint: { latitude: 9.9312, longitude: 76.2673 },
      endPoint: { latitude: 9.4981, longitude: 76.3388 },
      distanceKm: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/shorter than the straight line/i);
  });

  it("catches two pins that are almost on top of each other", () => {
    const result = validateDistanceConsistency({
      startPoint: KOCHI,
      endPoint: { latitude: 9.9313, longitude: 76.2674 },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a realistic distance for a real Kerala route", () => {
    const result = validateDistanceConsistency({
      startPoint: { latitude: 9.9312, longitude: 76.2673 },
      endPoint: { latitude: 9.4981, longitude: 76.3388 },
      distanceKm: 78,
    });
    expect(result.ok).toBe(true);
  });

  it("blocks a ride whose pin contradicts the typed place", async () => {
    const driver = await makeDriver();

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        ...baseRide,
        sourceCoordinates: CHENNAI,
        destinationCoordinates: { latitude: 9.4981, longitude: 76.3388 },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Kochi/);
  });

  it("blocks a ride claiming 2 km between pins 80 km apart", async () => {
    const driver = await makeDriver();

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        ...baseRide,
        distanceKm: 2,
        sourceCoordinates: { latitude: 9.9312, longitude: 76.2673 },
        destinationCoordinates: { latitude: 9.4981, longitude: 76.3388 },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/shorter than the straight line/i);
  });

  it("accepts a genuine Kerala route with consistent pins", async () => {
    const driver = await makeDriver();

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        ...baseRide,
        distanceKm: 78,
        sourceCoordinates: { latitude: 9.9312, longitude: 76.2673 },
        destinationCoordinates: { latitude: 9.4981, longitude: 76.3388 },
      });

    expect(response.status).toBe(201);
    createdRideIds.push(response.body.ride._id);
  });

  it("applies the same pin rule to ride requests", async () => {
    const rider = await User.create({
      name: "Pin Rider",
      email: makeUniqueEmail("pin-rider"),
      password: "secret123",
      roles: ["passenger"],
    });
    createdUserIds.push(rider._id);

    const response = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "Kochi",
        drop: "Alappuzha",
        earliestTime: new Date(Date.now() + 3600000).toISOString(),
        latestTime: new Date(Date.now() + 7200000).toISOString(),
        seats: 1,
        pickupCoordinates: CHENNAI,
        dropCoordinates: { latitude: 9.4981, longitude: 76.3388 },
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/Kochi/);
  });
});