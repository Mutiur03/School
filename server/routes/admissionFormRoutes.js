import router from "express";
import multer from "multer";
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
} from "../controllers/admissionFormController.js";

const addFormRouter = router.Router();

const upload = multer({
  dest: "uploads/temp/",
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

const handleMulterError = (err, req, res, next) => {
  if (
    err &&
    err instanceof multer.MulterError &&
    err.code === "LIMIT_FILE_SIZE"
  ) {
    return res.status(400).json({
      success: false,
      message: "File size too large. Maximum size is 2MB.",
    });
  }
  if (err && err.message === "Only image files are allowed") {
    return res
      .status(400)
      .json({ success: false, message: "Only image files are allowed" });
  }
  next(err);
};

addFormRouter.post("/", upload.single("photo"), handleMulterError, createForm);
addFormRouter.get("/", getForms);
addFormRouter.get("/excel", exportAllAdmissionsExcel);
addFormRouter.get("/download", exportAllAdmissionsExcel);
addFormRouter.get("/images-export", exportAdmissionImagesZip);
addFormRouter.get("/:id", getFormById);
addFormRouter.put(
  "/:id",
  upload.single("photo"),
  handleMulterError,
  updateForm
);
addFormRouter.put("/:id/pending", pendingForm);
addFormRouter.put("/:id/approve", approveForm);
addFormRouter.get("/:id/pdf", downloadPDF); 
addFormRouter.delete("/:id", deleteForm);

export default addFormRouter;
