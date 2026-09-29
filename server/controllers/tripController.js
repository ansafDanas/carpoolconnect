import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import {
  buildContributionQuote,
  buildDriverSavings,
  calculateFuelCost,
  getFuelPrice,
} from "../services/fuelService.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

const round2 = (value) => Math.round(value * 100) / 100;

export const getFuelPriceBoard = async (req, res) => {
  try {
    const city = req.query.city || "kerala";
    const state = req.query.state || "kerala";
    const price = await getFuelPrice({ city, state });

    res.status(200).json({
      success: true,
      data: {
        ...price,
        // A short, honest sample trip so the number is never abstract.
        sample: calculateFuelCost({
          distanceKm: 25,
          mileageKmpl: 15,
          petrolPrice: price.petrol,
        }),
        note: "Prices reflect recent Kerala fuel rates and change daily.",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while loading fuel prices",
    });
  }
};

// What one seat costs on this ride, based on real fuel maths.
export const quoteRide = async (req, res) => {
  try {
    const { rideId } = req.params;

    if (!isValidId(rideId)) {
      return res.status(400).json({ success: false, message: "Invalid ride ID" });
    }

    const ride = await Ride.findById(rideId)
      .populate("driver", "name rating ratingCount profileImage vehicleInfo.mileageKmpl isVerified")
      .lean();

    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const mileage = ride.driver?.vehicleInfo?.mileageKmpl || 15;
    const price = await getFuelPrice({});
    const distance = Number(ride.distanceKm) || 0;

    const fuel = calculateFuelCost({
      distanceKm: distance,
      mileageKmpl: mileage,
      petrolPrice: ride.fuelPriceAtPosting || price.petrol,
    });

    res.status(200).json({
      success: true,
      data: {
        rideId: ride._id,
        ...fuel,
        pricePerLitre: ride.fuelPriceAtPosting || price.petrol,
        quote: buildContributionQuote({
          fuelCost: fuel.fuelCost,
          seats: 1,
        }),
        hasDistance: distance > 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while quoting this ride",
    });
  }
};

// The rider chooses how much to contribute. The floor is the fuel split,
// so nobody can ever be asked for more than the trip actually costs them.
export const setContribution = async (req, res) => {
  try {
    const { id } = req.params;
    const { contributionAmount, paymentMethod } = req.body || {};

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the passenger can set the contribution",
      });
    }

    if (booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "This booking is not active",
      });
    }

    const ride = await Ride.findById(booking.ride);
    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    const totalSeats = Math.max(1, booking.seats || 1);
    const fuelCost = Number(ride.fuelCost) || 0;
    const fuelShare = round2(fuelCost / totalSeats);

    const requested = Number(contributionAmount);

    if (!Number.isFinite(requested) || requested < 0) {
      return res.status(400).json({
        success: false,
        message: "Contribution must be zero or more",
      });
    }

    if (requested > fuelShare * 5) {
      return res.status(400).json({
        success: false,
        message: "That is far beyond the cost of this trip",
      });
    }

    // The honest split is the floor: a passenger may top the trip up with a
    // coffee but never settle less than the fuel it actually costs. The UI
    // enforces this too, but the invariant belongs here so it cannot be
    // bypassed by calling the endpoint directly. Trips with no recorded fuel
    // cost have no floor, so any amount (including zero) is accepted.
    const floorQuote = buildContributionQuote({ fuelCost, seats: totalSeats });
    const floor = floorQuote.friendlyFuelShare;

    if (floor > 0 && requested < floor) {
      return res.status(400).json({
        success: false,
        message: `The fuel split for this trip is ₹${floor}, so that is the minimum contribution`,
        data: { minimum: floor, quote: floorQuote },
      });
    }

    const quote = buildContributionQuote({
      fuelCost,
      seats: totalSeats,
      contributionAmount: requested,
    });

    booking.fuelShare = quote.friendlyFuelShare;
    booking.coffeeAmount = quote.coffeeAmount;
    booking.contributionAmount = quote.contributionAmount;
    booking.paymentStatus = "unpaid";
    booking.paymentMethod =
      typeof paymentMethod === "string" ? paymentMethod.slice(0, 40) : "upi";

    await booking.save();

    res.status(200).json({
      success: true,
      message: "Contribution set",
      data: {
        booking: booking.toObject(),
        quote: buildContributionQuote({
          fuelCost,
          seats: totalSeats,
          contributionAmount: booking.contributionAmount,
        }),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while setting contribution",
    });
  }
};

// Dummy settlement: marks the split as paid without touching real money.
export const payContribution = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Only the passenger can pay",
      });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This contribution is already settled",
      });
    }

    // A trip that was cancelled will not happen, so it must never be marked
    // as settled. This mirrors the confirmed-booking guard on setContribution.
    if (booking.status !== "confirmed") {
      return res.status(400).json({
        success: false,
        message: "This booking is no longer active",
      });
    }

    const ride = await Ride.findById(booking.ride).select("status").lean();
    if (ride && ride.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "This ride was cancelled, so there is nothing to settle",
      });
    }

    booking.paymentStatus = "paid";
    booking.paidAt = new Date();
    await booking.save();

    res.status(200).json({
      success: true,
      message: "Contribution settled",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while settling contribution",
    });
  }
};

// The whole trip in one view: how much fuel it used, how much came back,
// and what the driver is out of pocket. Never per-person amounts.
export const getRideSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid ride ID" });
    }

    const ride = await Ride.findById(id);
    if (!ride) {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }

    if (ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This is not your trip",
      });
    }

    const bookings = await Booking.find({
      ride: ride._id,
      status: "confirmed",
    }).select("seats fuelShare coffeeAmount contributionAmount paymentStatus");

    const contributed = bookings.reduce(
      (total, booking) => total + (Number(booking.contributionAmount) || 0),
      0
    );
    const settled = bookings.filter(
      (booking) => booking.paymentStatus === "paid"
    ).length;

    const fuelCost = Number(ride.fuelCost) || 0;
    const netSaved = round2(contributed - fuelCost);

    res.status(200).json({
      success: true,
      data: {
        rideId: ride._id,
        source: ride.source,
        destination: ride.destination,
        date: ride.date,
        status: ride.status,
        seatsFilled: bookings.reduce((total, b) => total + (b.seats || 1), 0),
        riders: bookings.length,
        settledCount: settled,
        fuelCost: round2(fuelCost),
        contributed: round2(contributed),
        netSaved,
        fullyCovered: contributed >= fuelCost && fuelCost > 0,
        summary:
          netSaved > 0
            ? `Fuel cost you ₹${round2(fuelCost)}. The split covered ₹${round2(contributed)}, so you came out ₹${netSaved} ahead.`
            : `Fuel cost you ₹${round2(fuelCost)} and the split covered ₹${round2(contributed)}.`,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while loading trip settlement",
    });
  }
};
export const getDriverTripSummary = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ success: false, message: "Invalid booking ID" });
    }

    const booking = await Booking.findById(id).populate("ride").lean();
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.ride?.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "This is not your trip",
      });
    }

    const ride = booking.ride;

    // The driver's real cost is the share of the fuel this rider was
    // responsible for, not the whole trip cost, so a shared ride with
    // several people is never shown as a loss.
    const seats = Math.max(1, Number(booking.seats) || 1);
    const ridersShare = round2((Number(ride.fuelCost) || 0) / seats);
    const contributed = Number(booking.contributionAmount) || 0;

    const savings = buildDriverSavings({
      fuelCost: ridersShare,
      contributionAmount: contributed,
    });

    res.status(200).json({
      success: true,
      data: {
        fuelCost: savings.fuelCost,
        contributionAmount: savings.contributionAmount,
        netSaved: savings.netSaved,
        fullyCovered: savings.fullyCovered,
        paymentStatus: booking.paymentStatus,
        seats: booking.seats,
        // Per-person amounts are deliberately not exposed.
        summary:
          savings.netSaved > 0
            ? `You came out ₹${savings.netSaved} ahead on your share of this trip.`
            : "This trip was not fully covered by the fuel split.",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while loading trip summary",
    });
  }
};