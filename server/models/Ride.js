import mongoose from "mongoose";

const rideSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    source: {
      type: String,
      required: true,
      trim: true,
    },

    destination: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: Date,
      required: true,
    },

    seatsAvailable: {
      type: Number,
      required: true,
      min: 0,
      // Guards against obviously fake offers on a personal car.
      validate: {
        validator: (value) => value <= 8,
        message: "You can offer at most 8 seats on a personal car",
      },
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    vehicle: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
    },

    trackingActive: {
      type: Boolean,
      default: false,
    },

    currentLocation: {
      latitude: Number,
      longitude: Number,
      accuracy: Number,
      updatedAt: Date,
    },

    // GeoJSON points (GeoJSON order is [longitude, latitude]).
    // Optional so existing offers created before map picking still work.
    sourcePoint: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined },
    },

    destinationPoint: {
      type: { type: String, enum: ["Point"] },
      coordinates: { type: [Number], default: undefined },
    },

    // How far this driver is willing to detour from their own route.
    maxDetourKm: {
      type: Number,
      default: 5,
      min: 0,
      max: 50,
    },

    // Trip economics, so riders see an honest fuel split instead of a fare.
    distanceKm: {
      type: Number,
      min: 0,
      default: 0,
    },

    fuelCost: {
      type: Number,
      min: 0,
      default: 0,
    },

    fuelPriceAtPosting: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Sparse so rides without coordinates are not indexed for 2dsphere queries.
rideSchema.index({ sourcePoint: "2dsphere" }, { sparse: true });
rideSchema.index({ destinationPoint: "2dsphere" }, { sparse: true });

const Ride = mongoose.model("Ride", rideSchema);

export default Ride;