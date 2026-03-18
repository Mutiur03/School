import express from "express";
import { TeacherController } from "./teacher.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

// Teacher CRUD operations
router.get("/", TeacherController.getTeachersController);
router.get("/me", AuthMiddleware.authenticate(["teacher"]), TeacherController.getTeacherController);
router.post("/", AuthMiddleware.authenticate(["admin"]), TeacherController.addTeacherController);
router.put("/:id", AuthMiddleware.authenticate(["admin"]), TeacherController.updateTeacherController);
router.delete("/:id", AuthMiddleware.authenticate(["admin"]), TeacherController.deleteTeacherController);

// Teacher image management
router.post("/image/upload-url", AuthMiddleware.authenticate(["admin"]), TeacherController.getTeacherImageUploadUrlController);
router.put("/:id/image", AuthMiddleware.authenticate(["admin"]), TeacherController.saveTeacherImageController);
router.delete("/:id/image", AuthMiddleware.authenticate(["admin"]), TeacherController.removeTeacherImageController);

// Teacher password management
router.post("/change-password", AuthMiddleware.authenticate(["teacher"]), TeacherController.changePasswordController);
router.post("/password-rotations", AuthMiddleware.authenticate(["admin"]), TeacherController.rotatePasswordsBulkController);

// Head message management
router.post("/head-message", AuthMiddleware.authenticate(["admin"]), TeacherController.updateHeadMessageController);
router.get("/head-message", TeacherController.getHeadMessageController);
const teacherRouter = express.Router();
teacherRouter.use("/api/teachers", router);
export default teacherRouter;
