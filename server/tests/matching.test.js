import request from "supertest";
import { describe, it, expect } from "vitest";
import {
  app,
  generateToken,
  User,
  Ride,
  Booking,
  Review,
  RideRequest,
  createdUserIds,
  createdRideIds,
  createdBookingIds,
  makeUniqueEmail,
} from "./setup.js";
import {
  distanceKm,
  estimateDetourKm,
  rankRidesForRequest,
  rankRequestsForRide,
} from "../services/matchingService.js";

const HOUR = 3600000;

const createUser = async (overrides = {}) => {
  const user = await User.create({
    name: "Match User",
    email: makeUniqueEmail("match"),
    password: "secret123",
    roles: ["passenger"],
    ...overrides,
  });
  createdUserIds.push(user._id);
  return user;
};

const createRide = async (driver, overrides = {}) => {
  const ride = await Ride.create({
    driver: driver._id,
    source: "A",
    destination: "B",
    date: new Date(Date.now() + 24 * HOUR),
    seatsAvailable: 3,
    price: 100,
    status: "active",
    ...overrides,
  });
  createdRideIds.push(ride._id);
  return ride;
};

describe("Matching service", () => {
  it("computes real great-circle distance", () => {
    const kochi = { type: "Point", coordinates: [76.2695, 9.9312] };
    const coimbatore = { type: "Point", coordinates: [77.0295, 11.0168] };

    const km = distanceKm(kochi, coimbatore);

    expect(km).toBeGreaterThan(120);
    expect(km).toBeLessThan(160);
  });

  it("returns null distance when a point is missing", () => {
    expect(distanceKm({ type: "Point", coordinates: [1, 1] }, null)).toBeNull();
  });

  it("estimates a near-zero detour when the rider sits on the driver route", () => {
    const ride = {
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
    };
    const pickup = { type: "Point", coordinates: [76.2, 10.2] };
    const drop = { type: "Point", coordinates: [76.4, 10.4] };

    expect(estimateDetourKm(ride, pickup, drop)).toBeLessThan(1);
  });

  it("detours more when the rider route runs off the driver route", () => {
    const ride = {
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
    };
    const onRoute = estimateDetourKm(
      ride,
      { type: "Point", coordinates: [76.2, 10.2] },
      { type: "Point", coordinates: [76.4, 10.4] }
    );
    const offRoute = estimateDetourKm(
      ride,
      { type: "Point", coordinates: [77.2, 11.2] },
      { type: "Point", coordinates: [77.4, 11.4] }
    );

    expect(offRoute).toBeGreaterThan(onRoute);
  });

  it("ranks the smallest detour first and drops offers beyond the limit", () => {
    const near = {
      _id: "near",
      seatsAvailable: 3,
      maxDetourKm: 10,
      date: new Date(Date.now() + HOUR),
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
      driver: { rating: 5 },
    };
    const far = {
      _id: "far",
      seatsAvailable: 3,
      maxDetourKm: 10,
      date: new Date(Date.now() + HOUR),
      sourcePoint: { type: "Point", coordinates: [78.0, 12.0] },
      destinationPoint: { type: "Point", coordinates: [78.4, 12.4] },
      driver: { rating: 5 },
    };
    const request = {
      seats: 1,
      maxDetourKm: 10,
      earliestTime: new Date(Date.now() + 30 * 60000),
      latestTime: new Date(Date.now() + 90 * 60000),
      pickupPoint: { type: "Point", coordinates: [76.2, 10.2] },
      dropPoint: { type: "Point", coordinates: [76.4, 10.4] },
    };

    const ranked = rankRidesForRequest({ rides: [far, near], request });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].ride._id).toBe("near");
    expect(ranked[0].score).toBeLessThan(1000);
  });

  it("excludes offers that cannot fit the requested seats", () => {
    const ride = {
      _id: "small",
      seatsAvailable: 1,
      maxDetourKm: 10,
      date: new Date(Date.now() + HOUR),
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
      driver: { rating: 5 },
    };
    const request = {
      seats: 3,
      maxDetourKm: 10,
      earliestTime: new Date(Date.now()),
      latestTime: new Date(Date.now() + HOUR),
      pickupPoint: { type: "Point", coordinates: [76.2, 10.2] },
      dropPoint: { type: "Point", coordinates: [76.4, 10.4] },
    };

    expect(rankRidesForRequest({ rides: [ride], request })).toHaveLength(0);
  });
});

describe("Safety preferences in matching", () => {
  const buildRide = (id, driverOverrides = {}) => ({
    _id: id,
    seatsAvailable: 3,
    maxDetourKm: 10,
    date: new Date(Date.now() + HOUR),
    sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
    destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
    driver: { _id: `driver-${id}`, rating: 5, ...driverOverrides },
  });

  const buildRequest = (overrides = {}) => ({
    seats: 1,
    maxDetourKm: 10,
    earliestTime: new Date(Date.now() + 30 * 60000),
    latestTime: new Date(Date.now() + 90 * 60000),
    pickupPoint: { type: "Point", coordinates: [76.2, 10.2] },
    dropPoint: { type: "Point", coordinates: [76.4, 10.4] },
    ...overrides,
  });

  it("never surfaces a driver the rider has blocked", () => {
    const rides = [buildRide("a"), buildRide("b")];
    const ranked = rankRidesForRequest({
      rides,
      request: buildRequest(),
      blockedDriverIds: ["driver-a"],
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].ride._id).toBe("b");
  });

  it("hides a women-only driver from a non-female rider", () => {
    const rides = [
      buildRide("w", { womenOnly: true, gender: "female" }),
      buildRide("open"),
    ];

    const ranked = rankRidesForRequest({
      rides,
      request: buildRequest(),
      riderGender: "male",
    });

    expect(ranked.map((match) => match.ride._id)).toEqual(["open"]);
  });

  it("shows a women-only driver to a female rider", () => {
    const ranked = rankRidesForRequest({
      rides: [buildRide("w", { womenOnly: true, gender: "female" })],
      request: buildRequest(),
      riderGender: "female",
    });

    expect(ranked).toHaveLength(1);
  });

  it("honours a rider who only wants to travel with women", () => {
    const rides = [
      buildRide("male", { gender: "male" }),
      buildRide("woman", { gender: "female" }),
    ];

    const ranked = rankRidesForRequest({
      rides,
      request: buildRequest(),
      riderGender: "female",
      riderWantsWomen: true,
    });

    expect(ranked.map((match) => match.ride._id)).toEqual(["woman"]);
  });

  it("does not show a blocked rider to the driver either", () => {
    const ride = {
      seatsAvailable: 3,
      maxDetourKm: 10,
      date: new Date(Date.now() + HOUR),
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
    };
    const requests = [
      { seats: 1, maxDetourKm: 10, earliestTime: new Date(), latestTime: new Date(Date.now() + HOUR), pickupPoint: buildRide("x").sourcePoint, dropPoint: buildRide("x").destinationPoint, rider: { _id: "rider-bad", rating: 5 } },
      { seats: 1, maxDetourKm: 10, earliestTime: new Date(), latestTime: new Date(Date.now() + HOUR), pickupPoint: buildRide("x").sourcePoint, dropPoint: buildRide("x").destinationPoint, rider: { _id: "rider-ok", rating: 5 } },
    ];

    const ranked = rankRequestsForRide({
      requests,
      ride,
      blockedRiderIds: ["rider-bad"],
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].request.rider._id).toBe("rider-ok");
  });
});

describe("Ride sanity limits", () => {
  it("registration can store a women-only preference and gender", async () => {
    const email = makeUniqueEmail("register-safety");

    const response = await request(app).post("/api/auth/register").send({
      name: "Safety Signup",
      email,
      password: "secret123",
      roles: ["passenger"],
      gender: "female",
      womenOnly: true,
      languages: ["Malayalam"],
    });

    expect(response.status).toBe(201);

    const created = await User.findOne({ email });
    createdUserIds.push(created._id);

    expect(created.womenOnly).toBe(true);
    expect(created.gender).toBe("female");
    expect(created.languages).toEqual(["Malayalam"]);
  });

  it("PATCH /api/users/me persists safety preferences", async () => {
    const user = await createUser({ roles: ["passenger"] });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ gender: "female", womenOnly: true, bio: "Morning rides" });

    expect(response.status).toBe(200);

    const stored = await User.findById(user._id);
    expect(stored.womenOnly).toBe(true);
    expect(stored.gender).toBe("female");
    expect(stored.bio).toBe("Morning rides");
  });

  it("PATCH /api/users/me still cannot escalate roles alongside safety fields", async () => {
    const user = await createUser({ roles: ["passenger"] });

    await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ roles: ["admin"], role: "driver", womenOnly: true });

    const stored = await User.findById(user._id);
    expect(stored.roles).toEqual(["passenger"]);
    expect(stored.womenOnly).toBe(true);
  });

  it("a blocked driver is filtered out of matches", async () => {
    const rider = await createUser({ roles: ["passenger"] });
    const visible = await createUser({ roles: ["driver"] });
    const blocked = await createUser({ roles: ["driver"] });

    const makeRide = async (driver) =>
      createRide(driver, {
        sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
        destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
        maxDetourKm: 10,
      });

    await makeRide(visible);
    await makeRide(blocked);

    const earliest = new Date(Date.now() + HOUR);
    const rideReq = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "Mid",
        drop: "End",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
        maxDetourKm: 10,
        pickupCoordinates: { latitude: 10.2, longitude: 76.2 },
        dropCoordinates: { latitude: 10.4, longitude: 76.4 },
      });

    const before = await request(app)
      .get(`/api/ride-requests/${rideReq.body.data._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`);
    expect(before.body.count).toBe(2);

    await request(app)
      .post(`/api/social/block/${blocked._id}`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`);

    const after = await request(app)
      .get(`/api/ride-requests/${rideReq.body.data._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`);

    expect(after.body.count).toBe(1);
    expect(after.body.data[0].ride.driver._id.toString()).toBe(visible._id.toString());
  });

  it("stores map pins and ranks real Kerala coordinates by detour", async () => {
    const near = await createUser({ roles: ["driver"] });
    const far = await createUser({ roles: ["driver"] });
    const rider = await createUser({ roles: ["passenger"] });

    const kochiToAlappuzha = await createRide(near, {
      source: "Fort Kochi",
      destination: "Alappuzha",
      maxDetourKm: 10,
      sourcePoint: { type: "Point", coordinates: [76.2422, 9.9658] },
      destinationPoint: { type: "Point", coordinates: [76.3388, 9.4981] },
    });

    // A different city entirely, at the same time.
    await createRide(far, {
      source: "Chennai",
      destination: "Madurai",
      maxDetourKm: 50,
      sourcePoint: { type: "Point", coordinates: [80.2707, 13.0827] },
      destinationPoint: { type: "Point", coordinates: [78.1198, 9.9252] },
    });

    const earliest = new Date(Date.now() + HOUR);
    const rideReq = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "Kochi Marine Drive",
        drop: "Alleppey",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + 2 * HOUR).toISOString(),
        seats: 1,
        maxDetourKm: 10,
        pickupCoordinates: { latitude: 9.965, longitude: 76.24 },
        dropCoordinates: { latitude: 9.475, longitude: 76.34 },
      });

    expect(rideReq.status).toBe(201);
    // The pins must survive storage, not be silently dropped.
    const stored = await RideRequest.findById(rideReq.body.data._id);
    expect(stored.pickupPoint.coordinates.map(Number).sort()).toEqual(
      [76.24, 9.965].sort()
    );

    const matches = await request(app)
      .get(`/api/ride-requests/${rideReq.body.data._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`);

    // Chennai must be filtered out even though it is active and in time.
    expect(matches.body.count).toBe(1);
    expect(matches.body.data[0].ride._id.toString()).toBe(
      kochiToAlappuzha._id.toString()
    );
    expect(matches.body.data[0].detourKm).toBeLessThan(10);
    expect(matches.body.data[0].detourKm).toBeGreaterThan(0);
  });

  it("a ride stores its map pins and derives fuel cost from distance", async () => {
    const driver = await createUser({
      roles: ["driver"],
      vehicleInfo: { mileageKmpl: 20 },
    });

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        source: "Fort Kochi",
        destination: "Alappuzha",
        date: new Date(Date.now() + 24 * HOUR).toISOString(),
        seatsAvailable: 3,
        price: 0,
        distanceKm: 60,
        maxDetourKm: 10,
        sourceCoordinates: { latitude: 9.9658, longitude: 76.2422 },
        destinationCoordinates: { latitude: 9.4981, longitude: 76.3388 },
      });

    expect(response.status).toBe(201);
    createdRideIds.push(response.body.ride._id);

    // 60km at 20km/l = 3L, at the stored petrol price.
    expect(response.body.ride.distanceKm).toBe(60);
    expect(response.body.ride.fuelCost).toBeGreaterThan(0);
    expect(response.body.ride.sourcePoint.coordinates).toBeDefined();
  });

  it("rejects coordinates outside the valid range", async () => {
    const driver = await createUser({ roles: ["driver"] });

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        source: "A",
        destination: "B",
        date: new Date(Date.now() + 24 * HOUR).toISOString(),
        seatsAvailable: 2,
        price: 0,
        sourceCoordinates: { latitude: 999, longitude: 76.2 },
      });

    expect(response.status).toBe(400);
  });

  it("a women-only driver is not matched with a male rider", async () => {
    const rider = await createUser({ roles: ["passenger"], gender: "male" });
    const safeDriver = await createUser({
      roles: ["driver"],
      gender: "female",
      womenOnly: true,
    });
    const openDriver = await createUser({ roles: ["driver"], gender: "male" });

    const makeRide = async (driver) =>
      createRide(driver, {
        sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
        destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
        maxDetourKm: 10,
      });

    await makeRide(safeDriver);
    await makeRide(openDriver);

    const earliest = new Date(Date.now() + HOUR);
    const rideReq = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "Mid",
        drop: "End",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
        maxDetourKm: 10,
        pickupCoordinates: { latitude: 10.2, longitude: 76.2 },
        dropCoordinates: { latitude: 10.4, longitude: 76.4 },
      });

    const matches = await request(app)
      .get(`/api/ride-requests/${rideReq.body.data._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`);

    expect(matches.body.count).toBe(1);
    expect(matches.body.data[0].ride.driver._id.toString()).toBe(
      openDriver._id.toString()
    );
  });

  it("rejects an impossible number of seats", async () => {
    const driver = await User.create({
      name: "Big Car Driver",
      email: makeUniqueEmail("seat-cap"),
      password: "secret123",
      roles: ["driver"],
    });
    createdUserIds.push(driver._id);

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        source: "Kochi",
        destination: "Alappuzha",
        date: new Date(Date.now() + 24 * HOUR),
        seatsAvailable: 20,
        price: 0,
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/at most/i);
  });

  it("still allows a normal number of seats", async () => {
    const driver = await User.create({
      name: "Normal Car Driver",
      email: makeUniqueEmail("seat-ok"),
      password: "secret123",
      roles: ["driver"],
    });
    createdUserIds.push(driver._id);

    const response = await request(app)
      .post("/api/rides")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        source: "Kochi",
        destination: "Alappuzha",
        date: new Date(Date.now() + 24 * HOUR),
        seatsAvailable: 3,
        price: 0,
      });

    expect(response.status).toBe(201);
    createdRideIds.push(response.body.ride._id);
  });
});
describe("Ride request API", () => {
  it("rider posts a request with a time window", async () => {
    const rider = await createUser({ roles: ["passenger"] });
    const earliest = new Date(Date.now() + 2 * HOUR);

    const response = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "Kochi",
        drop: "Alappuzha",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 2,
        maxDetourKm: 5,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe("open");
    expect(response.body.data.seats).toBe(2);
  });

  it("rejects a backwards time window", async () => {
    const rider = await createUser({ roles: ["passenger"] });
    const latest = new Date(Date.now() + 4 * HOUR);

    const response = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "A",
        drop: "B",
        earliestTime: latest.toISOString(),
        latestTime: new Date(Date.now() + 2 * HOUR).toISOString(),
        seats: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it("requires authentication", async () => {
    const response = await request(app).post("/api/ride-requests").send({});
    expect(response.status).toBe(401);
  });

  it("rider sees ranked matches for their own request", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const rider = await createUser({ roles: ["passenger"] });
    const riderToken = generateToken(rider._id);

    await createRide(driver, {
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
      maxDetourKm: 10,
    });

    const earliest = new Date(Date.now() + HOUR);
    const created = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickup: "Mid",
        drop: "End",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
        maxDetourKm: 10,
        pickupCoordinates: { latitude: 10.2, longitude: 76.2 },
        dropCoordinates: { latitude: 10.4, longitude: 76.4 },
      });

    expect(created.status).toBe(201);
    const requestId = created.body.data._id;

    const matches = await request(app)
      .get(`/api/ride-requests/${requestId}/matches`)
      .set("Authorization", `Bearer ${riderToken}`);

    expect(matches.status).toBe(200);
    expect(matches.body.count).toBe(1);
    expect(matches.body.data[0].detourKm).toBeLessThan(10);
  });

  it("blocks viewing matches for somebody else's request", async () => {
    const owner = await createUser({ roles: ["passenger"] });
    const other = await createUser({ roles: ["passenger"] });
    const earliest = new Date(Date.now() + 2 * HOUR);

    const created = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(owner._id)}`)
      .send({
        pickup: "A",
        drop: "B",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
      });

    const response = await request(app)
      .get(`/api/ride-requests/${created.body.data._id}/matches`)
      .set("Authorization", `Bearer ${generateToken(other._id)}`);

    expect(response.status).toBe(403);
  });

  it("rider sends the request to a driver, then the driver accepts and a booking is created", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const rider = await createUser({ roles: ["passenger"] });
    const driverToken = generateToken(driver._id);
    const riderToken = generateToken(rider._id);

    const ride = await createRide(driver, {
      seatsAvailable: 3,
      sourcePoint: { type: "Point", coordinates: [76.0, 10.0] },
      destinationPoint: { type: "Point", coordinates: [76.4, 10.4] },
      maxDetourKm: 10,
    });

    const earliest = new Date(Date.now() + HOUR);
    const created = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${riderToken}`)
      .send({
        pickup: "Mid",
        drop: "End",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 2,
        maxDetourKm: 10,
        pickupCoordinates: { latitude: 10.2, longitude: 76.2 },
        dropCoordinates: { latitude: 10.4, longitude: 76.4 },
      });

    const requestId = created.body.data._id;

    const sent = await request(app)
      .post(`/api/ride-requests/${requestId}/send`)
      .set("Authorization", `Bearer ${riderToken}`)
      .send({ rideId: ride._id.toString() });

    expect(sent.status).toBe(200);

    const driverInbox = await request(app)
      .get(`/api/ride-requests/ride/${ride._id}/matches`)
      .set("Authorization", `Bearer ${driverToken}`);

    expect(driverInbox.status).toBe(200);
    expect(driverInbox.body.count).toBe(1);

    const accepted = await request(app)
      .patch(`/api/ride-requests/${requestId}/accept`)
      .set("Authorization", `Bearer ${driverToken}`);

    expect(accepted.status).toBe(200);
    expect(accepted.body.data.booking.status).toBe("confirmed");
    createdBookingIds.push(accepted.body.data.booking._id);

    const updatedRide = await Ride.findById(ride._id);
    expect(updatedRide.seatsAvailable).toBe(1);

    const stored = await RideRequest.findById(requestId);
    expect(stored.status).toBe("matched");
    expect(stored.matchedBooking.toString()).toBe(
      accepted.body.data.booking._id.toString()
    );
  });

  it("only the ride driver can accept a request", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const rider = await createUser({ roles: ["passenger"] });
    const stranger = await createUser({ roles: ["driver"] });
    const ride = await createRide(driver);
    const earliest = new Date(Date.now() + HOUR);

    const created = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "A",
        drop: "B",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
      });

    await request(app)
      .post(`/api/ride-requests/${created.body.data._id}/send`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({ rideId: ride._id.toString() });

    const response = await request(app)
      .patch(`/api/ride-requests/${created.body.data._id}/accept`)
      .set("Authorization", `Bearer ${generateToken(stranger._id)}`);

    expect(response.status).toBe(403);
  });

  it("a declined request does not create a booking or move seats", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const rider = await createUser({ roles: ["passenger"] });
    const ride = await createRide(driver);
    const earliest = new Date(Date.now() + HOUR);

    const created = await request(app)
      .post("/api/ride-requests")
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({
        pickup: "A",
        drop: "B",
        earliestTime: earliest.toISOString(),
        latestTime: new Date(earliest.getTime() + HOUR).toISOString(),
        seats: 1,
      });

    const requestId = created.body.data._id;
    await request(app)
      .post(`/api/ride-requests/${requestId}/send`)
      .set("Authorization", `Bearer ${generateToken(rider._id)}`)
      .send({ rideId: ride._id.toString() });

    const declined = await request(app)
      .patch(`/api/ride-requests/${requestId}/decline`)
      .set("Authorization", `Bearer ${generateToken(driver._id)}`);

    expect(declined.status).toBe(200);
    expect((await RideRequest.findById(requestId)).status).toBe("cancelled");
    expect(await Booking.countDocuments({ ride: ride._id })).toBe(0);
    expect((await Ride.findById(ride._id)).seatsAvailable).toBe(3);
  });
});

describe("Dual role accounts", () => {
  it("registration accepts both roles on one account", async () => {
    const email = makeUniqueEmail("dual-role-register");

    const response = await request(app).post("/api/auth/register").send({
      name: "Dual Role User",
      email,
      password: "secret123",
      roles: ["passenger", "driver"],
    });

    expect(response.status).toBe(201);
    expect(response.body.data.roles).toEqual(
      expect.arrayContaining(["passenger", "driver"])
    );

    const created = await User.findOne({ email });
    createdUserIds.push(created._id);
  });

  it("a passenger can switch to driver and back on the same login", async () => {
    const user = await createUser({ roles: ["passenger"] });
    const token = generateToken(user._id);

    const promoted = await request(app)
      .patch("/api/users/me/roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["passenger", "driver"] });

    expect(promoted.status).toBe(200);
    expect(promoted.body.data.roles).toEqual(
      expect.arrayContaining(["passenger", "driver"])
    );

    const demoted = await request(app)
      .patch("/api/users/me/roles")
      .set("Authorization", `Bearer ${token}`)
      .send({ roles: ["passenger"] });

    expect(demoted.status).toBe(200);
    expect(demoted.body.data.roles).toEqual(["passenger"]);
  });

  it("never grants admin through the self-service roles endpoint", async () => {
    const user = await createUser({ roles: ["passenger"] });

    const response = await request(app)
      .patch("/api/users/me/roles")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ roles: ["admin"] });

    expect(response.status).toBe(400);
    expect((await User.findById(user._id)).roles).toEqual(["passenger"]);
  });

  it("rejects an empty role selection", async () => {
    const user = await createUser({ roles: ["passenger"] });

    const response = await request(app)
      .patch("/api/users/me/roles")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ roles: [] });

    expect(response.status).toBe(400);
  });

  it("blocks vehicle details for a passenger-only account", async () => {
    const user = await createUser({ roles: ["passenger"] });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ vehicleInfo: { make: "Honda", model: "City" } });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/driver role/i);

    const stored = await User.findById(user._id);
    expect(stored.vehicleInfo?.make).toBeUndefined();
  });

  it("allows vehicle details once the driver role is enabled", async () => {
    const user = await createUser({ roles: ["passenger", "driver"] });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ vehicleInfo: { make: "Honda", model: "City" } });

    expect(response.status).toBe(200);
    expect((await User.findById(user._id)).vehicleInfo.make).toBe("Honda");
  });

  it("still allows a passenger to update their name and phone", async () => {
    const user = await createUser({ roles: ["passenger"] });

    const response = await request(app)
      .patch("/api/users/me")
      .set("Authorization", `Bearer ${generateToken(user._id)}`)
      .send({ name: "Renamed Rider", phone: "9876543210" });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Renamed Rider");
  });
});

describe("Bidirectional reviews", () => {
  it("driver and passenger can each review the same completed trip", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const passenger = await createUser({ roles: ["passenger"] });
    const ride = await createRide(driver, { status: "completed" });
    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const byPassenger = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 5,
        comment: "Great driver",
      });

    expect(byPassenger.status).toBe(201);

    const byDriver = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(driver._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 4,
        comment: "Great passenger",
      });

    expect(byDriver.status).toBe(201);
    expect(byDriver.body.data.reviewee.toString()).toBe(
      passenger._id.toString()
    );
    expect((await User.findById(passenger._id)).rating).toBe(4);
    expect(await Review.countDocuments({ booking: booking._id })).toBe(2);
  });

  it("the same person cannot review the same trip twice", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const passenger = await createUser({ roles: ["passenger"] });
    const ride = await createRide(driver, { status: "completed" });
    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const payload = {
      rideId: ride._id.toString(),
      bookingId: booking._id.toString(),
      rating: 5,
    };

    await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send(payload);

    const repeat = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(passenger._id)}`)
      .send(payload);

    expect(repeat.status).toBe(400);
  });

  it("an unrelated user still cannot review the trip", async () => {
    const driver = await createUser({ roles: ["driver"] });
    const passenger = await createUser({ roles: ["passenger"] });
    const stranger = await createUser({ roles: ["passenger"] });
    const ride = await createRide(driver, { status: "completed" });
    const booking = await Booking.create({
      passenger: passenger._id,
      ride: ride._id,
      seats: 1,
      status: "confirmed",
    });
    createdBookingIds.push(booking._id);

    const response = await request(app)
      .post("/api/reviews")
      .set("Authorization", `Bearer ${generateToken(stranger._id)}`)
      .send({
        rideId: ride._id.toString(),
        bookingId: booking._id.toString(),
        rating: 1,
      });

    expect(response.status).toBe(403);
  });
});

