import express from "express";
import {
  addTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  UpdateTeacherImage,
} from "../controllers/teacherController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
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

routerTeacher.post(
  "/uploadImage/:id",
  upload.single("image"),
  UpdateTeacherImage
);
export default routerTeacher;
