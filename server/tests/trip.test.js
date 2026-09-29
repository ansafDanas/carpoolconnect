import request from "supertest";
import { describe, it, expect } from "vitest";
import {
  app,
  generateToken,
  User,
  Ride,
  Booking,
  FuelPrice,
  Message,
  Report,
  createdUserIds,
  createdRideIds,
  createdBookingIds,
  makeUniqueEmail,
} from "./setup.js";
import {
  buildContributionQuote,
  buildDriverSavings,
  calculateFuelCost,
  getFuelPrice,
} from "../services/fuelService.js";
import { autoCompleteDueRides } from "../services/rideLifecycleService.js";

const HOUR = 3600000;

const makeUser = async (overrides = {}) => {
  const user = await User.create({
    name: "Trip User",
    email: makeUniqueEmail("trip"),
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
    source: "A",
    destination: "B",
    date: new Date(Date.now() + 24 * HOUR),
    seatsAvailable: 3,
    price: 0,
    status: "active",
    ...overrides,
  });
  createdRideIds.push(ride._id);
  return ride;
};

describe("Fuel cost maths", () => {
  it("works out litres burned and cost from distance and mileage", () => {
    const result = calculateFuelCost({
      distanceKm: 25,
      mileageKmpl: 15,
      petrolPrice: 107,
    });

    expect(result.litres).toBeCloseTo(1.67, 2);
    expect(result.fuelCost).toBeCloseTo(178.33, 1);
  });

  it("returns zeroes instead of dividing by zero", () => {
    const result = calculateFuelCost({
      distanceKm: 25,
      mileageKmpl: 0,
      petrolPrice: 107,
    });

    expect(result.fuelCost).toBe(0);
    expect(Number.isFinite(result.fuelCost)).toBe(true);
  });

  it("splits the fuel cost evenly and treats the rest as coffee", () => {
    const quote = buildContributionQuote({
      fuelCost: 178,
      seats: 2,
      contributionAmount: 120,
    });

    expect(quote.fuelShare).toBeCloseTo(89, 2);
    expect(quote.friendlyFuelShare).toBe(90);
    expect(quote.coffeeAmount).toBeCloseTo(30, 2);
    expect(quote.contributionAmount).toBe(120);
  });

  it("defaults to the fuel split when nothing is chosen", () => {
    const quote = buildContributionQuote({ fuelCost: 178, seats: 2 });
    expect(quote.contributionAmount).toBe(89);
    expect(quote.coffeeAmount).toBe(0);
  });

  it("frames the driver side as money saved, not earned", () => {
    const savings = buildDriverSavings({
      fuelCost: 178,
      contributionAmount: 120,
    });

    expect(savings.netSaved).toBeCloseTo(-58, 2);
    expect(savings.fullyCovered).toBe(false);
  });

  it("falls back to a Kerala price when none is configured", async () => {
    const price = await getFuelPrice({ city: "kerala" });
    expect(price.petrol).toBeGreaterThan(50);
    expect(price.isLive).toBe(false);
  });

  it("prefers a stored price over the fallback", async () => {
    await FuelPrice.create({
      state: "kerala",
      city: "testcity" + Date.now(),
      petrolPricePerLitre: 111.5,
    });

    const price = await getFuelPrice({ city: "testcity" + Date.now() });
    expect(price.petrol).toBe(111.5);
    expect(price.isLive).toBe(true);
  });
});

describe("Trip contribution API", () => {
  it("fuel board returns a usable price and a sample trip", async () => {
    const response = await request(app).get("/api/trip/fuel-price");

    expect(response.status).toBe(200);
    expect(response.body.data.petrol).toBeGreaterThan(50);
    expect(response.body.data.sample.fuelCost).toBeGreaterThan(0);
  });

  it("a new ride stores the fuel cost derived from driver mileage", async () => {
    const driver = await makeUser({
      roles: ["driver"],
      vehicleInfo: { mileageKmpl: 20 },
    });

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        source: "Kochi",
        destination: "Alappuzha",
        date: new Date(Date.now() + 24 * HOUR).toISOString(),
        seatsAvailable: 2,
        price: 0,
        distanceKm: 30,
      });

    expect(response.status).toBe(201);
    // 30km at 20kmpl = 1.5L
    expect(response.body.ride.distanceKm).toBe(30);
    expect(response.body.ride.fuelCost).toBeGreaterThan(0);
    expect(response.body.ride.fuelPriceAtPosting).toBeGreaterThan(50);
  });

  it("booking pre-fills the honest fuel split", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 180, seatsAvailable: 3 });

    const response = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({ rideId: ride._id.toString(), seats: 2 });

    expect(response.status).toBe(201);
    createdBookingIds.push(response.body.booking._id);
    expect(response.body.booking.contributionAmount).toBe(90);
    expect(response.body.booking.paymentStatus).toBe("unpaid");
  });

  it("rider can raise the contribution and settle it", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 180, seatsAvailable: 3 });
    const token = generateToken(rider._id);

    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 2,
      status: "confirmed",
      fuelShare: 90,
      contributionAmount: 90,
    });
    createdBookingIds.push(booking._id);

    const raised = await request(app)
      .patch(`/api/trip/bookings/${booking._id}/contribution`)
      .set("Authorization", `Bearer ${token}`)
      .send({ contributionAmount: 130 });

    expect(raised.status).toBe(200);
    expect(raised.body.data.booking.coffeeAmount).toBe(40);

    const paid = await request(app)
      .post(`/api/trip/bookings/${booking._id}/pay`)
      .set("Authorization", `Bearer ${token}`);

    expect(paid.status).toBe(200);
    expect(paid.body.data.paymentStatus).toBe("paid");
  });

  it("rejects an absurd contribution", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 100, seatsAvailable: 3 });
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .patch(`/api/trip/bookings/${booking._id}/contribution`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({ contributionAmount: 5000 });

    expect(response.status).toBe(400);
  });

  it("driver summary is framed as savings, not earnings", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 40, seatsAvailable: 3 });
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
      contributionAmount: 120,
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .get(`/api/trip/bookings/${booking._id}/summary`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.netSaved).toBe(80);
    expect(response.body.data.fullyCovered).toBe(true);
    expect(response.body.data.summary).toMatch(/ahead/i);
  });

  it("a shared ride is not shown as a loss for the driver", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 160, seatsAvailable: 4 });
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 2,
      status: "confirmed",
      fuelShare: 80,
      contributionAmount: 85,
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .get(`/api/trip/bookings/${booking._id}/summary`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    // This rider's share of fuel is 160/2 = 80, and they gave 85.
    expect(response.body.data.fuelCost).toBe(80);
    expect(response.body.data.netSaved).toBe(5);
    expect(response.body.data.fullyCovered).toBe(true);
  });

  it("only the passenger can set or pay a contribution", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver, { fuelCost: 100 });
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .patch(`/api/trip/bookings/${booking._id}/contribution`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({ contributionAmount: 100 });

    expect(response.status).toBe(403);
  });
});

describe("Auto complete and safety", () => {
  it("closes out a departed ride so it can be reviewed", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const ride = await makeRide(driver, {
      date: new Date(Date.now() - 5 * HOUR),
      status: "active",
    });

    const result = await autoCompleteDueRides({ graceMinutes: 60 });

    expect(result.completed).toBeGreaterThanOrEqual(1);
    expect((await Ride.findById(ride._id)).status).toBe("completed");
  });

  it("leaves future rides alone", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const ride = await makeRide(driver, {
      date: new Date(Date.now() + 5 * HOUR),
    });

    await autoCompleteDueRides({ graceMinutes: 60 });

    expect((await Ride.findById(ride._id)).status).toBe("active");
  });

  it("chat is closed to people who were not on the trip", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const stranger = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver);
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .post(`/api/social/chat/${booking._id}`)
      .set("Authorization", `Bearer ${generateToken(stranger._id)}`)
      .send({ body: "hello" });

    expect(response.status).toBe(403);
  });

  it("the two people on a trip can message each other", async () => {
    const driver = await makeUser({ roles: ["driver"] });
    const rider = await makeUser({ roles: ["passenger"] });
    const ride = await makeRide(driver);
    const booking = await Booking.create({
      passenger: rider._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const sent = await request(app)
      .post(`/api/social/chat/${booking._id}`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({ body: "I am near the metro station" });

    expect(sent.status).toBe(201);
    expect(sent.body.data.recipient.toString()).toBe(driver._id.toString());

    const thread = await request(app)
      .get(`/api/social/chat/${booking._id}`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(thread.status).toBe(200);
    expect(thread.body.data).toHaveLength(1);

    await Message.deleteMany({ booking: booking._id });
  });

  it("blocks a user and keeps them out of travel buddies", async () => {
    const me = await makeUser({ roles: ["passenger"] });
    const other = await makeUser({ roles: ["passenger"] });

    const blocked = await request(app)
      .post(`/api/social/block/${other._id}`)
      .set("Authorization", `Bearer ${generateToken(me._id)}`);

    expect(blocked.status).toBe(200);

    const fresh = await User.findById(me._id);
    expect(fresh.blockedUsers.map((id) => id.toString())).toContain(
      other._id.toString()
    );
  });

  it("accepts a safety report", async () => {
    const me = await makeUser({ roles: ["passenger"] });
    const other = await makeUser({ roles: ["driver"] });

    const response = await request(app)
      .post(`/api/social/report/${other._id}`)
      .set("Authorization", `Bearer ${generateToken(me._id)}`)
      .send({ reason: "no_show", details: "Waited 20 minutes" });

    expect(response.status).toBe(201);
    await Report.deleteMany({ reporter: me._id });
  });

  it("exposes a public profile with social signals", async () => {
    const person = await makeUser({
      roles: ["driver"],
      bio: "Always up early",
      conversationStarter: "Ask me about the best breakfast in Fort Kochi",
      vibeTags: ["quiet morning", "podcasts"],
    });

    const response = await request(app)
      .get(`/api/social/profile/${person._id}`)
      .set("Authorization", `Bearer ${generateToken(person._id)}`);

    expect(response.status).toBe(200);
    expect(response.body.data.bio).toBe("Always up early");
    expect(response.body.data.vibeTags).toEqual(["quiet morning", "podcasts"]);
    expect(response.body.data).toHaveProperty("ratingCount");
  });
});