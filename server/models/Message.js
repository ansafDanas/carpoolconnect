import mongoose from "mongoose";

// A short thread between a rider and driver, unlocked only once the
// booking is confirmed. Deliberately minimal: no media, no calls.
const messageSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    body: {
      type: String,
      required: [true, "Message cannot be empty"],
      trim: true,
      maxlength: 500,
    },

    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ booking: 1, createdAt: 1 });

const Message = mongoose.model("Message", messageSchema);

export default Message;