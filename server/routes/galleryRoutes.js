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
import { compressImageToLocation } from "../middlewares/compressImageToLocation.js";

const __dirname = path.resolve();
const storagePath = path.join(__dirname, "uploads/gallery");

fs.mkdirSync(storagePath, { recursive: true });

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images are allowed"));
    }
    cb(null, true);
  },
});

galleryRouter.post(
  "/upload",
  upload.array("images"), // Field name must match frontend form
  compressImageToLocation({
    targetLocation: "uploads/gallery",
    targetSizeKB: 200,
  }),
  addGalleryController
);
galleryRouter.get("/getGalleries", getGalleryController);
galleryRouter.put(
  "/updateGallery/:id",
  upload.single("images"), // Field name must match frontend form
  compressImageToLocation({
    targetLocation: "uploads/gallery",
    targetSizeKB: 200,
  }),
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

// Students part
galleryRouter.get("/approvedStudents", getApprovedStudentGalleryController);
galleryRouter.get("/pendingStudents", getPendingStudentGalleriesController);
galleryRouter.get("/rejectedStudents", getRejectedStudentGalleriesController);

// Client side routes
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
