import mongoose from "mongoose";

const fuelPriceSchema = new mongoose.Schema(
  {
    // Indian states, currently Kerala.
    state: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    petrolPricePerLitre: {
      type: Number,
      required: true,
      min: 1,
    },

    dieselPricePerLitre: {
      type: Number,
      min: 0,
      default: 0,
    },

    source: {
      type: String,
      default: "manual",
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

fuelPriceSchema.index({ state: 1, city: 1 }, { unique: true });

const FuelPrice = mongoose.model("FuelPrice", fuelPriceSchema);

export default FuelPrice;