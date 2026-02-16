import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateTokens = (user) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
      login_id: user.login_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { id: user.id, role: user.role, version: user.tokenVersion || 0 }, 
    process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
  return { accessToken, refreshToken };
};

const sendRefreshToken = (res, token) => {
  const isProduction = process.env.NODE_ENV === "production";
  const cookieDomain = isProduction ? process.env.DOMAIN : undefined;

  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "Lax" : "Lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    // domain: cookieDomain,
    // Partitioned cookies must be Secure. Only enable in production/secure mode.
    partitioned: isProduction,
  });
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
    if (!user) {
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

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: "admin",
    });
    sendRefreshToken(res, refreshToken);

    // Legacy cookie removed.

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: { id: user.id, role: "admin", username: user.username },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error logging in" });
  }
};

export const student_login = async (req, res) => {
  const { login_id, password } = req.body;
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

    if (!student.password) {
      console.error("No password found for student:", student.login_id);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const hashedPassword = student.password;
    const isValidPassword = await bcrypt.compare(password, hashedPassword);

    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens({
      ...student,
      role: "student",
    });
    // We can send refresh token, but student app might ignore it.
    // sendRefreshToken(res, refreshToken); // Check if this breaks anything? Probably safe to send.

    // Legacy cookie removed.

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: { id: student.id, role: "student", login_id: student.login_id },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Error during login", error: error.message });
  }
};

export const teacher_login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await prisma.teachers.findUnique({
      where: {
        email: email,
        available: true,
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

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: "teacher",
    });
    sendRefreshToken(res, refreshToken);

    // Legacy cookie removed.

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      user: { id: user.id, role: "teacher", email: user.email },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error logging in" });
  }
};

export const refresh_token = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) {
    return res.json({ success: false, accessToken: "" });
  }

  try {
    const payload = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
    );

    // Check if user exists based on role
    let user = null;
    if (payload.role === "admin") {
      user = await prisma.admin.findUnique({ where: { id: payload.id } });
    } else if (payload.role === "student") {
      user = await prisma.students.findUnique({ where: { id: payload.id } });
    } else if (payload.role === "teacher") {
      user = await prisma.teachers.findUnique({ where: { id: payload.id } });
    }

    if (!user) {
      return res.json({ success: false, accessToken: "" });
    }

    // Check token version for revocation
    const tokenVersion = payload.version || 0;
    const userVersion = user.tokenVersion || 0;

    if (tokenVersion !== userVersion) {
      console.log(
        `Token version mismatch for user ${user.id}: in-token=${tokenVersion}, in-db=${userVersion}`,
      );
      return res.json({ success: false, accessToken: "" });
    }

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: payload.role,
    });
    sendRefreshToken(res, refreshToken); // Rotate refresh token

    return res.json({
      success: true,
      accessToken,
      user: {
        id: user.id,
        role: payload.role,
        username: user.username,
        email: user.email,
        login_id: user.login_id,
      },
    });
  } catch (err) {
    console.log(err);
    return res.json({ success: false, accessToken: "" });
  }
};

export const logout = async (req, res) => {
  const token = req.cookies?.refreshToken;

  if (token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      );

      // Increment token version to revoke all sessions for this user
      if (decoded.role === "admin") {
        await prisma.admin.update({
          where: { id: decoded.id },
          data: { tokenVersion: { increment: 1 } },
        });
      } else if (decoded.role === "student") {
        await prisma.students.update({
          where: { id: decoded.id },
          data: { tokenVersion: { increment: 1 } },
        });
      } else if (decoded.role === "teacher") {
        await prisma.teachers.update({
          where: { id: decoded.id },
          data: { tokenVersion: { increment: 1 } },
        });
      }
    } catch (error) {
      // Token might be expired or invalid, just proceed to clear cookies
      console.log(
        "Logout: Token invalid or expired, skipping version increment.",
      );
    }
  }

  res.clearCookie("refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
};

export const checkAdminExists = async (req, res) => {
  try {
    const adminCount = await prisma.admin.count();
    res.json({
      success: true,
      hasAdmins: adminCount > 0,
      adminCount,
    });
  } catch (err) {
    console.error("Error checking admin existence:", err);
    res
      .status(500)
      .json({ success: false, error: "Error checking admin existence" });
  }
};

export const addAdmin = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res
      .status(400)
      .json({ message: "Username and password are required" });

  try {
    // Check if any admin exists in the system
    const adminCount = await prisma.admin.count();

    // If admins exist, require authentication
    if (adminCount > 0) {
      const token = req.headers.authorization?.split(" ")[1];
      if (!token) {
        return res.status(401).json({
          message: "Admin authentication required to create additional admins",
        });
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (!decoded.id || decoded.role !== "admin") {
          return res.status(401).json({
            message:
              "Admin authentication required to create additional admins",
          });
        }

        const authenticatedAdmin = await prisma.admin.findUnique({
          where: { id: decoded.id },
        });
        if (!authenticatedAdmin) {
          return res.status(401).json({
            message:
              "Admin authentication required to create additional admins",
          });
        }
      } catch (error) {
        return res.status(401).json({
          message: "Invalid admin token",
        });
      }
    }

    // Check if admin with this username already exists
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

    const message =
      adminCount === 0
        ? "First admin created successfully"
        : "Admin created successfully";

    res.json({
      success: true,
      message,
      admin: { id: admin.id, username: admin.username },
    });
  } catch (err) {
    console.error("Error creating admin:", err);
    res.status(500).json({ success: false, error: "Error creating admin" });
  }
};
