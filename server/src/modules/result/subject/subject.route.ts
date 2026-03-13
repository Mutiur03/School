import express from "express";
import AuthMiddleware from "@/middlewares/auth.middleware.js";
import { SubjectController } from "./subject.controller.js";
import { validate } from "@/middlewares/validate.middleware.js";
import { addSubjectsSchema, updateSubjectSchema } from "@school/shared-schemas";

const router = express.Router();

router.get(
  "/getSubjects",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  SubjectController.getSubsController,
);

router.post(
  "/addSubject",
  AuthMiddleware.authenticate(["admin"]),
  validate(addSubjectsSchema),
  SubjectController.addSubController,
);

router.delete(
  "/deleteSubject/:id",
  AuthMiddleware.authenticate(["admin"]),
  SubjectController.deleteSubController,
);

router.put(
  "/updateSubject/:id",
  AuthMiddleware.authenticate(["admin"]),
  validate(updateSubjectSchema),
  SubjectController.updateSubController,
);

const subjectRouter = express.Router();
subjectRouter.use("/api/sub", router);
export default subjectRouter;
