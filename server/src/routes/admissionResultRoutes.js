import { Router } from "express";
import {
  getAdmissionResults,
  createAdmissionResult,
  updateAdmissionResult,
  deleteAdmissionResult,
  getAdmissionResultById,
  handleUploadRequest,
  signMultipartUploadPart,
  completeMultipartUploadHandler,
} from "../controllers/admissionResultController.js";

const admissionResultRouter = Router();

admissionResultRouter.get("/", getAdmissionResults);
admissionResultRouter.get("/:id", getAdmissionResultById);
admissionResultRouter.post("/upload", handleUploadRequest);
admissionResultRouter.post("/multipart/sign-part", signMultipartUploadPart);
admissionResultRouter.post(
  "/multipart/complete",
  completeMultipartUploadHandler,
);
admissionResultRouter.post("/", createAdmissionResult);
admissionResultRouter.put("/:id", updateAdmissionResult);
admissionResultRouter.delete("/:id", deleteAdmissionResult);

export default admissionResultRouter;
