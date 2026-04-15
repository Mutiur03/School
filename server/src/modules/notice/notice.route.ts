import { Router } from "express";
import {
  addNoticeController,
  deleteNoticeController,
  getNoticesController,
  getPresignedUrlController,
  updateNoticeController,
} from "./notice.controller.js";
import AuthMiddleware from "@/middlewares/auth.middleware.js";

const router = Router();

router.get("/getNotices", getNoticesController);

router.get(
  "/presigned-url",
  AuthMiddleware.authenticate(["admin"]),
  getPresignedUrlController
);
router.post(
  "/addNotice",
  AuthMiddleware.authenticate(["admin"]),
  addNoticeController
);
router.put(
  "/updateNotice/:id",
  AuthMiddleware.authenticate(["admin"]),
  updateNoticeController
);
router.delete(
  "/deleteNotice/:id",
  AuthMiddleware.authenticate(["admin"]),
  deleteNoticeController
);
const noticeRouter = router.use("/api/notices", router);
export default noticeRouter;
