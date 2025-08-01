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
} from "../controllers/examController.js";
import express from "express";

const examRouter = express.Router();

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

export default examRouter;
