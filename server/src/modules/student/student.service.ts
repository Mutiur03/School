import generatePassword from "@/utils/pwgenerator.js";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2, getFileBuffer } from "@/config/r2.js";
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

  static async getStudentsPaginated(
    params: {
      year: number;
      page: number;
      limit: number;
      level?: number;
      section?: string;
      search?: string;
      religion?: string;
      roll?: number;
    },
    // userOptions: {
    //   role?: string;
    //   levels?: Array<{ class_name: number; section: string; year: number }>;
    // } = {},
  ) {
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

    // if (userOptions.role === "teacher") {
    //   if (!userOptions.levels || userOptions.levels.length === 0) {
    //     return {
    //       data: [],
    //       meta: {
    //         total: 0,
    //         filtered: 0,
    //         page: normalizedPage,
    //         limit: normalizedLimit,
    //         totalPages: 0,
    //       },
    //     };
    //   }

    //   const teacherLevels = userOptions.levels
    //     .filter((l) => l.year === year)
    //     .map((l) => ({ class: l.class_name, section: l.section }));

    //   if (teacherLevels.length === 0) {
    //     return {
    //       data: [],
    //       meta: {
    //         total: 0,
    //         filtered: 0,
    //         page: normalizedPage,
    //         limit: normalizedLimit,
    //         totalPages: 0,
    //       },
    //     };
    //   }

    //   baseWhere.OR = teacherLevels;
    //   enrollmentWhere.OR = teacherLevels;
    // }

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
    const batches = [
      ...new Set(
        students.map((s: any) => {
          const classNum = Number(removeInitialZeros(String(s.class || 1)));
          return String(current_year + 11 - classNum);
        }),
      ),
    ];

    const batchLoginIdMap: Record<string, bigint> = {};
    for (const batch of batches) {
      const result = await prisma.students.findMany({
        where: { batch },
        orderBy: { login_id: "desc" },
        take: 1,
      });

      batchLoginIdMap[batch] =
        result.length > 0 && result[0].login_id
          ? result[0].login_id + 1n
          : BigInt(batch.slice(-2) + "001");
    }

    const hashedStudents = await Promise.all(
      students.map(async (s, i) => {
        const student = { ...s };
        const password = generatePassword();
        const hashedPassword = await bcrypt.hash(password, 10);

        const classNum = Number(removeInitialZeros(String(student.class || 1)));
        const batch = String(current_year + 11 - classNum);
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

        const login_id = batchLoginIdMap[batch];
        batchLoginIdMap[batch] += 1n;

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
          const maxLoginResult = await tx.students.findMany({
            where: { batch: String(newBatch) },
            orderBy: { login_id: "desc" },
            take: 1,
          });

          const maxLoginId =
            maxLoginResult.length > 0 ? maxLoginResult[0].login_id : null;
          newLoginId = maxLoginId
            ? maxLoginId + 1n
            : BigInt(newBatch.toString().slice(-2) + "001");

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

    const data = {
      school_name: "Panchbibi Lal Bihari Pilot Govt. High School",
      school_location: "Panchbibi, Joypurhat.",
      school_website: "www.lbphs.gov.bd",
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
}): Promise<{ pdfBuffer: Buffer; studentName: string }> {
  const classNames: Record<number, string> = {
    1: "one",
    2: "two",
    3: "three",
    4: "four",
    5: "five",
    6: "six",
    7: "seven",
    8: "eight",
    9: "nine",
    10: "ten",
  };
  const classStr = classNames[Number(data.class)] || String(data.class);

  // Pre-generate QR Code Data URL (so we can await it outside the synchronous Promise executor)
  const qrText = `Name: ${data.name}\nRoll: ${data.roll}\nClass: ${classStr}\nSection: ${data.section}\nSession: ${data.session}\nSchool: ${data.school_name}`;
  const qrDataUrl = await QRCode.toDataURL(qrText, {
    margin: 1,
    width: 200,
  }).catch(() => null);

  // Pre-generate Grayscale Watermark (outside the synchronous Promise executor)
  const logoPath = path.join("public", "icon.jpg");
  let logoBuffer: Buffer | null = null;
  if (fs.existsSync(logoPath)) {
    try {
      logoBuffer = await sharp(logoPath).grayscale().toBuffer();
    } catch (e) {
      console.error("Failed to process watermark logo with sharp:", e);
    }
  }

  // Pre-fetch and process student passport image
  let passportBuffer: Buffer | null = null;
  if (data.imageKey) {
    try {
      const rawPassport = await getFileBuffer(data.imageKey);
      if (rawPassport) {
        passportBuffer = rawPassport;
      }
    } catch (e) {
      console.error("Failed to process passport image:", e);
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
    const M = 40; // margin
    const studentPartHeight = 648; // 9 inches (9 * 72)

    // --- STUDENT PART (Top 9 Inches) ---

    // Official Header (Centered - Original Design)
    let y = M - 5;
    const contentWidth = W - M * 2;
    doc.font("Times-Roman").fontSize(12).fillColor("#000000");
    doc.text("Government of the People's Republic of Bangladesh", M, y, {
      align: "center",
      width: contentWidth,
    });

    y += 20;
    doc
      .fontSize(14)
      .text("The office of the Headmaster", M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 26;
    
    if (passportBuffer) {
      // Scale Puppeteer CSS pixels (96dpi) to PDFKit points (72dpi): 90x110 -> 68x83
      const imgW = 68;
      const imgH = 83;
      const imgX = W - M - imgW;
      const imgY = M + 10;
      doc.save();
      doc.rect(imgX, imgY, imgW, imgH).clip();
      doc.image(passportBuffer, imgX, imgY, { cover: [imgW, imgH], align: 'center', valign: 'center' });
      doc.restore();
      doc.rect(imgX, imgY, imgW, imgH).lineWidth(1).stroke("#bbbbbb");
    }

    let schoolNameFontSize = 24;
    doc.font("Times-Bold").fontSize(schoolNameFontSize);
    const maxSchoolNameWidth = passportBuffer ? 350 : contentWidth;
    while (doc.widthOfString(data.school_name) > maxSchoolNameWidth && schoolNameFontSize > 10) {
      schoolNameFontSize -= 1;
      doc.fontSize(schoolNameFontSize);
    }

    doc.text(data.school_name, M, y, { align: "center", width: contentWidth });

    y += Math.max(schoolNameFontSize + 6, 26);
    doc
      .font("Times-Roman")
      .fontSize(14)
      .text(data.school_location, M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 20;
    doc
      .fontSize(13)
      .text(data.school_website, M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 20;
    doc
      .fontSize(13)
      .text("EIIN: 121983, School Code: 5100", M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 26;
    // Double line divider
    const dividerY = y;
    doc
      .moveTo(M, y)
      .lineTo(W - M, y)
      .lineWidth(2)
      .stroke("#000000");
    doc
      .moveTo(M, y + 3)
      .lineTo(W - M, y + 3)
      .lineWidth(1)
      .stroke("#000000");

    y += 12;

    // SL No & Date (Positioned after the header divider)
    doc.font("Times-Bold").fontSize(10).fillColor("#333333");
    doc.text(
      `Date: ${new Date().toLocaleDateString("en-GB")}`,
      W - M - 150,
      y,
      { align: "right", width: 150 },
    );

    // Watermark drawing (Centered between divider and cutting line)
    try {
      doc.save();
      doc.opacity(0.05); // Professional subtle watermark
      const watermarkWidth = 300;
      const centerY = (dividerY + studentPartHeight) / 2;
      if (logoBuffer) {
        doc.image(logoBuffer, W / 2 - watermarkWidth / 2, centerY - 150, {
          width: watermarkWidth,
        });
      }
      doc.restore();
    } catch (e) {
      /* ignore */
    }

    y += 35;
    // Professional Title
    doc
      .font("Times-Bold")
      .fontSize(22)
      .text("Certificate", M, y, { align: "center", width: contentWidth });

    y += 45;

    // Paragraph 1
    const bodyFont = "Times-Roman";
    const bodyFontBold = "Times-Bold";
    const bodySize = 13;
    const textX = M + 20;
    const textWidth = W - (M + 20) * 2;

    doc.font(bodyFont).fontSize(bodySize).fillColor("#000000");
    doc.text("This is to certify that ", textX, y, {
      continued: true,
      width: textWidth,
      lineGap: 12,
    });
    doc.font(bodyFontBold).text(data.name, { continued: true });
    doc.font(bodyFont).text(" son of ", { continued: true });
    doc.font(bodyFontBold).text(data.father_name, { continued: true });
    doc.font(bodyFont).text(" and ", { continued: true });
    doc.font(bodyFontBold).text(data.mother_name, { continued: true });
    doc.font(bodyFont).text(" is a student of class ", { continued: true });
    doc.font(bodyFontBold).text(classStr, { continued: true });
    doc.font(bodyFont).text(", section ", { continued: true });
    doc.font(bodyFontBold).text(data.section, { continued: true });
    doc
      .font(bodyFont)
      .text(
        " of this school. According to the admission information his date of birth is ",
        { continued: true },
      );
    doc.font(bodyFontBold).text(data.dob, { continued: false });

    y = doc.y + 18;
    doc
      .font(bodyFont)
      .text(
        "His behavior is satisfactory. I do not know that he is involved in any kind of activities against the discipline of this school or the state.",
        textX,
        y,
        { width: textWidth, lineGap: 12 },
      );

    y = doc.y + 18;
    doc
      .font(bodyFont)
      .text("I wish his all success in life.", textX, y, {
        width: textWidth,
        lineGap: 12,
      });

    y = studentPartHeight - 50;
    const sigWidth = 180; // Longer signature line

    // QR Code Placement (using pre-generated qrDataUrl)
    if (qrDataUrl) {
      doc.image(qrDataUrl, M + 30, y - 90, { width: 80 });
    }

    doc
      .moveTo(W - M - sigWidth, y)
      .lineTo(W - M, y)
      .lineWidth(1)
      .stroke("#000000");
    doc
      .font("Times-Bold")
      .fontSize(12)
      .text("Headmaster", W - M - sigWidth, y + 8, {
        width: sigWidth,
        align: "center",
      });

    // --- CUTTING SECTION ---
    const drawScissor = (x: number, y: number, angle: number = 0) => {
      doc
        .save()
        .translate(x, y)
        .rotate(angle)
        .scale(0.4)
        .lineWidth(1.2)
        .strokeColor("#666666");
      doc.circle(-8, -6, 6).stroke(); // Handles
      doc.circle(-8, 6, 6).stroke();
      doc.moveTo(-4, 0).lineTo(24, -8).stroke(); // Blades
      doc.moveTo(-4, 0).lineTo(24, 8).stroke();
      doc.restore();
    };

    drawScissor(M + 25, studentPartHeight, 0); // Lying along the line
    drawScissor(W - M - 25, studentPartHeight, 0);

    doc
      .moveTo(M + 45, studentPartHeight)
      .lineTo(W - M - 45, studentPartHeight)
      .lineWidth(1)
      .dash(2, { space: 2 })
      .stroke("#666666")
      .undash();
    doc.fillColor("#000000"); // Reset

    // --- SCHOOL RECEIPT (OFFICE COPY) ---
    const receiptTop = studentPartHeight + 25;
    const receiptHeight = 110;

    // Receipt Border Box
    doc
      .rect(M, receiptTop, contentWidth, receiptHeight)
      .lineWidth(0.5)
      .dash(3, { space: 3 })
      .stroke("#999999")
      .undash();

    y = receiptTop + 15;
    doc
      .font("Times-Bold")
      .fontSize(12)
      .fillColor("#000000")
      .text("OFFICE COPY (RECEIPT / ACKNOWLEDGEMENT)", M, y, {
        align: "center",
        width: contentWidth,
      });

    y += 20;
    doc
      .font("Times-Bold")
      .fontSize(9)
      .text(
        `Date: ${new Date().toLocaleDateString("en-GB")}`,
        M + 15,
        y,
      );

    y += 18;
    doc.font("Times-Roman").fontSize(10);
    doc.text("Name: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.name);

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
      .text("Father's Name: ", M + 15, y, { continued: true });
    doc.font("Times-Bold").text(data.father_name);

    doc.end();
  });
}
