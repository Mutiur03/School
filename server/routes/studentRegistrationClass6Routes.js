import router from "express";
import {
  createRegistration,
  getAllRegistrations,
  getRegistrationById,
  updateRegistration,
  updateRegistrationStatus,
  deleteRegistration,
  getRegistrationPhotoUploadUrl,
  exportRegistrations,
  exportRegistrationPhotos,
  downloadRegistrationPDF,
  getClassMates,
} from "../controllers/studentRegistrationClass6Controller.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  class6RegistrationServerSchema,
  class6RegistrationStatusSchema,
} from "@school/shared-schemas";

const studentRegistrationClass6Router = router.Router();

studentRegistrationClass6Router.post(
  "/",
  validate(class6RegistrationServerSchema),
  createRegistration,
);
studentRegistrationClass6Router.get(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  getAllRegistrations,
);
studentRegistrationClass6Router.get(
  "/export",
  AuthMiddleware.authenticate(["admin"]),
  exportRegistrations,
);
studentRegistrationClass6Router.get(
  "/export-photos",
  AuthMiddleware.authenticate(["admin"]),
  exportRegistrationPhotos,
);
studentRegistrationClass6Router.post(
  "/upload-url",
  getRegistrationPhotoUploadUrl,
);
studentRegistrationClass6Router.get("/getclassmates", getClassMates);
studentRegistrationClass6Router.get("/:id", getRegistrationById);
studentRegistrationClass6Router.get("/:id/pdf", downloadRegistrationPDF);
studentRegistrationClass6Router.put(
  "/:id/status",
  validate(class6RegistrationStatusSchema),
  updateRegistrationStatus,
);
studentRegistrationClass6Router.put(
  "/:id",
  validate(class6RegistrationServerSchema),
  updateRegistration,
);
studentRegistrationClass6Router.delete(
  "/:id",
  AuthMiddleware.authenticate(["admin"]),
  deleteRegistration,
);

export default studentRegistrationClass6Router;
