import router from "express";
import {
  addEventController,
  deleteEventController,
  getEventsController,
  updateEventController,
} from "../controllers/eventsController.js";
import multer from "multer";
import path from "path";
import fs from "fs";
const eventsRouter = router.Router();
const __dirname = path.resolve();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "uploads/events");
    fs.mkdir(uploadPath, { recursive: true }, (err) => {
      if (err) {
        return cb(err, uploadPath);
      }
      cb(null, 'uploads/events');
    });
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });
eventsRouter.post(
  "/addEvent",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  addEventController
);
eventsRouter.get("/getEvents", getEventsController);
eventsRouter.delete("/deleteEvent/:id", deleteEventController);
eventsRouter.put(
  "/updateEvent/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ]),
  updateEventController
);

export default eventsRouter;
