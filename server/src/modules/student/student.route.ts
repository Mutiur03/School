import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { StudentController } from "@/modules/student/student.controller.js";

const router = express.Router();

router.get(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.getStudentsQueryController,
);

router.get(
  "/attendance-overview",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  StudentController.getAttendanceOverviewController,
);

router.get(
  "/alumni",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.getAlumniController,
);

router.get(
  "/me",
  AuthMiddleware.authenticate(["student"]),
  StudentController.getStudentController,
);

router.post(
  "/bulk",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.addStudentController,
);

router.post(
  "/:id/image/upload-url",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.getStudentImageUploadUrlParamsController,
);

router.put(
  "/:id/image",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.saveStudentImageController,
);

router.put(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.updateStudentController,
);

router.delete(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.deleteStudentController,
);

router.delete(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.deleteStudentsBulkController,
);

router.post(
  "/password-rotations",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.rotatePasswordsBulkController,
);

router.post(
  "/regenerate-all",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.regenerateAllCredentialsController,
);

router.post(
  "/me/password",
  AuthMiddleware.authenticate(["student"]),
  StudentController.changePasswordController,
);

router.post(
  "/:id/testimonials",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.generateTestimonialsController,
);

const studentRouter = express.Router();
studentRouter.use("/api/students", router);

const enrollmentRouter = express.Router();
enrollmentRouter.patch(
  "/:enrollment_id",
  AuthMiddleware.authenticate(["admin"]),
  StudentController.updateAcademicInfoController,
);
studentRouter.use("/api/enrollments", enrollmentRouter);

export default studentRouter;
