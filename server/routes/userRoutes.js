import express from "express";

import { protect, authorizeRoles } from "../middleware/authMiddleware.js";
import { uploadSingleImage } from "../middleware/imageUploadMiddleware.js";

import {
  getMyProfile,
  updateMyProfile,
  updateMyRoles,
  uploadProfileImage,
  uploadVehicleImage,
} from "../controllers/userController.js";

const router = express.Router();

router.get(
  "/me",
  protect,
  getMyProfile
);
router.patch(
  "/me",
  protect,
  updateMyProfile
);
// Switch between passenger and driver (or both) on the same account.
router.patch(
  "/me/roles",
  protect,
  updateMyRoles
);
router.patch(
  "/me/profile-image",
  protect,
  uploadSingleImage,
  uploadProfileImage
);
router.patch(
  "/me/vehicle-image",
  protect,
  authorizeRoles("driver"),
  uploadSingleImage,
  uploadVehicleImage
);

export default router;