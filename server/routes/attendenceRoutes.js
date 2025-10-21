import router from "express";
import { addAttendenceController, getAttendenceController } from "../controllers/attendenceController.js";

const attendenceRouter = router.Router();

attendenceRouter.post("/addAttendence", addAttendenceController);
attendenceRouter.get("/getAttendence", getAttendenceController);

export default attendenceRouter;