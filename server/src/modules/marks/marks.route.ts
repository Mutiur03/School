import express from "express";
import { MarksController } from "./marks.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

router.post(
  "/addMarks",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.addMarksController,
);
router.get(
  "/students",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.getStudentsForMarksController,
);
router.get(
  "/getMarks/:id/:year/:exam",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  MarksController.getIndividualMarksController,
);
router.get(
  "/getClassMarks/:className/:year/:exam",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.getClassMarksController,
);

router.get(
  "/:id/:year/preview",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  MarksController.getIndividualSessionMarksPreviewController,
);
router.get(
  "/:id/:year/download",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  MarksController.downloadIndividualSessionMarksheetController,
);

router.get(
  "/:id/:year/:exam/download",
  AuthMiddleware.authenticate(["admin", "teacher", "student"]),
  MarksController.generateMarksheetController,
);
router.get(
  "/all/:year",
  AuthMiddleware.authenticate(["admin"]),
  MarksController.downloadAllMarksheetPDFController,
);

router.get(
  "/class-exam/:className/:year/:exam/download",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.downloadClassExamMarksheetPDFController,
);

router.post(
  "/update-fourth-subject",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.updateFourthSubjectController,
);

const marksRouter = express.Router();
marksRouter.use("/api/marks", router);

export default marksRouter;
