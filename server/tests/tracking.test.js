import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, Ride, Booking, createdUserIds, createdRideIds, createdBookingIds, makeUniqueEmail } from "./setup.js";

describe("Tracking API", () => {
  it("ride driver can start tracking", async () => {
    const driver = await User.create({
      name: "Tracking Driver",
      email: makeUniqueEmail("tracking-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Track-${Math.random().toString(16).slice(2, 8)}`,
      destination: `TrackDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10368000000),
      seatsAvailable: 3,
      price: 200,
      vehicle: "Car",
      status: "active",
      trackingActive: false,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);
    const response = await request(app)
      .post(`/api/rides/${ride._id}/tracking/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.trackingActive).toBe(true);
  });

  it("driver can update location and retrieve their location", async () => {
    const driver = await User.create({
      name: "Location Driver",
      email: makeUniqueEmail("location-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Loc-${Math.random().toString(16).slice(2, 8)}`,
      destination: `LocDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10497600000),
      seatsAvailable: 2,
      price: 180,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);

    const updateResponse = await request(app)
      .post(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 12.9716, longitude: 77.5946, accuracy: 12 });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.currentLocation.latitude).toBe(12.9716);

    const locationResponse = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`);

    expect(locationResponse.status).toBe(200);
    expect(locationResponse.body.trackingActive).toBe(true);
    expect(locationResponse.body.currentLocation.latitude).toBe(12.9716);
    expect(locationResponse.body.currentLocation.longitude).toBe(77.5946);
  });

  it("booked passenger can retrieve active ride location", async () => {
    const driver = await User.create({
      name: "Passenger Track Driver",
      email: makeUniqueEmail("passenger-track-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Passenger Track Passenger",
      email: makeUniqueEmail("passenger-track-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `BookLoc-${Math.random().toString(16).slice(2, 8)}`,
      destination: `BookLocDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10512000000),
      seatsAvailable: 4,
      price: 160,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
      currentLocation: {
        latitude: 13.0124,
        longitude: 77.5505,
        accuracy: 8,
        updatedAt: new Date(),
      },
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
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.trackingActive).toBe(true);
    expect(response.body.currentLocation.latitude).toBe(13.0124);
  });

  it("unrelated user cannot retrieve location", async () => {
    const driver = await User.create({
      name: "Unauth Location Driver",
      email: makeUniqueEmail("unauth-location-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const outsider = await User.create({
      name: "Unrelated User",
      email: makeUniqueEmail("unrelated-user"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(outsider._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Out-${Math.random().toString(16).slice(2, 8)}`,
      destination: `OutDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10600000000),
      seatsAvailable: 4,
      price: 170,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
      currentLocation: {
        latitude: 15.1234,
        longitude: 75.1234,
        accuracy: 10,
        updatedAt: new Date(),
      },
    });
    createdRideIds.push(ride._id);

    const token = generateToken(outsider._id);
    const response = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/not authorized to view this ride location/i);
  });

  it("cancelled booking cannot retrieve location", async () => {
    const driver = await User.create({
      name: "Cancelled Book Driver",
      email: makeUniqueEmail("cancelled-book-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Cancelled Book Passenger",
      email: makeUniqueEmail("cancelled-book-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `CancelLoc-${Math.random().toString(16).slice(2, 8)}`,
      destination: `CancelLocDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10700000000),
      seatsAvailable: 3,
      price: 210,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
      currentLocation: {
        latitude: 17.4567,
        longitude: 78.4567,
        accuracy: 15,
        updatedAt: new Date(),
      },
    });
    createdRideIds.push(ride._id);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const passengerToken = generateToken(passenger._id);
    const cancelResponse = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(cancelResponse.status).toBe(200);

    const response = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${passengerToken}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/not authorized to view this ride location/i);
  });

  it("non-driver cannot update location", async () => {
    const driver = await User.create({
      name: "Non Driver Update Driver",
      email: makeUniqueEmail("non-driver-update-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherDriver = await User.create({
      name: "Other Driver Update Location",
      email: makeUniqueEmail("other-driver-update-location"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(otherDriver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `NonDriver-${Math.random().toString(16).slice(2, 8)}`,
      destination: `NonDriverDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10800000000),
      seatsAvailable: 2,
      price: 190,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(otherDriver._id);
    const response = await request(app)
      .post(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 12.1, longitude: 77.1, accuracy: 5 });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only manage tracking for your own rides/i);
  });

  it("invalid latitude, longitude, and accuracy are rejected", async () => {
    const driver = await User.create({
      name: "Bad Location Driver",
      email: makeUniqueEmail("bad-location-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `BadLoc-${Math.random().toString(16).slice(2, 8)}`,
      destination: `BadLocDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 10900000000),
      seatsAvailable: 2,
      price: 200,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);

    const latResponse = await request(app)
      .post(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 91, longitude: 77.1, accuracy: 5 });

    expect(latResponse.status).toBe(400);

    const longResponse = await request(app)
      .post(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 12.1, longitude: 181, accuracy: 5 });

    expect(longResponse.status).toBe(400);

    const accuracyResponse = await request(app)
      .post(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`)
      .send({ latitude: 12.1, longitude: 77.1, accuracy: -1 });

    expect(accuracyResponse.status).toBe(400);
  });

  it("driver can stop tracking", async () => {
    const driver = await User.create({
      name: "Stop Driver",
      email: makeUniqueEmail("stop-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Stop-${Math.random().toString(16).slice(2, 8)}`,
      destination: `StopDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 11000000000),
      seatsAvailable: 2,
      price: 210,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);
    const response = await request(app)
      .post(`/api/rides/${ride._id}/tracking/stop`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.trackingActive).toBe(false);
  });

  it("completed and cancelled rides disable tracking through update logic", async () => {
    const driver = await User.create({
      name: "Completed Driver",
      email: makeUniqueEmail("completed-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: `Done-${Math.random().toString(16).slice(2, 8)}`,
      destination: `DoneDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 11100000000),
      seatsAvailable: 2,
      price: 220,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);

    const completeResponse = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "completed" });

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.ride.trackingActive).toBe(false);

    const cancelledRide = await Ride.create({
      driver: driver._id,
      source: `CancelledRide-${Math.random().toString(16).slice(2, 8)}`,
      destination: `CancelledRideDest-${Math.random().toString(16).slice(2, 8)}`,
      date: new Date(Date.now() + 11200000000),
      seatsAvailable: 2,
      price: 230,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(cancelledRide._id);

    const cancelResponse = await request(app)
      .patch(`/api/rides/${cancelledRide._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "cancelled" });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.ride.trackingActive).toBe(false);
  });
});
