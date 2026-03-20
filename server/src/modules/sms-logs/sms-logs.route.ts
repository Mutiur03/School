import { Router } from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { SmsLogsController } from "./sms-logs.controller.js";

const router = Router();
router.use(AuthMiddleware.authenticate(["admin"]));
router.get("/sms-logs", SmsLogsController.getSmsLogs);
router.post("/retry-sms", SmsLogsController.retrySms);
router.delete("/sms-logs", SmsLogsController.deleteSmsLogs);
router.get("/sms-stats", SmsLogsController.getSmsStats);

const smsRouter = Router();
smsRouter.use("/api/sms", router);
export default smsRouter;
