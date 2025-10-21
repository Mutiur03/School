import express from "express";
import {
    addLevelController,
    deleteLevelController,
    getLevelsController,
    updateLevelController,
} from "../controllers/levelController.js";      

const levelRouter = express.Router();

// Route to create level table
levelRouter.post("/addLevel", addLevelController);
levelRouter.get("/getLevels", getLevelsController);
levelRouter.put("/updateLevel/:id", updateLevelController);
levelRouter.delete("/deleteLevel/:id", deleteLevelController);

export default levelRouter;