import expreess from "express";
import {
  promoteStudentController,
  passStatusController,
  updateStatus,
} from "../controllers/protomotionController.js";

const promotionRouter = expreess.Router();

promotionRouter.post("/updateStatus/:year", passStatusController);
promotionRouter.post("/addPromotion/:year", promoteStudentController);
promotionRouter.put("/updateStatus", updateStatus);

export default promotionRouter;
