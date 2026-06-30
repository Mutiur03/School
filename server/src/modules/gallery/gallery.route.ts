import { Router } from "express";
import { GalleryController } from "./gallery.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

// Presigned upload URL
router.get(
  "/presigned-url",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  GalleryController.getPresignedUrl,
);

// Upload (save keys)
router.post(
  "/upload",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  GalleryController.addGallery,
);

// Public reads
router.get("/getGalleries", GalleryController.getGalleries);
router.get("/getCategories", GalleryController.getCategories);
router.get("/getGalleries/event/:id", GalleryController.getByEventId);
router.get("/getGalleries/campus/:id", GalleryController.getByCategoryId);

// Student
router.get(
  "/approvedStudents",
  AuthMiddleware.authenticate(["student"]),
  GalleryController.getApprovedStudent,
);
router.get(
  "/pendingStudents",
  AuthMiddleware.authenticate(["student"]),
  GalleryController.getPendingStudent,
);
router.get(
  "/rejectedStudents",
  AuthMiddleware.authenticate(["student"]),
  GalleryController.getRejectedStudent,
);

// Update
router.put(
  "/updateGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.updateGallery,
);

// Admin moderation
router.get(
  "/pending",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.getPending,
);
router.get(
  "/rejected",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.getRejected,
);
router.patch(
  "/approve/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.approve,
);
router.patch(
  "/reject/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.reject,
);
router.post(
  "/rejectMultiple",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.rejectMultiple,
);
router.post(
  "/deleteMultiple",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.deleteMultiple,
);
router.delete(
  "/deleteGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.deleteGallery,
);
router.delete(
  "/deleteEventGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.deleteEventGallery,
);
router.delete(
  "/deleteCategoryGallery/:id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.deleteCategoryGallery,
);

// Categories + thumbnails
router.post(
  "/addCategory",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.addCategory,
);
router.put(
  "/setCategoryThumbnail/:category_id/:image_id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.setCategoryThumbnail,
);
router.put(
  "/setEventThumbnail/:event_id/:image_id",
  AuthMiddleware.authenticate(["admin"]),
  GalleryController.setEventThumbnail,
);

export default router;
