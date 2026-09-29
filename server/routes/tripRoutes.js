import express from "express";
import {
  getDriverTripSummary,
  getFuelPriceBoard,
  getRideSettlement,
  payContribution,
  quoteRide,
  setContribution,
} from "../controllers/tripController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";
import { autoCompleteDueRides } from "../services/rideLifecycleService.js";

const router = express.Router();

// Lets a scheduler close out departed rides on a timer, so completion
// never depends on somebody remembering to press a button. This is a bulk
// state change, so it is admin-only rather than open to any signed-in user.
router.post(
  "/maintenance/auto-complete",
  protect,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const result = await autoCompleteDueRides();
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Server error while auto-completing rides",
      });
    }
  }
);

// Live-ish fuel board for the region.
router.get("/fuel-price", getFuelPriceBoard);

// What one seat costs on a specific ride.
router.get("/quote/:rideId", protect, quoteRide);

// Contribution and dummy settlement, scoped to a booking.
router.patch("/bookings/:id/contribution", protect, setContribution);
router.post("/bookings/:id/pay", protect, payContribution);
router.get("/bookings/:id/summary", protect, getDriverTripSummary);
router.get("/rides/:id/settlement", protect, getRideSettlement);

export default router;