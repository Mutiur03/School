import express from "express";
import { validate } from "@/middlewares/validate.middleware.js";
import {
  admissionResultCreateSchema,
  admissionResultMultipartCompleteSchema,
  admissionResultMultipartSignSchema,
  admissionResultUpdateSchema,
  admissionResultUploadRequestSchema,
} from "@school/shared-schemas";
import { AdmissionResultController } from "./admission-result.controller.js";

const router = express.Router();

router.get("/", AdmissionResultController.getAdmissionResults);
router.get("/:id", AdmissionResultController.getAdmissionResultById);
router.post(
  "/upload",
  validate(admissionResultUploadRequestSchema),
  AdmissionResultController.handleUploadRequest,
);
router.post(
  "/multipart/sign-part",
  validate(admissionResultMultipartSignSchema),
  AdmissionResultController.signMultipartUploadPart,
);
router.post(
  "/multipart/complete",
  validate(admissionResultMultipartCompleteSchema),
  AdmissionResultController.completeMultipartUploadHandler,
);
router.post(
  "/",
  validate(admissionResultCreateSchema),
  AdmissionResultController.createAdmissionResult,
);
router.put(
  "/:id",
  validate(admissionResultUpdateSchema),
  AdmissionResultController.updateAdmissionResult,
);
router.delete("/:id", AdmissionResultController.deleteAdmissionResult);

const admissionResultRouter = express.Router();
admissionResultRouter.use("/api/admission-result", router);

export default admissionResultRouter;
