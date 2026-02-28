import express from "express";
import {
  addTeacher,
  getTeachers,
  updateTeacher,
  deleteTeacher,
  getTeacherImageUploadUrlController,
  saveTeacherImageController,
  removeTeacherImageController,
  changePassword,
  head_msg_update,
  get_head_msg,
} from "../controllers/teacherController.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";
const routerTeacher = express.Router();

routerTeacher.post("/addTeacher", addTeacher);
routerTeacher.get("/getTeachers", getTeachers);
routerTeacher.put("/updateTeacher/:id", updateTeacher);
routerTeacher.delete("/deleteTeacher/:id", deleteTeacher);
routerTeacher.put(
  "/update_head_msg",
  AuthMiddleware.authenticate(["admin"]),
  head_msg_update,
);
routerTeacher.get("/get_head_msg", get_head_msg);
routerTeacher.post("/get-image-url", getTeacherImageUploadUrlController);
routerTeacher.put("/updateTeacherImage/:id", saveTeacherImageController);
routerTeacher.delete("/removeTeacherImage/:id", removeTeacherImageController);

routerTeacher.post(
  "/change-password",
  AuthMiddleware.authenticate(["teacher"]),
  changePassword,
);

export default routerTeacher;
