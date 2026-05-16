import router from "express";
import {
  uploadSyllabus,
  listSyllabus,
  deleteSyllabus,
  updateSyllabus,
  getSyllabusPresignedUrl,
} from "../controllers/syllabusController.js";

const syllabusRoutes = router();

syllabusRoutes.get("/", listSyllabus);
syllabusRoutes.get("/presigned-url", getSyllabusPresignedUrl);
syllabusRoutes.post("/upload", uploadSyllabus);
syllabusRoutes.put("/:id", updateSyllabus);
syllabusRoutes.delete("/:id", deleteSyllabus);

export default syllabusRoutes;
