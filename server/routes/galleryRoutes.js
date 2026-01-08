import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const galleryRouter = Router();

import {
  addGalleryController,
  deleteCategoryGalleryController,
  deleteEventGalleryController,
  deleteGalleryController,
  getCategoriesController,
  getGalleryController,
  updateGalleryController,
  getPendingGalleriesController,
  approveGalleryController,
  rejectGalleryController,
  rejectMultipleGalleryController,
  getApprovedStudentGalleryController,
  deleteMultipleGalleryController,
  getPendingStudentGalleriesController,
  getRejectedGalleriesController,
  getRejectedStudentGalleriesController,
  getGalleriesByEventId,
  getGalleriesByCategoryId,
  updateCategoryThumbnailController,
  updateEventThumbnailController,
} from "../controllers/galleryController.js";

const __dirname = path.resolve();
const storagePath = path.join(__dirname, "uploads/gallery");

fs.mkdirSync(storagePath, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(storagePath, { recursive: true });
      cb(null, storagePath);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const name = path.basename(file.originalname, ext);
      cb(null, `${uniqueSuffix}-${name}${ext}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"));
    }
    cb(null, true);
  },
  // limits: {
  //   fileSize: 5 * 1024 * 1024, // 5MB limit
  // },
});

galleryRouter.post("/upload", upload.array("images"), addGalleryController);
galleryRouter.get("/getGalleries", getGalleryController);
galleryRouter.put(
  "/updateGallery/:id",
  upload.single("images"),
  updateGalleryController
);
galleryRouter.delete("/deleteGallery/:id", deleteGalleryController);
galleryRouter.delete("/deleteEventGallery/:id", deleteEventGalleryController);
galleryRouter.delete(
  "/deleteCategoryGallery/:id",
  deleteCategoryGalleryController
);
galleryRouter.get("/getCategories", getCategoriesController);
galleryRouter.get("/pending", getPendingGalleriesController);
galleryRouter.patch("/approve/:id", approveGalleryController);
galleryRouter.patch("/reject/:id", rejectGalleryController);
galleryRouter.post("/rejectMultiple", rejectMultipleGalleryController);
galleryRouter.get("/rejected", getRejectedGalleriesController);
galleryRouter.post("/deleteMultiple", deleteMultipleGalleryController);

galleryRouter.get("/approvedStudents", getApprovedStudentGalleryController);
galleryRouter.get("/pendingStudents", getPendingStudentGalleriesController);
galleryRouter.get("/rejectedStudents", getRejectedStudentGalleriesController);

galleryRouter.get("/getGalleries/event/:id", getGalleriesByEventId);
galleryRouter.get("/getGalleries/campus/:id", getGalleriesByCategoryId);

galleryRouter.put(
  "/setCategoryThumbnail/:category_id/:image_id",
  updateCategoryThumbnailController
);
galleryRouter.put(
  "/setEventThumbnail/:event_id/:image_id",
  updateEventThumbnailController
);

export default galleryRouter;
