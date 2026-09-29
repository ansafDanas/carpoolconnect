import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ride: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ride",
    },

    reason: {
      type: String,
      required: [true, "Please tell us what happened"],
      enum: [
        "unsafe_behaviour",
        "harassment",
        "no_show",
        "wrong_vehicle",
        "overcharging",
        "fake_profile",
        "other",
      ],
    },

    details: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },

    status: {
      type: String,
      enum: ["open", "reviewed", "dismissed", "actioned"],
      default: "open",
    },

    // What an admin actually did, kept for the audit trail.
    resolution: {
      action: {
        type: String,
        enum: [
          "none",
          "warned",
          "suspended",
          "reinstated",
          "ride_cancelled",
          "dismissed",
        ],
        default: "none",
      },
      note: {
        type: String,
        trim: true,
        maxlength: 300,
        default: "",
      },
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      at: Date,
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1, status: 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;