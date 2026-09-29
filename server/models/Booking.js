import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    passenger: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
      required: true,
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
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "confirmed",
    },

    // The honest fuel split plus any optional coffee contribution.
    fuelShare: {
      type: Number,
      min: 0,
      default: 0,
    },

    coffeeAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    contributionAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "processing", "paid", "failed"],
      default: "unpaid",
    },

    paidAt: Date,

    // Chat becomes available once a booking is confirmed.
    chatUnlockedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Prevent multiple active bookings while preserving cancelled booking history
bookingSchema.index(
  { passenger: 1, ride: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending", "confirmed"] },
    },
  }
);

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;
