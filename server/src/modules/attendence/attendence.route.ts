import express from "express";
import { AttendenceController } from "./attendence.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();
router.use(AuthMiddleware.authenticate(["admin", "teacher"]));
router.get("/getAttendence", AttendenceController.getAttendenceController);
router.post("/addAttendence", AttendenceController.addAttendenceController);
router.get("/getStats", AttendenceController.getAttendanceStatsController);
router.post("/send-sms", AttendenceController.sendAttendanceSMSController);

const attendenceRouter = express.Router();
attendenceRouter.use("/api/attendance", router);
export default attendenceRouter;
