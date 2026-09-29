import nodemailer from "nodemailer";
import request from "supertest";
import { describe, it, expect, vi } from "vitest";
import { app, generateToken, User, Ride, Booking, createdUserIds, createdRideIds, createdBookingIds, makeUniqueEmail } from "./setup.js";
import Notification from "../models/Notification.js";

describe("Booking API", () => {
  it("authenticated passenger can book a ride", async () => {
    const driver = await User.create({
      name: "Booking Driver",
      email: makeUniqueEmail("booking-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Booking Passenger",
      email: makeUniqueEmail("booking-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Ride-${Math.random().toString(16).slice(2, 8)}`,
      destination: `Dest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 345600000),
      seatsAvailable: 5,
      price: 100,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(response.status).toBe(201);
    expect(response.body.message).toMatch(/ride booked successfully/i);
    createdBookingIds.push(response.body.booking._id);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.seatsAvailable).toBe(3);
  });

  it("booking remains successful when notification creation fails", async () => {
    const driver = await User.create({ name: "Notification Failure Driver", email: makeUniqueEmail("notification-failure-driver"), password: "secret123", role: "driver" });
    const passenger = await User.create({ name: "Notification Failure Passenger", email: makeUniqueEmail("notification-failure-passenger"), password: "secret123", role: "rider" });
    createdUserIds.push(driver._id, passenger._id);
    const ride = await Ride.create({ driver: driver._id, source: "Source", destination: "Destination", date: new Date(Date.now() + 3600000), seatsAvailable: 2, price: 100, status: "active" });
    createdRideIds.push(ride._id);
    const notificationSpy = vi.spyOn(Notification, "create").mockRejectedValueOnce(new Error("notification unavailable"));

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    notificationSpy.mockRestore();
    expect(response.status).toBe(201);
    createdBookingIds.push(response.body.booking._id);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(1);
  });

  it("booking remains successful when confirmation email fails", async () => {
    const driver = await User.create({ name: "Email Failure Driver", email: makeUniqueEmail("email-failure-driver"), password: "secret123", role: "driver" });
    const passenger = await User.create({ name: "Email Failure Passenger", email: makeUniqueEmail("email-failure-passenger"), password: "secret123", role: "rider" });
    createdUserIds.push(driver._id, passenger._id);
    const ride = await Ride.create({ driver: driver._id, source: "Source", destination: "Destination", date: new Date(Date.now() + 3600000), seatsAvailable: 2, price: 100, status: "active" });
    createdRideIds.push(ride._id);
    const originalEnvironment = {
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASS: process.env.SMTP_PASS,
      EMAIL_FROM: process.env.EMAIL_FROM,
    };
    process.env.SMTP_HOST = "smtp.test";
    process.env.SMTP_USER = "test-user";
    process.env.SMTP_PASS = "test-pass";
    process.env.EMAIL_FROM = "test@example.com";
    const transportSpy = vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(new Error("email unavailable")),
    });

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    transportSpy.mockRestore();
    Object.entries(originalEnvironment).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
    expect(response.status).toBe(201);
    createdBookingIds.push(response.body.booking._id);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(1);
  });

  it("booking with multiple seats works and decreases available seats by the requested number", async () => {
    const driver = await User.create({
      name: "Multi Seat Driver",
      email: makeUniqueEmail("multi-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Multi Seat Passenger",
      email: makeUniqueEmail("multi-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Multi-${Math.random().toString(16).slice(2, 8)}`,
      destination: `MultiDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 432000000),
      seatsAvailable: 7,
      price: 180,
      vehicle: "SUV",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 3 });

    expect(response.status).toBe(201);
    createdBookingIds.push(response.body.booking._id);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.seatsAvailable).toBe(4);
  });

  it("insufficient seats are rejected", async () => {
    const driver = await User.create({
      name: "Seat Check Driver",
      email: makeUniqueEmail("insufficient-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Seat Check Passenger",
      email: makeUniqueEmail("insufficient-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Ins-${Math.random().toString(16).slice(2, 8)}`,
      destination: `InsDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 518400000),
      seatsAvailable: 2,
      price: 90,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 3 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/not enough seats|available/i);
  });

  it("zero, negative, and invalid seats are rejected", async () => {
    const driver = await User.create({
      name: "Invalid Seat Driver",
      email: makeUniqueEmail("invalid-seat-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Invalid Seat Passenger",
      email: makeUniqueEmail("invalid-seat-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `SeatBad-${Math.random().toString(16).slice(2, 8)}`,
      destination: `SeatBadDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 604800000),
      seatsAvailable: 4,
      price: 130,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);

    const zeroResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 0 });

    expect(zeroResponse.status).toBe(400);

    const negativeResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: -1 });

    expect(negativeResponse.status).toBe(400);

    const invalidResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: "abc" });

    expect(invalidResponse.status).toBe(400);
  });

  it("duplicate booking is rejected according to current application behavior", async () => {
    const driver = await User.create({
      name: "Duplicate Driver",
      email: makeUniqueEmail("duplicate-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Duplicate Passenger",
      email: makeUniqueEmail("duplicate-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Dup-${Math.random().toString(16).slice(2, 8)}`,
      destination: `DupDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 691200000),
      seatsAvailable: 4,
      price: 110,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const firstResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(firstResponse.status).toBe(201);
    createdBookingIds.push(firstResponse.body.booking._id);

    const duplicateResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.message).toMatch(/already booked|already/i);
  });

  it("driver cannot book their own ride", async () => {
    const driver = await User.create({
      name: "Driver Book Self",
      email: makeUniqueEmail("driver-self"),
      password: "secret123",
      roles: ["passenger", "driver"],
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Self-${Math.random().toString(16).slice(2, 8)}`,
      destination: `SelfDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 777600000),
      seatsAvailable: 3,
      price: 140,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);
    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/cannot book your own ride/i);
  });

  it("unauthenticated booking is rejected", async () => {
    const driver = await User.create({
      name: "Unauth Booking Driver",
      email: makeUniqueEmail("unauth-book-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Unauth-${Math.random().toString(16).slice(2, 8)}`,
      destination: `UnauthDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 864000000),
      seatsAvailable: 2,
      price: 150,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const response = await request(app)
      .post("/api/bookings")
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/not authorized|token/i);
  });

  it("cancelling a booking restores the correct number of seats", async () => {
    const driver = await User.create({
      name: "Cancel Driver",
      email: makeUniqueEmail("cancel-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Cancel Passenger",
      email: makeUniqueEmail("cancel-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Cancel-${Math.random().toString(16).slice(2, 8)}`,
      destination: `CancelDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 950400000),
      seatsAvailable: 5,
      price: 200,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const bookingResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(bookingResponse.status).toBe(201);
    createdBookingIds.push(bookingResponse.body.booking._id);

    const preCancelRide = await Ride.findById(ride._id);
    expect(preCancelRide.seatsAvailable).toBe(3);

    const cancelResponse = await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking._id}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.message).toMatch(/booking cancelled successfully/i);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.seatsAvailable).toBe(5);
  });

  it("allows rebooking after cancellation and preserves the cancelled booking", async () => {
    const driver = await User.create({
      name: "Rebook Driver",
      email: makeUniqueEmail("rebook-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Rebook Passenger",
      email: makeUniqueEmail("rebook-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Rebook-${Math.random().toString(16).slice(2, 8)}`,
      destination: `RebookDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 1036800000),
      seatsAvailable: 5,
      price: 200,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const token = generateToken(passenger._id);
    const firstBookingResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(firstBookingResponse.status).toBe(201);
    const firstBookingId = firstBookingResponse.body.booking._id;
    createdBookingIds.push(firstBookingId);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(3);

    const cancelResponse = await request(app)
      .patch(`/api/bookings/${firstBookingId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(cancelResponse.status).toBe(200);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(5);

    const cancelledBooking = await Booking.findById(firstBookingId);
    expect(cancelledBooking).not.toBeNull();
    expect(cancelledBooking.status).toBe("cancelled");

    const rebookingResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(rebookingResponse.status).toBe(201);
    createdBookingIds.push(rebookingResponse.body.booking._id);
    expect(rebookingResponse.body.booking._id).not.toBe(firstBookingId);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(3);

    const duplicateResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(duplicateResponse.status).toBe(400);
    expect(duplicateResponse.body.message).toMatch(/already booked|already/i);
  });

  it("GET /api/bookings returns the authenticated passenger's bookings", async () => {
    const driver = await User.create({
      name: "Booking List Driver",
      email: makeUniqueEmail("bookings-list-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Booking List Passenger",
      email: makeUniqueEmail("bookings-list-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "List City",
      destination: "List Town",
      date: new Date(Date.now() + 1209600000),
      seatsAvailable: 4,
      price: 200,
      vehicle: "Van",
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

    const token = generateToken(passenger._id);
    const response = await request(app)
      .get("/api/bookings")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.count).toBeGreaterThanOrEqual(1);
    expect(response.body.bookings.some((item) => item._id.toString() === booking._id.toString())).toBe(true);
  });

  it("booking with missing rideId and a nonexistent ride is rejected", async () => {
    const driver = await User.create({
      name: "Missing Ride Driver",
      email: makeUniqueEmail("missing-ride-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Missing Ride Passenger",
      email: makeUniqueEmail("missing-ride-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const token = generateToken(passenger._id);

    const missingRideIdResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ seats: 1 });

    expect(missingRideIdResponse.status).toBe(400);
    expect(missingRideIdResponse.body.message).toMatch(/ride id is required/i);

    const nonexistentRideId = "507f1f77bcf86cd799439011";
    const missingRideResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: nonexistentRideId, seats: 1 });

    expect(missingRideResponse.status).toBe(404);
    expect(missingRideResponse.body.message).toMatch(/ride not found/i);
  });

  it("booking a ride that is inactive, cancelled, or completed is rejected", async () => {
    const driver = await User.create({
      name: "Inactive Ride Driver",
      email: makeUniqueEmail("inactive-ride-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Inactive Ride Passenger",
      email: makeUniqueEmail("inactive-ride-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const token = generateToken(passenger._id);

    const inactiveRide = await Ride.create({
      driver: driver._id,
      source: "Inactive Source",
      destination: "Inactive Destination",
      date: new Date(Date.now() + 1728000000),
      seatsAvailable: 3,
      price: 130,
      vehicle: "Car",
      status: "cancelled",
    });
    createdRideIds.push(inactiveRide._id);

    const inactiveResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: inactiveRide._id.toString(), seats: 1 });

    expect(inactiveResponse.status).toBe(400);

    const completedRide = await Ride.create({
      driver: driver._id,
      source: "Completed Source",
      destination: "Completed Destination",
      date: new Date(Date.now() + 2592000000),
      seatsAvailable: 2,
      price: 120,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(completedRide._id);

    const completedResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: completedRide._id.toString(), seats: 1 });

    expect(completedResponse.status).toBe(400);

    const otherActiveRide = await Ride.create({
      driver: driver._id,
      source: "Active Source",
      destination: "Active Destination",
      date: new Date(Date.now() + 3456000000),
      seatsAvailable: 1,
      price: 140,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(otherActiveRide._id);

    const activeResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ rideId: otherActiveRide._id.toString(), seats: 1 });

    expect(activeResponse.status).toBe(201);
    createdBookingIds.push(activeResponse.body.booking._id);
  });

  it("cancelling another user's booking or an already-cancelled booking is rejected", async () => {
    const driver = await User.create({
      name: "Booking Owner Driver",
      email: makeUniqueEmail("owner-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Booking Owner Passenger",
      email: makeUniqueEmail("owner-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const otherUser = await User.create({
      name: "Other User",
      email: makeUniqueEmail("other-user"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(otherUser._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Cancel Auth Source",
      destination: "Cancel Auth Destination",
      date: new Date(Date.now() + 4320000000),
      seatsAvailable: 3,
      price: 180,
      vehicle: "Car",
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

    const otherUserToken = generateToken(otherUser._id);
    const unauthorizedResponse = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${otherUserToken}`);

    expect(unauthorizedResponse.status).toBe(403);
    expect(unauthorizedResponse.body.message).toMatch(/not authorized to cancel this booking/i);

    const passengerToken = generateToken(passenger._id);
    const firstCancelResponse = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(firstCancelResponse.status).toBe(200);

    const alreadyCancelledResponse = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(alreadyCancelledResponse.status).toBe(400);
    expect(alreadyCancelledResponse.body.message).toMatch(/already cancelled/i);
  });
});
