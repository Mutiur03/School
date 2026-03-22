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
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.getIndividualMarksController,
);
router.get(
  "/getClassMarks/:className/:year/:exam",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.getClassMarksController,
);
router.get(
  "/markSheet/:id/marks/:year/:exam/download",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.generateMarksheetController,
);
router.get(
  "/:id/:year/preview",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.previewMarksheetController,
);
router.get(
  "/:id/:year/download",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  MarksController.downloadPreviewMarksheetController,
);
router.get(
  "/all/:year",
  AuthMiddleware.authenticate(["admin"]),
  MarksController.downloadAllMarksheetPDFController,
);

const marksRouter = express.Router();
marksRouter.use("/api/marks", router);

export default marksRouter;
