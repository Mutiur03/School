import { Router } from "express";
import AuthMiddleware from "../middlewares/auth.middleware.js";
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

galleryRouter.post(
  "/upload",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  upload.array("images"),
  addGalleryController,
);
galleryRouter.get("/getGalleries", getGalleryController);
galleryRouter.put(
  "/updateGallery/:id",
  upload.single("images"),
  updateGalleryController,
);
galleryRouter.delete(
  "/deleteGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  deleteGalleryController,
);
galleryRouter.delete(
  "/deleteEventGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  deleteEventGalleryController,
);
galleryRouter.delete(
  "/deleteCategoryGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  deleteCategoryGalleryController,
);
galleryRouter.get("/getCategories", getCategoriesController);
galleryRouter.get(
  "/pending",
  AuthMiddleware.authenticate(["admin"]),
  getPendingGalleriesController,
);
galleryRouter.patch(
  "/approve/:id",
  AuthMiddleware.authenticate(["admin"]),
  approveGalleryController,
);
galleryRouter.patch(
  "/reject/:id",
  AuthMiddleware.authenticate(["admin"]),
  rejectGalleryController,
);
galleryRouter.post(
  "/rejectMultiple",
  AuthMiddleware.authenticate(["admin"]),
  rejectMultipleGalleryController,
);
galleryRouter.get(
  "/rejected",
  AuthMiddleware.authenticate(["admin"]),
  getRejectedGalleriesController,
);
galleryRouter.post(
  "/deleteMultiple",
  AuthMiddleware.authenticate(["admin"]),
  deleteMultipleGalleryController,
);

galleryRouter.get(
  "/approvedStudents",
  AuthMiddleware.authenticate(["student"]),
  getApprovedStudentGalleryController,
);
galleryRouter.get(
  "/pendingStudents",
  AuthMiddleware.authenticate(["student"]),
  getPendingStudentGalleriesController,
);
galleryRouter.get(
  "/rejectedStudents",
  AuthMiddleware.authenticate(["student"]),
  getRejectedStudentGalleriesController,
);

galleryRouter.get("/getGalleries/event/:id", getGalleriesByEventId);
galleryRouter.get("/getGalleries/campus/:id", getGalleriesByCategoryId);

galleryRouter.put(
  "/setCategoryThumbnail/:category_id/:image_id",
  AuthMiddleware.authenticate(["admin"]),
  updateCategoryThumbnailController,
);
galleryRouter.put(
  "/setEventThumbnail/:event_id/:image_id",
  AuthMiddleware.authenticate(["admin"]),
  updateEventThumbnailController,
);

export default galleryRouter;
