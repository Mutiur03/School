import express from "express";
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
  getClassRoutinePresignedUrl,
} from "../controllers/classRoutineController.js";

const classRoutineRouter = express.Router();

// Class Routine
classRoutineRouter.get("/", getRoutines);
classRoutineRouter.post("/", createRoutine);
classRoutineRouter.put("/:id", updateRoutine);
classRoutineRouter.delete("/:id", deleteRoutine);

// Slots
classRoutineRouter.get("/slots", getClassSlots);
classRoutineRouter.post("/slots", createClassSlot);
classRoutineRouter.put("/slots/:id", updateClassSlot);
classRoutineRouter.delete("/slots/:id", deleteClassSlot);

// Class Routine PDF endpoints (body: { key } — browser uploads directly to R2)
classRoutineRouter.get("/presigned-url", getClassRoutinePresignedUrl);
classRoutineRouter.post("/pdf", uploadClassRoutinePDF);
classRoutineRouter.get("/pdf", getClassRoutinePDFs);
classRoutineRouter.delete("/pdf/:id", deleteClassRoutinePDF);
classRoutineRouter.put("/pdf/:id", updateClassRoutinePDF);

export default classRoutineRouter;
