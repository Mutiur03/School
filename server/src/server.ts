import express from "express";
import "dotenv/config";
import { env } from "./config/env.js";

process.env.TZ = "Asia/Dhaka";
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

export const TTL = process.env.PDF_CACHE_TTL || "300";
import cors from "cors";
import { detailedRequestLogger } from "./middlewares/requestLogger.js";
import logger from "./utils/logger.js";
import examRouter from "./routes/examRoutes.js";
import marksRouter from "./modules/marks/marks.route.js";
import promotionRouter from "./routes/promotionRoutes.js";
import {
  sharedAuthSessionRouter,
  superAdminAuthRouter,
  tenantAuthRouter,
} from "./modules/auth/auth.route.js";
import cookieParser from "cookie-parser";
import levelRouter from "./modules/level/level.route.js";
import attendenceRouter from "./modules/attendence/attendence.route.js";
import smsSettingsRoute from "./modules/sms-settings/sms-settings.route.js";
import noticeRouter from "./modules/notice/notice.route.js";
import holidayRouter from "./routes/holidayRoutes.js";
import eventsRouter from "./routes/eventsRoutes.js";
import galleryRouter from "./routes/galleryRoutes.js";
import dashboardRouter from "./modules/dashboard/dashboard.route.js";
import path from "path";
import fs from "fs";
import syllabusRoutes from "./routes/syllabusRoutes.js";
import classRoutineRouter from "./routes/classRoutineRoutes.js";
import fileUploadRouter from "./routes/fileUpload.js";
import routerStaff from "./routes/staffRoutes.js";
import admmissionRoutes from "./routes/admissionRoutes.js";
import addFormRouter from "./routes/admissionFormRoutes.js";
import admissionResultRouter from "./routes/admissionResultRoutes.js";
import smsRouter from "./modules/sms-logs/sms-logs.route.js";
import registrationSettingsClass6Router from "./modules/registration/class-6/Settings/registrationSettingsClass6.route.js";
import registrationFormClass6Router from "./modules/registration/class-6/Form/registrationFormClass6.route.js";
import registrationSettingsClass8Router from "./modules/registration/class-8/Settings/registrationSettingsClass8.route.js";
import registrationFormClass8Router from "./modules/registration/class-8/Form/registrationFormClass8.route.js";
import registrationSettingsClass9Router from "./modules/registration/class-9/Settings/registrationSettingsClass9.route.js";
import registrationFormClass9Router from "./modules/registration/class-9/Form/registrationFormClass9.route.js";
import { check } from "./config/redis.js";
import rateLimit from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";
import AuthMiddleware from "./middlewares/auth.middleware.js";
import {
  superAdminSchoolRouter,
  tenantSchoolRouter,
} from "./modules/school/school.route.js";
import studentRouter from "./modules/student/student.route.js";
import routerTeacher from "./modules/teacher/teacher.route.js";
import expressStatusMonitor from "express-status-monitor";
import generateToken from "@/utils/generateSetupToken.js";
import subjectRouter from "./modules/result/subject/subject.route.js";
import { schoolContextMiddleware } from "./middlewares/tenant.middleware.js";
import { requireSchoolContextMiddleware } from "./middlewares/access.middleware.js";

const storagePath = path.resolve("uploads");

const app = express();
const PORT = env.PORT || 5000;
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-school-id"],
  }),
);
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});
app.use(detailedRequestLogger);
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(storagePath, {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
    },
  }),
);
const limitStore = new MemoryStore();
const LimitReq = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 5000 : 1000,
  message: {
    message: "Too many requests, please try again after an hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: limitStore,
  skip: (req) => {
    const url = req.originalUrl || req.url;
    return (
      url.includes("/api/sms-settings/public") || url.includes("/api/health")
    );
  },
});
app.use(
  (expressStatusMonitor as any)({
    spans: [
      { interval: 1, retention: 60 },
      { interval: 5, retention: 60 },
      { interval: 15, retention: 60 },
      { interval: 60, retention: 60 },
      { interval: 300, retention: 288 },
    ],
    healthChecks: [
      {
        protocol: "http",
        host: "localhost",
        path: "/api/health",
        port: PORT.toString(),
      },
    ],
  }),
);
app.use(LimitReq);
app.get(
  "/api/resetLimit",
  AuthMiddleware.authenticate(["admin"]),
  (_req, res) => {
    limitStore.resetAll();
    res.json({
      success: true,
      message: "Rate limit reset successfully",
    });
  },
);

app.use(superAdminAuthRouter);
app.use(superAdminSchoolRouter);
app.use(schoolContextMiddleware);
app.use(sharedAuthSessionRouter);
app.use(requireSchoolContextMiddleware);

app.use(studentRouter);
app.use(tenantSchoolRouter);
app.use("/api/exams", examRouter);
app.use(subjectRouter);
app.use(marksRouter);
app.use("/api/promotion", promotionRouter);
app.use(routerTeacher);
app.use("/api/staffs", routerStaff);
app.use(tenantAuthRouter);
app.use(levelRouter);
app.use(attendenceRouter);
app.use(noticeRouter);
app.use(smsSettingsRoute);
app.use("/api/holidays", holidayRouter);
app.use("/api/events", eventsRouter);
app.use("/api/gallery", galleryRouter);
app.use(dashboardRouter);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/class-routine", classRoutineRouter);
app.use("/api/file-upload", fileUploadRouter);
app.use(registrationSettingsClass9Router);
app.use(registrationFormClass9Router);
app.use(registrationSettingsClass6Router);
app.use(registrationFormClass6Router);
app.use(registrationSettingsClass8Router);
app.use(registrationFormClass8Router);
app.use("/api/admission", admmissionRoutes);
app.use("/api/admission/form", addFormRouter);
app.use("/api/admission-result", admissionResultRouter);

app.use(smsRouter);
app.use("*", (_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
app.use(
  (
    error: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error";

    const logMethod = statusCode >= 500 ? "error" : "warn";
    const logTitle =
      statusCode >= 500 ? "Unhandled server error" : "Client error response";

    (logger as any)[logMethod](logTitle, {
      status: statusCode,
      message,
      stack: statusCode >= 500 ? error.stack : undefined,
      url: req.originalUrl,
      method: req.method,
      ip:
        (
          (Array.isArray(req.headers["x-forwarded-for"])
            ? req.headers["x-forwarded-for"][0]
            : req.headers["x-forwarded-for"]) || ""
        )
          .split(",")[0]
          .trim() || req.socket?.remoteAddress,
    });

    res.status(statusCode).json({
      success: false,
      message: message,
      errors: error.errors || [],
      error: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  },
);
generateToken();
app.listen(PORT, () => {
  fs.mkdir(storagePath, { recursive: true }, (err) => {
    if (err) {
      logger.error("Error creating uploads directory", { error: err.message });
    } else {
      logger.info("Uploads directory ready", { path: storagePath });
    }
  });
  const logsPath = path.resolve("logs");
  fs.mkdir(logsPath, { recursive: true }, (err) => {
    if (err) {
      logger.error("Error creating logs directory", { error: err.message });
    } else {
      logger.info("Logs directory ready", {
        path: logsPath,
      });
    }
  });
  const mode =
    process.env.NODE_ENV === "production" ? "production" : "development";
  logger.info(`Server started`, {
    port: PORT,
    mode,
    health: `http://localhost:${PORT}/api/health`,
  });
  check();
});
export default app;
