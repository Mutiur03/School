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

const examRouter = express.Router();

// Multer setup for PDF uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"), false);
  },
});

examRouter.post("/addExam", addExamController);
examRouter.get("/getExams", getExamsController);
examRouter.put("/updateVisibility/:examId", updateExamVisibilityController);
examRouter.put("/updateExam/:examId", updateExamController);
examRouter.delete("/deleteExam/:examId", deleteExamController);

// Exam Routine routes
examRouter.post("/addExamRoutine", addExamRoutineController);
examRouter.get("/getExamRoutines", getExamRoutinesController);
examRouter.put("/updateExamRoutine/:routineId", updateExamRoutineController);
examRouter.delete("/deleteExamRoutine/:routineId", deleteExamRoutineController);

// Exam Routine PDF upload route
examRouter.post(
  "/uploadRoutinePDF/:examId",
  upload.single("pdf"),
  uploadExamRoutinePDFController
);

// Remove PDF routine from exam
examRouter.delete("/removeRoutinePDF/:examId", removeExamRoutinePDFController);

export default examRouter;
