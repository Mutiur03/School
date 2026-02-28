import express from "express";
import "dotenv/config";

process.env.TZ = "Asia/Dhaka";

export const TTL = process.env.PDF_CACHE_TTL || "300";
import cors from "cors";
import { morganMiddleware, detailedRequestLogger } from "./middlewares/requestLogger.js";
import logger from "./utils/logger.js";
import studRouter from "./routes/studRoutes.js";
import examRouter from "./routes/examRoutes.js";
import subRouter from "./routes/subRoutes.js";
import marksRouter from "./routes/marksRoutes.js";
import promotionRouter from "./routes/promotionRoutes.js";
import routerTeacher from "./routes/teacherRoutes.js";
import authRouter from "./routes/authRoutes.js";
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
import regClass6Router from "./routes/regClass6Routes.js";
import studentRegistrationClass6Router from "./routes/studentRegistrationClass6Routes.js";
import {
  resolveClass6Preview,
} from "./controllers/studentRegistrationClass6Controller.js";
import { check } from "./config/redis.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storagePath = path.join(__dirname, "uploads");

const app = express();

const PORT = process.env.PORT || 5000;
const envAllowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : null;
const allowedOrigins = envAllowedOrigins;
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Request logging: morgan pipes to winston, then detailed logger captures
// structured JSON (method, url, status, duration, ip, redacted body) into
// logs/access-YYYY-MM-DD.log + logs/combined-YYYY-MM-DD.log
app.use(morganMiddleware);
app.use(detailedRequestLogger);
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res) => {
      res.set("Cross-Origin-Resource-Policy", "cross-origin");
      res.set("Access-Control-Allow-Origin", "*");
    },
  }),
);
app.get("/api", (req, res) => {
  res.send("Hello World");
});
app.use("/api/students", studRouter);
app.use("/api/exams", examRouter);
app.use("/api/sub", subRouter);
app.use("/api/marks", marksRouter);
app.use("/api/promotion", promotionRouter);
app.use("/api/teachers", routerTeacher);
app.use("/api/staffs", routerStaff);
app.use("/api/auth", authRouter);
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
app.use("/api/reg/class-6", regClass6Router);
app.use("/api/reg/class-6/form", studentRegistrationClass6Router);
app.use("/api/admission", admmissionRoutes);
app.use("/api/admission/form", addFormRouter);
app.use("/api/admission-result", admissionResultRouter);
app.use("/api/sms", smsRouter);
app.get("/preview/class6/:id", resolveClass6Preview);
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
app.use((error, req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";

  logger.error("Unhandled server error", {
    status: statusCode,
    message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip:
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress,
  });

  res.status(statusCode).json({
    success: false,
    message: message,
    errors: error.errors || [],
    error: process.env.NODE_ENV === "development" ? error.stack : undefined,
  });
});

app.listen(PORT, () => {
  fs.mkdir(storagePath, { recursive: true }, (err) => {
    if (err) {
      logger.error("Error creating uploads directory", { error: err.message });
    } else {
      logger.info("Uploads directory ready", { path: storagePath });
    }
  });
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  logger.info(`Server started`, {
    port: PORT,
    mode,
    health: `http://localhost:${PORT}/api/health`,
  });
  check();
});
