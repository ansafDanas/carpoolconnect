import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  app,
  Booking,
  Notification,
  Ride,
  RideRequest,
  User,
  createdBookingIds,
  createdRideIds,
  createdUserIds,
  generateToken,
  makeUniqueEmail,
} from "./setup.js";

vi.mock("../services/emailService.js", () => ({
  sendRideCancellationEmail: vi.fn().mockResolvedValue({ success: true }),
  sendRideCompletionEmail: vi.fn().mockResolvedValue({ success: true }),
}));

import { sendRideCancellationEmail } from "../services/emailService.js";

const createUser = async (name, roles) => {
  const user = await User.create({
    name,
    email: makeUniqueEmail(name.toLowerCase().replace(/\s+/g, "-")),
    password: "secret123",
    roles,
  });
  createdUserIds.push(user._id);
  return user;
};

const auth = (user) => `Bearer ${generateToken(user._id)}`;

describe("Admin authorization and ride management", () => {
  it("rejects unauthenticated, passenger, and driver admin requests", async () => {
    const passenger = await createUser("Admin Test Passenger", ["passenger"]);
    const driver = await createUser("Admin Test Driver", ["driver"]);

    const unauthenticatedResponse = await request(app).get("/api/admin/users");
    const passengerResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", auth(passenger));
    const driverResponse = await request(app)
      .get("/api/admin/users")
      .set("Authorization", auth(driver));

    expect(unauthenticatedResponse.status).toBe(401);
    expect(passengerResponse.status).toBe(403);
    expect(driverResponse.status).toBe(403);
  });

  it("allows an admin to view users, rides, and bookings", async () => {
    const admin = await createUser("Admin User", ["admin"]);

    for (const endpoint of ["/api/admin/users", "/api/admin/rides", "/api/admin/bookings"]) {
      const response = await request(app)
        .get(endpoint)
        .set("Authorization", auth(admin));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    }
  });

  it("soft-cancels a ride without orphaning bookings", async () => {
    const admin = await createUser("Cancellation Admin", ["admin"]);
    const driver = await createUser("Cancellation Driver", ["driver"]);
    const passenger = await createUser("Cancellation Passenger", ["passenger"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "Admin Source",
      destination: "Admin Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 1,
      price: 100,
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(200);
    expect(response.body.ride.status).toBe("cancelled");
    expect(response.body.ride.trackingActive).toBe(false);

    const updatedRide = await Ride.findById(ride._id);
    const updatedBooking = await Booking.findById(booking._id);
    const notification = await Notification.findOne({
      recipient: passenger._id,
      type: "ride_cancelled",
      relatedRide: ride._id,
      relatedBooking: booking._id,
    });

    expect(updatedRide.status).toBe("cancelled");
    expect(updatedRide.trackingActive).toBe(false);
    expect(updatedRide.seatsAvailable).toBe(2);
    expect(updatedBooking.status).toBe("cancelled");
    expect(notification).not.toBeNull();
  });

  it("reopens matched ride requests when cancelling a ride as admin", async () => {
    const admin = await createUser("Admin Reopen Requests", ["admin"]);
    const driver = await createUser("Driver Reopen Requests", ["driver"]);
    const passenger = await createUser("Passenger Reopen Requests", ["passenger"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "Reopen Source",
      destination: "Reopen Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 100,
      status: "active",
    });
    createdRideIds.push(ride._id);

    const rideRequest = await RideRequest.create({
      rider: passenger._id,
      pickup: "Reopen Source",
      drop: "Reopen Destination",
      earliestTime: new Date(Date.now() + 86400000),
      latestTime: new Date(Date.now() + 90000000),
      seats: 1,
      status: "matched",
      matchedRide: ride._id,
    });

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updatedRequest = await RideRequest.findById(rideRequest._id);
    expect(updatedRequest.status).toBe("open");
    expect(updatedRequest.matchedRide).toBeUndefined();
  });

  it("cancellation succeeds even when email delivery fails", async () => {
    vi.mocked(sendRideCancellationEmail).mockRejectedValueOnce(
      new Error("SMTP down")
    );

    const admin = await createUser("Admin Email Fail", ["admin"]);
    const driver = await createUser("Driver Email Fail", ["driver"]);
    const passenger = await createUser("Passenger Email Fail", ["passenger"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "Email Fail Source",
      destination: "Email Fail Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 100,
      status: "active",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.status).toBe("cancelled");
    expect(updatedRide.trackingActive).toBe(false);

    const updatedBooking = await Booking.findById(booking._id);
    expect(updatedBooking.status).toBe("cancelled");

    const notification = await Notification.findOne({
      recipient: passenger._id,
      type: "ride_cancelled",
      relatedRide: ride._id,
    });
    expect(notification).not.toBeNull();
  });

  it("cancels a ride without bookings successfully", async () => {
    const admin = await createUser("Admin No Bookings", ["admin"]);
    const driver = await createUser("Driver No Bookings", ["driver"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "No Booking Source",
      destination: "No Booking Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 3,
      price: 100,
      status: "active",
    });
    createdRideIds.push(ride._id);

    const originalSeats = ride.seatsAvailable;

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.cancelledBookingCount).toBe(0);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.status).toBe("cancelled");
    expect(updatedRide.seatsAvailable).toBe(originalSeats);
  });

  it("rejects cancellation of an already cancelled ride", async () => {
    const admin = await createUser("Admin Already Cancelled", ["admin"]);
    const driver = await createUser("Driver Already Cancelled", ["driver"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "Already Cancelled Source",
      destination: "Already Cancelled Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 100,
      status: "cancelled",
    });
    createdRideIds.push(ride._id);

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/already cancelled/i);
  });

  it("rejects cancellation of a completed ride", async () => {
    const admin = await createUser("Admin Completed Ride", ["admin"]);
    const driver = await createUser("Driver Completed Ride", ["driver"]);
    const ride = await Ride.create({
      driver: driver._id,
      source: "Completed Source",
      destination: "Completed Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 100,
      status: "completed",
    });
    createdRideIds.push(ride._id);

    const response = await request(app)
      .delete(`/api/admin/rides/${ride._id}`)
      .set("Authorization", auth(admin));

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toMatch(/completed rides cannot be cancelled/i);
  });
});
