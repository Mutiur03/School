import express from "express";
import "dotenv/config";
import cors from "cors";
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
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// app.use("/uploads/notice", express.static(path.join(__dirname, "uploads/notice")));
// app.use(
//   "/pdf/notice",
//   express.static(path.join(__dirname, "uploads", "notice"), {
//     setHeaders: (res, filePath) => {
//       if (filePath.endsWith(".pdf")) {
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader("Content-Disposition", "inline"); // Ensures inline viewing
//       }
//     },
//   })
// );

// app.get("/preview/:fileName", async (req, res) => {
//   const { fileName } = req.params;
//   const cloudinaryUrl = `https://res.cloudinary.com/dgplti59u/raw/upload/notices/${fileName}`;

//   const fileResponse = await axios.get(cloudinaryUrl, {
//     responseType: "stream",
//   });

//   res.setHeader("Content-Type", "application/pdf");
//   res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);

//   fileResponse.data.pipe(res);
// });

app.get("/", (req, res) => {
  res.send("Ballo World");
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
app.use("/api/student-registration", studentRegistrationRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Server error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? error.message
        : "Something went wrong",
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
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
