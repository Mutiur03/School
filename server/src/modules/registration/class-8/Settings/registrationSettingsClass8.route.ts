import express from "express";
import { RegistrationSettingsClass8Controller } from "./registrationSettingsClass8.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  class8RegistrationSettingsSchema,
  registrationNoticeUploadSchema,
} from "@school/shared-schemas";

const router = express.Router();

router.post(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  validate(class8RegistrationSettingsSchema),
  RegistrationSettingsClass8Controller.createOrUpdateClass8Reg,
);
router.get("/", RegistrationSettingsClass8Controller.getClass8Reg);
router.delete(
  "/notice",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationSettingsClass8Controller.deleteClass8RegNotice,
);
router.post(
  "/upload-url",
  AuthMiddleware.authenticate(["admin"]),
  validate(registrationNoticeUploadSchema),
  RegistrationSettingsClass8Controller.getClass8NoticeUploadUrl,
);

const registrationSettingsClass8Router = express.Router();
registrationSettingsClass8Router.use("/api/reg/class-8", router);

export default registrationSettingsClass8Router;
