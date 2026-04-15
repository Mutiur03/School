import router from "express";
import {
  addEventController,
  deleteEventController,
  getEventsController,
  updateEventController,
  getPresignedUrlController,
} from "../controllers/eventsController.js";

const eventsRouter = router.Router();

eventsRouter.post("/addEvent", addEventController);
eventsRouter.get("/getEvents", getEventsController);
eventsRouter.delete("/deleteEvent/:id", deleteEventController);
eventsRouter.put("/updateEvent/:id", updateEventController);
eventsRouter.get("/presigned-url", getPresignedUrlController);

export default eventsRouter;
