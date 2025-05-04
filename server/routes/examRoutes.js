import {
  addExamController,
  deleteExamController,
  getExamsController,
  updateExamController,
  updateExamVisibilityController,
} from "../controllers/examController.js";
import express from "express";

const examRouter = express.Router();

examRouter.post("/addExam", addExamController);
examRouter.get("/getExams", getExamsController);
examRouter.put("/updateVisibility/:examId", updateExamVisibilityController);
examRouter.put("/updateExam/:examId", updateExamController);
examRouter.delete("/deleteExam/:examId", deleteExamController);


export default examRouter;
