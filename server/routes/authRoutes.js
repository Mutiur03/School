import express from "express";
import {
  authenticateUser,
  login,
  student_login,
  authenticateStudent,
  teacher_login,
  teacher_me,
} from "../controllers/authController.js";

const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.get("/protected", authenticateUser, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});
authRouter.get("/logout", (req, res) => {
  console.log("Logging out...");

  res.clearCookie("token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
  });
  res.json({ message: "Logout successful" });
});
export default authRouter;

authRouter.post("/student_login", student_login);
authRouter.post("/teacher_login", teacher_login);
authRouter.get("/teacher_me", teacher_me);
authRouter.get("/student-protected", authenticateStudent, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});
