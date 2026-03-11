import router from "express";
import {
  getSmsLogsController,
  retrySmsController,
  deleteSmsLogsController,
  getSmsStatsController,
} from "../controllers/smsController.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";

const smsRouter = router.Router();

smsRouter.get(
  "/sms-logs",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  getSmsLogsController,
);
smsRouter.post(
  "/retry-sms",
  AuthMiddleware.authenticate(["admin"]),
  retrySmsController,
);
smsRouter.delete(
  "/sms-logs",
  AuthMiddleware.authenticate(["admin"]),
  deleteSmsLogsController,
);
smsRouter.get(
  "/sms-stats",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  getSmsStatsController,
);

export default smsRouter;
