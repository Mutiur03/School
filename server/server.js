import express from "express";
import "dotenv/config";
import cors from "cors";
import studRouter from "./routes/studRoutes.js";
import examRouter from "./routes/examRoutes.js";
import pool from "./config/db.js";
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
import runQuery from "./config/query.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const allowedOrigins = ["http://localhost:5173", "http://localhost:5174"];

app.use(
  cors({
    origin: (origin, callback) => {
      // if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      //   callback(null, true);
      // } else {
      //   callback(new Error("Not allowed by CORS"));
      // }
      callback(null, true);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.send("Hello World");
});
// app.get("/uploads/:filename", (req, res) => {
//   const fileName = req.params.filename;
//   const filePath = path.join(__dirname, "uploads", fileName);

//   // Check if file exists
//   if (!fs.existsSync(filePath)) {
//     return res.status(404).send("File not found");
//   }

//   const fileExtension = path.extname(fileName).toLowerCase();

//   // Serve PDF with inline disposition
//   if (fileExtension === ".pdf") {
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
//   } else {
//     res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
//   }

//   res.sendFile(filePath);
// });
// Routes
app.use("/api/students", studRouter);
app.use("/api/exams", examRouter);
app.use("/api/sub", subRouter);
app.use("/api/marks", marksRouter);
app.use("/api/promotion", promotionRouter);
app.use("/api/teachers", routerTeacher);
app.use("/api/auth", authRouter);
app.use("/api/level", levelRouter);
app.use("/api/attendance", attendenceRouter);
app.use("/api/notices", noticeRouter);
app.use("/api/holidays", holidayRouter);
app.use("/api/events", eventsRouter);
app.use('/api/gallery',galleryRouter);
pool
  .connect()
  .then(() => {
    console.log("Connected to PostgreSQL database");
    runQuery();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error connecting to database:", err);
    process.exit(1); 
  });
