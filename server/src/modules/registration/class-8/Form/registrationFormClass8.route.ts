import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  registrationSchemaClass8,
  class8RegistrationStatusSchema,
  registrationPhotoUploadSchema,
} from "@school/shared-schemas";
import { RegistrationFormClass8Controller } from "./registrationFormClass8.controller.js";

const router = express.Router();

router.post(
  "/",
  validate(registrationSchemaClass8),
  RegistrationFormClass8Controller.createRegistration,
);
router.get(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass8Controller.getAllRegistrations,
);
router.post(
  "/upload-url",
  validate(registrationPhotoUploadSchema),
  RegistrationFormClass8Controller.getRegistrationPhotoUploadUrl,
);
router.get("/:id", RegistrationFormClass8Controller.getRegistrationById);
router.put(
  "/:id/status",
  validate(class8RegistrationStatusSchema),
  RegistrationFormClass8Controller.updateRegistrationStatus,
);
router.put(
  "/:id",
  validate(registrationSchemaClass8),
  RegistrationFormClass8Controller.updateRegistration, 
);
router.delete(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass8Controller.deleteRegistration,
);

router.get(
  "/export",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass8Controller.exportRegistrations,
);
router.get(
  "/export-photos",
  AuthMiddleware.authenticate(["admin"]),
  RegistrationFormClass8Controller.exportRegistrationPhotos, 
);
router.get("/:id/pdf", RegistrationFormClass8Controller.downloadRegistrationPDF);

const registrationFormClass8Router = express.Router();
registrationFormClass8Router.use("/api/reg/class-8/form", router);

export default registrationFormClass8Router;
