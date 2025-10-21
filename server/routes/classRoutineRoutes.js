import express from "express";
import multer from "multer";
import {
  getRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  getClassSlots,
  createClassSlot,
  updateClassSlot,
  deleteClassSlot,
  uploadClassRoutinePDF,
  getClassRoutinePDFs,
  deleteClassRoutinePDF,
  updateClassRoutinePDF,
} from "../controllers/classRoutineController.js";

const classRoutineRouter = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });
classRoutineRouter.get("/", getRoutines);
classRoutineRouter.post("/", createRoutine);
classRoutineRouter.put("/:id", updateRoutine);
classRoutineRouter.delete("/:id", deleteRoutine);

// Class slot endpoints
classRoutineRouter.get("/slots", getClassSlots);
classRoutineRouter.post("/slots", createClassSlot);
classRoutineRouter.put("/slots/:id", updateClassSlot);
classRoutineRouter.delete("/slots/:id", deleteClassSlot);

// Class Routine PDF endpoints
classRoutineRouter.post("/pdf", upload.single("pdf"), uploadClassRoutinePDF);
classRoutineRouter.get("/pdf", getClassRoutinePDFs);
classRoutineRouter.delete("/pdf/:id", deleteClassRoutinePDF);
classRoutineRouter.put("/pdf/:id", upload.single("pdf"), updateClassRoutinePDF);

export default classRoutineRouter;
