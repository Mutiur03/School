import { Router } from "express";
import { StaffController } from "./staff.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

router.get("/", StaffController.getStaffsController);
router.post("/", AuthMiddleware.authenticate(["admin"]), StaffController.addStaffController);
router.get(
  "/presigned-url",
  AuthMiddleware.authenticate(["admin"]),
  StaffController.getStaffPresignedUrlController,
);
router.put("/:id", AuthMiddleware.authenticate(["admin"]), StaffController.updateStaffController);
router.delete("/:id", AuthMiddleware.authenticate(["admin"]), StaffController.deleteStaffController);
router.put(
  "/:id/image",
  AuthMiddleware.authenticate(["admin"]),
  StaffController.saveStaffImageController,
);
router.delete(
  "/:id/image",
  AuthMiddleware.authenticate(["admin"]),
  StaffController.removeStaffImageController,
);

const staffRouter = Router();
staffRouter.use("/api/staffs", router);
export default staffRouter;
