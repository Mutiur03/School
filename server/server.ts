import express from "express";
import "dotenv/config";
import { env } from "./config/env.js";

process.env.TZ = "Asia/Dhaka";

export const TTL = process.env.PDF_CACHE_TTL || "300";
import cors from "cors";
import { detailedRequestLogger } from "./middlewares/requestLogger.js";
import logger from "./utils/logger.js";
import examRouter from "./routes/examRoutes.js";
import subRouter from "./routes/subRoutes.js";
import marksRouter from "./routes/marksRoutes.js";
import promotionRouter from "./routes/promotionRoutes.js";
import authRouter from "./api/auth/auth.route.js";
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
import rateLimit from "express-rate-limit";
import { MemoryStore } from "express-rate-limit";
import AuthMiddleware from "./middlewares/auth.middleware.js";
import studentRouter from "./api/student/student.route.js";
import routerTeacher from "./api/teacher/teacher.route.js";
import jwt from "jsonwebtoken"; // Added jwt import
import expressStatusMonitor from "express-status-monitor";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const storagePath = path.join(__dirname, "uploads");


const authAdmin = (req: any, res: any, next: any) => {
  const token = req.cookies?.refreshToken;

  if (!token) return res.status(401).send("Unauthorized");

  try {
    const secret = (process.env.REFRESH_TOKEN_SECRET ||
      process.env.JWT_SECRET)!;
    const decoded: any = jwt.verify(token, secret);
    if (decoded.role !== "admin") return res.status(403).send("Forbidden");
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).send("Invalid Token");
  }
};

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
app.get("/api", (_req, res) => {
  res.send("Hello World");
});
app.use(studentRouter);
app.use("/api/exams", examRouter);
app.use("/api/sub", subRouter);
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
app.use("/api/reg/class-6", regClass6Router);
app.use("/api/reg/class-6/form", studentRegistrationClass6Router);
app.use("/api/admission", admmissionRoutes);
app.use("/api/admission/form", addFormRouter);
app.use("/api/admission-result", admissionResultRouter);


app.get("/api/monitoring/recent-requests", authAdmin, (_req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const accessLogPath = path.join(__dirname, `access-${today}.log`);

    if (!fs.existsSync(accessLogPath)) {
      return res.json({ success: true, logs: [] });
    }

    const logs = fs
      .readFileSync(accessLogPath, "utf8")
      .split("\n")
      .filter((line) => line.trim())
      // .slice(-50)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(
        (log) =>
          log !== null && log.type === "request" && log.status !== undefined,
      )
      .reverse();

    return res.json({ success: true, logs });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/monitoring/logs/stream", authAdmin, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const onLog = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  (logger as any).emitter.on("log", onLog);

  req.on("close", () => {
    (logger as any).emitter.off("log", onLog);
  });
});

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
      logger.info("Logs directory ready", { path: path.join(__dirname, "logs") });
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
