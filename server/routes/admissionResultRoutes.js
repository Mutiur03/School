import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  getAdmissionResults,
  createAdmissionResult,
  updateAdmissionResult,
  deleteAdmissionResult,
  getAdmissionResultById,
} from "../controllers/admissionResultController.js";

const admissionResultRouter = Router();
const __dirname = path.resolve();
const storagePath = path.join(__dirname, "uploads/admission-results");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(storagePath, { recursive: true }, (err) => {
      if (err) {
        return cb(err, storagePath);
      }
      cb(null, "uploads/admission-results");
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({
  storage,
  // limits: {
  //   fileSize: 10 * 1024 * 1024, 
  // },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

admissionResultRouter.get("/", getAdmissionResults);
admissionResultRouter.get("/:id", getAdmissionResultById);
admissionResultRouter.post(
  "/",
  upload.fields([
    { name: "merit_list", maxCount: 1 },
    { name: "waiting_list_1", maxCount: 1 },
    { name: "waiting_list_2", maxCount: 1 },
  ]),
  createAdmissionResult
);
admissionResultRouter.put(
  "/:id",
  upload.fields([
    { name: "merit_list", maxCount: 1 },
    { name: "waiting_list_1", maxCount: 1 },
    { name: "waiting_list_2", maxCount: 1 },
  ]),
  updateAdmissionResult
);
admissionResultRouter.delete("/:id", deleteAdmissionResult);

export default admissionResultRouter;
