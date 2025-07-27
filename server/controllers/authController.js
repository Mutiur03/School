import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";

// Admin authentication middleware
export const authenticateUser = async (req, res, next) => {
  const token = req.cookies?.admin_token;
  console.log(token);
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    console.log(req.user);
    console.log(req.user.id);
    if (!req.user.id) return res.status(401).json({ message: "Unauthorized" });
    if (req.user.role !== "admin")
      return res.status(401).json({ message: "Unauthorized" });
    const check = await prisma.admin.findUnique({
      where: { id: req.user.id },
    });
    if (!check) return res.status(401).json({ message: "Unauthorized" });
    req.admin = check;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.admin.findFirst({
      where: {
        username: username,
        role: "admin",
      },
    });
    console.log("User found:", user);
    if (!user) {
      console.log(username, password);
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    console.log("logging in");
    const token = jwt.sign(
      { id: user.id, role: user.role, username: user.username },
      process.env.JWT_SECRET
    );
    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 3600000,
      partitioned: true,
    });
    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error logging in" });
  }
};

export const student_login = async (req, res) => {
  console.log("Received login data:", req.body);
  const { login_id, password } = req.body;
  console.log("Received login data:", login_id, password);

  if (!login_id || !password) {
    return res
      .status(400)
      .json({ message: "Login ID and password are required" });
  }

  try {
    const loginIdInt = parseInt(login_id);
    if (isNaN(loginIdInt)) {
      return res.status(400).json({ message: "Invalid login ID format" });
    }

    const student = await prisma.students.findUnique({
      where: { login_id: loginIdInt },
    });

    if (!student) {
      return res.status(401).json({ message: "Invalid login id" });
    }

    console.log("Student found:", student.login_id);

    if (!student.password) {
      console.error("No password found for student:", student.login_id);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log("Comparing passwords...");
    const hashedPassword = student.password;
    const isValidPassword = await bcrypt.compare(password, hashedPassword);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: student.id,
        role: "student",
        login_id: student.login_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log(process.env.NODE_ENV === "production");
    res.cookie("student_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 3600000,
      partitioned: true,
    });
    res.json({ success: true, message: "Login successful" });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Error during login", error: error.message });
  }
};

export const authenticateStudent = async (req, res, next) => {
  const token = req.cookies?.student_token;
  if (!token) return res.status(401).json({ message: "Unauthorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    req.user = decoded;
    const check = await prisma.students.findUnique({
      where: { login_id: req.user.login_id },
    });
    if (!check) return res.status(401).json({ message: "Unauthorized" });
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid Token" });
  }
};

export const teacher_login = async (req, res) => {
  console.log("Received login data:", req.body);

  const { email, password } = req.body;

  try {
    const user = await prisma.teachers.findUnique({
      where: {
        email: email,
      },
    });

    if (!user || !user.password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: "teacher", email: user.email },
      process.env.JWT_SECRET
    );
    console.log("Teacher logging in:", user.email);
    const cookieDomain =
      process.env.NODE_ENV === "production" ? process.env.DOMAIN : "localhost";

    res.cookie("teacher_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "Lax" : "Lax",
      path: "/",
      maxAge: 3600000,
      domain: cookieDomain,
    });
    console.log(process.env.NODE_ENV === "production");

    res.json({ success: true, message: "Login successful" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error logging in" });
  }
};

export const addAdmin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Username and password are required" });

  try {
    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
      return res.status(409).json({ message: "Admin already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: "admin",
      },
    });
    res.json({
      success: true,
      message: "Admin created successfully",
      admin: { id: admin.id, username: admin.username },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Error creating admin" });
  }
};
