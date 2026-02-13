import router from "express";
import {
  createOrUpdateClass6Reg,
  getClass6Reg,
  deleteClass6RegNotice,
  getClass6NoticeUploadUrl,
} from "../controllers/regClass6Controller.js";

const regClass6Router = router.Router();

regClass6Router.post("/", createOrUpdateClass6Reg);
regClass6Router.get("/", getClass6Reg);
regClass6Router.delete("/notice", deleteClass6RegNotice);
regClass6Router.post("/upload-url", getClass6NoticeUploadUrl);

export default regClass6Router;
