/**
 * Regression coverage for the production-hardening and end-to-end fixes:
 * rate limiting, security headers, body-size limit, maintenance auth,
 * driver-side bookings/chat, payment guards, own-ride matching,
 * cancellation cleanup and the ride lifecycle scheduler.
 */
import request from "supertest";
import { describe, it, expect, afterAll } from "vitest";
import {
  app,
  generateToken,
  User,
  Ride,
  Booking,
  RideRequest,
  Message,
  createdUserIds,
  createdRideIds,
  createdBookingIds,
  makeUniqueEmail,
} from "./setup.js";
import {
  autoCompleteDueRides,
  startRideLifecycleScheduler,
  stopRideLifecycleScheduler,
} from "../services/rideLifecycleService.js";

const HOUR = 3600000;

const makeUser = async (overrides = {}) => {
  const user = await User.create({
    name: "Hardening User",
    email: makeUniqueEmail("harden"),
    password: "secret123",
    roles: ["passenger"],
    ...overrides,
  });
  createdUserIds.push(user._id);
  return user;
};

const makeRide = async (driver, overrides = {}) => {
  const ride = await Ride.create({
    driver: driver._id,
    source: "Kochi",
    destination: "Thrissur",
    date: new Date(Date.now() + 24 * HOUR),
    seatsAvailable: 3,
    price: 0,
    fuelCost: 200,
    ...overrides,
  });
  createdRideIds.push(ride._id);
  return ride;
};

const makeBooking = async (passenger, ride, overrides = {}) => {
  const booking = await Booking.create({
    passenger: passenger._id,
    ride: ride._id,
    seats: 1,
    status: "confirmed",
    fuelShare: 100,
    contributionAmount: 100,
    ...overrides,
  });
  createdBookingIds.push(booking._id);
  return booking;
};

describe("Security headers and body limits", () => {
  it("sends baseline hardening headers and hides the framework", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("rejects a body beyond the configured limit", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "x".repeat(2 * 1024 * 1024) });

    // The size guard or normal validation rejects it, but it is never a 5xx.
    expect([400, 413]).toContain(response.status);
  });
});

describe("Auth rate limiting", () => {
  it("throttles repeated failed logins with 429", async () => {
    const email = makeUniqueEmail("ratelimit");
    let sawRateLimit = false;

    // The auth limiter allows 10 attempts per window, so the 11th must 429.
    for (let attempt = 0; attempt < 14; attempt++) {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email, password: "wrong-password" });

      if (response.status === 429) {
        expect(response.body.success).toBe(false);
        expect(response.headers["retry-after"]).toBeDefined();
        sawRateLimit = true;
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });
});

describe("Maintenance endpoint authorization", () => {
  it("refuses a non-admin authenticated user", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });

    const response = await request(app)
      .post("/api/trip/maintenance/auto-complete")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(403);
  });

  it("refuses an anonymous caller", async () => {
    const response = await request(app).post(
      "/api/trip/maintenance/auto-complete"
    );

    expect(response.status).toBe(401);
  });

  it("allows an admin", async () => {
    const admin = await makeUser({ roles: ["admin"] });

    const response = await request(app)
      .post("/api/trip/maintenance/auto-complete")
      .set("Authorization", `Bearer ${generateToken(admin._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});

describe("Driver-side bookings, chat and reviews", () => {
  it("shows a driver the bookings made on their own ride", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver);
    await makeBooking(passenger, ride);

    const response = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(1);
    expect(response.body.bookings[0].passenger).toBeTruthy();
  });

  it("never exposes a booking on somebody else's ride", async () => {
    const ownerDriver = await makeUser({ roles: ["passenger", "driver"] });
    const otherDriver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(ownerDriver);
    await makeBooking(passenger, ride);

    const response = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${generateToken(otherDriver._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(0);
  });

  it("lets a driver open trip chat as the other party", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver);
    const booking = await makeBooking(passenger, ride);

    await Message.create({
      booking: booking._id,
      sender: passenger._id,
      recipient: driver._id,
      body: "On my way",
    });

    const response = await request(app)
      .get(`/api/social/chat/${booking._id}`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.length).toBe(1);
  });
});


describe("Payment guards", () => {
  it("refuses to settle a cancelled booking", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver);
    const booking = await makeBooking(passenger, ride, { status: "cancelled" });

    const response = await request(app)
      .post(`/api/trip/bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`);

    expect(response.status).toBe(400);
    const unchanged = await Booking.findById(booking._id);
    expect(unchanged.paymentStatus).toBe("unpaid");
  });

  it("refuses to settle a booking on a cancelled ride", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver);
    const booking = await makeBooking(passenger, ride);

    await Ride.updateOne({ _id: ride._id }, { $set: { status: "cancelled" } });

    const response = await request(app)
      .post(`/api/trip/bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`);

    expect(response.status).toBe(400);
    const unchanged = await Booking.findById(booking._id);
    expect(unchanged.paymentStatus).toBe("unpaid");
  });
});

describe("Matching never returns the rider's own ride", () => {
  it("excludes a dual-role user's own offer", async () => {
    const user = await makeUser({ roles: ["passenger", "driver"] });
    const ownRide = await makeRide(user, {
      sourcePoint: { type: "Point", coordinates: [76.2673, 9.9312] },
      destinationPoint: { type: "Point", coordinates: [76.2144, 10.5276] },
    });

    const rideRequest = await RideRequest.create({
      rider: user._id,
      pickup: "Kochi",
      drop: "Thrissur",
      earliestTime: new Date(Date.now() + 2 * HOUR),
      latestTime: new Date(Date.now() + 6 * HOUR),
      seats: 1,
      pickupPoint: { type: "Point", coordinates: [76.2673, 9.9312] },
      dropPoint: { type: "Point", coordinates: [76.2144, 10.5276] },
    });

    const response = await request(app)
      .get(`/api/ride-requests/${rideRequest._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(user._id)}`);

    expect(response.status).toBe(200);
    const ids = (response.body.data || []).map((match) =>
      String(match.ride?._id ?? match.ride ?? match._id)
    );
    expect(ids).not.toContain(String(ownRide._id));
  });
});

describe("Ride cancellation releases matched requests", () => {
  it("resets a matched request when its ride is cancelled", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver);

    const rideRequest = await RideRequest.create({
      rider: passenger._id,
      pickup: "Kochi",
      drop: "Thrissur",
      earliestTime: new Date(Date.now() + 2 * HOUR),
      latestTime: new Date(Date.now() + 6 * HOUR),
      seats: 1,
      status: "matched",
      matchedRide: ride._id,
    });

    const response = await request(app)
      .delete(`/api/rides/${ride._id}`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(200);

    const released = await RideRequest.findById(rideRequest._id);
    expect(released.status).toBe("open");
    expect(released.matchedRide).toBeUndefined();
  });
});

describe("Ride lifecycle scheduler", () => {
  afterAll(() => {
    stopRideLifecycleScheduler();
  });

  it("completes a departed ride and is idempotent", async () => {
    const driver = await makeUser({ roles: ["passenger", "driver"] });
    const passenger = await makeUser();
    const ride = await makeRide(driver, {
      date: new Date(Date.now() - 5 * HOUR),
    });
    await makeBooking(passenger, ride);

    // Fire the same function the timer uses, to assert what it relies on.
    const first = await autoCompleteDueRides();
    const second = await autoCompleteDueRides();

    const completed = await Ride.findById(ride._id);
    expect(completed.status).toBe("completed");
    expect(completed.trackingActive).toBe(false);
    expect(first.completed).toBeGreaterThanOrEqual(1);
    // A second sweep has nothing left to close, proving it cannot double-fire.
    expect(second.completed).toBe(0);
  });

  it("starts once and stops cleanly", () => {
    const timer = startRideLifecycleScheduler({ intervalMs: 60000 });
    expect(timer).toBeTruthy();

    // A second call must reuse the timer rather than stack another loop.
    expect(startRideLifecycleScheduler({ intervalMs: 60000 })).toBe(timer);

    stopRideLifecycleScheduler();
    expect(() => stopRideLifecycleScheduler()).not.toThrow();
  });
});
