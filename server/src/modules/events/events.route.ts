import { Router } from "express";
import { EventController } from "./events.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

// Public
router.get("/getEvents", EventController.getEvents);

// Admin-only
router.get(
  "/presigned-url",
  AuthMiddleware.authenticate(["admin"]),
  EventController.getPresignedUrl,
);
router.post(
  "/addEvent",
  AuthMiddleware.authenticate(["admin"]),
  EventController.addEvent,
);
router.put(
  "/updateEvent/:id",
  AuthMiddleware.authenticate(["admin"]),
  EventController.updateEvent,
);
router.delete(
  "/deleteEvent/:id",
  AuthMiddleware.authenticate(["admin"]),
  EventController.deleteEvent,
);

const eventsRouter = router.use("/api/events", router);
export default eventsRouter;
