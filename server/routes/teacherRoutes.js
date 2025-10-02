import express from "express";
import {
  addTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  UpdateTeacherImage,
  changePassword,
  head_msg_update,
  get_head_msg, // add this import
} from "../controllers/teacherController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { teacher_me } from "../middlewares/auth.js";
import { compressImageToLocation } from "../middlewares/compressImageToLocation.js";
import { authenticateAdmin } from "../controllers/authController.js";
const routerTeacher = express.Router();

const __dirname = path.resolve();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads/teacher");
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        return cb(err, uploadPath);
      }
      cb(null, "uploads/teacher");
    });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });

routerTeacher.post("/addTeacher", addTeacher);
routerTeacher.get("/getTeachers", getTeachers);
routerTeacher.put("/updateTeacher/:id", updateTeacher);
routerTeacher.delete("/deleteTeacher/:id", deleteTeacher);
routerTeacher.put("/update_head_msg",authenticateAdmin, head_msg_update);
routerTeacher.get("/get_head_msg", get_head_msg);
routerTeacher.post(
  "/uploadImage/:id",
  upload.single("image"),
  compressImageToLocation({
    targetLocation: "uploads/teacher",
    targetSizeKB: 200,
  }),
  UpdateTeacherImage
);

routerTeacher.post("/change-password", teacher_me, changePassword);

export default routerTeacher;
