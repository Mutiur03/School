import Router from "express";
const staffRouter = Router();
import {
  addStaff,
  getStaffs,
  updateStaff,
  deleteStaff,
  UpdateStaffImage, // added
} from "../controllers/staffController.js";
import { compressImageToLocation } from "../middlewares/compressImageToLocation.js";
import path from "path";
import multer from "multer";
import fs from "fs";


const __dirname = path.resolve();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads/staff");
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        return cb(err, uploadPath);
      }
      cb(null, "uploads/staff");
    });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

staffRouter.post("/add", addStaff);
staffRouter.get("/", getStaffs);
staffRouter.put("/update/:id", updateStaff);
staffRouter.delete("/delete/:id", deleteStaff);

staffRouter.put(
  "/image/:id",
  upload.single("image"),
  compressImageToLocation({
    targetLocation: "uploads/staff",
    targetSizeKB: 200,
  }),
  UpdateStaffImage
);

export default staffRouter;
