import { Router } from "express";
import { SmsSettingsController } from "./sms-settings.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

router.get(
  "/public",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  SmsSettingsController.getPublicSettings,
);

router.use(AuthMiddleware.authenticate(["admin"]));

router.get("/", SmsSettingsController.getSettings);
router.patch("/", SmsSettingsController.updateSettings);
router.get("/balance", SmsSettingsController.getBalance);
router.post("/add-balance", SmsSettingsController.updateBalance);
router.post("/test", SmsSettingsController.sendTestSMS);
router.get("/calculate-count", SmsSettingsController.getCalculateCount);

const smsSettingsRoute = Router();
smsSettingsRoute.use("/api/sms-settings", router);
export default smsSettingsRoute;
