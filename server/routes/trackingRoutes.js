import express from "express";
import {
  getLocation,
  startTracking,
  stopTracking,
  updateLocation,
} from "../controllers/trackingController.js";
import { authorizeRoles, protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/:id/tracking/start", protect, authorizeRoles("driver"), startTracking);
router.post("/:id/tracking/stop", protect, authorizeRoles("driver"), stopTracking);
router.post("/:id/location", protect, authorizeRoles("driver"), updateLocation);
router.get("/:id/location", protect, getLocation);

export default router;