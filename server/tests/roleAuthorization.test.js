import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  app,
  Booking,
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

const createRide = async (driver, seatsAvailable = 3) => {
  const ride = await Ride.create({
    driver: driver._id,
    source: "Role Test Source",
    destination: "Role Test Destination",
    date: new Date(Date.now() + 86400000),
    seatsAvailable,
    price: 100,
    vehicle: "Car",
    status: "active",
  });
  createdRideIds.push(ride._id);
  return ride;
};

const auth = (user) =>
  `Bearer ${generateToken(user._id)}`;

describe("Role authorization", () => {
  it("allows a passenger to book and rejects a driver booking", async () => {
    const driver = await createUser("Role Driver", ["driver"]);
    const passenger = await createUser("Role Passenger", ["passenger"]);
    const ride = await createRide(driver);

    const passengerResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", auth(passenger))
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(passengerResponse.status).toBe(201);
    createdBookingIds.push(passengerResponse.body.booking._id);

    const driverResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", auth(driver))
      .send({ rideId: ride._id.toString(), seats: 1 });

    expect(driverResponse.status).toBe(403);
  });

  it("allows drivers to create and update their own rides, but not another driver's", async () => {
    const driver = await createUser("Owner Driver", ["driver"]);
    const otherDriver = await createUser("Other Driver", ["driver"]);
    const passenger = await createUser("Non Driver", ["passenger"]);
    const ride = await createRide(driver);

    const createResponse = await request(app)
      .post("/api/rides")
      .set("Authorization", auth(driver))
      .send({
        source: "Created Source",
        destination: "Created Destination",
        date: new Date(Date.now() + 172800000).toISOString(),
        seatsAvailable: 2,
        price: 120,
        vehicle: "Van",
      });

    expect(createResponse.status).toBe(201);
    createdRideIds.push(createResponse.body.ride._id);

    const ownUpdateResponse = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", auth(driver))
      .send({ price: 150 });

    expect(ownUpdateResponse.status).toBe(200);

    const otherUpdateResponse = await request(app)
      .patch(`/api/rides/${ride._id}`)
      .set("Authorization", auth(otherDriver))
      .send({ price: 160 });

    expect(otherUpdateResponse.status).toBe(403);

    const passengerCreateResponse = await request(app)
      .post("/api/rides")
      .set("Authorization", auth(passenger))
      .send({
        source: "Denied Source",
        destination: "Denied Destination",
        date: new Date(Date.now() + 172800000).toISOString(),
        seatsAvailable: 2,
        price: 120,
      });

    expect(passengerCreateResponse.status).toBe(403);
  });

  it("rejects passenger tracking start and allows the owning driver", async () => {
    const driver = await createUser("Tracking Driver", ["driver"]);
    const passenger = await createUser("Tracking Passenger", ["passenger"]);
    const ride = await createRide(driver);

    const passengerResponse = await request(app)
      .post(`/api/rides/${ride._id}/tracking/start`)
      .set("Authorization", auth(passenger));

    expect(passengerResponse.status).toBe(403);

    const driverResponse = await request(app)
      .post(`/api/rides/${ride._id}/tracking/start`)
      .set("Authorization", auth(driver));

    expect(driverResponse.status).toBe(200);
    expect(driverResponse.body.trackingActive).toBe(true);
  });

  it("does not allow public registration to create an admin", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Attempted Admin",
        email: makeUniqueEmail("attempted-admin"),
        password: "secret123",
        roles: ["admin"],
        role: "admin",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.roles).not.toContain("admin");
    const user = await User.findOne({ email: response.body.data.email });
    createdUserIds.push(user._id);
    expect(user.roles).not.toContain("admin");
  });

  it("preserves cancelled booking records when role-protected cancellation succeeds", async () => {
    const driver = await createUser("Cancel Driver", ["driver"]);
    const passenger = await createUser("Cancel Passenger", ["passenger"]);
    const ride = await createRide(driver, 4);

    const bookingResponse = await request(app)
      .post("/api/bookings")
      .set("Authorization", auth(passenger))
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(bookingResponse.status).toBe(201);
    const bookingId = bookingResponse.body.booking._id;
    createdBookingIds.push(bookingId);

    const cancelResponse = await request(app)
      .patch(`/api/bookings/${bookingId}/cancel`)
      .set("Authorization", auth(passenger));

    expect(cancelResponse.status).toBe(200);
    expect((await Booking.findById(bookingId)).status).toBe("cancelled");
  });
});
