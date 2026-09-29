import mongoose from "mongoose";

// A rider posts what they need. Drivers are matched against it and can accept.
const rideRequestSchema = new mongoose.Schema(
  {
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    pickup: {
      type: String,
      required: [true, "Pickup point is required"],
      trim: true,
      maxlength: 100,
    },

    drop: {
      type: String,
      required: [true, "Drop point is required"],
      trim: true,
      maxlength: 100,
    },

    // Riders are often flexible, so a window is used instead of a single time.
    earliestTime: {
      type: Date,
      required: [true, "Earliest time is required"],
    },

    latestTime: {
      type: Date,
      required: [true, "Latest time is required"],
    },

    seats: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Seats must be a whole number",
      },
    },

    maxDetourKm: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    pickupPoint: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined },
    },

    dropPoint: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined },
    },

    status: {
      type: String,
      enum: ["open", "matched", "cancelled", "expired"],
      default: "open",
    },

    matchedRide: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
    },

    matchedBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
    },
  },
  { timestamps: true }
);

rideRequestSchema.index({ rider: 1, createdAt: -1 });
rideRequestSchema.index({ pickupPoint: "2dsphere" }, { sparse: true });
rideRequestSchema.index({ status: 1, earliestTime: 1, latestTime: 1 });

const RideRequest = mongoose.model("RideRequest", rideRequestSchema);

export default RideRequest;