import express from "express";
import {
  addMarksController,
  getClassMarksController,
  getIndividualMarksController,
  generateMarksheetController,
  previewMarksheetController,
  downloadPreviewMarksheet,
  downloadAllMarksheetPDF,
  addGPAController,
  getAllStudentsGPAController,
} from "../controllers/marksController.js";

const marksRouter = express.Router();
 
marksRouter.post("/addMarks", addMarksController);
marksRouter.post("/addGPA", addGPAController);
marksRouter.get("/getMarks/:id/:year/:exam", getIndividualMarksController);
marksRouter.get("/getGPA/:year", getAllStudentsGPAController);
marksRouter.get(
  "/getClassMarks/:className/:year/:exam",
  getClassMarksController
);
marksRouter.get(
  "/markSheet/:id/marks/:year/:exam/download",
  generateMarksheetController
); // Single exam indivisuall marksheet download

marksRouter.get("/:id/:year/preview", previewMarksheetController); // indivisuall marksheet preview
marksRouter.get("/:id/:year/download", downloadPreviewMarksheet); //  indivisuall marksheet download pdf
marksRouter.get("/all/:year", downloadAllMarksheetPDF); // All indivisuall marksheet download pdf

export default marksRouter;
