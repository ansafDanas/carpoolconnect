import Booking from "../models/Booking.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from "../services/emailService.js";
import { buildContributionQuote } from "../services/fuelService.js";
import { createNotification } from "./notificationController.js";

const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(id);

export const createBooking = async (req, res) => {
  try {
    const { rideId, seats } = req.body;

    const requestedSeats = Number(seats);

    // 1. Check if ride ID was provided
    if (!rideId) {
      return res.status(400).json({
        message: "Ride ID is required",
      });
    }

    if (!isValidId(rideId)) {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    if (!Number.isInteger(requestedSeats) || requestedSeats < 1) {
      return res.status(400).json({
        message: "Seats must be a whole number greater than 0",
      });
    }

    // 2. Find the ride
    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    // 3. Make sure the ride is active and has not departed
    if (ride.status !== "active" || ride.date <= new Date()) {
      return res.status(400).json({
        message: "This ride is no longer available",
      });
    }

    // 4. Prevent the driver from booking their own ride
    if (ride.driver.toString() === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot book your own ride",
      });
    }

    // 5. Check whether this passenger has an active booking for this ride
    const existingBooking = await Booking.findOne({
      passenger: req.user._id,
      ride: rideId,
      status: { $in: ["pending", "confirmed"] },
    });

    if (existingBooking) {
      return res.status(400).json({
        message: "You have already booked this ride",
      });
    }

    // 6. Check available seats
    if (requestedSeats > ride.seatsAvailable) {
      return res.status(400).json({
        message: "Not enough seats are available",
      });
    }

    // Reserve seats atomically so concurrent bookings cannot oversell a ride.
    const updatedRide = await Ride.findOneAndUpdate(
      {
        _id: rideId,
        status: "active",
        seatsAvailable: { $gte: requestedSeats },
      },
      { $inc: { seatsAvailable: -requestedSeats } },
      { returnDocument: "after" }
    );

    if (!updatedRide) {
      return res.status(400).json({
        message: "Not enough seats are available",
      });
    }

    let booking;
    try {
      // Pre-fill the honest fuel split so the rider only has to adjust
      // the optional coffee top-up, never the base cost.
      const initialQuote = buildContributionQuote({
        fuelCost: Number(ride.fuelCost) || 0,
        seats: requestedSeats,
      });

      booking = await Booking.create({
        passenger: req.user._id,
        ride: rideId,
        seats: requestedSeats,
        status: "confirmed",
        fuelShare: initialQuote.friendlyFuelShare,
        coffeeAmount: 0,
        contributionAmount: initialQuote.friendlyFuelShare,
        paymentStatus: "unpaid",
        chatUnlockedAt: new Date(),
      });
    } catch (bookingError) {
      await Ride.updateOne(
        { _id: rideId },
        { $inc: { seatsAvailable: requestedSeats } }
      );
      throw bookingError;
    }

    try {
      await createNotification({
        recipient: updatedRide.driver,
        type: "booking_created",
        title: "New booking received",
        message: "A passenger booked your ride.",
        relatedRide: updatedRide._id,
        relatedBooking: booking._id,
      });
    } catch (notificationError) {
      console.error("Booking notification error:", notificationError);
    }

    try {
      const passenger = await User.findById(req.user._id).select("name email");
      const driver = await User.findById(updatedRide.driver).select("name email");

      await sendBookingConfirmationEmail({
        passengerEmail: passenger?.email,
        passengerName: passenger?.name,
        driverName: driver?.name,
        source: ride.source,
        destination: ride.destination,
        date: ride.date,
        seats: requestedSeats,
        contribution: ride.price * requestedSeats,
        rideReference: ride._id.toString(),
      });
    } catch (emailError) {
      console.error("Booking confirmation email error:", emailError);
    }

    // 9. Return the booking
    res.status(201).json({
      message: "Ride booked successfully",
      booking,
    });
  } catch (error) {
    console.error("Create booking error:", error);
    res.status(500).json({
      message: "Server error while creating booking",
    });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    // A booking belongs to the trip as a whole, so it is visible to the
    // passenger who made it AND to the driver of the ride it is on. Without
    // the driver side, a driver could not read their own incoming requests,
    // open trip chat, or leave the review they are entitled to.
    const asDriver = await Ride.find({
      driver: req.user._id,
    }).distinct("_id");

    const bookings = await Booking.find({
      $or: [
        { passenger: req.user._id },
        ...(asDriver.length ? [{ ride: { $in: asDriver } }] : []),
      ],
    })
      .populate({
        path: "ride",
        populate: {
          path: "driver",
          select: "name email",
        },
      })
      // The driver side needs the passenger to address the conversation.
      .populate({ path: "passenger", select: "name email" })
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: bookings.length,
      bookings,
    });
  } catch (error) {
    console.error("Get my bookings error:", error);

    res.status(500).json({
      message: "Server error while fetching bookings",
    });
  }
};

export const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid booking ID",
      });
    }

    const existingBooking = await Booking.findById(id);

    if (!existingBooking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    if (existingBooking.passenger.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not authorized to cancel this booking",
      });
    }

    if (existingBooking.status === "cancelled") {
      return res.status(400).json({
        message: "Booking is already cancelled",
      });
    }

    const ride = await Ride.findById(existingBooking.ride);

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    if (ride.status === "completed") {
      return res.status(400).json({
        message: "Bookings for completed rides cannot be cancelled",
      });
    }

    // Claim the cancellation once so concurrent requests cannot restore seats twice.
    const booking = await Booking.findOneAndUpdate(
      {
        _id: id,
        passenger: req.user._id,
        status: { $in: ["pending", "confirmed"] },
      },
      { $set: { status: "cancelled" } },
      { returnDocument: "after" }
    );

    if (!booking) {
      return res.status(400).json({
        message: "Booking is already cancelled",
      });
    }

    await Ride.updateOne(
      { _id: ride._id },
      { $inc: { seatsAvailable: booking.seats || 1 } }
    );

    try {
      await createNotification({
        recipient: ride.driver,
        type: "booking_cancelled",
        title: "Booking cancelled",
        message: "A passenger cancelled their booking for this ride.",
        relatedRide: ride._id,
        relatedBooking: booking._id,
      });
    } catch (notificationError) {
      console.error("Booking cancellation notification error:", notificationError);
    }

    try {
      const passenger = await User.findById(booking.passenger).select("name email");
      const driver = await User.findById(ride.driver).select("name email");

      await sendBookingCancellationEmail({
        passengerEmail: passenger?.email,
        passengerName: passenger?.name,
        driverName: driver?.name,
        source: ride.source,
        destination: ride.destination,
        date: ride.date,
        seats: booking.seats,
        contribution: ride.price * (booking.seats || 1),
        rideReference: ride._id.toString(),
      });
    } catch (emailError) {
      console.error("Booking cancellation email error:", emailError);
    }

    res.status(200).json({
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Cancel booking error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid booking reference",
      });
    }

    res.status(500).json({
      message: "Server error while cancelling booking",
    });
  }
};
