import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Review from "../models/Review.js";
import Ride from "../models/Ride.js";
import User from "../models/User.js";
import { createNotification } from "./notificationController.js";

export const createReview = async (req, res) => {
  try {
    const {
      rideId,
      bookingId,
      rating,
      comment,
    } = req.body;
    const numericRating = Number(rating);

    if (!rideId || !bookingId) {
      return res.status(400).json({
        message: "Ride ID and booking ID are required",
      });
    }

    if (
      !Number.isInteger(numericRating) ||
      numericRating < 1 ||
      numericRating > 5
    ) {
      return res.status(400).json({
        message: "Rating must be a whole number from 1 to 5",
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        message: "Booking not found",
      });
    }

    if (booking.ride.toString() !== rideId) {
      return res.status(400).json({
        message: "Booking does not belong to this ride",
      });
    }

    const normalizedComment = typeof comment === "string" ? comment.trim() : "";

    if (normalizedComment.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Review comment must be 500 characters or fewer",
      });
    }

    if (booking.status === "cancelled") {
      return res.status(400).json({
        message: "Cancelled bookings cannot be reviewed",
      });
    }

    const ride = await Ride.findById(rideId);

    if (!ride) {
      return res.status(404).json({
        message: "Ride not found",
      });
    }

    if (ride.status !== "completed") {
      return res.status(400).json({
        message: "Ride must be completed before reviewing",
      });
    }

    const reviewerId = req.user._id.toString();
    const passengerId = booking.passenger.toString();
    const driverId = ride.driver.toString();
    const isPassenger = reviewerId === passengerId;
    const isDriver = reviewerId === driverId;

    // Both sides of the trip may review each other, but nobody outside it can.
    if (!isPassenger && !isDriver) {
      return res.status(403).json({
        message: "You can only review a trip you were part of",
      });
    }

    const reviewee = isPassenger ? driverId : passengerId;

    if (reviewee === reviewerId) {
      return res.status(400).json({
        message: "You cannot review yourself",
      });
    }

    const existingReview = await Review.findOne({
      booking: bookingId,
      reviewer: req.user._id,
    });

    if (existingReview) {
      return res.status(400).json({
        message: "You have already reviewed this trip",
      });
    }

    const review = await Review.create({
      reviewer: req.user._id,
      reviewee,
      ride: rideId,
      booking: bookingId,
      rating: numericRating,
      comment: normalizedComment,
    });

    const ratingSummary = await Review.aggregate([
      {
        $match: {
          reviewee: new mongoose.Types.ObjectId(reviewee),
        },
      },
      {
        $group: {
          _id: "$reviewee",
          averageRating: { $avg: "$rating" },
        },
      },
    ]);

    const averageRating = ratingSummary[0]?.averageRating || 0;
    const updatedRating = Number(averageRating.toFixed(2));

    await User.findByIdAndUpdate(reviewee, {
      rating: updatedRating,
    });

    await createNotification({
      recipient: reviewee,
      type: "review_received",
      title: "New review received",
      message: isPassenger
        ? "A passenger left a review for your completed ride."
        : "A driver left a review for your completed trip.",
      relatedRide: ride._id,
      relatedBooking: booking._id,
      relatedReview: review._id,
    });

    res.status(201).json({
      success: true,
      message: "Review created successfully",
      data: review,
      updatedRating,
    });
  } catch (error) {
    console.error("Create review error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "This booking has already been reviewed",
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid review reference",
      });
    }

    res.status(500).json({
      message: "Server error while creating review",
    });
  }
};

export const getReviewsForUser = async (req, res) => {
  try {
    const reviews = await Review.find({
      reviewee: req.params.userId,
    })
      .populate("reviewer", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Get user reviews error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      message: "Server error while fetching user reviews",
    });
  }
};

export const getReviewsForRide = async (req, res) => {
  try {
    const reviews = await Review.find({
      ride: req.params.rideId,
    })
      .populate("reviewer", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error("Get ride reviews error:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid ride ID",
      });
    }

    res.status(500).json({
      message: "Server error while fetching ride reviews",
    });
  }
};
