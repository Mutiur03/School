import express from "express";
import { validate } from "@/middlewares/validate.middleware.js";
import { admissionPhotoUploadSchema } from "@school/shared-schemas";
import { AdmissionFormController } from "./admission-form.controller.js";

const router = express.Router();

router.post(
  "/upload-url",
  validate(admissionPhotoUploadSchema),
  AdmissionFormController.getAdmissionUploadUrl,
);
router.post("/", AdmissionFormController.createForm);
router.get("/", AdmissionFormController.getForms);
router.get("/excel", AdmissionFormController.exportAllAdmissionsExcel);
router.get("/download", AdmissionFormController.exportAllAdmissionsExcel);
router.get("/images-export", AdmissionFormController.exportAdmissionImagesZip);
router.get("/:id", AdmissionFormController.getFormById);
router.put("/:id", AdmissionFormController.updateForm);
router.put("/:id/pending", AdmissionFormController.pendingForm);
router.put("/:id/approve", AdmissionFormController.approveForm);
router.get("/:id/pdf", AdmissionFormController.downloadPDF);
router.delete("/:id", AdmissionFormController.deleteForm);

const admissionFormRouter = express.Router();
admissionFormRouter.use("/api/admission/form", router);

export default admissionFormRouter;
