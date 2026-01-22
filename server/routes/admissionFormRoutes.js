import router from "express";

import {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  approveForm,
  exportAllAdmissionsExcel,
  exportAdmissionImagesZip,
  pendingForm,
  downloadPDF,
  getAdmissionUploadUrl,
} from "../controllers/admissionFormController.js";

const addFormRouter = router.Router();

addFormRouter.post("/upload-url", getAdmissionUploadUrl);

addFormRouter.post("/", createForm);
addFormRouter.get("/", getForms);  
addFormRouter.get("/excel", exportAllAdmissionsExcel);
addFormRouter.get("/download", exportAllAdmissionsExcel);
addFormRouter.get("/images-export", exportAdmissionImagesZip);
addFormRouter.get("/:id", getFormById);
addFormRouter.put("/:id", updateForm);
addFormRouter.put("/:id/pending", pendingForm);
addFormRouter.put("/:id/approve", approveForm);
addFormRouter.get("/:id/pdf", downloadPDF);
addFormRouter.delete("/:id", deleteForm);

export default addFormRouter;
