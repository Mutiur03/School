import express from "express";
import {
  authenticateUser,
  login,
  student_login,
  authenticateStudent,
  teacher_login,
  addAdmin,
} from "../controllers/authController.js";
import { teacher_me } from "../middlewares/auth.js";

const authRouter = express.Router();

authRouter.post("/login", login);
authRouter.get("/protected", authenticateUser, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});
authRouter.get("/logout", (req, res) => {
  console.log("Logging out...");
  const cookieDomain =
    process.env.NODE_ENV === "production" ? process.env.DOMAIN : "localhost";

  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    partitioned: true,
  });
  res.clearCookie("admin_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Lax" : "Lax",
    path: "/",
    domain: cookieDomain,
  });

  res.clearCookie("student_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    partitioned: true,
  });
  res.clearCookie("student_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Lax" : "Lax",
    path: "/",
    domain: cookieDomain,
  });

  res.clearCookie("teacher_token", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    partitioned: true,
  });
  res.clearCookie("teacher_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Lax" : "Lax",
    path: "/",
    domain: cookieDomain,
  });
  res.json({ message: "Logout successful" });
});
authRouter.post("/student_login", student_login);
authRouter.post("/teacher_login", teacher_login);
authRouter.get("/teacher_me", teacher_me, (req, res) => {
  console.log("Authenticated Teacher:", req.user);

  res.json({ message: "You are authenticated!", user: req.user });
});
authRouter.get("/student-protected", authenticateStudent, (req, res) => {
  res.json({ message: "You are authenticated!", user: req.user });
});
authRouter.post("/add-admin", addAdmin); // <-- add this line

export default authRouter;
