import router from "express";
import {
  addAttendenceController,
  getAttendenceController,
} from "../controllers/attendenceController.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";

const attendenceRouter = router.Router();

attendenceRouter.post(
  "/addAttendence",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  addAttendenceController,
);
attendenceRouter.get(
  "/getAttendence",
  AuthMiddleware.authenticate(["admin", "teacher"]),
  getAttendenceController,
);

export default attendenceRouter;
