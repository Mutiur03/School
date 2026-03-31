import { Router } from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { SmsLogsController } from "./sms-logs.controller.js";

const router = Router();
router.use(AuthMiddleware.authenticate(["admin"]));
router.get("/sms-logs", SmsLogsController.getSmsLogs);
router.get("/usage-stats", SmsLogsController.getSmsUsageStats);
router.post("/retry-sms", SmsLogsController.retrySms);
router.post("/bulk-sms", SmsLogsController.sendBulkSmsByClass);
router.get("/student-count", SmsLogsController.getStudentCountByClasses);
router.delete("/sms-logs", SmsLogsController.deleteSmsLogs);

const smsRouter = Router();
smsRouter.use("/api/sms", router);
export default smsRouter;
