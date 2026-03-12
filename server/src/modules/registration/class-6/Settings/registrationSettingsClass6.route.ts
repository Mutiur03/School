import express from "express";
import { RegistrationSettingsClass6Controller } from "./registrationSettingsClass6.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationSettingsClass6Controller.createOrUpdateClass6Reg,
);
router.get("/", RegistrationSettingsClass6Controller.getClass6Reg);
router.delete(
  "/notice",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationSettingsClass6Controller.deleteClass6RegNotice,
);
router.post(
  "/upload-url",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationSettingsClass6Controller.getClass6NoticeUploadUrl,
);

const registrationSettingsClass6Router = express.Router();
registrationSettingsClass6Router.use("/api/reg/class-6", router);

export default registrationSettingsClass6Router;
