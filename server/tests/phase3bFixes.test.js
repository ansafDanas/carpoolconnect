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

const createRide = async (driver, status = "active", seatsAvailable = 4) => {
  const ride = await Ride.create({
    driver: driver._id,
    source: "Test Source",
    destination: "Test Destination",
    date: new Date(Date.now() + 86400000),
    seatsAvailable,
    price: 150,
    vehicle: "Sedan",
    status,
  });
  createdRideIds.push(ride._id);
  return ride;
};

const auth = (user) => `Bearer ${generateToken(user._id)}`;

describe("Phase 3B — RBAC & Lifecycle Fixes Regression Suite", () => {
  it("1. Driver cannot delete a completed ride", async () => {
    const driver = await createUser("Completed Delete Driver", ["driver"]);
    const ride = await createRide(driver, "completed");

    const response = await request(app)
      .delete(`/api/rides/${ride._id}`)
      .set("Authorization", auth(driver));

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed rides cannot be cancelled|completed/i);
  });

  it("2 & 3. Driver cancellation/deletion soft-cancels ride, cancels active bookings, preserves history, and notifies passenger", async () => {
    const driver = await createUser("Soft Delete Driver", ["driver"]);
    const passenger = await createUser("Soft Delete Passenger", ["passenger"]);
    const ride = await createRide(driver, "active", 3);

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 2,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const deleteResponse = await request(app)
      .delete(`/api/rides/${ride._id}`)
      .set("Authorization", auth(driver));

    expect(deleteResponse.status).toBe(200);

    const dbRide = await Ride.findById(ride._id);
    expect(dbRide).not.toBeNull();
    expect(dbRide.status).toBe("cancelled");
    expect(dbRide.seatsAvailable).toBe(5);

    const dbBooking = await Booking.findById(booking._id);
    expect(dbBooking).not.toBeNull();
    expect(dbBooking.status).toBe("cancelled");

    const notification = await Notification.findOne({
      recipient: passenger._id,
      type: "ride_cancelled",
      relatedRide: ride._id,
    });
    expect(notification).not.toBeNull();
  });

  it("4. Completed ride cannot be edited", async () => {
    const driver = await createUser("Edit Completed Driver", ["driver"]);
    const ride = await createRide(driver, "completed");

    const response = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", auth(driver))
      .send({ price: 200 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed or cancelled rides cannot be modified|completed/i);
  });

  it("5. Cancelled ride cannot be edited", async () => {
    const driver = await createUser("Edit Cancelled Driver", ["driver"]);
    const ride = await createRide(driver, "cancelled");

    const response = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", auth(driver))
      .send({ price: 200 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed or cancelled rides cannot be modified|cancelled/i);
  });

  it("6. Completed ride booking cannot be cancelled", async () => {
    const driver = await createUser("Completed Booking Driver", ["driver"]);
    const passenger = await createUser("Completed Booking Passenger", ["passenger"]);
    const ride = await createRide(driver, "completed");

    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .patch(`/api/bookings/${booking._id}/cancel`)
      .set("Authorization", auth(passenger));

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/completed rides cannot be cancelled|completed/i);
  });

  it("7. Passenger cannot update vehicle image", async () => {
    const passenger = await createUser("Vehicle Passenger", ["passenger"]);

    const response = await request(app)
      .patch("/api/users/me/vehicle-image")
      .set("Authorization", auth(passenger));

    expect(response.status).toBe(403);
  });

  it("8. Driver can update vehicle image (passes authorization)", async () => {
    const driver = await createUser("Vehicle Driver", ["driver"]);

    const response = await request(app)
      .patch("/api/users/me/vehicle-image")
      .set("Authorization", auth(driver));

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/select an image/i);
  });

  it("9. passenger+driver can update vehicle image (passes authorization)", async () => {
    const multiUser = await createUser("Vehicle Multi", ["passenger", "driver"]);

    const response = await request(app)
      .patch("/api/users/me/vehicle-image")
      .set("Authorization", auth(multiUser));

    expect(response.status).not.toBe(403);
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/select an image/i);
  });

  it("10. roles ['rider'] satisfy passenger authorization", async () => {
    const legacyRider = await createUser("Legacy Rider", ["rider"]);
    const driver = await createUser("Target Driver", ["driver"]);
    const ride = await createRide(driver);

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", auth(legacyRider))
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(response.status).toBe(201);
    createdBookingIds.push(response.body.booking._id);
  });

  it("11. roles ['rider', 'driver'] satisfy both passenger and driver capabilities", async () => {
    const multiLegacyUser = await createUser("Multi Legacy User", ["rider", "driver"]);
    const otherDriver = await createUser("Other Driver 11", ["driver"]);
    const otherRide = await createRide(otherDriver);

    const createRideResponse = await request(app)
      .post("/api/rides")
      .set("Authorization", auth(multiLegacyUser))
      .send({
        source: "Legacy Source",
        destination: "Legacy Dest",
        date: new Date(Date.now() + 172800000).toISOString(),
        seatsAvailable: 3,
        price: 200,
        vehicle: "Car",
      });

    expect(createRideResponse.status).toBe(201);
    createdRideIds.push(createRideResponse.body.ride._id);

    const bookResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", auth(multiLegacyUser))
      .send({ rideId: otherRide._id.toString(), seats: 1 });

    expect(bookResponse.status).toBe(201);
    createdBookingIds.push(bookResponse.body.booking._id);
  });

  it("12. pure admin does not receive req.user.role === 'passenger'", async () => {
    const admin = await createUser("Pure Admin", ["admin"]);

    const response = await request(app)
      .get("/api/users/me")
      .set("Authorization", auth(admin));

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe("admin");
  });

  it("13. passenger cannot access GET /api/rides/my-rides", async () => {
    const passenger = await createUser("MyRides Passenger", ["passenger"]);

    const response = await request(app)
      .get("/api/rides/my-rides")
      .set("Authorization", auth(passenger));

    expect(response.status).toBe(403);
  });

  it("14. driver can access GET /api/rides/my-rides", async () => {
    const driver = await createUser("MyRides Driver", ["driver"]);

    const response = await request(app)
      .get("/api/rides/my-rides")
      .set("Authorization", auth(driver));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it("15. passenger+driver can access GET /api/rides/my-rides", async () => {
    const multiUser = await createUser("MyRides Multi", ["passenger", "driver"]);

    const response = await request(app)
      .get("/api/rides/my-rides")
      .set("Authorization", auth(multiUser));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
