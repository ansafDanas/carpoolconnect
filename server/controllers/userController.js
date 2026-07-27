import User from "../models/User.js";
export const getMyProfile = async (
  req,
  res
) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const updateMyProfile = async (
  req,
  res
) => {
  try {
    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    user.name =
      req.body.name || user.name;

    user.phone =
      req.body.phone || user.phone;

    user.vehicleInfo = {
      make:
        req.body.vehicleInfo?.make ||
        user.vehicleInfo?.make,

      model:
        req.body.vehicleInfo?.model ||
        user.vehicleInfo?.model,

      color:
        req.body.vehicleInfo?.color ||
        user.vehicleInfo?.color,

      plateNumber:
        req.body.vehicleInfo
          ?.plateNumber ||
        user.vehicleInfo?.plateNumber,
    };

    const updatedUser =
      await user.save();

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};