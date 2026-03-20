import { Router } from "express";
import { SmsSettingsController } from "./sms-settings.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

// Allow both admins and teachers to see public settings (templates + balance)
router.get("/public", AuthMiddleware.authenticate(['admin', 'teacher']), SmsSettingsController.getPublicSettings);

// Protect all other routes with admin only middleware
router.use(AuthMiddleware.authenticate(['admin']));

router.get("/", SmsSettingsController.getSettings);
router.patch("/", SmsSettingsController.updateSettings);
router.get("/balance", SmsSettingsController.getBalance);
router.post("/add-balance", SmsSettingsController.updateBalance);
router.post("/test", SmsSettingsController.sendTestSMS);
router.get("/calculate-count", SmsSettingsController.getCalculateCount);

export default router;
