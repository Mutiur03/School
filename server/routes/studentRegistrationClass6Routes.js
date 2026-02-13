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
} from "../controllers/studentRegistrationClass6Controller.js";

const studentRegistrationClass6Router = router.Router();

studentRegistrationClass6Router.post("/", createRegistration);
studentRegistrationClass6Router.get("/", getAllRegistrations);
studentRegistrationClass6Router.get("/export", exportRegistrations);
studentRegistrationClass6Router.post(
  "/upload-url",
  getRegistrationPhotoUploadUrl,
);
studentRegistrationClass6Router.get("/:id", getRegistrationById);
studentRegistrationClass6Router.put("/:id/status", updateRegistrationStatus);
studentRegistrationClass6Router.put("/:id", updateRegistration);
studentRegistrationClass6Router.delete("/:id", deleteRegistration);

export default studentRegistrationClass6Router;
