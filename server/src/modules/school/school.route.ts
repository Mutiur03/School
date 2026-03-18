import { Router } from "express";
import { SchoolController } from "./school.controller.js";
import AuthMiddleware from "../../middlewares/auth.middleware.js";

const router = Router();

// Public route to get school info (e.g., for branding on landing page)
router.get("/api/schools/:id/public", SchoolController.getSchoolPublicInfo);

// Protected routes for school management
router.post(
  "/api/schools",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.createSchool
);

router.get(
  "/api/schools",
  AuthMiddleware.authenticate(["super_admin", "admin"]),
  SchoolController.getSchools
);

router.get(
  "/api/schools/:id",
  AuthMiddleware.authenticate(["super_admin", "admin"]),
  SchoolController.getSchoolById
);

router.put(
  "/api/schools/:id",
  AuthMiddleware.authenticate(["super_admin", "admin"]),
  SchoolController.updateSchool
);

router.delete(
  "/api/schools/:id",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.deleteSchool
);

export default router;
