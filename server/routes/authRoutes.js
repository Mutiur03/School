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
import rateLimit from "express-rate-limit";
import { ApiResponse } from "../utils/ApiResponse.js";

const authRouter = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "development" ? 500 : 50,
  message: {
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.use(authLimiter);

authRouter.post("/login", login);
authRouter.get("/logout", logout);
authRouter.post("/refresh", refresh_token);
authRouter.post("/student_login", student_login);
authRouter.post("/teacher_login", teacher_login);
authRouter.get("/me", AuthMiddleware.authenticate(), (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, "success", "You are authenticated!", req.user));
});
authRouter.post("/add-admin", addAdmin);

export default authRouter;
