import router from "express";
import {
  getAllDashboardData,
} from "../controllers/dashboardController.js";

const dashboardRouter = router.Router();

dashboardRouter.get("/", getAllDashboardData);

export default dashboardRouter;
