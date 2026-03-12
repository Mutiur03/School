import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  registrationSchema,
  class6RegistrationStatusSchema,
} from "@school/shared-schemas";
import { RegistrationFormClass6Controller } from "./registrationFormClass6.controller.js";

const router = express.Router();

router.post(
  "/",
  validate(registrationSchema),
  RegistrationFormClass6Controller.createRegistration,
);
router.get(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass6Controller.getAllRegistrations,
);
router.get(
  "/export",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass6Controller.exportRegistrations,
);
router.get(
  "/export-photos",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass6Controller.exportRegistrationPhotos,
);
router.post(
  "/upload-url",
  RegistrationFormClass6Controller.getRegistrationPhotoUploadUrl,
);
router.get("/:id", RegistrationFormClass6Controller.getRegistrationById);
router.get("/:id/pdf", RegistrationFormClass6Controller.downloadRegistrationPDF);
router.put(
  "/:id/status",
  validate(class6RegistrationStatusSchema),
  RegistrationFormClass6Controller.updateRegistrationStatus,
);
router.put(
  "/:id",
  validate(registrationSchema),
  RegistrationFormClass6Controller.updateRegistration,
);
router.delete(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass6Controller.deleteRegistration,
);

const registrationFormClass6Router = express.Router();
registrationFormClass6Router.use("/api/reg/class-6/form", router);

export default registrationFormClass6Router;
