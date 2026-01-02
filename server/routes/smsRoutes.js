import router from "express";
import {
  getSmsLogsController,
  retrySmsController,
  deleteSmsLogsController,
  getSmsStatsController,
} from "../controllers/smsController.js";

const smsRouter = router.Router();

smsRouter.get("/sms-logs", getSmsLogsController);
smsRouter.post("/retry-sms", retrySmsController);
smsRouter.delete("/sms-logs", deleteSmsLogsController);
smsRouter.get("/sms-stats", getSmsStatsController);

export default smsRouter;
