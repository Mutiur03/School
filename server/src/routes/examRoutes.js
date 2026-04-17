import {
  addExamController,
  deleteExamController,
  getExamsController,
  updateExamController,
  updateExamVisibilityController,
  addExamRoutineController,
  getExamRoutinesController,
  updateExamRoutineController,
  deleteExamRoutineController,
  uploadExamRoutinePDFController,
  removeExamRoutinePDFController,
} from "../controllers/examController.js";
import express from "express";
import multer from "multer";
import AuthMiddleware from "../middlewares/auth.middleware.js";

const examRouter = express.Router();

// Multer setup for PDF uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});

examRouter.post(
  "/addExam",
  AuthMiddleware.authenticate(["admin"]),
  addExamController,
);
examRouter.get("/getExams", getExamsController);
examRouter.put(
  "/updateVisibility/:examId",
  AuthMiddleware.authenticate(["admin"]),
  updateExamVisibilityController,
);
examRouter.put(
  "/updateExam/:examId",
  AuthMiddleware.authenticate(["admin"]),
  updateExamController,
);
examRouter.delete(
  "/deleteExam/:examId",
  AuthMiddleware.authenticate(["admin"]),
  deleteExamController,
);

// Exam Routine routes
examRouter.post(
  "/addExamRoutine",
  AuthMiddleware.authenticate(["admin"]),
  addExamRoutineController,
);
examRouter.get("/getExamRoutines", getExamRoutinesController);
examRouter.put(
  "/updateExamRoutine/:routineId",
  AuthMiddleware.authenticate(["admin"]),
  updateExamRoutineController,
);
examRouter.delete(
  "/deleteExamRoutine/:routineId",
  AuthMiddleware.authenticate(["admin"]),
  deleteExamRoutineController,
);

// Exam Routine PDF upload route
examRouter.post(
  "/uploadRoutinePDF/:examId",
  AuthMiddleware.authenticate(["admin"]),
  upload.single("pdf"),
  uploadExamRoutinePDFController,
);

// Remove PDF routine from exam
examRouter.delete(
  "/removeRoutinePDF/:examId",
  AuthMiddleware.authenticate(["admin"]),
  removeExamRoutinePDFController,
);

export default examRouter;
