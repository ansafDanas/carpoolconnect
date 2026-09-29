import request from "supertest";
import { describe, it, expect } from "vitest";
import { app, generateToken, User, Ride, Booking, createdUserIds, createdRideIds, createdBookingIds, makeUniqueEmail } from "./setup.js";

describe("Tracking edge cases", () => {
  it("starting tracking is rejected for inactive, completed, or cancelled rides", async () => {
    const driver = await User.create({
      name: "Inactive Tracking Driver",
      email: makeUniqueEmail("inactive-tracking-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const token = generateToken(driver._id);

    const inactiveRide = await Ride.create({
      driver: driver._id,
      source: "Inactive Track Source",
      destination: "Inactive Track Destination",
      date: new Date(Date.now() + 86400000),
      seatsAvailable: 2,
      price: 150,
      vehicle: "Car",
      status: "cancelled",
      trackingActive: false,
    });
    createdRideIds.push(inactiveRide._id);

    const inactiveResponse = await request(app)
      .post(`/api/rides/${inactiveRide._id}/tracking/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(inactiveResponse.status).toBe(400);

    const completedRide = await Ride.create({
      driver: driver._id,
      source: "Completed Track Source",
      destination: "Completed Track Destination",
      date: new Date(Date.now() + 172800000),
      seatsAvailable: 2,
      price: 160,
      vehicle: "Car",
      status: "completed",
      trackingActive: false,
    });
    createdRideIds.push(completedRide._id);

    const completedResponse = await request(app)
      .post(`/api/rides/${completedRide._id}/tracking/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(completedResponse.status).toBe(400);

    const activeRide = await Ride.create({
      driver: driver._id,
      source: "Active Track Source",
      destination: "Active Track Destination",
      date: new Date(Date.now() + 259200000),
      seatsAvailable: 3,
      price: 170,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(activeRide._id);

    const alreadyActiveResponse = await request(app)
      .post(`/api/rides/${activeRide._id}/tracking/start`)
      .set("Authorization", `Bearer ${token}`);

    expect(alreadyActiveResponse.status).toBe(200);
    expect(alreadyActiveResponse.body.trackingActive).toBe(true);
  });

  it("location retrieval without active tracking returns previous location and invalid ride IDs are rejected", async () => {
    const driver = await User.create({
      name: "Previous Location Driver",
      email: makeUniqueEmail("previous-location-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Location Edge Source",
      destination: "Location Edge Destination",
      date: new Date(Date.now() + 345600000),
      seatsAvailable: 2,
      price: 180,
      vehicle: "Car",
      status: "active",
      trackingActive: false,
      currentLocation: {
        latitude: 12.5,
        longitude: 77.5,
        accuracy: 25,
        updatedAt: new Date(),
      },
    });
    createdRideIds.push(ride._id);

    const token = generateToken(driver._id);
    const inactiveLocationResponse = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${token}`);

    expect(inactiveLocationResponse.status).toBe(200);
    expect(inactiveLocationResponse.body.trackingActive).toBe(false);
    expect(inactiveLocationResponse.body.currentLocation.latitude).toBe(12.5);

    const invalidRideResponse = await request(app)
      .get("/api/rides/not-a-valid-id/location")
      .set("Authorization", `Bearer ${token}`);

    expect(invalidRideResponse.status).toBe(400);
    expect(invalidRideResponse.body.message).toMatch(/invalid ride id/i);
  });

  it("active tracking without currentLocation and pending versus confirmed booking authorization are handled correctly", async () => {
    const driver = await User.create({
      name: "Location Wait Driver",
      email: makeUniqueEmail("location-wait-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const passenger = await User.create({
      name: "Pending Booking Passenger",
      email: makeUniqueEmail("pending-booking-passenger"),
      password: "secret123",
      role: "rider",
    });
    createdUserIds.push(passenger._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Wait Source",
      destination: "Wait Destination",
      date: new Date(Date.now() + 432000000),
      seatsAvailable: 2,
      price: 190,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
      currentLocation: null,
    });
    createdRideIds.push(ride._id);

    const driverToken = generateToken(driver._id);
    const driverResponse = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${driverToken}`);

    expect(driverResponse.status).toBe(200);
    expect(driverResponse.body.trackingActive).toBe(true);
    expect(driverResponse.body.currentLocation).toBeNull();

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "pending",
    });
    createdBookingIds.push(booking._id);

    const pendingResponse = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`);

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.success).toBe(true);

    booking.status = "confirmed";
    await booking.save();

    const confirmedResponse = await request(app)
      .get(`/api/rides/${ride._id}/location`)
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`);

    expect(confirmedResponse.status).toBe(200);
    expect(confirmedResponse.body.currentLocation).toBeNull();
  });

  it("unauthorized stop tracking is rejected", async () => {
    const driver = await User.create({
      name: "Stop Guard Driver",
      email: makeUniqueEmail("stop-guard-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(driver._id);

    const otherDriver = await User.create({
      name: "Stop Guard Other Driver",
      email: makeUniqueEmail("stop-guard-other-driver"),
      password: "secret123",
      role: "driver",
    });
    createdUserIds.push(otherDriver._id);

    const ride = await Ride.create({
      driver: driver._id,
      source: "Stop Guard Source",
      destination: "Stop Guard Destination",
      date: new Date(Date.now() + 518400000),
      seatsAvailable: 2,
      price: 200,
      vehicle: "Car",
      status: "active",
      trackingActive: true,
    });
    createdRideIds.push(ride._id);

    const response = await request(app)
      .post(`/api/rides/${ride._id}/tracking/stop`)
      .set("Authorization", `Bearer ${generateToken(otherDriver._id)}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/only manage tracking for your own rides/i);
  });
});
