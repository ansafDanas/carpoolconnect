import RideRequest from "../models/RideRequest.js";
import Ride from "../models/Ride.js";
import Booking from "../models/Booking.js";
import User from "../models/User.js";
import { createNotification } from "./notificationController.js";
import {
  findRidesForRequest,
  findRequestsForRide,
  estimateDetourKm,
} from "../services/matchingService.js";
import { validatePin } from "../services/placeValidation.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const parseCoordinate = (value) => {
  const latitude = Number(value?.latitude);
  const longitude = Number(value?.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }

  return { type: "Point", coordinates: [longitude, latitude] };
};

// Riders post what they need instead of browsing blindly.
export const createRideRequest = async (req, res) => {
  try {
    const {
      pickup,
      drop,
      earliestTime,
      latestTime,
      seats,
      maxDetourKm,
      notes,
      pickupCoordinates,
      dropCoordinates,
    } = req.body;

    if (!pickup || !drop || !earliestTime || !latestTime || seats === undefined) {
      return res.status(400).json({
        success: false,
        message: "Pickup, drop, time window and seats are required",
      });
    }

    const earliest = new Date(earliestTime);
    const latest = new Date(latestTime);

    if (Number.isNaN(earliest.getTime()) || Number.isNaN(latest.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Time window must be valid",
      });
    }

    if (earliest <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Earliest time must be in the future",
      });
    }

    if (latest <= earliest) {
      return res.status(400).json({
        success: false,
        message: "Latest time must be after the earliest time",
      });
    }

    const requestedSeats = Number(seats);
    if (!Number.isInteger(requestedSeats) || requestedSeats < 1 || requestedSeats > 8) {
      return res.status(400).json({
        success: false,
        message: "Seats must be a whole number between 1 and 8",
      });
    }

    const detourLimit = maxDetourKm === undefined ? 5 : Number(maxDetourKm);

    if (!Number.isFinite(detourLimit) || detourLimit < 0 || detourLimit > 50) {
      return res.status(400).json({
        success: false,
        message: "Max detour must be between 0 and 50 km",
      });
    }

    const pickupPoint = parseCoordinate(pickupCoordinates);
    const dropPoint = parseCoordinate(dropCoordinates);

    if (pickupCoordinates && !pickupPoint) {
      return res.status(400).json({
        success: false,
        message: "Pickup coordinates are invalid",
      });
    }

    if (dropCoordinates && !dropPoint) {
      return res.status(400).json({
        success: false,
        message: "Drop coordinates are invalid",
      });
    }

    // Same rule as ride offers: a pin must sit near the place the rider
    // named, or the detour ranking can be gamed.
    const pickupCheck = validatePin({ text: pickup, point: pickupPoint });
    if (!pickupCheck.ok) {
      return res.status(400).json({ success: false, message: pickupCheck.reason });
    }

    const dropCheck = validatePin({ text: drop, point: dropPoint });
    if (!dropCheck.ok) {
      return res.status(400).json({ success: false, message: dropCheck.reason });
    }

    const request = await RideRequest.create({
      rider: req.user._id,
      pickup: String(pickup).trim(),
      drop: String(drop).trim(),
      earliestTime: earliest,
      latestTime: latest,
      seats: requestedSeats,
      maxDetourKm: detourLimit,
      notes: typeof notes === "string" ? notes.trim() : "",
      pickupPoint: pickupPoint ?? undefined,
      dropPoint: dropPoint ?? undefined,
    });

    await request.populate("rider", "name rating");

    return res.status(201).json({
      success: true,
      message: "Ride request posted",
      data: request,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Invalid ride request",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating ride request",
    });
  }
};

export const getMyRideRequests = async (req, res) => {
  try {
    const requests = await RideRequest.find({ rider: req.user._id })
      .sort({ createdAt: -1 })
      .populate("matchedRide", "source destination date price seatsAvailable")
      .populate("matchedBooking", "status seats");

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while fetching your ride requests",
    });
  }
};

export const getMatchingSummary = async (req, res) => {
  try {
    const openRequests = await RideRequest.countDocuments({
      status: "open",
      latestTime: { $gte: new Date() },
    });

    res.status(200).json({ success: true, data: { openRequests } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while loading matching summary",
    });
  }
};

// Best-fit drivers for one request, ranked by detour.
export const getMatchesForRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid request ID" });
    }

    const request = await RideRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Ride request not found" });
    }

    if (request.rider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view matches for your own request",
      });
    }

    // The rider's block list and travel preferences must be honoured.
    const rider = await User.findById(req.user._id)
      .select("blockedUsers gender womenOnly")
      .lean();

    const matches = await findRidesForRequest(request, {
      blockedDriverIds: rider?.blockedUsers || [],
      // A dual-role account must never be shown its own ride as a match.
      excludeDriverId: req.user._id,
      riderId: req.user._id,
      riderGender: rider?.gender,
      riderWantsWomen: Boolean(rider?.womenOnly),
    });

    res.status(200).json({
      success: true,
      count: matches.length,
      data: matches.map(({ ride, detourKm, timeDifferenceMinutes, timeIsExactMatch, score }) => ({
        ride,
        detourKm,
        timeDifferenceMinutes,
        timeIsExactMatch,
        matchScore: score,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while matching ride requests",
    });
  }
};

export const cancelRideRequest = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid request ID" });
    }

    const request = await RideRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: "Ride request not found" });
    }

    if (request.rider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only cancel your own request",
      });
    }

    if (request.status === "matched") {
      return res.status(400).json({
        success: false,
        message: "This request is already matched. Cancel the booking instead.",
      });
    }

    request.status = "cancelled";
    await request.save();

    res.status(200).json({
      success: true,
      message: "Ride request cancelled",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while cancelling ride request",
    });
  }
};

// Driver inbox: open requests that fit this driver's own offer.
export const getMatchesForRide = async (req, res) => {
  try {
    const { rideId } = req.params;

    if (!isValidId(rideId)) {
      return res.status(400).json({ success: false, message: "Invalid ride ID" });
    }

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "You can only view requests for your own ride",
      });
    }

    const driver = await User.findById(req.user._id)
      .select("blockedUsers gender womenOnly")
      .lean();

    const matches = await findRequestsForRide(ride, {
      blockedRiderIds: driver?.blockedUsers || [],
      driverGender: driver?.gender,
      driverWantsWomen: Boolean(driver?.womenOnly),
    });

    res.status(200).json({
      success: true,
      count: matches.length,
      data: matches.map(({ request, detourKm, timeDifferenceMinutes, timeIsExactMatch, score }) => ({
        request,
        detourKm,
        timeDifferenceMinutes,
        timeIsExactMatch,
        matchScore: score,
      })),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while matching requests to ride",
    });
  }
};

const loadOwnedRequest = async (id, userId) => {
  if (!isValidId(id)) {
    return { error: { status: 400, message: "Invalid request ID" } };
  }

  const request = await RideRequest.findById(id);
  if (!request) {
    return { error: { status: 404, message: "Ride request not found" } };
  }

  if (request.status !== "open") {
    return { error: { status: 400, message: "This request is no longer open" } };
  }

  const ride = await Ride.findById(request.matchedRide);
  if (!ride) {
    return { error: { status: 404, message: "Linked ride not found" } };
  }

  if (ride.driver.toString() !== userId.toString()) {
    return {
      error: {
        status: 403,
        message: "Only the ride driver can respond to this request",
      },
    };
  }

  return { request, ride };
};

export const declineRideRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await loadOwnedRequest(id, req.user._id);

    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    await RideRequest.updateOne(
      { _id: id, status: "open" },
      { $set: { status: "cancelled" } }
    );

    res.status(200).json({ success: true, message: "Ride request declined" });
  } catch (declineError) {
    res.status(500).json({
      success: false,
      message: "Server error while declining ride request",
    });
  }
};

// The rider chooses one of the ranked offers and sends the driver a request.
export const sendRequestToRide = async (req, res) => {
  try {
    const { id } = req.params;
    const { rideId } = req.body;

    if (!isValidId(id) || !isValidId(rideId)) {
      return res.status(400).json({ success: false, message: "Invalid request or ride ID" });
    }

    const request = await RideRequest.findOne({
      _id: id,
      rider: req.user._id,
      status: "open",
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Open ride request not found",
      });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    if (ride.status !== "active" || ride.date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "This ride is no longer available",
      });
    }

    if (ride.driver.toString() === req.user._id.toString()) {
      // A dual-role account can hit this by accident. Explain it rather
      // than leaving a confusing rejection.
      return res.status(400).json({
        success: false,
        code: "OWN_RIDE",
        message:
          "This is your own ride, so you cannot request a seat on it. Browse other rides on this route to find a driver going your way.",
      });
    }

    if (ride.seatsAvailable < request.seats) {
      return res.status(400).json({
        success: false,
        message: "This ride no longer has enough seats",
      });
    }

    const detourKm = estimateDetourKm(
      ride,
      request.pickupPoint,
      request.dropPoint
    );
    const allowedDetour = Math.min(
      Number(ride.maxDetourKm ?? 5),
      Number(request.maxDetourKm ?? 5)
    );

    if (detourKm !== null && detourKm > allowedDetour) {
      return res.status(400).json({
        success: false,
        message: "This ride would add too much detour for your request",
      });
    }

    request.matchedRide = ride._id;
    await request.save();

    try {
      await createNotification({
        recipient: ride.driver,
        type: "request_received",
        title: "New ride request",
        message: `A rider wants a seat from ${request.pickup} to ${request.drop}.`,
        relatedRide: ride._id,
      });
    } catch (notificationError) {
      console.error("Request received notification error:", notificationError);
    }

    res.status(200).json({
      success: true,
      message: "Request sent to the driver",
      data: request,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while sending ride request",
    });
  }
};

// Accepting a request atomically reserves the seats and confirms the booking.
export const acceptRideRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { request, ride, error } = await loadOwnedRequest(id, req.user._id);

    if (error) {
      return res.status(error.status).json({ success: false, message: error.message });
    }

    if (ride.status !== "active" || ride.date <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "This ride is no longer available",
      });
    }

    if (ride.seatsAvailable < request.seats) {
      return res.status(400).json({
        success: false,
        message: "Not enough seats are available for this request",
      });
    }

    // Claim the request first so two drivers cannot both accept it.
    const claimed = await RideRequest.findOneAndUpdate(
      { _id: request._id, status: "open" },
      { $set: { status: "matched", matchedRide: ride._id } },
      { returnDocument: "after" }
    );

    if (!claimed) {
      return res.status(409).json({
        success: false,
        message: "This request was already handled",
      });
    }

    const reservedRide = await Ride.findOneAndUpdate(
      { _id: ride._id, status: "active", seatsAvailable: { $gte: request.seats } },
      { $inc: { seatsAvailable: -request.seats } },
      { returnDocument: "after" }
    );

    if (!reservedRide) {
      await RideRequest.updateOne(
        { _id: request._id },
        { $set: { status: "open" }, $unset: { matchedRide: 1 } }
      );

      return res.status(400).json({
        success: false,
        message: "Not enough seats are available for this request",
      });
    }

    let booking;
    try {
      booking = await Booking.create({
        passenger: request.rider,
        ride: ride._id,
        seats: request.seats,
        status: "confirmed",
      });
    } catch (bookingError) {
      await Ride.updateOne({ _id: ride._id }, { $inc: { seatsAvailable: request.seats } });
      await RideRequest.updateOne(
        { _id: request._id },
        { $set: { status: "open" }, $unset: { matchedRide: 1 } }
      );
      throw bookingError;
    }

    await RideRequest.updateOne(
      { _id: request._id },
      { $set: { matchedBooking: booking._id } }
    );

    try {
      await createNotification({
        recipient: request.rider,
        type: "request_accepted",
        title: "Your ride request was accepted",
        message: `A driver accepted your request from ${request.pickup} to ${request.drop}.`,
        relatedRide: ride._id,
        relatedBooking: booking._id,
      });
    } catch (notificationError) {
      console.error("Request accepted notification error:", notificationError);
    }

    res.status(200).json({
      success: true,
      message: "Ride request accepted",
      data: { request: claimed, ride: reservedRide, booking },
    });
  } catch (acceptError) {
    if (acceptError.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This rider already has an active booking for this ride",
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while accepting ride request",
    });
  }
};