import express from "express";
import {
  cancelRideAsAdmin,
  getAdminBookings,
  getAdminReports,
  getAdminRides,
  getAdminUsers,
  resolveReport,
  setUserSuspension,
} from "../controllers/adminController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect, authorizeRoles("admin"));

router.get("/users", getAdminUsers);
router.get("/rides", getAdminRides);
router.get("/bookings", getAdminBookings);
router.delete("/rides/:id", cancelRideAsAdmin);

// Safety moderation.
router.get("/reports", getAdminReports);
router.patch("/reports/:id", resolveReport);
router.patch("/users/:userId/suspension", setUserSuspension);

export default router;
