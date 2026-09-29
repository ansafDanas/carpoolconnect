import multer from "multer";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new Error("Only JPG, PNG, and WebP images are supported."));
      return;
    }

    callback(null, true);
  },
});

export const uploadSingleImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "Image must be 5 MB or smaller.",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: error.message || "Please upload a valid image.",
    });
  });
};
