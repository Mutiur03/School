import { Router } from "express";
import { SchoolController } from "./school.controller.js";
import AuthMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { createSchoolSchema, updateSchoolSchema } from "@school/shared-schemas";

const router = Router();

router.get("/public", SchoolController.getSchoolPublicInfo);

router.post(
  "/",
  AuthMiddleware.authenticate(["super_admin"]),
  validate(createSchoolSchema),
  SchoolController.createSchool,
);

router.get(
  "/",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.getSchools,
);

// router.get(
//   "/:id",
//   AuthMiddleware.authenticate(["super_admin", "admin"]),
//   SchoolController.getSchoolById,
// );

router.put(
  "/:id",
  AuthMiddleware.authenticate(["super_admin", "admin"]),
  validate(updateSchoolSchema),
  SchoolController.updateSchool,
);

router.delete(
  "/:id",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.deleteSchool,
);

const schoolRouter = router.use("/api/schools", router);

export default schoolRouter;
