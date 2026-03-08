import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response } from "express";
import { prisma } from "@/config/prisma.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import asyncHandler from "@/utils/asyncHandler.js";

type AuthUser = {
  id: number;
  role: string;
  username?: string | null;
  email?: string | null;
  login_id?: number | null;
  tokenVersion?: number | null;
};

const generateTokens = (user: AuthUser) => {
  const accessToken = jwt.sign(
    {
      id: user.id,
      role: user.role,
      username: user.username,
      email: user.email,
      login_id: user.login_id,
    },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  );
  const refreshToken = jwt.sign(
    { id: user.id, role: user.role, version: user.tokenVersion || 0 },
    (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)!,
    { expiresIn: "7d" },
  );
  return { accessToken, refreshToken };
};

const sendRefreshToken = (res: Response, token: string) => {
  const isProduction = process.env.NODE_ENV === "production";
  // const cookieDomain = isProduction ? process.env.DOMAIN : undefined;

  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    // domain: cookieDomain || undefined,
    partitioned: isProduction,
  });
};

export class AuthController {
  static login = asyncHandler(async (req: Request, res: Response) => {
    console.log("[Admin Login] Request received");
    const { username, password } = req.body;

    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }

    console.log(`[Admin Login] Looking up admin with username: "${username}"`);
    const user = await prisma.admin.findUnique({
      where: { username: username },
    });

    if (!user) {
      console.log(
        `[Admin Login] FAILED — No admin found with username: "${username}"`,
      );
      throw new ApiError(401, "Admin not found");
    }

    if (!user.password) {
      throw new ApiError(401, "Invalid credentials (no password set)");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: "admin",
    });
    sendRefreshToken(res, refreshToken);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken,
          user: { id: user.id, role: "admin", username: user.username },
        },
        "Login successful",
      ),
    );
  });

  static student_login = asyncHandler(async (req: Request, res: Response) => {
    const { login_id, password } = req.body;
    if (!login_id || !password) {
      throw new ApiError(400, "Login ID and password are required");
    }

    const loginIdInt = parseInt(login_id);
    if (isNaN(loginIdInt)) {
      throw new ApiError(400, "Invalid login ID format");
    }

    const student = await prisma.students.findUnique({
      where: { login_id: loginIdInt },
    });

    if (!student) {
      throw new ApiError(401, "Invalid login id");
    }

    if (!student.password) {
      throw new ApiError(401, "Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, student.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = generateTokens({
      ...student,
      role: "student",
    });
    sendRefreshToken(res, refreshToken);

    const studentAddress = [
      student.village,
      student.post_office,
      student.upazila,
      student.district,
    ]
      .filter(Boolean)
      .join(", ");

    res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken,
          user: {
            id: student.id,
            role: "student",
            name: student.name,
            login_id: student.login_id,
            email: student.email,
            phone: student.father_phone,
            father_phone: student.father_phone,
            mother_phone: student.mother_phone,
            village: student.village,
            post_office: student.post_office,
            upazila: student.upazila,
            district: student.district,
            address: studentAddress,
            image: student.image,
          },
        },
        "Login successful",
      ),
    );
  });

  static teacher_login = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.teachers.findFirst({
      where: {
        email: email,
        available: true,
      },
    });

    if (!user || !user.password) {
      throw new ApiError(401, "Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: "teacher",
    });
    sendRefreshToken(res, refreshToken);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          accessToken,
          user: {
            id: user.id,
            role: "teacher",
            name: user.name,
            email: user.email,
            phone: user.phone,
            designation: user.designation,
            address: user.address,
            image: user.image,
          },
        },
        "Login successful",
      ),
    );
  });

  static refresh_token = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies.refreshToken;
    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }

    let payload: any;
    try {
      payload = jwt.verify(
        token,
        (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)!,
      ) as any;
    } catch {
      throw new ApiError(401, "Unauthorized");
    }

    let user = null;
    if (payload.role === "admin") {
      user = await prisma.admin.findUnique({ where: { id: payload.id } });
    } else if (payload.role === "student") {
      user = await prisma.students.findUnique({ where: { id: payload.id } });
    } else if (payload.role === "teacher") {
      user = await prisma.teachers.findUnique({ where: { id: payload.id } });
    }

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    const tokenVersion = payload.version || 0;
    const userVersion = user.tokenVersion || 0;

    if (tokenVersion !== userVersion) {
      throw new ApiError(401, "Unauthorized");
    }

    const { accessToken, refreshToken } = generateTokens({
      ...user,
      role: payload.role,
    });
    sendRefreshToken(res, refreshToken);

    let responseUser = {
      id: user.id,
      role: payload.role,
      name: (user as any).name,
      email: (user as any).email,
    } as any;

    if (payload.role === "admin") {
      responseUser.username = (user as any).username;
    } else if (payload.role === "teacher") {
      responseUser.phone = (user as any).phone;
      responseUser.designation = (user as any).designation;
      responseUser.address = (user as any).address;
      responseUser.image = (user as any).image;
    } else if (payload.role === "student") {
      const student = user as any;
      const studentAddress = [
        student.village,
        student.post_office,
        student.upazila,
        student.district,
      ]
        .filter(Boolean)
        .join(", ");

      responseUser.login_id = student.login_id;
      responseUser.phone = student.father_phone;
      responseUser.father_phone = student.father_phone;
      responseUser.mother_phone = student.mother_phone;
      responseUser.village = student.village;
      responseUser.post_office = student.post_office;
      responseUser.upazila = student.upazila;
      responseUser.district = student.district;
      responseUser.address = studentAddress;
      responseUser.image = student.image;
    }

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken, user: responseUser },
          "Token refreshed successfully",
        ),
      );
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken;

    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)!,
        ) as any;

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
      } catch {
        console.log(
          "Logout: Token invalid or expired, skipping version increment.",
        );
      }
    }

    const isProduction = process.env.NODE_ENV === "production";
    const cookieDomain = isProduction ? process.env.DOMAIN : undefined;

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      domain: cookieDomain,
      partitioned: isProduction,
    });

    res.status(200).json(new ApiResponse(200, {}, "Logged out successfully"));
  });

  static addAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }

    const adminCount = await prisma.admin.count();
    const existing = await prisma.admin.findUnique({ where: { username } });
    if (existing) {
      throw new ApiError(409, "Admin already exists");
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

    res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { id: admin.id, username: admin.username },
          message,
        ),
      );
  });
}
