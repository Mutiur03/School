import express from "express";
import {
  getStudentsController,
  getStudentController,
  addStudentController,
  updateStudentController,
  deleteStudentController,
  deleteStudentsBulkController,
  getAlumniController,
  updateAcademicInfoController,
  getStudentImageUploadUrlController,
  saveStudentImageController,
  changePasswordController,
  getClassStudentsController,
} from "../controllers/studController.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";
const studRouter = express.Router();
studRouter.get(
  "/getStudents/:year",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  getStudentsController,
);
studRouter.get(
  "/getStudentsByClass/:year/:level",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  getClassStudentsController,
);
studRouter.get("/getAlumni", getAlumniController);
studRouter.get(
  "/getStudent",
  AuthMiddleware.authenticate(["student"]),
  getStudentController,
);
studRouter.post("/addStudents", AuthMiddleware.authenticate(["admin"]),
  addStudentController);
studRouter.post(
  "/get-image-url",
  AuthMiddleware.authenticate(["admin"]),
  getStudentImageUploadUrlController,
);
studRouter.put(
  "/updateStudentImage/:id",
  AuthMiddleware.authenticate(["admin"]),
  saveStudentImageController,
);
studRouter.put("/updateStudent/:id", AuthMiddleware.authenticate(["admin"]),
  updateStudentController);
studRouter.put("/updateacademic/:enrollment_id", AuthMiddleware.authenticate(["admin"]),
  updateAcademicInfoController);
studRouter.delete("/deleteStudent/:id", AuthMiddleware.authenticate(["admin"]),
  deleteStudentController);
studRouter.delete(
  "/deleteStudentsBulk",
  AuthMiddleware.authenticate(["admin"]),
  deleteStudentsBulkController,
);
studRouter.post("/change-password/", changePasswordController);

export default studRouter;
