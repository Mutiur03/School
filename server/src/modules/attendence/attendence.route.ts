import express from "express";
import { AttendenceController } from "./attendence.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = express.Router();

router.get(
  "/getAttendence",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  AttendenceController.getAttendenceController
);

router.post(
  "/addAttendence",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  AttendenceController.addAttendenceController
);

const attendenceRouter = express.Router();
attendenceRouter.use("/api/attendance", router);
export default attendenceRouter;
