import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Request, Response } from "express";
import { env } from "@/config/env.js";
import { prisma } from "@/config/prisma.js";
import { ApiError } from "@/utils/ApiError.js";
import { redis } from "@/config/redis.js";
import EmailService from "@/utils/email.service.js";
import { SMSService } from "@/utils/sms.service.js";
import { assertSuperAdminHostAllowed } from "@/utils/superAdminDomain.js";

export type AuthUser = {
  id: number;
  role: string;
  username?: string | null;
  email?: string | null;
  login_id?: bigint | null;
  tokenVersion?: number | null;
};

export class AuthService {
  static async setupSuperAdmin(req: Request, email?: string, token?: string) {
    await assertSuperAdminHostAllowed(req);

    if (!email || !token) {
      throw new ApiError(400, "Email and token are required");
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const [count, tokenDoc] = await prisma.$transaction([
      prisma.superAdmin.count(),
      prisma.setupToken.findUnique({ where: { tokenHash } }),
    ]);

    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new ApiError(403, "Invalid or expired token");
    }

    if (tokenDoc.role === "super_admin" && count > 0) {
      throw new ApiError(403, "Super admin already exists");
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

    return { email };
  }

  static async loginAdmin(
    username?: string,
    password?: string,
    schoolId?: number,
  ) {
    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }

    const user = await prisma.admin.findUnique({
      where: { username, school_id: schoolId },
    });

    if (!user) {
      throw new ApiError(401, "Admin not found");
    }

    if (!user.password) {
      throw new ApiError(401, "Invalid credentials (no password set)");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = AuthService.generateTokens({
      ...user,
      role: "admin",
    });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, role: "admin", username: user.username },
    };
  }

  static async loginSuperAdmin(
    req: Request,
    email?: string,
    password?: string,
  ) {
    await assertSuperAdminHostAllowed(req);

    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.superAdmin.findUnique({ where: { email } });

    if (!user) {
      throw new ApiError(401, "Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = AuthService.generateTokens({
      ...user,
      role: "super_admin",
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: "super_admin",
        email: user.email,
      },
    };
  }

  static async loginStudent(
    loginId?: string,
    password?: string,
    schoolId?: number,
  ) {
    if (!loginId || !password) {
      throw new ApiError(400, "Login ID and password are required");
    }

    const loginIdInt = parseInt(loginId, 10);
    if (Number.isNaN(loginIdInt)) {
      throw new ApiError(400, "Invalid login ID format");
    }

    const student = await prisma.students.findUnique({
      where: { login_id: loginIdInt, school_id: schoolId },
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

    const { accessToken, refreshToken } = AuthService.generateTokens({
      ...student,
      role: "student",
    });

    const studentAddress = [
      student.village,
      student.post_office,
      student.upazila,
      student.district,
    ]
      .filter(Boolean)
      .join(", ");

    return {
      accessToken,
      refreshToken,
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
    };
  }

  static async loginTeacher(
    email?: string,
    password?: string,
    schoolId?: number,
  ) {
    if (!email || !password) {
      throw new ApiError(400, "Email and password are required");
    }

    const user = await prisma.teachers.findFirst({
      where: {
        email,
        available: true,
        school_id: schoolId,
      },
      include: {
        levels: { where: { year: new Date().getFullYear() } },
      },
    });

    if (!user || !user.password) {
      throw new ApiError(401, "Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new ApiError(401, "Invalid credentials");
    }

    const { accessToken, refreshToken } = AuthService.generateTokens({
      ...user,
      role: "teacher",
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: "teacher",
        name: user.name,
        email: user.email,
        phone: user.phone,
        designation: user.designation,
        address: user.address,
        image: user.image,
        signature: user.signature,
        levels: (user as any).levels,
      },
    };
  }

  static async refreshToken(req: Request, token?: string) {
    if (!token) {
      throw new ApiError(401, "Unauthorized");
    }

    const secret = process.env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
    let payload: any;
    try {
      payload = jwt.verify(token, secret) as any;
    } catch {
      throw new ApiError(401, "Unauthorized");
    }

    let user = null;
    if (payload.role === "admin") {
      user = await prisma.admin.findFirst({
        where: { id: payload.id, school_id: req.schoolId },
      });
    } else if (payload.role === "student") {
      user = await prisma.students.findFirst({
        where: { id: payload.id, school_id: req.schoolId },
      });
    } else if (payload.role === "teacher") {
      user = await prisma.teachers.findFirst({
        where: { id: payload.id, school_id: req.schoolId },
        include: { levels: { where: { year: new Date().getFullYear() } } },
      });
    } else if (payload.role === "super_admin") {
      await assertSuperAdminHostAllowed(req);
      user = await prisma.superAdmin.findUnique({ where: { id: payload.id } });
    }

    if (!user) {
      throw new ApiError(401, "Unauthorized");
    }

    const tokenVersion = payload.version || 0;
    const userVersion = user.tokenVersion || 0;

    if (tokenVersion !== userVersion) {
      throw new ApiError(401, "Unauthorized");
    }

    const { accessToken, refreshToken } = AuthService.generateTokens({
      ...user,
      role: payload.role,
    });

    const responseUser = {
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
      responseUser.signature = (user as any).signature;
      responseUser.levels = (user as any).levels;
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

    return { accessToken, refreshToken, user: responseUser };
  }

  static async logout(token: string | undefined, schoolId?: number) {
    if (!token) {
      return;
    }

    try {
      const decoded = jwt.verify(
        token,
        (process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET)!,
      ) as any;

      if (decoded.role === "admin") {
        await prisma.admin.update({
          where: { id: decoded.id, school_id: schoolId },
          data: { tokenVersion: { increment: 1 } },
        });
      } else if (decoded.role === "student") {
        await prisma.students.update({
          where: { id: decoded.id, school_id: schoolId },
          data: { tokenVersion: { increment: 1 } },
        });
      } else if (decoded.role === "teacher") {
        await prisma.teachers.update({
          where: { id: decoded.id, school_id: schoolId },
          data: { tokenVersion: { increment: 1 } },
        });
      } else if (decoded.role === "super_admin") {
        await prisma.superAdmin.update({
          where: { id: decoded.id },
          data: { tokenVersion: { increment: 1 } },
        });
      }
    } catch {
      // Ignore invalid/expired token during logout cleanup.
    }
  }

  static async addAdmin(
    username?: string,
    password?: string,
    schoolId?: number,
  ) {
    if (!username || !password) {
      throw new ApiError(400, "Username and password are required");
    }

    if (!schoolId || !Number.isInteger(schoolId) || schoolId <= 0) {
      throw new ApiError(400, "School ID is required");
    }

    const existing = await prisma.admin.findUnique({
      where: { username, school_id: schoolId },
    });

    if (existing) {
      throw new ApiError(409, "Admin already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await prisma.admin.create({
      data: {
        username,
        password: hashedPassword,
        role: "admin",
        school_id: schoolId,
      },
    });

    return { id: admin.id, username: admin.username };
  }

  static async requestTeacherPasswordReset(email?: string, schoolId?: number) {
    if (!email) {
      throw new ApiError(400, "Email is required");
    }

    const rateLimitKey = `teacher_reset_rate:${email}`;
    const existingRequests = await redis.get(rateLimitKey);

    if (existingRequests) {
      const requestCount = parseInt(existingRequests, 10);
      if (requestCount >= 3) {
        throw new ApiError(
          429,
          "Too many reset requests. Please try again after 1 hour.",
        );
      }
    }

    const teacher = await prisma.teachers.findFirst({
      where: {
        email,
        available: true,
        school_id: schoolId,
      },
    });

    if (!teacher) {
      return { message: "If an account exists, a reset code will be sent." };
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetKey = `teacher_reset:${email}`;

    await redis.set(resetKey, resetCode, "EX", 900);
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 3600);

    try {
      await EmailService.sendEmail({
        from: env.FROM_EMAIL,
        to: email,
        subject: "Password Reset Code - School Management System",
        body: `Hello ${teacher.name},\n\nYou requested a password reset. Your 6-digit verification code is:\n\n${resetCode}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nSchool Management System`,
      });
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      throw new ApiError(500, "Failed to send reset email. Please try again.");
    }

    return { message: "Reset code sent to your email." };
  }

  static async checkTeacherPasswordResetCode(email?: string, code?: string) {
    if (!email || !code) {
      throw new ApiError(400, "Email and code are required");
    }

    const resetKey = `teacher_reset:${email}`;
    const storedCode = await redis.get(resetKey);

    if (!storedCode) {
      throw new ApiError(400, "Reset code has expired or is invalid");
    }

    if (storedCode !== code) {
      throw new ApiError(400, "Invalid reset code");
    }
  }

  static async verifyTeacherPasswordReset(
    email?: string,
    code?: string,
    newPassword?: string,
    schoolId?: number,
  ) {
    if (!email || !code || !newPassword) {
      throw new ApiError(400, "Email, code, and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters long");
    }

    const resetKey = `teacher_reset:${email}`;
    const storedCode = await redis.get(resetKey);

    if (!storedCode) {
      throw new ApiError(400, "Reset code has expired or is invalid");
    }

    if (storedCode !== code) {
      throw new ApiError(400, "Invalid reset code");
    }

    const teacher = await prisma.teachers.findFirst({
      where: {
        email,
        available: true,
        school_id: schoolId,
      },
    });

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.teachers.update({
      where: { id: teacher.id, school_id: schoolId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    await redis.del(resetKey);
  }

  static async requestStudentPasswordReset(
    loginId?: string,
    schoolId?: number,
  ) {
    if (!loginId) {
      throw new ApiError(400, "Login ID is required");
    }

    const loginIdInt = parseInt(loginId, 10);
    if (Number.isNaN(loginIdInt)) {
      throw new ApiError(400, "Invalid login ID format");
    }

    const rateLimitKey = `student_reset_rate:${loginId}`;
    const existingRequests = await redis.get(rateLimitKey);

    if (existingRequests) {
      const requestCount = parseInt(existingRequests, 10);
      if (requestCount >= 3) {
        throw new ApiError(
          429,
          "Too many reset requests. Please try again after 1 hour.",
        );
      }
    }

    const student = await prisma.students.findUnique({
      where: { login_id: loginIdInt, school_id: schoolId },
    });

    if (!student) {
      return { message: "If an account exists, a reset code will be sent." };
    }

    if (!student.father_phone) {
      throw new ApiError(
        400,
        "No phone number associated with this account. Please contact the school administration.",
      );
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetKey = `student_reset:${loginId}`;

    await redis.set(resetKey, resetCode, "EX", 900);
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, 3600);

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

    return { message: "Reset code sent to your phone number." };
  }

  static async checkStudentPasswordResetCode(loginId?: string, code?: string) {
    if (!loginId || !code) {
      throw new ApiError(400, "Login ID and code are required");
    }

    const resetKey = `student_reset:${loginId}`;
    const storedCode = await redis.get(resetKey);

    if (!storedCode) {
      throw new ApiError(400, "Reset code has expired or is invalid");
    }

    if (storedCode !== code) {
      throw new ApiError(400, "Invalid reset code");
    }
  }

  static async verifyStudentPasswordReset(
    loginId?: string,
    code?: string,
    newPassword?: string,
    schoolId?: number,
  ) {
    if (!loginId || !code || !newPassword) {
      throw new ApiError(400, "Login ID, code, and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters long");
    }

    const loginIdInt = parseInt(loginId, 10);
    if (Number.isNaN(loginIdInt)) {
      throw new ApiError(400, "Invalid login ID format");
    }

    const resetKey = `student_reset:${loginId}`;
    const storedCode = await redis.get(resetKey);

    if (!storedCode) {
      throw new ApiError(400, "Reset code has expired or is invalid");
    }

    if (storedCode !== code) {
      throw new ApiError(400, "Invalid reset code");
    }

    const student = await prisma.students.findUnique({
      where: { login_id: loginIdInt, school_id: schoolId },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.students.update({
      where: { id: student.id, school_id: schoolId },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 },
      },
    });

    await redis.del(resetKey);
  }

  static generateTokens(user: AuthUser) {
    const secret = process.env.REFRESH_TOKEN_SECRET || env.JWT_SECRET;
    const accessToken = jwt.sign(
      {
        id: user.id,
        role: user.role,
        username: user.username,
        email: user.email,
        login_id: user.login_id,
      },
      env.JWT_SECRET,
      { expiresIn: env.NODE_ENV === "development" ? "1m" : "15m" },
    );
    const refreshToken = jwt.sign(
      { id: user.id, role: user.role, version: user.tokenVersion || 0 },
      secret,
      { expiresIn: "7d" },
    );
    return { accessToken, refreshToken };
  }

  static sendRefreshToken(res: Response, token: string) {
    const isProduction = process.env.NODE_ENV === "production";

    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      partitioned: isProduction,
    });
  }

  static clearRefreshToken(res: Response) {
    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      // Intentionally omit domain so cookie remains host-scoped.
      partitioned: isProduction,
    });
  }
}
