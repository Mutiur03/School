import { Router } from "express";
import {
  creatOrUpdateAdmission,
  getAdmission,
} from "../controllers/admissionController.js";
import multer from "multer";
import fs from "fs";
import path from "path";

// import all controllers
// import SessionController from './app/controllers/SessionController';

const admmissionRoutes = new Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = "uploads/temp/";
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      "admission-notice-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Upload notice: use POST with multer handling the file field named 'notice'
admmissionRoutes.post("/", upload.single("notice"), creatOrUpdateAdmission);

// Retrieve current admission notice: GET
admmissionRoutes.get("/", getAdmission);
// admmissionRoutes.put("/", SessionController.store);
// admmissionRoutes.delete('/', SessionController.store);

export default admmissionRoutes;
