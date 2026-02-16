import express from "express";
import "dotenv/config";
import helmet from "helmet";

process.env.TZ = "Asia/Dhaka";

export const TTL = process.env.PDF_CACHE_TTL || "300";
import cors from "cors";
import morgan from "morgan";
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
import { check } from "./config/redis.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storagePath = path.join(__dirname, "uploads");

const app = express();
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
); // Set security headers

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
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    gray: "\x1b[90m",
  };

  const colorStatus = (status) => {
    const s = Number(status);
    if (s >= 500) return `${colors.red}${status}${colors.reset}`;
    if (s >= 400) return `${colors.yellow}${status}${colors.reset}`;
    if (s >= 300) return `${colors.cyan}${status}${colors.reset}`;
    return `${colors.green}${status}${colors.reset}`;
  };

  app.use(
    // morgan((tokens, req, res) => {
    //   const method = tokens.method(req, res);
    //   const url = tokens.url(req, res);
    //   const status = tokens.status(req, res) || "-";
    //   const responseTime = tokens["response-time"](req, res) || "-";
    //   const remote = tokens["remote-addr"](req, res) || "-";
    //   return `${colors.magenta}${method}${colors.reset} ${colors.reset}${url}${
    //     colors.reset
    //   } ${colorStatus(status)} ${colors.gray}-${
    //     colors.reset
    //   } ${responseTime} ms ${colors.gray}${remote}${colors.reset}`;
    // })
    morgan("combined"),
  );
}
app.options("*", cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
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
app.use((error, req, res, next) => {
  // console.error("Server error:", error); // Optional: keep logging

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal server error";

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
      console.error("Error creating uploads directory:", err);
    } else {
      console.log("Uploads directory created successfully");
    }
  });
  console.log(
    `Server running on port ${PORT} in ${
      process.env.NODE_ENV === "production" ? "production" : "dev"
    } mode`,
  );
  check();
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
