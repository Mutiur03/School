import generatePassword from "@/utils/pwgenerator.js";
import * as bcrypt from "bcrypt";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2 } from "@/config/r2.js";
import * as XLSX from "xlsx";
import { teacherFormSchema } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";
import EmailService from "@/utils/email.service.js";
import { env } from "@/config/env.js";
import { redis } from "@/config/redis.js";
import { LONG_TERM_CACHE_TTL } from "@/utils/globalVars.js";
import type { Prisma } from "@prisma/client";

export const sanitizeTeacher = (teacher: any) => {
  const { password: _password, ...rest } = teacher;
  return rest;
};

export class TeacherService {
  static async getTeachersPaginated(
    params: {
      page: number;
      limit: number;
      search?: string;
    },
    _userOptions: { role?: string } = {}
  ) {
    const { page, limit, search } = params;

    const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 200) : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const normalizedSearch = search?.trim();

    const where: Prisma.teachersWhereInput = { available: true };

    if (normalizedSearch) {
      where.OR = [
        { name: { contains: normalizedSearch, mode: "insensitive" } },
        { email: { contains: normalizedSearch, mode: "insensitive" } },
        { phone: { contains: normalizedSearch, mode: "insensitive" } },
        { designation: { contains: normalizedSearch, mode: "insensitive" } },
        { address: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }

    const [total, teachers] = await prisma.$transaction([
      prisma.teachers.count({ where: { available: true } }),
      prisma.teachers.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: normalizedLimit,
      }),
    ]);

    const data = teachers.map(sanitizeTeacher);

    const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedLimit);

    return {
      data,
      meta: {
        total,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages,
      },
    };
  }

  static async getAllTeachers() {
    const teachers = await prisma.teachers.findMany({
      where: { available: true },
    });
    return teachers.map(sanitizeTeacher);
  }

  static async getTeacherById(teacherId: number | string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: Number(teacherId), available: true },
    });

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    return sanitizeTeacher(teacher);
  }

  static async addTeachers(teachers: any[]) {
    const processedTeachers: any[] = [];

    const emails = teachers.map((t) => t.email);
    const uniqueEmails = new Set(emails);

    if (uniqueEmails.size !== emails.length) {
      throw new ApiError(400, "Duplicate emails found in the provided list");
    }

    const existingTeachers = await prisma.teachers.findMany({
      where: {
        email: { in: emails },
      },
      select: { email: true },
    });

    if (existingTeachers.length > 0) {
      const existingEmails = existingTeachers.map((t) => t.email).join(", ");
      throw new ApiError(400, `Teachers with following emails already exist: ${existingEmails}`);
    }

    for (let i = 0; i < teachers.length; i++) {
      const teacher = { ...teachers[i] };

      const parsed = teacherFormSchema.safeParse(teacher);
      if (!parsed.success) {
        throw new ApiError(
          400,
          parsed.error.issues[0]?.message || `Invalid teacher data at index ${i + 1}`,
          parsed.error.issues,
        );
      }

      const { data } = parsed;
      const originalPassword = generatePassword();
      const hashedPassword = await bcrypt.hash(originalPassword, 10);

      processedTeachers.push({
        ...data,
        password: hashedPassword,
        originalPassword,
      });
    }

    await prisma.teachers.createMany({
      data: processedTeachers.map(
        ({ originalPassword: _originalPassword, ...data }) => data,
      ),
    });

    const createdTeachers = await prisma.teachers.findMany({
      where: {
        email: {
          in: processedTeachers.map((t) => t.email),
        },
      },
    });

    const excelData = processedTeachers.map((teacher) => ({
      Name: teacher.name,
      Email: teacher.email,
      Phone: teacher.phone,
      Designation: teacher.designation,
      Address: teacher.address || '',
      Password: teacher.originalPassword,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    EmailService.sendEmailWithAttachment({
      from: env.FROM_EMAIL,
      to: "mutiur5bb@gmail.com",
      subject: "New Teachers Registered - Credentials",
      body: `Hello Headmaster,\n\nPlease find attached the login credentials for the ${processedTeachers.length} newly registered teachers.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "teachers_credentials.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return {
      data: createdTeachers.map(sanitizeTeacher),
      inserted_count: processedTeachers.length,
      excelBuffer,
    };
  }

  static async updateTeacher(id: number, updates: any) {
    const parsed = teacherFormSchema.safeParse(updates);
    if (!parsed.success) {
      throw new ApiError(
        400,
        parsed.error.issues[0]?.message || "Invalid teacher data",
        parsed.error.issues,
      );
    }

    const result = await prisma.teachers.update({
      where: { id },
      data: parsed.data,
    });

    // Clear head message cache
    const key = "head_msg_cache";
    await redis.del(key);

    return sanitizeTeacher(result);
  }

  static async deleteTeacher(id: number) {
    const teacher = await prisma.teachers.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }

    await prisma.teachers.update({
      where: { id },
      data: { available: false },
    });

    // Clear head message cache
    const key = "head_msg_cache";
    await redis.del(key);

    return { message: "Teacher deleted successfully" };
  }

  static async saveTeacherImage(id: number, key: string | null) {
    const existingTeacher = await prisma.teachers.findUnique({
      where: { id },
    });
    if (!existingTeacher) {
      throw new ApiError(404, "Teacher not found");
    }
    if (existingTeacher.image) {
      await deleteFromR2(existingTeacher.image);
    }
    const result = await prisma.teachers.update({
      where: { id },
      data: { image: key || null },
    });

    // Clear head message cache
    const cacheKey = "head_msg_cache";
    await redis.del(cacheKey);

    return result;
  }

  static async changePassword(teacherId: number, currentPassword: string, newPassword: string) {
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new ApiError(404, "Teacher not found");
    }
    if (!teacher.password) {
      throw new ApiError(401, "No password set for this teacher");
    }
    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      throw new ApiError(400, "Current password is incorrect");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.teachers.update({
      where: { id: teacherId },
      data: { password: hashedNewPassword },
    });
  }

  static async rotatePasswordsBulk(teacherIds: number[]) {
    const teachers = await prisma.teachers.findMany({
      where: { id: { in: teacherIds }, available: true },
      select: { id: true, name: true, email: true, designation: true },
    });

    if (teachers.length === 0) {
      throw new ApiError(404, "No matching teachers found");
    }

    const processedTeachers = await Promise.all(
      teachers.map(async (teacher) => {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        return {
          ...teacher,
          password,
          hashedPassword,
        };
      })
    );

    const rotatedTeachers: Array<{
      name: string;
      email: string;
      designation: string;
      password: string;
    }> = [];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const teacher of processedTeachers) {
        await tx.teachers.update({
          where: { id: teacher.id },
          data: { password: teacher.hashedPassword },
        });

        rotatedTeachers.push({
          name: teacher.name,
          email: teacher.email || "N/A",
          designation: teacher.designation || "N/A",
          password: teacher.password,
        });
      }
    });

    const excelData = rotatedTeachers.map(
      (teacher: {
        name: string;
        email: string;
        designation: string;
        password: string;
      }) => ({
        Name: teacher.name,
        Email: teacher.email,
        Designation: teacher.designation,
        "New Password": teacher.password,
      }),
    );

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rotated Passwords");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    EmailService.sendEmailWithAttachment({
      from: env.FROM_EMAIL,
      to: "mutiur5bb@gmail.com",
      subject: "Teacher Passwords Rotated - New Credentials",
      body: `Hello Headmaster,\n\nPlease find attached the new login credentials for the ${rotatedTeachers.length} teachers whose passwords were just rotated.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "rotated_passwords.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return excelBuffer;
  }

  static async updateHeadMessage(teacherId?: number | null, message?: string | null) {
    const updateData: any = {};
    if (teacherId) updateData.head_id = parseInt(teacherId.toString());
    if (message !== undefined) updateData.head_message = message;

    await prisma.head_msg.upsert({
      where: { id: 1 },
      create: { id: 1, ...updateData },
      update: updateData,
    });

    // Clear cache
    const key = "head_msg_cache";
    await redis.del(key);

    return { message: "Head message updated successfully" };
  }

  static async getHeadMessage() {
    const key = "head_msg_cache";
    const cachedHeadMsg = await redis.get(key);
    if (cachedHeadMsg) {
      return JSON.parse(cachedHeadMsg);
    }

    const headMsg = await prisma.head_msg.findUnique({
      where: { id: 1 },
      include: {
        teacher: { select: { id: true, name: true, image: true } },
      },
    });

    await redis.set(key, JSON.stringify(headMsg), "EX", LONG_TERM_CACHE_TTL);
    return headMsg;
  }
}
