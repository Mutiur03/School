import express from "express";
import { AuthController } from "@/api/auth/auth.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  adminLoginSchema,
  addAdminSchema,
  teacherLoginSchema,
  studentLoginSchema,
} from "@school/shared-schemas";
import { ApiResponse } from "@/utils/ApiResponse.js";
import rateLimit from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";

const router = express.Router();
const authStore = new MemoryStore();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 500 : 100,
  message: {
    message: "Too many attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: authStore,
});

router.post(
  "/admin/sessions",
  validate(adminLoginSchema),
  AuthController.login,
);
router.post(
  "/student/sessions",
  validate(studentLoginSchema),
  AuthController.student_login,
);
router.post(
  "/teacher/sessions",
  validate(teacherLoginSchema),
  AuthController.teacher_login,
);
router.post("/sessions/refresh", AuthController.refresh_token);
router.delete("/sessions", AuthController.logout);
router.get("/me", AuthMiddleware.authenticate(), (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, req.user, "You are authenticated!"));
});
router.post("/admins", validate(addAdminSchema), AuthController.addAdmin);

const authRouter = express.Router();
authRouter.use("/api/auth", authLimiter, router);

export default authRouter;
