import express from "express";
import {
  login,
  student_login,
  teacher_login,
  addAdmin,
  refresh_token,
  logout,
} from "../controllers/authController.js";
import AuthMiddleware from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adminLoginSchema,
  addAdminSchema,
  teacherLoginSchema,
  studentLoginSchema,
} from "@school/shared-schemas";
import { ApiResponse } from "../utils/ApiResponse.js";

const authRouter = express.Router();

authRouter.post("/login", validate(adminLoginSchema), login);
authRouter.get("/logout", logout);
authRouter.post("/refresh", refresh_token);
authRouter.post("/student_login", validate(studentLoginSchema), student_login);
authRouter.post("/teacher_login", validate(teacherLoginSchema), teacher_login);
authRouter.get("/me", AuthMiddleware.authenticate(), (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, "success", "You are authenticated!", req.user));
});
authRouter.post("/add-admin", validate(addAdminSchema), addAdmin);

export default authRouter;
