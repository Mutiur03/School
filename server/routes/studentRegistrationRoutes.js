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
  importRegistrationsFromExcel,
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

// Multer setup for Excel files
const uploadExcel = multer({
  dest: "uploads/temp/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB for Excel files
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    console.log("File received:", file.originalname, file.mimetype);
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.mimetype === "application/vnd.ms-excel" ||
      file.mimetype === "application/octet-stream" || // Sometimes Excel files are detected as this
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls")
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Only Excel files (.xlsx, .xls) are allowed. Received: ${file.mimetype}`
        ),
        false
      );
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

// Error handling for Excel uploads
const handleExcelMulterError = (err, req, res, next) => {
  console.error("Multer error:", err);
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 10MB.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        success: false,
        message: "Unexpected field name. Please use 'excel' as the field name.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }
  if (err.message && err.message.includes("Only Excel files")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  if (err.message && err.message.includes("Unexpected end of form")) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file upload. Please ensure you're uploading a valid Excel file with the correct form field name 'excel'.",
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
studentRegistrationRouter.post(
  "/import",
  (req, res, next) => {
    // Debug middleware to check content type
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Request headers:", req.headers);
    next();
  },
  uploadExcel.single("excel"),
  handleExcelMulterError,
  importRegistrationsFromExcel
);
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
