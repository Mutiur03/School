import express from "express";
import { LevelController } from "./level.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

// Level CRUD operations
router.get("/getLevels",AuthMiddleware.authenticate(["admin"]), LevelController.getLevelsController);
router.post("/addLevel", AuthMiddleware.authenticate(["admin"]), LevelController.addLevelController);
router.put("/updateLevel/:id", AuthMiddleware.authenticate(["admin"]), LevelController.updateLevelController);
router.delete("/deleteLevel/:id", AuthMiddleware.authenticate(["admin"]), LevelController.deleteLevelController);

const levelRouter = express.Router();
levelRouter.use("/api/level", router);
export default levelRouter;
