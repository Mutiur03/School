import express from "express";
import { DashboardController } from "./dashboard.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

router.use(AuthMiddleware.authenticate(["admin"]));
router.get("/", DashboardController.getAllDashboardData);
const dashboardRouter = express.Router();
dashboardRouter.use("/api/dashboard", router);
export default dashboardRouter;
