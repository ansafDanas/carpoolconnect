import Ride from "../models/Ride.js";
import RideRequest from "../models/RideRequest.js";

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Great-circle distance in kilometres between two GeoJSON point objects.
export const distanceKm = (pointA, pointB) => {
  if (!pointA?.coordinates || !pointB?.coordinates) {
    return null;
  }

  const [lng1, lat1] = pointA.coordinates.map(Number);
  const [lng2, lat2] = pointB.coordinates.map(Number);

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
};

// Extra kilometres the driver travels by inserting the rider's leg.
export const estimateDetourKm = (ride, pickupPoint, dropPoint) => {
  const direct =
    distanceKm(ride.sourcePoint, ride.destinationPoint) ?? 0;
  const toPickup = distanceKm(ride.sourcePoint, pickupPoint);
  const between = distanceKm(pickupPoint, dropPoint);
  const toDrop = distanceKm(dropPoint, ride.destinationPoint);

  if ([toPickup, between, toDrop].some((value) => value === null)) {
    return null;
  }

  return Math.max(0, toPickup + between + toDrop - direct);
};

const timeOverlapMinutes = (ride, request) => {
  const rideTime = new Date(ride.date).getTime();
  const earliest = new Date(request.earliestTime).getTime();
  const latest = new Date(request.latestTime).getTime();

  const overlapStart = Math.max(rideTime, earliest);
  const overlapEnd = Math.min(rideTime, latest);
  const overlapMs = Math.max(0, overlapEnd - overlapStart);

  if (overlapMs > 0) {
    return { minutes: overlapMs / 60000, exact: true };
  }

  const gapMs = Math.min(Math.abs(rideTime - earliest), Math.abs(rideTime - latest));
  return { minutes: gapMs / 60000, exact: false };
};

// Lower score is better. Detour dominates because the product promise is
// "least detour first"; time fit and driver trust break ties.
const scoreMatch = ({ detourKm, timeMinutes, exactTimeMatch, rating, seatsLeft }) => {
  const detourScore = Math.min(detourKm, 50) * 10;
  const timeScore = Math.min(timeMinutes, 240) * (exactTimeMatch ? 0.5 : 2);
  const ratingScore = ((5 - (Number(rating) || 5)) * 4);
  const seatScore = seatsLeft <= 1 ? 15 : 0;

  return Number((detourScore + timeScore + ratingScore + seatScore).toFixed(2));
};

// Ranks active offers against one request. Returns only offers the driver can
// actually serve without an unreasonable detour.
export const rankRidesForRequest = ({
  rides,
  request,
  excludeDriverId,
  blockedDriverIds = [],
  riderId,
  riderGender = "undisclosed",
  riderWantsWomen = false,
}) => {
  const scored = [];
  const blocked = new Set(blockedDriverIds.map((id) => id.toString()));

  for (const ride of rides) {
    if (!ride.seatsAvailable || ride.seatsAvailable < request.seats) {
      continue;
    }

    const driverId = ride.driver?._id?.toString();

    if (excludeDriverId && driverId === excludeDriverId.toString()) {
      continue;
    }

    // Never surface somebody the rider has blocked, and respect a
    // women-only preference on the rider's profile.
    if (driverId && blocked.has(driverId)) {
      continue;
    }

    // "Women only" means this account will only travel with other women,
    // whoever is driving or riding.
    const driverWantsWomenOnly = Boolean(ride.driver?.womenOnly);
    const riderWantsWomenOnly = Boolean(riderWantsWomen);
    const riderIsWoman = riderGender === "female";
    const driverIsWoman = ride.driver?.gender === "female";

    if (driverWantsWomenOnly && !riderIsWoman) {
      continue;
    }

    if (riderWantsWomenOnly && !driverIsWoman) {
      continue;
    }

    const detourKm = estimateDetourKm(ride, request.pickupPoint, request.dropPoint);

    // Without coordinates we cannot promise a small detour, so treat it as
    // unknown and only include it when the rider accepts a wide detour.
    const allowedDetour = Math.min(
      Number(ride.maxDetourKm ?? 5),
      Number(request.maxDetourKm ?? 5)
    );

    if (detourKm !== null && detourKm > allowedDetour) {
      continue;
    }

    const time = timeOverlapMinutes(ride, request);
    const rating = ride.driver?.rating;

    scored.push({
      ride,
      detourKm: detourKm === null ? null : Number(detourKm.toFixed(2)),
      timeDifferenceMinutes: Number(time.minutes.toFixed(0)),
      timeIsExactMatch: time.exact,
      score: scoreMatch({
        detourKm: detourKm === null ? allowedDetour : detourKm,
        timeMinutes: time.minutes,
        exactTimeMatch: time.exact,
        rating,
        seatsLeft: ride.seatsAvailable,
      }),
    });
  }

  return scored.sort((a, b) => a.score - b.score);
};

// Ranks open requests against one driver offer (used on the driver side).
export const rankRequestsForRide = ({
  requests,
  ride,
  blockedRiderIds = [],
  driverGender = "undisclosed",
  driverWantsWomen = false,
}) => {
  const scored = [];
  const blocked = new Set(blockedRiderIds.map((id) => id.toString()));

  for (const request of requests) {
    if (request.seats > ride.seatsAvailable) {
      continue;
    }

    const riderId = request.rider?._id?.toString();

    if (riderId && blocked.has(riderId)) {
      continue;
    }

    // "Women only" is honoured from both sides of the match.
    if (request.rider?.womenOnly && driverGender !== "female") {
      continue;
    }

    if (driverWantsWomen && request.rider?.gender !== "female") {
      continue;
    }

    const detourKm = estimateDetourKm(ride, request.pickupPoint, request.dropPoint);
    const allowedDetour = Math.min(
      Number(ride.maxDetourKm ?? 5),
      Number(request.maxDetourKm ?? 5)
    );

    if (detourKm !== null && detourKm > allowedDetour) {
      continue;
    }

    const time = timeOverlapMinutes(ride, request);

    scored.push({
      request,
      detourKm: detourKm === null ? null : Number(detourKm.toFixed(2)),
      timeDifferenceMinutes: Number(time.minutes.toFixed(0)),
      timeIsExactMatch: time.exact,
      score: scoreMatch({
        detourKm: detourKm === null ? allowedDetour : detourKm,
        timeMinutes: time.minutes,
        exactTimeMatch: time.exact,
        rating: request.rider?.rating,
        seatsLeft: ride.seatsAvailable,
      }),
    });
  }

  return scored.sort((a, b) => a.score - b.score);
};

// How far around a pickup point to search. Wide enough to still find a
// driver whose origin is offset from the rider's exact point.
const PREFILTER_KM = 40;

const baseQuery = {
  status: "active",
  date: { $gte: new Date() },
};

export const findRidesForRequest = async (request, options = {}) => {
  const hasPickup = Array.isArray(request.pickupPoint?.coordinates);

  // Use the 2dsphere index to prefilter when we have coordinates, instead
  // of loading every active ride into memory. Without coordinates we fall
  // back to the time-scoped query.
  const filter = hasPickup
    ? {
        ...baseQuery,
        sourcePoint: {
          $near: {
            $geometry: request.pickupPoint,
            $maxDistance: PREFILTER_KM * 1000,
          },
        },
      }
    : baseQuery;

  const rides = await Ride.find(filter)
    .limit(hasPickup ? 300 : 200)
    .populate("driver", "name email rating ratingCount profileImage isVerified womenOnly gender");

  return rankRidesForRequest({ rides, request, ...options });
};

export const findRequestsForRide = async (ride, options = {}) => {
  const hasPickup = Array.isArray(ride.sourcePoint?.coordinates);

  const filter = hasPickup
    ? {
        status: "open",
        latestTime: { $gte: new Date() },
        pickupPoint: {
          $near: {
            $geometry: ride.sourcePoint,
            $maxDistance: PREFILTER_KM * 1000,
          },
        },
      }
    : {
        status: "open",
        latestTime: { $gte: new Date() },
      };

  const requests = await RideRequest.find(filter)
    .limit(hasPickup ? 200 : 300)
    .populate("rider", "name email rating ratingCount profileImage isVerified womenOnly gender");

  return rankRequestsForRide({ requests, ride, ...options });
};