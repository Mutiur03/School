import router from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  createOrUpdateSSCReg,
  getSSCReg,
  deleteSSCRegNotice,
} from "../controllers/regSSCController.js";

const regSSCRouter = router.Router();

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
    cb(null, "ssc-notice-" + uniqueSuffix + path.extname(file.originalname));
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

regSSCRouter.post("/", upload.single("notice"), createOrUpdateSSCReg);
regSSCRouter.get("/", getSSCReg);
regSSCRouter.delete("/", deleteSSCRegNotice);

export default regSSCRouter;
