import generatePassword from "@/utils/pwgenerator.js";
import * as bcrypt from "bcrypt";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2 } from "@/config/r2.js";
import * as XLSX from "xlsx";
import { removeInitialZeros, VALID_GROUPS } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";
import PDFDocument from "pdfkit";
import EmailService from "@/utils/email.service.js";
import { env } from "@/config/env.js";
import type { Prisma } from "@prisma/client";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import sharp from "sharp";
const current_year = new Date().getFullYear();

export const sanitizeStudent = (student: any) => {
  if (!student) return student;
  const { password: _password, ...rest } = student;
  if (rest.login_id !== undefined && rest.login_id !== null) {
    rest.login_id = rest.login_id.toString();
  }
  return rest;
};

export class StudentService {
  static async getAlumni() {
    const students = await prisma.students.findMany();
    return students.map(sanitizeStudent);
  }

  static async getStudentsPaginated(params: {
    year: number;
    page: number;
    limit: number;
    level?: number;
    section?: string;
    search?: string;
    religion?: string;
    roll?: number;
  }) {
    const { year, page, limit, level, section, search, religion, roll } =
      params;

    const normalizedPage =
      Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const normalizedLimit =
      Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 200)
        : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;

    const normalizedSection = section?.trim().toUpperCase();
    const normalizedSearch = search?.trim();

    const enrollmentWhere: Prisma.student_enrollmentsWhereInput = {
      year,
      ...(typeof level === "number" && !Number.isNaN(level)
        ? { class: level }
        : {}),
      ...(normalizedSection ? { section: normalizedSection } : {}),
      ...(!Number.isNaN(roll as number) && roll !== undefined ? { roll } : {}),
    };

    const baseWhere: Prisma.student_enrollmentsWhereInput = {
      year,
    };

    if (normalizedSearch) {
      enrollmentWhere.student = {
        AND: [
          ...(religion
            ? [{ religion: { equals: religion, mode: "insensitive" as const } }]
            : []),
          {
            OR: [
              { name: { contains: normalizedSearch, mode: "insensitive" } },
              {
                father_phone: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
              {
                mother_phone: {
                  contains: normalizedSearch,
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      };
    } else {
      if (religion) {
        enrollmentWhere.student = {
          religion: { equals: religion, mode: "insensitive" as const },
        };
      }
    }

    const [total, filtered, enrollments, allOptions] =
      await prisma.$transaction([
        prisma.student_enrollments.count({
          where: baseWhere,
        }),
        prisma.student_enrollments.count({
          where: enrollmentWhere,
        }),
        prisma.student_enrollments.findMany({
          where: enrollmentWhere,
          include: { student: true },
          orderBy: [{ class: "asc" }, { section: "asc" }, { roll: "asc" }],
          skip,
          take: normalizedLimit,
        }),
        prisma.student_enrollments.findMany({
          where: baseWhere,
          select: { class: true, section: true, roll: true },
        }),
      ]);

    const availableClasses = Array.from(
      new Set(allOptions.map((o) => o.class)),
    ).sort((a, b) => a - b);

    const availableSections = Array.from(
      new Set(allOptions.map((o) => o.section)),
    ).sort();

    const hasLevel = typeof level === "number" && !Number.isNaN(level);
    const hasSection = !!normalizedSection;

    const availableRolls = Array.from(
      new Set(
        allOptions
          .filter(
            (o) =>
              (!hasLevel || o.class === level) &&
              (!hasSection || o.section === normalizedSection),
          )
          .map((o) => o.roll),
      ),
    ).sort((a, b) => a - b);

    const data = enrollments.map((enrollment: any) => {
      const { student, ...enrollmentData } = enrollment;
      const studentWithoutPassword = sanitizeStudent(student);
      return {
        ...enrollmentData,
        ...studentWithoutPassword,
        id: studentWithoutPassword.id,
        enrollment_id: enrollment.id,
      };
    });

    const totalPages =
      filtered === 0 ? 0 : Math.ceil(filtered / normalizedLimit);

    return {
      data,
      meta: {
        total,
        filtered,
        page: normalizedPage,
        limit: normalizedLimit,
        totalPages,
        availableClasses,
        availableSections,
        availableRolls,
      },
    };
  }

  static async getStudents(
    year: number,
    userOptions: {
      role?: string;
      levels?: Array<{ class_name: number; section: string; year: number }>;
    } = {},
  ) {
    let result: any[] = [];
    if (userOptions.role === "admin") {
      result = await prisma.students.findMany({
        include: {
          enrollments: {
            where: { year },
            orderBy: { year: "desc" },
          },
        },
      });
    } else if (userOptions.role === "teacher") {
      if (!userOptions.levels || userOptions.levels.length === 0) {
        return [];
      }
      const levelConditions = userOptions.levels.map((level) => ({
        class: level.class_name,
        section: level.section,
        year: level.year,
      }));

      result = await prisma.students.findMany({
        where: {
          enrollments: {
            some: {
              AND: [{ year }, { OR: levelConditions }],
            },
          },
        },
        include: {
          enrollments: {
            where: {
              AND: [{ year }, { OR: levelConditions }],
            },
            orderBy: { year: "desc" },
          },
        },
      });
    }

    return result.flatMap((student: any) => {
      const studentWithoutPassword = sanitizeStudent(student);
      return student.enrollments.map((enrollment: any) => ({
        ...enrollment,
        ...studentWithoutPassword,
        id: studentWithoutPassword.id,
        enrollment_id: enrollment.id,
      }));
    });
  }

  static async getAttendanceOverview(params: {
    year: number;
    level?: number;
    section?: string;
  }) {
    const { year, level, section } = params;

    const where: Prisma.student_enrollmentsWhereInput = {
      year,
      student: { available: true },
      ...(typeof level === "number" && !Number.isNaN(level)
        ? { class: level }
        : {}),
      ...(section ? { section } : {}),
    };

    const enrollments = await prisma.student_enrollments.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            image: true,
            login_id: true,
          },
        },
      },
      orderBy: [{ class: "asc" }, { section: "asc" }, { roll: "asc" }],
    });

    return enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      name: enrollment.student.name,
      image: enrollment.student.image,
      login_id: enrollment.student.login_id.toString(),
      class: enrollment.class,
      section: enrollment.section,
      roll: enrollment.roll,
      enrollment_id: enrollment.id,
    }));
  }

  static async getStudentById(studentId: number) {
    const result = await prisma.students.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { year: new Date().getFullYear() },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!result || result.enrollments.length === 0) {
      throw new ApiError(404, "Student not found");
    }

    const studentWithoutPassword = sanitizeStudent(result);
    return {
      ...result.enrollments[0],
      ...studentWithoutPassword,
      id: studentWithoutPassword.id,
      enrollment_id: result.enrollments[0].id,
    };
  }

  static async addStudents(students: any[]) {
    const hashedStudents = await Promise.all(
      students.map(async (s, i) => {
        const student = { ...s };
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        const studentYear = student.year || current_year;
        const classNum = Number(removeInitialZeros(String(student.class || 1)));
        const batch = String(studentYear + 11 - classNum);
        const section = (student.section?.trim() || "A").toUpperCase();
        const roll = Number(removeInitialZeros(String(student.roll || 1)));
        const group = classNum >= 9 ? student.group?.trim() || null : null;

        if (
          (classNum === 9 || classNum === 10) &&
          !VALID_GROUPS.includes(group || "")
        ) {
          throw new ApiError(
            400,
            `Student at index ${i}: Group is required for class 9-10`,
          );
        }

        const class6Year = studentYear - (classNum - 6);
        let secValue = 1;
        if (section >= "A" && section <= "Z") {
          secValue = section.charCodeAt(0) - 64;
        } else if (!isNaN(Number(section))) {
          secValue = Number(section);
        }
        const sectionCode = String(secValue).padStart(2, "0");
        const rollCode = String(roll).padStart(2, "0");
        const login_id = BigInt(
          `${String(class6Year).slice(-2)}${sectionCode}${rollCode}`,
        );

        return {
          ...student,
          originalPassword: password,
          password: hashedPassword,
          class: classNum,
          batch,
          section,
          roll,
          group,
          login_id,
          year: student.year || current_year,
        };
      }),
    );

    const result = await prisma.$transaction(async (tx) => {
      await tx.students.createMany({
        data: hashedStudents.map((s) => ({
          login_id: s.login_id,
          name: s.name,
          father_name: s.father_name,
          mother_name: s.mother_name,
          father_phone: s.father_phone,
          mother_phone: s.mother_phone,
          batch: s.batch,
          village: s.village,
          post_office: s.post_office,
          upazila: s.upazila,
          district: s.district,
          dob: s.dob,
          has_stipend: s.has_stipend,
          religion: s.religion,
          password: s.password,
        })),
        skipDuplicates: true,
      });

      const newStudents = await tx.students.findMany({
        where: { login_id: { in: hashedStudents.map((s) => s.login_id) } },
        select: { id: true, login_id: true },
      });

      const studentIdMap = new Map(newStudents.map((s) => [s.login_id, s.id]));

      const enrollmentData = hashedStudents.map((s) => ({
        student_id: studentIdMap.get(s.login_id)!,
        class: s.class,
        roll: s.roll,
        section: s.section,
        year: s.year,
        group: s.group,
      }));

      await tx.student_enrollments.createMany({
        data: enrollmentData,
        skipDuplicates: true,
      });

      return await tx.student_enrollments.findMany({
        where: {
          student_id: { in: Array.from(studentIdMap.values()) },
          year: current_year,
        },
      });
    });

    const excelData = hashedStudents.map((student) => ({
      "Login ID": student.login_id.toString(),
      Name: student.name,
      Password: student.originalPassword,
      Batch: student.batch,
      Class: student.class,
      Section: student.section,
      Roll: student.roll,
      Religion: student.religion,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    EmailService.sendEmailWithAttachment({
      from: env.FROM_EMAIL,
      to: "mutiur5bb@gmail.com",
      subject: "New Students Registered - Credentials",
      body: `Hello Headmaster,\n\nPlease find attached the login credentials for the ${hashedStudents.length} newly registered students.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "students_credentials.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return {
      data: result,
      inserted_count: hashedStudents.length,
      excelBuffer,
    };
  }

  static async updateStudent(id: number, updates: any) {
    const result = await prisma.students.update({
      where: { id },
      data: updates,
    });

    return sanitizeStudent(result);
  }

  static async deleteStudent(id: number) {
    const student = await prisma.students.findUnique({
      where: { id },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    await prisma.students.delete({
      where: { id },
    });

    return { message: "Student deleted successfully" };
  }

  static async giveTransferCertificate(id: number) {
    const student = await prisma.students.findUnique({
      where: { id },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const result = await prisma.students.update({
      where: { id },
      data: { available: false },
    });

    return sanitizeStudent(result);
  }

  static async reactivateStudent(id: number) {
    const student = await prisma.students.findUnique({
      where: { id },
    });

    if (!student) {
      throw new ApiError(404, "Student not found");
    }

    const result = await prisma.students.update({
      where: { id },
      data: { available: true },
    });

    return sanitizeStudent(result);
  }

  static async deleteStudentsBulk(studentIds: number[]) {
    const students = await prisma.students.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, login_id: true },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No matching students found");
    }

    await prisma.students.deleteMany({
      where: { id: { in: students.map((s: any) => s.id) } },
    });

    return students.length;
  }

  static async rotatePasswordsBulk(studentIds: number[]) {
    const students = await prisma.students.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        login_id: true,
        name: true,
        batch: true,
        religion: true,
      },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No matching students found");
    }

    const processedStudents = await Promise.all(
      students.map(async (student) => {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);
        return {
          ...student,
          password,
          hashedPassword,
        };
      }),
    );

    const rotatedStudents: Array<{
      login_id: bigint;
      name: string;
      batch: string;
      religion: string;
      password: string;
    }> = [];

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const student of processedStudents) {
        await tx.students.update({
          where: { id: student.id },
          data: { password: student.hashedPassword },
        });

        rotatedStudents.push({
          login_id: student.login_id,
          name: student.name,
          batch: student.batch,
          religion: student.religion,
          password: student.password,
        });
      }
    });

    const excelData = rotatedStudents.map(
      (student: {
        login_id: bigint;
        name: string;
        batch: string;
        religion: string;
        password: string;
      }) => ({
        "Login ID": student.login_id.toString(),
        Name: student.name,
        Batch: student.batch,
        Religion: student.religion,
        "New Password": student.password,
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
      subject: "Student Passwords Rotated - New Credentials",
      body: `Hello Headmaster,\n\nPlease find attached the new login credentials for the ${rotatedStudents.length} students whose passwords were just rotated.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "rotated_passwords.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return excelBuffer;
  }

  static async regenerateAllCredentials() {
    const students = await prisma.students.findMany({
      include: {
        enrollments: {
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No students found");
    }

    const currentYear = new Date().getFullYear();

    const idMappedStudents = students.map((student) => {
      let studentYear = currentYear;
      let classNum = 1;
      let section = "A";
      let roll = 1;

      if (student.enrollments.length > 0) {
        const enrollment = student.enrollments[0];
        studentYear = enrollment.year || currentYear;
        classNum = enrollment.class;
        section = (enrollment.section?.trim() || "A").toUpperCase();
        roll = enrollment.roll;
      }

      const class6Year = studentYear - (classNum - 6);
      let secValue = 1;
      if (section >= "A" && section <= "Z") {
        secValue = section.charCodeAt(0) - 64;
      } else if (!isNaN(Number(section))) {
        secValue = Number(section);
      }
      const sectionCode = String(secValue).padStart(2, "0");
      const rollCode = String(roll).padStart(2, "0");
      const login_id = BigInt(
        `${String(class6Year).slice(-2)}${sectionCode}${rollCode}`,
      );
      const batch = String(studentYear + 11 - classNum);

      return {
        id: student.id,
        name: student.name || "N/A",
        religion: student.religion || "N/A",
        class: classNum,
        section,
        roll,
        login_id,
        batch,
      };
    });

    const loginIdGroups = new Map<string, any[]>();
    const duplicateErrors: any[] = [];

    for (const student of idMappedStudents) {
      const idStr = student.login_id.toString();
      if (!loginIdGroups.has(idStr)) {
        loginIdGroups.set(idStr, []);
      }
      loginIdGroups.get(idStr)!.push(student);
    }

    for (const [loginId, group] of loginIdGroups.entries()) {
      if (group.length > 1) {
        duplicateErrors.push({
          login_id: loginId,
          students: group.map((s: any) => ({
            id: s.id,
            name: s.name,
            class: s.class,
            section: s.section,
            roll: s.roll,
          })),
        });
      }
    }

    if (duplicateErrors.length > 0) {
      throw new ApiError(
        400,
        "Duplicate login IDs generated for some students. Ensure class, section, and roll combinations are unique.",
        duplicateErrors,
      );
    }

    const processedStudents = await Promise.all(
      idMappedStudents.map(async (student) => {
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        return {
          ...student,
          password,
          hashedPassword,
        };
      }),
    );

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const student of processedStudents) {
        await tx.students.update({
          where: { id: student.id },
          data: {
            login_id: student.login_id,
            batch: student.batch,
            password: student.hashedPassword,
          },
        });
      }
    });

    const excelData = processedStudents.map((s) => ({
      "Login ID": s.login_id.toString(),
      Name: s.name,
      Batch: s.batch,
      Class: s.class,
      Section: s.section,
      Roll: s.roll,
      Religion: s.religion,
      "New Password": s.password,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "All Credentials");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "buffer",
    });

    EmailService.sendEmailWithAttachment({
      from: env.FROM_EMAIL,
      to: "mutiur5bb@gmail.com",
      subject: "All Student Credentials Regenerated",
      body: `Hello Headmaster,\n\nPlease find attached the completely regenerated login IDs and passwords for all ${processedStudents.length} students.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "all_students_credentials.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return excelBuffer;
  }

  static async updateAcademicInfo(enrollmentId: number, updates: any) {
    const parsedEnrollmentId =
      typeof enrollmentId === "string"
        ? parseInt(enrollmentId, 10)
        : enrollmentId;

    const classForValidation =
      updates.class ??
      (
        await prisma.student_enrollments.findUnique({
          where: { id: parsedEnrollmentId },
          select: { class: true },
        })
      )?.class;

    if (
      (classForValidation === 9 || classForValidation === 10) &&
      (!updates.group || !VALID_GROUPS.includes(updates.group))
    ) {
      throw new ApiError(
        400,
        "Group is required for class 9-10 and must be valid.",
      );
    }

    if (classForValidation !== 9 && classForValidation !== 10) {
      updates.group = null;
    }

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const enrollment = await tx.student_enrollments.update({
          where: { id: parsedEnrollmentId },
          data: updates,
        });

        if (!enrollment) throw new ApiError(404, "Enrollment record not found");

        const studentInfo = await tx.students.findUnique({
          where: { id: enrollment.student_id },
          select: { batch: true, login_id: true, id: true },
        });

        if (!studentInfo) throw new ApiError(404, "Student not found");

        const oldBatch = parseInt(studentInfo.batch);
        const currentLoginId = studentInfo.login_id;
        const currentYear = new Date().getFullYear();
        const newBatch = currentYear + 11 - enrollment.class;

        let newLoginId = currentLoginId;
        let updatedStudent = null;

        if (newBatch !== oldBatch) {
          const studentYear = enrollment.year || currentYear;
          const classNum = enrollment.class;
          const section = (enrollment.section?.trim() || "A").toUpperCase();
          const roll = enrollment.roll;

          const class6Year = studentYear - (classNum - 6);
          let secValue = 1;
          if (section >= "A" && section <= "Z") {
            secValue = section.charCodeAt(0) - 64;
          } else if (!isNaN(Number(section))) {
            secValue = Number(section);
          }
          const sectionCode = String(secValue).padStart(2, "0");
          const rollCode = String(roll).padStart(2, "0");
          newLoginId = BigInt(
            `${String(class6Year).slice(-2)}${sectionCode}${rollCode}`,
          );

          updatedStudent = await tx.students.update({
            where: { id: enrollment.student_id },
            data: {
              batch: String(newBatch),
              login_id: newLoginId,
            },
          });
        }

        return {
          enrollment,
          updatedStudent,
          oldLoginId: currentLoginId,
          newLoginId,
        };
      },
    );

    return result.enrollment;
  }

  static async saveStudentImage(id: number | string, key: string | null) {
    const existingStudent = await prisma.students.findUnique({
      where: { id: Number(id) },
    });
    if (!existingStudent) {
      throw new ApiError(404, "Student not found");
    }
    if (existingStudent.image) {
      await deleteFromR2(existingStudent.image);
    }
    return prisma.students.update({
      where: { id: Number(id) },
      data: { image: key || null },
    });
  }

  static async changePassword(
    studentId: number | string,
    currentPassword: string,
    newPassword: string,
  ) {
    const student = await prisma.students.findUnique({
      where: { id: Number(studentId) },
    });
    if (!student) {
      throw new ApiError(404, "Student not found");
    }
    if (!student.password) {
      throw new ApiError(401, "No password set for this student");
    }
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.students.update({
      where: { id: Number(studentId) },
      data: { password: hashedNewPassword },
    });
  }

  static async getClassStudents(year: number, level: number) {
    const currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear + 5) {
      throw new ApiError(
        400,
        `Invalid year. Year must be between 2000 and ${currentYear + 5}.`,
      );
    }

    const result = await prisma.students.findMany({
      include: {
        enrollments: {
          where: { year, class: level },
          orderBy: { year: "desc" },
        },
      },
    });

    if (result.length === 0) {
      throw new ApiError(404, "No students found for the specified year");
    }

    return result.flatMap((student: any) => {
      const studentWithoutPassword = sanitizeStudent(student);
      return student.enrollments.map((enrollment: any) => ({
        ...enrollment,
        ...studentWithoutPassword,
        id: studentWithoutPassword.id,
        enrollment_id: enrollment.id,
      }));
    });
  }

  static async generateTestimonials(id: number | string) {
    const result = await prisma.students.findUnique({
      where: { id: typeof id === "string" ? parseInt(id) : id },
      include: {
        enrollments: {
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!result) {
      throw new ApiError(404, "Student not found");
    }

    const rawDob = result.dob || "";
    let formattedDob = rawDob;
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawDob)) {
      const [y, m, d] = rawDob.split("-");
      formattedDob = `${d}/${m}/${y}`;
    }

    const addressParts = [];
    if (result.village)
      addressParts.push({ title: "Village/ Road No/ House No:", value: result.village });
    if (result.post_office) addressParts.push({ title: "Post Office:", value: result.post_office });
    if (result.upazila) addressParts.push({ title: "Upazila/ Thana:", value: result.upazila });
    if (result.district) addressParts.push({ title: "District:", value: result.district });
    const address = addressParts.length > 0 ? addressParts : null;

    const data = {
      school_name: "Panchbibi Lal Bihari Pilot Govt. High School",
      school_location: "Panchbibi, Joypurhat.",
      school_website: "https://lbphs.gov.bd",
      name: result.name || "N/A",
      father_name: result.father_name || "N/A",
      mother_name: result.mother_name || "N/A",
      roll: result.enrollments[0]?.roll || "N/A",
      class: result.enrollments[0]?.class || "N/A",
      section: result.enrollments[0]?.section || "N/A",
      session: result.enrollments[0]?.year || "N/A",
      dob: formattedDob || "N/A",
      student_id: result.login_id ? result.login_id.toString() : "N/A",
      id: result.id,
      imageKey: result.image || null,
      address,
    };

    return await generatePDF(data);
  }
}
async function generatePDF(data: {
  school_name: string;
  school_location: string;
  school_website: string;
  name: string;
  father_name: string;
  mother_name: string;
  roll: number | string;
  class: number | string;
  section: string;
  session: number | string;
  dob: string;
  student_id: string;
  id: number;
  imageKey?: string | null;
  address?: { title: string; value: string }[] | null;
}): Promise<{ pdfBuffer: Buffer; studentName: string }> {
  const classNames: Record<number, string> = {
    1: "One",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
  };
  const classStr = classNames[Number(data.class)] || String(data.class);

  const addressStr = data.address ? data.address.map(a => `${a.title} ${a.value}`).join(", ") : "N/A";
  const qrText = `Name: ${data.name}\nClass: ${classStr}\nSection: ${data.section}\nRoll: ${data.roll}\nAddress: ${addressStr}\nSession: ${data.session}\nSchool: ${data.school_name}`;
  const qrDataUrl = await QRCode.toDataURL(qrText, {
    margin: 1,
    width: 200,
  }).catch(() => null);

  const logoPath = path.join("public", "icon.jpg");
  let logoBuffer: Buffer | null = null;
  if (fs.existsSync(logoPath)) {
    try {
      logoBuffer = await sharp(logoPath).grayscale().toBuffer();
    } catch (e) {
      console.error("Failed to process watermark logo with sharp:", e);
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () =>
      resolve({ pdfBuffer: Buffer.concat(chunks), studentName: data.name }),
    );
    doc.on("error", reject);

    const W = doc.page.width;
    const M = 40;
    const studentPartHeight = 504;

    let y = M - 5;
    const contentWidth = W - M * 2;
    doc.font("Times-Roman").fontSize(12).fillColor("#000000");
    doc.text("Government of the People's Republic of Bangladesh", M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 20;
    doc.fontSize(14).text("The office of the Headmaster", M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 26;

    let schoolNameFontSize = 24;
    doc.font("Times-Bold").fontSize(schoolNameFontSize);
    const maxSchoolNameWidth = contentWidth;
    while (
      doc.widthOfString(data.school_name) > maxSchoolNameWidth &&
      schoolNameFontSize > 10
    ) {
      schoolNameFontSize -= 1;
      doc.fontSize(schoolNameFontSize);
    }

    doc.text(data.school_name, M, y, { align: "center", width: contentWidth });

    y += Math.max(schoolNameFontSize + 6, 26);
    doc.font("Times-Roman").fontSize(14).text(data.school_location, M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 20;
    doc.fontSize(13).text(data.school_website, M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 20;
    doc.fontSize(13).text("EIIN: 121983, School Code: 5100", M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 26;

    const dividerY = y;
    doc.moveTo(0, y).lineTo(W, y).lineWidth(2).stroke("#000000");
    doc
      .moveTo(0, y + 3)
      .lineTo(W, y + 3)
      .lineWidth(1)
      .stroke("#000000");

    /*y += 12;

    doc.font("Times-Bold").fontSize(10).fillColor("#333333");
    doc.text(
      `Date: ${new Date().toLocaleDateString("en-GB")}`,
      W - M - 180,
      y,
      { align: "right", width: 150 },
    );*/

    try {
      doc.save();
      doc.opacity(0.15);
      const watermarkWidth = 250;
      const centerY = (dividerY + studentPartHeight) / 2;
      if (logoBuffer) {
        doc.image(logoBuffer, W / 2 - watermarkWidth / 2, centerY - 150, {
          width: watermarkWidth,
        });
      }
      doc.restore();
    } catch (e) {}

    y += 25;

    doc
      .font("Times-Bold")
      .fontSize(22)
      .text("Certificate", M, y, { align: "center", width: contentWidth });

    y += 35;

    const bodyFont = "Times-Roman";
    const bodyFontBold = "Times-Bold";
    const bodySize = 12;
    const textX = M + 20;
    const textWidth = W - (M + 20) * 2;

    const fragments = [
      { text: "This is to certify that", font: bodyFont },
      { text: data.name, font: bodyFontBold },
      { text: "son of", font: bodyFont },
      { text: data.father_name, font: bodyFontBold },
      { text: "and", font: bodyFont },
      { text: data.mother_name, font: bodyFontBold },
    ];
    if (data.address && data.address.length > 0) {
      fragments.push({ text: "of", font: bodyFont });
      data.address.forEach((addrPart, index) => {
        fragments.push({ text: addrPart.title, font: bodyFont });
        const valText = index < data.address!.length - 1 ? addrPart.value + "," : addrPart.value;
        fragments.push({ text: valText, font: bodyFontBold });
      });
    }
    fragments.push({ text: "is a student of class", font: bodyFont });
    fragments.push({ text: classStr + ",", font: bodyFontBold });
    fragments.push({ text: "section", font: bodyFont });
    fragments.push({ text: data.section, font: bodyFontBold });
    fragments.push({ text: "of this school. According to the admission information his date of birth is", font: bodyFont });
    fragments.push({ text: data.dob + ".", font: bodyFontBold });

    const tokens: { text: string; font: string }[] = [];
    fragments.forEach((frag) => {
      const words = frag.text.split(/(\s+)/);
      words.forEach((w) => {
        if (w.trim().length > 0) tokens.push({ text: w.trim(), font: frag.font });
      });
    });

    let currentLine: { text: string; font: string; width: number }[] = [];
    let currentLineWidth = 0;
    
    doc.font(bodyFont).fontSize(bodySize).fillColor("#000000");
    const defaultSpaceWidth = doc.widthOfString(" ");

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      doc.font(token.font);
      const w = doc.widthOfString(token.text);
      
      const spaceToAdd = currentLine.length === 0 ? 0 : defaultSpaceWidth;
      
      if (currentLineWidth + spaceToAdd + w > textWidth && currentLine.length > 0) {
        const totalWordsWidth = currentLine.reduce((sum, t) => sum + t.width, 0);
        const spaceWidth = currentLine.length > 1 ? (textWidth - totalWordsWidth) / (currentLine.length - 1) : 0;
        
        let curX = textX;
        currentLine.forEach((t) => {
          doc.font(t.font).text(t.text, curX, y);
          curX += t.width + spaceWidth;
        });
        
        y += doc.currentLineHeight() + 3;
        currentLine = [{ text: token.text, font: token.font, width: w }];
        currentLineWidth = w;
      } else {
        currentLine.push({ text: token.text, font: token.font, width: w });
        currentLineWidth += spaceToAdd + w;
      }
    }

    if (currentLine.length > 0) {
      let curX = textX;
      currentLine.forEach((t) => {
        doc.font(t.font).text(t.text, curX, y);
        curX += t.width + defaultSpaceWidth;
      });
      doc.font(bodyFont);
      y += doc.currentLineHeight() + 3;
    }
    doc.y = y - 3; // Align PDFKit's internal cursor with our final custom Y

    y = doc.y + 6;
    doc
      .font(bodyFont)
      .text(
        "To the best of my knowledge, his behavior is satisfactory. I do not know that he is involved in any kind of activities against the discipline of this school or the state.",
        textX,
        y,
        { width: textWidth, lineGap: 1.5, align: "justify" },
      );

    y = doc.y + 6;
    doc.font(bodyFont).text("I wish his all success in life.", textX, y, {
      width: textWidth,
      lineGap: 1.5,
      align: "left",
    });

    const verifiedLineY = studentPartHeight - 75;
    const verifiedLineWidth = 50;
    const verifiedLineStartX = (W - verifiedLineWidth) / 2;
    const verifiedLabelY = verifiedLineY + 6;

    doc
      .moveTo(verifiedLineStartX, verifiedLineY)
      .lineTo(verifiedLineStartX + verifiedLineWidth, verifiedLineY)
      .lineWidth(1)
      .dash(2, { space: 2 })
      .stroke("#000000")
      .undash();
    doc
      .font("Times-Roman")
      .fontSize(11)
      .fillColor("#000000")
      .text("Verified by", verifiedLineStartX, verifiedLabelY, {
        width: verifiedLineWidth,
        align: "center",
      });

    if (qrDataUrl) {
      doc.image(qrDataUrl, M + 15, studentPartHeight - 110, { width: 75 });
    }

    doc
      .moveTo(M + 15, studentPartHeight)
      .lineTo(W - M - 15, studentPartHeight)
      .lineWidth(1)
      .dash(2, { space: 2 })
      .stroke("#666666")
      .undash();
    doc.fillColor("#000000");

    const receiptTop = studentPartHeight + 25;
    y = receiptTop + 8;
    doc
      .font("Times-Bold")
      .fontSize(14)
      .fillColor("#000000")
      .text(data.school_name, M, y, { align: "center", width: contentWidth });
    y += 18;
    doc
      .font("Times-Roman")
      .fontSize(11)
      .text(data.school_location, M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 28;
    doc
      .font("Times-Bold")
      .fontSize(12)
      .text("Office Copy (Receipt / Acknowledgement)", M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 20;
    doc
      .font("Times-Bold")
      .fontSize(9)
      .text(`Date: ${new Date().toLocaleDateString("en-GB")}`, M + 15, y);

    y += 18;
    doc.font("Times-Roman").fontSize(10);
    doc.text("Name: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.name);
    y += 16;
    doc
      .font("Times-Roman")
      .text("Father's Name: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.father_name);
    y += 16;
    doc
      .font("Times-Roman")
      .text("Mother's Name: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.mother_name);

    y += 16;
    doc.font("Times-Roman").text("Class: ", M + 15, y, { continued: true });
    doc
      .font("Times-Bold")
      .text(`${classStr} (${data.class})`, { continued: true });
    doc.font("Times-Roman").text(" | Section: ", { continued: true });
    doc.font("Times-Bold").text(data.section, { continued: true });
    doc.font("Times-Roman").text(" | Roll: ", { continued: true });
    doc.font("Times-Bold").text(String(data.roll));
    y += 16;
    doc
      .font("Times-Roman")
      .text("Date of Birth: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.dob);

    y += 16;
    const labelWidth = 260;
    const rightX = W - M - labelWidth - 15;
    doc.font("Times-Roman").fontSize(10);
    doc.text(
      "Received by: ...........................................",
      rightX,
      y,
      { width: labelWidth, align: "right" },
    );
    y += 18;
    doc.text("Mobile: ...........................................", rightX, y, {
      width: labelWidth,
      align: "right",
    });

    doc.end();
  });
}
