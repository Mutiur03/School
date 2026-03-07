import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { StudentController } from "@/api/student/student.controller.js";

const router = express.Router();

router.get(
  "/getStudents/:year",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  StudentController.getStudentsController,
);

router.get(
  "/getStudentsByClass/:year/:level",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  StudentController.getClassStudentsController,
);

router.get(
  "/getAlumni",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.getAlumniController,
);

router.get(
  "/getStudent",
  AuthMiddleware.authenticate(["student"]),
  StudentController.getStudentController,
);

router.post(
  "/addStudents",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.addStudentController,
);

router.post(
  "/get-image-url",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.getStudentImageUploadUrlController,
);

router.put(
  "/updateStudentImage/:id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.saveStudentImageController,
);

router.put(
  "/updateStudent/:id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.updateStudentController,
);

router.put(
  "/updateacademic/:enrollment_id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.updateAcademicInfoController,
);

router.delete(
  "/deleteStudent/:id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.deleteStudentController,
);

router.delete(
  "/deleteStudentsBulk",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.deleteStudentsBulkController,
);

router.post(
  "/change-password",
  AuthMiddleware.authenticate(["student"]),
  StudentController.changePasswordController,
);

router.post(
  "/generate-testimonials/:id",
  // AuthMiddleware.authenticate(["admin"]),
  StudentController.generateTestimonialsController,
);

const studentRouter = express.Router();
studentRouter.use("/api/students", router);

export default studentRouter;
