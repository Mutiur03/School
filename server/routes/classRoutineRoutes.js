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
} from "../controllers/classRoutineController.js";

const classRoutineRouter = express.Router();

classRoutineRouter.get("/", getRoutines);
classRoutineRouter.post("/", createRoutine);
classRoutineRouter.put("/:id", updateRoutine);
classRoutineRouter.delete("/:id", deleteRoutine);

// Class slot endpoints
classRoutineRouter.get("/slots", getClassSlots);
classRoutineRouter.post("/slots", createClassSlot);
classRoutineRouter.put("/slots/:id", updateClassSlot);
classRoutineRouter.delete("/slots/:id", deleteClassSlot);

export default classRoutineRouter;
