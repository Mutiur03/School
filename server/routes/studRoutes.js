import express from "express";
import {
  getStudentsController,
  getStudentController,
  addStudentController,
  updateStudentController,
  deleteStudentController,
  getAlumniController,
  updateAcademicInfoController,
  updateStudentImageController,
  changePasswordController,
} from "../controllers/studController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
const studRouter = express.Router(); 
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join("uploads", "students");
    if (!fs.existsSync(dir)) { 
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage });
// Route to create student table  
studRouter.get("/getStudents/:year", getStudentsController);
studRouter.get("/getAlumni", getAlumniController); 
studRouter.get("/getStudent", getStudentController);
studRouter.post("/addStudents",addStudentController); 
studRouter.post("/updateStudentImage/:id", upload.single("image"), updateStudentImageController);
studRouter.put("/updateStudent/:id", updateStudentController);
studRouter.put('/updateacademic/:enrollment_id', updateAcademicInfoController);
studRouter.delete("/deleteStudent/:id",deleteStudentController);
studRouter.post("/change-password/", changePasswordController);
 
export default studRouter;
 