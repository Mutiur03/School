import { Router } from "express";
import {
  getCitizenCharterController,
  getPresignedUrlController,
  upsertCitizenCharterController,
} from "./citizen-charter.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

router.get("/", getCitizenCharterController);

router.get(
  "/presigned-url",
  AuthMiddleware.authenticate(["admin"]),
  getPresignedUrlController,
);
router.post(
  "/",
  AuthMiddleware.authenticate(["admin"]),
  upsertCitizenCharterController,
);

const citizenCharterRouter = router.use("/api/citizen-charter", router);
export default citizenCharterRouter;
