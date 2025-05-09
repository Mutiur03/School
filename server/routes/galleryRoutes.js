import router from "express";
import multer from "multer";
const galleryRouter = router.Router();

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
import path from "path";
import fs from "fs";
const __dirname = path.resolve();
const storagePath = path.join(__dirname, "uploads/gallery");
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    fs.mkdir(storagePath, { recursive: true }, (err) => {
      if (err) {
        return cb(err, storagePath);
      }
      cb(null, "uploads/gallery");
    });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

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

// students part
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
