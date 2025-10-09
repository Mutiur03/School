import router from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistration,
  updateRegistrationStatus,
  deleteRegistration,
  exportRegistrations,
  exportImages,
  downloadRegistrationPDF,
} from "../controllers/studentRegistrationController.js";

const studentRegistrationRouter = router.Router(); 

// Simplified multer setup for temporary storage
const upload = multer({
  dest: "uploads/temp/",
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// Simplified error handling
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size too large. Maximum size is 2MB.",
    });
  }
  if (err.message === "Only image files are allowed") {
    return res.status(400).json({
      success: false,
      message: "Only image files are allowed",
    });
  }
  next(err);
};

// Routes
studentRegistrationRouter.post(
  "/",
  upload.single("photo"),
  handleMulterError,
  createRegistration
);
studentRegistrationRouter.get("/", getAllRegistrations);
studentRegistrationRouter.get("/export", exportRegistrations);
studentRegistrationRouter.get("/export-images", exportImages);
studentRegistrationRouter.get("/:id", getRegistrationById);
studentRegistrationRouter.get("/:id/pdf", downloadRegistrationPDF);
studentRegistrationRouter.put("/:id/status", updateRegistrationStatus);
studentRegistrationRouter.put(
  "/:id",
  upload.single("photo"),
  handleMulterError,
  updateRegistration
);
studentRegistrationRouter.delete("/:id", deleteRegistration);

export default studentRegistrationRouter;
