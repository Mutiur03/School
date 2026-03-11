import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Request, Response } from "express";
import { prisma } from "@/config/prisma.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { redis } from "@/config/redis.js";
import EmailService from "@/utils/email.service.js";
import { env } from "@/config/env.js";
import { SMSService } from "@/utils/sms.service.js";

type AuthUser = {
  id: number;
  role: string;
  username?: string | null;
  email?: string | null;
  login_id?: bigint | null;
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
    { expiresIn: env.NODE_ENV === "development" ? "1s" : "15m" },
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
  static setupSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
    const { email, token } = req.body;

    if (!email || !token) {
      throw new ApiError(400, "Email and token are required");
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [count, tokenDoc] = await prisma.$transaction([
      prisma.superAdmin.count(),
      prisma.setupToken.findUnique({
        where: { tokenHash },
      }),
    ]);
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new ApiError(403, "Invalid or expired token");
    }
    if (tokenDoc.role === "super_admin") {
      if (count > 0) throw new ApiError(403, "Super admin already exists");
    }

    const randomPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    await prisma.superAdmin.create({
      data: {
        email,
        password: hashedPassword,
        role: tokenDoc.role,
      },
    });

    await prisma.setupToken.delete({ where: { id: tokenDoc.id } });
    await EmailService.sendSuperAdminSetupEmail(email, randomPassword);
    res
      .status(201)
      .json(
        new ApiResponse(201, { email }, "Super admin created successfully"),
      );
  });

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
            login_id: student.login_id.toString(),
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

      responseUser.login_id = student.login_id.toString();
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

  // Teacher password reset request
  static requestTeacherPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { email } = req.body;

      if (!email) {
        throw new ApiError(400, "Email is required");
      }

      // Check rate limiting for password reset requests
      const rateLimitKey = `teacher_reset_rate:${email}`;
      const existingRequests = await redis.get(rateLimitKey);

      if (existingRequests) {
        const requestCount = parseInt(existingRequests);
        if (requestCount >= 3) {
          throw new ApiError(
            429,
            "Too many reset requests. Please try again after 1 hour.",
          );
        }
      }

      // Find teacher by email
      const teacher = await prisma.teachers.findFirst({
        where: {
          email: email,
          available: true,
        },
      });

      if (!teacher) {
        // Don't reveal if email exists or not for security
        res
          .status(200)
          .json(
            new ApiResponse(
              200,
              null,
              "If an account exists, a reset code will be sent.",
            ),
          );
        return;
      }

      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store reset code with 15-minute expiration
      const resetKey = `teacher_reset:${email}`;
      await redis.set(resetKey, resetCode, "EX", 900); // 15 minutes

      // Increment rate limit counter
      await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 3600); // 1 hour

      // Send email with reset code
      try {
        await EmailService.sendEmail({
          from: env.FROM_EMAIL,
          to: email,
          subject: "Password Reset Code - School Management System",
          body: `Hello ${teacher.name},\n\nYou requested a password reset. Your 6-digit verification code is:\n\n${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nSchool Management System`,
        });
      } catch (emailError) {
        console.error("Failed to send reset email:", emailError);
        throw new ApiError(
          500,
          "Failed to send reset email. Please try again.",
        );
      }

      res
        .status(200)
        .json(new ApiResponse(200, null, "Reset code sent to your email."));
    },
  );

  // Teacher password reset code verification (Step 2: Check code only)
  static checkTeacherPasswordResetCode = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, code } = req.body;

      if (!email || !code) {
        throw new ApiError(400, "Email and code are required");
      }

      // Verify reset code
      const resetKey = `teacher_reset:${email}`;
      const storedCode = await redis.get(resetKey);

      if (!storedCode) {
        throw new ApiError(400, "Reset code has expired or is invalid");
      }

      if (storedCode !== code) {
        throw new ApiError(400, "Invalid reset code");
      }

      res
        .status(200)
        .json(new ApiResponse(200, null, "Code verified successfully"));
    },
  );

  // Teacher password reset verification (Step 3: Update password)
  static verifyTeacherPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { email, code, newPassword } = req.body;

      if (!email || !code || !newPassword) {
        throw new ApiError(400, "Email, code, and new password are required");
      }

      if (newPassword.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long");
      }

      // Verify reset code
      const resetKey = `teacher_reset:${email}`;
      const storedCode = await redis.get(resetKey);

      if (!storedCode) {
        throw new ApiError(400, "Reset code has expired or is invalid");
      }

      if (storedCode !== code) {
        throw new ApiError(400, "Invalid reset code");
      }

      // Find teacher and update password
      const teacher = await prisma.teachers.findFirst({
        where: {
          email: email,
          available: true,
        },
      });

      if (!teacher) {
        throw new ApiError(404, "Teacher not found");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and increment token version to invalidate existing sessions
      await prisma.teachers.update({
        where: { id: teacher.id },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
      });

      // Clear reset code
      await redis.del(resetKey);

      res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successfully"));
    },
  );

  // Student password reset request
  static requestStudentPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id } = req.body;

      if (!login_id) {
        throw new ApiError(400, "Login ID is required");
      }

      const loginIdInt = parseInt(login_id);
      if (isNaN(loginIdInt)) {
        throw new ApiError(400, "Invalid login ID format");
      }

      // Check rate limiting for password reset requests
      const rateLimitKey = `student_reset_rate:${login_id}`;
      const existingRequests = await redis.get(rateLimitKey);

      if (existingRequests) {
        const requestCount = parseInt(existingRequests);
        if (requestCount >= 3) {
          throw new ApiError(
            429,
            "Too many reset requests. Please try again after 1 hour.",
          );
        }
      }

      // Find student by login_id
      const student = await prisma.students.findUnique({
        where: { login_id: loginIdInt },
      });

      if (!student) {
        // Don't reveal if login_id exists or not for security
        res
          .status(200)
          .json(
            new ApiResponse(
              200,
              null,
              "If an account exists, a reset code will be sent.",
            ),
          );
        return;
      }

      // Check if student has a phone number for SMS
      if (!student.father_phone) {
        throw new ApiError(
          400,
          "No phone number associated with this account. Please contact the school administration.",
        );
      }

      // Generate 6-digit code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

      // Store reset code with 15-minute expiration
      const resetKey = `student_reset:${login_id}`;
      await redis.set(resetKey, resetCode, "EX", 900); // 15 minutes

      // Increment rate limit counter
      await redis.incr(rateLimitKey);
      await redis.expire(rateLimitKey, 3600); // 1 hour

      // Send SMS with reset code
      try {
        await SMSService.sendPasswordResetCode(
          student.father_phone,
          resetCode,
          student.name,
        );
      } catch (smsError) {
        console.error("Failed to send reset SMS:", smsError);
        throw new ApiError(500, "Failed to send reset code. Please try again.");
      }

      res
        .status(200)
        .json(
          new ApiResponse(200, null, "Reset code sent to your phone number."),
        );
    },
  );

  // Student password reset code verification (Step 2: Check code only)
  static checkStudentPasswordResetCode = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id, code } = req.body;

      if (!login_id || !code) {
        throw new ApiError(400, "Login ID and code are required");
      }

      // Verify reset code
      const resetKey = `student_reset:${login_id}`;
      const storedCode = await redis.get(resetKey);

      if (!storedCode) {
        throw new ApiError(400, "Reset code has expired or is invalid");
      }

      if (storedCode !== code) {
        throw new ApiError(400, "Invalid reset code");
      }

      res
        .status(200)
        .json(new ApiResponse(200, null, "Code verified successfully"));
    },
  );

  // Student password reset verification (Step 3: Update password)
  static verifyStudentPasswordReset = asyncHandler(
    async (req: Request, res: Response) => {
      const { login_id, code, newPassword } = req.body;

      if (!login_id || !code || !newPassword) {
        throw new ApiError(
          400,
          "Login ID, code, and new password are required",
        );
      }

      if (newPassword.length < 8) {
        throw new ApiError(400, "Password must be at least 8 characters long");
      }

      const loginIdInt = parseInt(login_id);
      if (isNaN(loginIdInt)) {
        throw new ApiError(400, "Invalid login ID format");
      }

      // Verify reset code
      const resetKey = `student_reset:${login_id}`;
      const storedCode = await redis.get(resetKey);

      if (!storedCode) {
        throw new ApiError(400, "Reset code has expired or is invalid");
      }

      if (storedCode !== code) {
        throw new ApiError(400, "Invalid reset code");
      }

      // Find student and update password
      const student = await prisma.students.findUnique({
        where: { login_id: loginIdInt },
      });

      if (!student) {
        throw new ApiError(404, "Student not found");
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password and increment token version to invalidate existing sessions
      await prisma.students.update({
        where: { id: student.id },
        data: {
          password: hashedPassword,
          tokenVersion: { increment: 1 },
        },
      });

      // Clear reset code
      await redis.del(resetKey);

      res
        .status(200)
        .json(new ApiResponse(200, null, "Password reset successfully"));
    },
  );
}
