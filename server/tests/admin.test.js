import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  app,
  Booking,
  Notification,
  Ride,
  User,
  createdBookingIds,
  createdRideIds,
  createdUserIds,
  generateToken,
  makeUniqueEmail,
} from "./setup.js";

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
});
