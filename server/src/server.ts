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
import marksRouter from "./routes/marksRoutes.js";
import promotionRouter from "./routes/promotionRoutes.js";
import authRouter from "./modules/auth/auth.route.js";
import cookieParser from "cookie-parser";
import levelRouter from "./routes/levelRoutes.js";
import attendenceRouter from "./routes/attendenceRoutes.js";
import noticeRouter from "./routes/noticeRoutes.js";
import holidayRouter from "./routes/holidayRoutes.js";
import eventsRouter from "./routes/eventsRoutes.js";
import galleryRouter from "./routes/galleryRoutes.js";
import dashboardRouter from "./routes/dashboardRoutes.js";
import path from "path";
import fs from "fs";
import syllabusRoutes from "./routes/syllabusRoutes.js";
import classRoutineRouter from "./routes/classRoutineRoutes.js";
import fileUploadRouter from "./routes/fileUpload.js";
import routerStaff from "./routes/staffRoutes.js";
import regSSCRouter from "./routes/regSSCRoutes.js";
import studentRegistrationRouter from "./routes/studentRegistrationRoutes.js";
import { fileURLToPath } from "url";
import admmissionRoutes from "./routes/admissionRoutes.js";
import addFormRouter from "./routes/admissionFormRoutes.js";
import admissionResultRouter from "./routes/admissionResultRoutes.js";
import smsRouter from "./routes/smsRoutes.js";
import registrationSettingsClass6Router from "./modules/registration/class-6/Settings/registrationSettingsClass6.route.js";
import registrationFormClass6Router from "./modules/registration/class-6/Form/registrationFormClass6.route.js";
import { check } from "./config/redis.js";
import rateLimit from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";
import AuthMiddleware from "./middlewares/auth.middleware.js";
import studentRouter from "./modules/student/student.route.js";
import routerTeacher from "./modules/teacher/teacher.route.js";
import expressStatusMonitor from "express-status-monitor";
import generateToken from "@/utils/generateSetupToken.js";
import subjectRouter from "./modules/result/subject/subject.route.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storagePath = path.join(__dirname, "uploads");

const app = express();
const PORT = env.PORT || 5000;
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : undefined;
const allowedOrigins = envAllowedOrigins;
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

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
  max: process.env.NODE_ENV === "development" ? 5000 : 500,
  message: {
    message: "Too many requests, please try again after an hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: limitStore,
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
app.use(studentRouter);
app.use("/api/exams", examRouter);
app.use(subjectRouter);
app.use("/api/marks", marksRouter);
app.use("/api/promotion", promotionRouter);
app.use(routerTeacher);
app.use("/api/staffs", routerStaff);
app.use(authRouter);
app.use("/api/level", levelRouter);
app.use("/api/attendance", attendenceRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/holidays", holidayRouter);
app.use("/api/events", eventsRouter);
app.use("/api/gallery", galleryRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/syllabus", syllabusRoutes);
app.use("/api/class-routine", classRoutineRouter);
app.use("/api/file-upload", fileUploadRouter);
app.use("/api/reg/ssc", regSSCRouter);
app.use("/api/reg/ssc/form", studentRegistrationRouter);
app.use(registrationSettingsClass6Router);
app.use(registrationFormClass6Router);
app.use("/api/admission", admmissionRoutes);
app.use("/api/admission/form", addFormRouter);
app.use("/api/admission-result", admissionResultRouter);

app.use("/api/sms", smsRouter);
app.get("/api/health", (_req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});
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

    logger.error("Unhandled server error", {
      status: statusCode,
      message,
      stack: error.stack,
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
  fs.mkdir(path.join(__dirname, "logs"), { recursive: true }, (err) => {
    if (err) {
      logger.error("Error creating logs directory", { error: err.message });
    } else {
      logger.info("Logs directory ready", {
        path: path.join(__dirname, "logs"),
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
