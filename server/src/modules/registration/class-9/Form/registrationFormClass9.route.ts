import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  registrationSchemaClass9,
  class9RegistrationStatusSchema,
  registrationPhotoUploadSchema,
} from "@school/shared-schemas";
import { RegistrationFormClass9Controller } from "./registrationFormClass9.controller.js";

const router = express.Router();

router.post(
  "/",
  validate(registrationSchemaClass9),
  RegistrationFormClass9Controller.createRegistration,
);
router.get(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass9Controller.getAllRegistrations,
);
router.post(
  "/upload-url",
  validate(registrationPhotoUploadSchema),
  RegistrationFormClass9Controller.getRegistrationPhotoUploadUrl,
);
router.get(
  "/export",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass9Controller.exportRegistrations,
);
router.get(
  "/export-photos",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass9Controller.exportRegistrationPhotos,
);
router.get("/:id", RegistrationFormClass9Controller.getRegistrationById);
router.put(
  "/:id/status",
  validate(class9RegistrationStatusSchema),
  RegistrationFormClass9Controller.updateRegistrationStatus,
);
router.put(
  "/:id",
  validate(registrationSchemaClass9),
  RegistrationFormClass9Controller.updateRegistration,
);
router.delete(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass9Controller.deleteRegistration,
);
router.get("/:id/pdf", RegistrationFormClass9Controller.downloadRegistrationPDF);

const registrationFormClass9Router = express.Router();
registrationFormClass9Router.use("/api/reg/class-9/form", router);

export default registrationFormClass9Router;
