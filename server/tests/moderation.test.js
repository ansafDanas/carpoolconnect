import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import {
  app,
  generateToken,
  User,
  Ride,
  Booking,
  RideRequest,
  Notification,
  Report,
  createdUserIds,
  createdRideIds,
  createdBookingIds,
  makeUniqueEmail,
} from "./setup.js";

vi.mock("../services/emailService.js", () => ({
  sendRideCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendRideCompletionEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { sendRideCancellationEmail } from "../services/emailService.js";

const HOUR = 3600000;

const makeUser = async (roles = ["passenger"], overrides = {}) => {
  const user = await User.create({
    name: "Mod User",
    email: makeUniqueEmail("mod"),
    password: "secret123",
    roles,
    ...overrides,
  });
  createdUserIds.push(user._id);
  return user;
};

const makeAdmin = async () =>
  makeUser(["admin"], { name: "Moderator", email: makeUniqueEmail("admin") });

const makeReport = async (reporter, reported, reason = "no_show") => {
  const report = await Report.create({
    reporter: reporter._id,
    reportedUser: reported._id,
    reason,
    details: "Waited a long time",
  });
  return report;
};

describe("Safety report moderation", () => {
  it("an admin can list open reports with both parties resolved", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    await makeReport(reporter, reported);

    const response = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${generateToken(admin._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.openCount).toBe(1);
    expect(response.body.data[0].reporter.name).toBe(reporter.name);
    expect(response.body.data[0].reportedUser.name).toBe(reported.name);
  });

  it("a non-admin cannot read reports", async () => {
    const driver = await makeUser(["driver"]);
    const response = await request(app)
      .get("/api/admin/reports")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(403);
  });

  it("dismissing a report closes it without action", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    const report = await makeReport(reporter, reported);

    const response = await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "dismissed", note: "Not substantiated" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("dismissed");
    expect(response.body.data.resolution.action).toBe("dismissed");
    expect((await User.findById(reported._id)).isSuspended).toBe(false);
  });

  it("suspending through a report blocks the account immediately", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    const report = await makeReport(reporter, reported, "unsafe_behaviour");

    const response = await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "suspended" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("actioned");

    const stored = await User.findById(reported._id);
    expect(stored.isSuspended).toBe(true);
    expect(stored.suspendedReason).toBeTruthy();

    // A suspended account cannot log in at all.
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: stored.email, password: "secret123" });
    expect(login.status).toBe(403);
    expect(login.body.code).toBe("ACCOUNT_SUSPENDED");

    // And an already-issued token is refused on every request.
    const blocked = await request(app)
      .get("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(reported._id)}`);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("ACCOUNT_SUSPENDED");
  });

  it("suspending a driver cancels their active rides", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    const ride = await Ride.create({
      driver: reported._id,
      source: "A",
      destination: "B",
      date: new Date(Date.now() + 24 * HOUR),
      seatsAvailable: 3,
      price: 0,
      status: "active",
    });
    createdRideIds.push(ride._id);
    const report = await makeReport(reporter, reported);

    await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "suspended" });

    expect((await Ride.findById(ride._id)).status).toBe("cancelled");
  });

  it("suspending a driver cancels active rides with full cleanup", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);

    const ride = await Ride.create({
      driver: reported._id,
      source: "A",
      destination: "B",
      date: new Date(Date.now() + 24 * HOUR),
      seatsAvailable: 3,
      price: 0,
      status: "active",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: reporter._id,
      ride: ride._id,
      seats: 2,
      status: "confirmed",
      fuelShare: 100,
      coffeeAmount: 0,
      contributionAmount: 100,
      paymentStatus: "unpaid",
    });
    createdBookingIds.push(booking._id);

    const rideRequest = await RideRequest.create({
      rider: reporter._id,
      pickup: "A",
      drop: "B",
      earliestTime: new Date(Date.now() + 24 * HOUR),
      latestTime: new Date(Date.now() + 25 * HOUR),
      seats: 1,
      status: "matched",
      matchedRide: ride._id,
    });

    const report = await makeReport(reporter, reported, "unsafe_behaviour");

    await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "suspended" });

    // Ride cancelled and tracking deactivated
    const storedRide = await Ride.findById(ride._id);
    expect(storedRide.status).toBe("cancelled");
    expect(storedRide.trackingActive).toBe(false);

    // Seats restored: 3 original + 2 from booking = 5
    expect(storedRide.seatsAvailable).toBe(5);

    // Booking cancelled
    const storedBooking = await Booking.findById(booking._id);
    expect(storedBooking.status).toBe("cancelled");

    // Ride-request reopened and matchedRide cleared
    const storedRequest = await RideRequest.findById(rideRequest._id);
    expect(storedRequest.status).toBe("open");
    expect(storedRequest.matchedRide).toBeUndefined();

    // Notification created for passenger
    const notification = await Notification.findOne({
      recipient: reporter._id,
      type: "ride_cancelled",
      relatedRide: ride._id,
    });
    expect(notification).toBeTruthy();

    // Cancellation email attempted
    expect(sendRideCancellationEmail).toHaveBeenCalled();
  });

  it("an admin cannot suspend another admin account", async () => {
    const admin = await makeAdmin();
    const otherAdmin = await makeUser(["admin"]);
    const reporter = await makeUser();
    const report = await makeReport(reporter, otherAdmin);

    const response = await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "suspended" });

    expect(response.status).toBe(400);
    expect((await User.findById(otherAdmin._id)).isSuspended).toBe(false);
  });

  it("an admin cannot suspend their own account", async () => {
    const admin = await makeAdmin();
    const response = await request(app)
      .patch(`/api/admin/users/${admin._id}/suspension`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ suspended: true });

    expect(response.status).toBe(400);
  });

  it("a report cannot be actioned twice", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    const report = await makeReport(reporter, reported);

    await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "dismissed" });

    const second = await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "suspended" });

    expect(second.status).toBe(400);
  });

  it("a rejected action leaves the report open", async () => {
    const admin = await makeAdmin();
    const reporter = await makeUser();
    const reported = await makeUser(["driver"]);
    const report = await makeReport(reporter, reported);

    const response = await request(app)
      .patch(`/api/admin/reports/${report._id}`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ action: "delete_everything" });

    expect(response.status).toBe(400);
    expect((await Report.findById(report._id)).status).toBe("open");
  });

  it("a suspension can be lifted without losing the account", async () => {
    const admin = await makeAdmin();
    const user = await makeUser(["driver"], { isSuspended: true });

    const response = await request(app)
      .patch(`/api/admin/users/${user._id}/suspension`)
      .set("Authorization", `Bearer ${generateToken(admin._id)}`)
      .send({ suspended: false });

    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).isSuspended).toBe(false);
  });
});