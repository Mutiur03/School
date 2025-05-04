import express from 'express';
import { addSubController, deleteSubController, getSubsController, updateSubController } from '../controllers/subController.js';

const subRouter = express.Router();

subRouter.get("/getSubjects", getSubsController);
subRouter.post("/addSubject", addSubController);
subRouter.delete("/deleteSubject/:id", deleteSubController);
subRouter.put("/updateSubject/:id", updateSubController);

export default subRouter;