import { Router } from "express";
import { SchoolController } from "./school.controller.js";
import AuthMiddleware from "../../middlewares/auth.middleware.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { createSchoolSchema, updateSchoolSchema } from "@school/shared-schemas";

const tenantSchoolRouterInternal = Router();
tenantSchoolRouterInternal.get("/public", SchoolController.getSchoolPublicInfo);
tenantSchoolRouterInternal.put(
  "/:id",
  AuthMiddleware.authenticate(["super_admin", "admin"]),
  validate(updateSchoolSchema),
  SchoolController.updateSchool,
);

const superAdminSchoolRouterInternal = Router();
superAdminSchoolRouterInternal.post(
  "/",
  AuthMiddleware.authenticate(["super_admin"]),
  validate(createSchoolSchema),
  SchoolController.createSchool,
);
superAdminSchoolRouterInternal.get(
  "/",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.getSchools,
);
superAdminSchoolRouterInternal.put(
  "/:id",
  AuthMiddleware.authenticate(["super_admin"]),
  validate(updateSchoolSchema),
  SchoolController.updateSchool,
);
superAdminSchoolRouterInternal.delete(
  "/:id",
  AuthMiddleware.authenticate(["super_admin"]),
  SchoolController.deleteSchool,
);

export const tenantSchoolRouter = Router();
tenantSchoolRouter.use("/api/schools", tenantSchoolRouterInternal);

export const superAdminSchoolRouter = Router();
superAdminSchoolRouter.use("/api/schools", superAdminSchoolRouterInternal);
