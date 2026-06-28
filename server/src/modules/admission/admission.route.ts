import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  admissionNoticeUploadSchema,
  admissionSettingsSchema,
} from "@school/shared-schemas";
import { AdmissionController } from "./admission.controller.js";

const router = express.Router();

router.get("/", AdmissionController.getAdmission);
router.post(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  validate(admissionSettingsSchema),
  AdmissionController.createOrUpdateAdmission,
);
router.put(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  validate(admissionSettingsSchema),
  AdmissionController.createOrUpdateAdmission,
);
router.delete(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  AdmissionController.deleteAdmissionNotice,
);
router.post(
  "/upload-url",
  AuthMiddleware.authenticate(["admin"]),
  validate(admissionNoticeUploadSchema),
  AdmissionController.getNoticeUploadUrl,
);

const admissionRouter = express.Router();
admissionRouter.use("/api/admission", router);

export default admissionRouter;
