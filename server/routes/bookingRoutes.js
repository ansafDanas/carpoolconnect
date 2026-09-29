import express from "express";
import {
  cancelBooking,
  createBooking,
  getMyBookings,
} from "../controllers/bookingController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Get current user's bookings
router.get("/", protect, getMyBookings);

// Create a booking
router.post("/", protect, authorizeRoles("passenger"), createBooking);

// Cancel a booking
router.patch("/:id/cancel", protect, authorizeRoles("passenger"), cancelBooking);

export default router;
