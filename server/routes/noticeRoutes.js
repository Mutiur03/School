import router from "express";
import multer from "multer";
const noticeRouter = router.Router();

import {
  addNoticeController,
  deleteNoticeController,
  getNoticesController,
  updateNoticeController,
  getNoticeController,
} from "../controllers/noticeController.js";
import path from "path";
import fs from "fs";
const __dirname = path.resolve();
const storagePath = path.join(__dirname, "uploads/notice");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(storagePath, { recursive: true }, (err) => { 
      if (err) {
        return cb(err, storagePath);
      }
      cb(null, "uploads/notice");
    });
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage });

noticeRouter.post("/addNotice", upload.single("file"), addNoticeController);
noticeRouter.get("/getNotices", getNoticesController);
noticeRouter.put("/updateNotice/:id",upload.single("file"), updateNoticeController);
noticeRouter.delete("/deleteNotice/:id", deleteNoticeController);
noticeRouter.get("/download/:id", getNoticeController);

export default noticeRouter;
