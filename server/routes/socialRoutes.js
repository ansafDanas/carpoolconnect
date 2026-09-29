import express from "express";
import {
  blockUser,
  getMessages,
  getPublicProfile,
  getRegularPartners,
  markMessagesRead,
  reportUser,
  sendMessage,
  unblockUser,
} from "../controllers/socialController.js";
import { protect } from "../middleware/authMiddleware.js";
import { writeLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// Travel buddies you have shared rides with.
router.get("/partners", protect, getRegularPartners);

// Safety actions.
router.post("/block/:userId", protect, blockUser);
router.delete("/block/:userId", protect, unblockUser);
router.post("/report/:userId", protect, writeLimiter, reportUser);

// A public profile is the whole point of a social carpool.
router.get("/profile/:userId", protect, getPublicProfile);

// Trip chat, only between the two people on a confirmed trip.
router.get("/chat/:bookingId", protect, getMessages);
router.post("/chat/:bookingId", protect, writeLimiter, sendMessage);
router.patch("/chat/:bookingId/read", protect, markMessagesRead);

export default router;