import express from "express";
import { AuthController } from "@/modules/auth/auth.controller.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  adminLoginSchema,
  addAdminSchema,
  teacherLoginSchema,
  teacherPasswordResetRequestSchema,
  teacherPasswordResetCodeVerifySchema,
  teacherPasswordUpdateSchema,
  studentLoginSchema,
  studentPasswordResetRequestSchema,
  studentPasswordResetCodeVerifySchema,
  studentPasswordUpdateSchema,
  setupSuperAdminSchema,
  superAdminLoginSchema,
} from "@school/shared-schemas";
import rateLimit from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";
import {
  requireSchoolContextOrSuperAdminHostMiddleware,
} from "@/middlewares/access.middleware.js";

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

const passwordResetStore = new MemoryStore();
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: {
    message:
      "Too many password reset attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: passwordResetStore,
});

const superAdminRouter = express.Router();
superAdminRouter.post(
  "/setup",
  validate(setupSuperAdminSchema),
  AuthController.setupSuperAdmin,
);
superAdminRouter.post(
  "/sessions",
  validate(superAdminLoginSchema),
  AuthController.superAdminLogin,
);

const sessionRouter = express.Router();
sessionRouter.use(requireSchoolContextOrSuperAdminHostMiddleware);
sessionRouter.post("/refresh", AuthController.refresh_token);
sessionRouter.delete("/", AuthController.logout);

const tenantRouter = express.Router();
tenantRouter.post(
  "/admin/sessions",
  validate(adminLoginSchema),
  AuthController.login,
);
tenantRouter.post(
  "/student/sessions",
  validate(studentLoginSchema),
  AuthController.student_login,
);
tenantRouter.post(
  "/teacher/sessions",
  validate(teacherLoginSchema),
  AuthController.teacher_login,
);
tenantRouter.post("/admins", validate(addAdminSchema), AuthController.addAdmin);
tenantRouter.post(
  "/teacher/password-reset/request",
  passwordResetLimiter,
  validate(teacherPasswordResetRequestSchema),
  AuthController.requestTeacherPasswordReset,
);
tenantRouter.post(
  "/teacher/password-reset/check-code",
  passwordResetLimiter,
  validate(teacherPasswordResetCodeVerifySchema),
  AuthController.checkTeacherPasswordResetCode,
);
tenantRouter.post(
  "/teacher/password-reset/verify",
  passwordResetLimiter,
  validate(teacherPasswordUpdateSchema),
  AuthController.verifyTeacherPasswordReset,
);
tenantRouter.post(
  "/student/password-reset/request",
  passwordResetLimiter,
  validate(studentPasswordResetRequestSchema),
  AuthController.requestStudentPasswordReset,
);
tenantRouter.post(
  "/student/password-reset/check-code",
  passwordResetLimiter,
  validate(studentPasswordResetCodeVerifySchema),
  AuthController.checkStudentPasswordResetCode,
);
tenantRouter.post(
  "/student/password-reset/verify",
  passwordResetLimiter,
  validate(studentPasswordUpdateSchema),
  AuthController.verifyStudentPasswordReset,
);

export const superAdminAuthRouter = express.Router();
superAdminAuthRouter.use("/api/auth/super_admin", authLimiter, superAdminRouter);

export const sharedAuthSessionRouter = express.Router();
sharedAuthSessionRouter.use("/api/auth/sessions", authLimiter, sessionRouter);

export const tenantAuthRouter = express.Router();
tenantAuthRouter.use("/api/auth", authLimiter, tenantRouter);
