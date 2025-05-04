import router from "express";
import { addHolidayController, getHolidaysController, deleteHolidayController, updateHolidayController } from "../controllers/holidayController.js";

const holidayRouter = router.Router();

holidayRouter.post("/addHoliday", addHolidayController);
holidayRouter.get("/getHolidays", getHolidaysController);
holidayRouter.delete("/deleteHoliday/:id", deleteHolidayController);
holidayRouter.put("/updateHoliday/:id", updateHolidayController);
export default holidayRouter;