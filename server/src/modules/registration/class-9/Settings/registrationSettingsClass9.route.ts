import express from "express";
import { RegistrationSettingsClass9Controller } from "./registrationSettingsClass9.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  class9RegistrationSettingsSchema,
  registrationNoticeUploadSchema,
} from "@school/shared-schemas";

const router = express.Router();

router.post(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  validate(class9RegistrationSettingsSchema),
  RegistrationSettingsClass9Controller.createOrUpdateClass9Reg,
);
router.get("/", RegistrationSettingsClass9Controller.getClass9Reg);
router.delete(
  "/notice",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationSettingsClass9Controller.deleteClass9RegNotice,
);
router.post(
  "/upload-url",
  AuthMiddleware.authenticate(["admin"]),
  validate(registrationNoticeUploadSchema),
  RegistrationSettingsClass9Controller.getClass9NoticeUploadUrl,
);

const registrationSettingsClass9Router = express.Router();
registrationSettingsClass9Router.use("/api/reg/class-9", router);

export default registrationSettingsClass9Router;
