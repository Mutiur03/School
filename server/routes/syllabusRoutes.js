import router from "express";
import {
  uploadSyllabus,
  listSyllabus,
  deleteSyllabus,
  updateSyllabus,
} from "../controllers/syllabusController.js";
import multer from "multer";
const syllabusRoutes = router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

syllabusRoutes.get("/", listSyllabus);
syllabusRoutes.post("/upload", upload.single("pdf"), uploadSyllabus);
syllabusRoutes.put("/:id", upload.single("pdf"), updateSyllabus);
syllabusRoutes.delete("/:id", deleteSyllabus);

export default syllabusRoutes;
