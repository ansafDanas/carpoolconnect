import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, Ride, Booking, Notification, Review, createdUserIds, createdRideIds, createdBookingIds, makeUniqueEmail } from "./setup.js";

describe("Notification API", () => {
  it("GET /api/notifications returns only the authenticated recipient's notifications", async () => {
    const driver = await User.create({
      name: "Notification Driver",
      email: makeUniqueEmail("notification-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherUser = await User.create({
      name: "Other Recipient",
      email: makeUniqueEmail("notification-other"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(otherUser._id);

    const first = await Notification.create({
      recipient: driver._id,
      type: "booking_created",
      title: "New booking received",
      message: "A passenger booked your ride.",
    });

    await Notification.create({
      recipient: otherUser._id,
      type: "booking_created",
      title: "Another user's notice",
      message: "Should not be visible.",
    });

    const token = generateToken(driver._id);
    const response = await request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.some((notification) => notification._id.toString() === first._id.toString())).toBe(true);
    expect(response.body.data.some((notification) => notification.recipient.toString() === otherUser._id.toString())).toBe(false);
  });

  it("notification unread state and read-all behavior works for the authenticated user", async () => {
    const driver = await User.create({
      name: "Read All Driver",
      email: makeUniqueEmail("read-all-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const unreadNotification = await Notification.create({
      recipient: driver._id,
      type: "booking_created",
      title: "Unread notification",
      message: "This is unread",
      read: false,
    });

    const token = generateToken(driver._id);
    const readOneResponse = await request(app)
      .patch(`/api/notifications/${unreadNotification._id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(readOneResponse.status).toBe(200);
    expect(readOneResponse.body.success).toBe(true);
    expect(readOneResponse.body.data.read).toBe(true);

    const anotherNotification = await Notification.create({
      recipient: driver._id,
      type: "booking_cancelled",
      title: "Second unread",
      message: "Also unread",
      read: false,
    });

    const readAllResponse = await request(app)
      .patch("/api/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    expect(readAllResponse.status).toBe(200);
    expect(readAllResponse.body.success).toBe(true);
    expect(readAllResponse.body.modifiedCount).toBeGreaterThanOrEqual(1);

    const refreshed = await Notification.findById(anotherNotification._id);
    expect(refreshed.read).toBe(true);
  });

  it("another user cannot mark a notification as read", async () => {
    const driver = await User.create({
      name: "Owner Driver",
      email: makeUniqueEmail("owner-driver-notification"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherUser = await User.create({
      name: "Intruder User",
      email: makeUniqueEmail("intruder-user"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(otherUser._id);

    const notification = await Notification.create({
      recipient: driver._id,
      type: "review_received",
      title: "Review received",
      message: "A review arrived.",
      read: false,
    });

    const token = generateToken(otherUser._id);
    const response = await request(app)
      .patch(`/api/notifications/${notification._id}/read`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/notification not found/i);
  });

  it("unauthenticated notification access is rejected", async () => {
    const response = await request(app).get("/api/notifications");
    expect(response.status).toBe(401);

    const notification = await Notification.create({
      recipient: "507f1f77bcf86cd799439011",
      type: "booking_created",
      title: "Placeholder",
      message: "No access",
    });

    const markResponse = await request(app).patch(`/api/notifications/${notification._id}/read`);
    expect(markResponse.status).toBe(401);
  });

  it("booking created and cancelled notifications are generated for the driver", async () => {
    const driver = await User.create({
      name: "Driver Notify",
      email: makeUniqueEmail("driver-notify"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Passenger Notify",
      email: makeUniqueEmail("passenger-notify"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Notify Source",
      destination: "Notify Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 4,
      price: 200,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(ride._id);

    const bookingToken = generateToken(passenger._id);
    const bookingResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${bookingToken}`)
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(bookingResponse.status).toBe(201);
    createdBookingIds.push(bookingResponse.body.booking._id);

    const createdNotification = await Notification.findOne({
      recipient: driver._id,
      type: "booking_created",
      relatedBooking: bookingResponse.body.booking._id,
    });

    expect(createdNotification).not.toBeNull();
    expect(createdNotification.title).toMatch(/new booking received/i);

    const cancelResponse = await request(app)
      .patch(`/api/bookings/${bookingResponse.body.booking._id}/cancel`)
      .set("Authorization", `Bearer ${bookingToken}`);

    expect(cancelResponse.status).toBe(200);

    const cancelledNotification = await Notification.findOne({
      recipient: driver._id,
      type: "booking_cancelled",
      relatedBooking: bookingResponse.body.booking._id,
    });

    expect(cancelledNotification).not.toBeNull();
    expect(cancelledNotification.title).toMatch(/booking cancelled/i);
  });

  it("ride cancelled and completed notifications are generated for affected passengers", async () => {
    const driver = await User.create({
      name: "Ride Event Driver",
      email: makeUniqueEmail("ride-event-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Ride Event Passenger",
      email: makeUniqueEmail("ride-event-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Ride Event Source",
      destination: "Ride Event Destination",
      date: new Date(Date.now() + 172800000),
      seatsAvailable: 2,
      price: 210,
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

    const driverToken = generateToken(driver._id);
    const cancelResponse = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "cancelled" });

    expect(cancelResponse.status).toBe(200);

    const cancelledNotification = await Notification.findOne({
      recipient: passenger._id,
      type: "ride_cancelled",
      relatedRide: ride._id,
    });

    expect(cancelledNotification).not.toBeNull();
    expect(cancelledNotification.title).toMatch(/ride cancelled/i);

    const completedRide = await Ride.create({
      driver: driver._id,
      source: "Completed Event Source",
      destination: "Completed Event Destination",
      date: new Date(Date.now() + 259200000),
      seatsAvailable: 3,
      price: 220,
      vehicle: "Car",
      status: "active",
    });
    createdRideIds.push(completedRide._id);

    const completedBooking = await Booking.create({
      passenger: passenger._id,
      ride: completedRide._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(completedBooking._id);

    const completeResponse = await request(app)
      .patch(`/api/rides/${completedRide._id}`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "completed" });

    expect(completeResponse.status).toBe(200);

    const completedNotification = await Notification.findOne({
      recipient: passenger._id,
      type: "ride_completed",
      relatedRide: completedRide._id,
    });

    expect(completedNotification).not.toBeNull();
    expect(completedNotification.title).toMatch(/ride completed/i);
  });

  it("review submitted notifications are generated for the driver", async () => {
    const driver = await User.create({
      name: "Review Notify Driver",
      email: makeUniqueEmail("review-notify-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Review Notify Passenger",
      email: makeUniqueEmail("review-notify-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Review Notify Source",
      destination: "Review Notify Destination",
      date: new Date(Date.now() - 86400000),
      seatsAvailable: 2,
      price: 150,
      vehicle: "Car",
      status: "completed",
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const reviewResponse = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 5,
        comment: "Great trip",
      });

    expect(reviewResponse.status).toBe(201);
    const notification = await Notification.findOne({
      recipient: driver._id,
      type: "review_received",
      relatedReview: reviewResponse.body.data._id,
    });

    expect(notification).not.toBeNull();
    expect(notification.title).toMatch(/new review received/i);
  });
});
