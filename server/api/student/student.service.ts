import generatePassword from "@/utils/pwgenerator.js";
import * as bcrypt from "bcryptjs";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2 } from "@/config/r2.js";
import * as XLSX from "xlsx";
import { removeInitialZeros, VALID_DEPARTMENTS } from "@school/shared-schemas";
import { ApiError } from "@/utils/ApiError.js";
import PDFDocument from "pdfkit";
import EmailService from "@/utils/email.service.js";
import { env } from "@/config/env.js";
import type { Prisma } from "@prisma/client";

const current_year = new Date().getFullYear();

export const sanitizeStudent = (student: any) => {
  const { password: _password, ...rest } = student;
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
    },
    userOptions: {
      role?: string;
      levels?: Array<{ class_name: number; section: string; year: number }>;
    } = {},
  ) {
    const { year, page, limit, level, section, search } = params;

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
    };

    const baseWhere: Prisma.student_enrollmentsWhereInput = {
      year,
      student: { available: true },
    };

    if (userOptions.role === "teacher") {
      if (!userOptions.levels || userOptions.levels.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            filtered: 0,
            page: normalizedPage,
            limit: normalizedLimit,
            totalPages: 0,
          },
        };
      }

      const teacherLevels = userOptions.levels
        .filter((l) => l.year === year)
        .map((l) => ({ class: l.class_name, section: l.section }));

      if (teacherLevels.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            filtered: 0,
            page: normalizedPage,
            limit: normalizedLimit,
            totalPages: 0,
          },
        };
      }

      baseWhere.OR = teacherLevels;
      enrollmentWhere.OR = teacherLevels;
    }

    if (normalizedSearch) {
      enrollmentWhere.student = {
        AND: [
          { available: true },
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
      enrollmentWhere.student = {
        available: true,
      };
    }

    const [total, filtered, enrollments] = await prisma.$transaction([
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
    ]);

    const data = enrollments.map((enrollment: any) => {
      const studentWithoutPassword = sanitizeStudent(enrollment.student);
      return {
        ...enrollment,
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

  static async getStudentById(studentId: number | string) {
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
    const batchLoginIdMap: Record<string, number> = {};
    const usedLoginIds = new Set<number>();
    const processedStudents: any[] = [];

    for (let i = 0; i < students.length; i++) {
      const student = { ...students[i] };

      let password = generatePassword();
      student.originalPassword = password;
      student.password = await bcrypt.hash(password, 10);

      const classNum = Number(removeInitialZeros(String(student.class || 1)));
      student.class = classNum;
      student.section = (student.section?.trim() || "A").toUpperCase();
      student.roll = Number(removeInitialZeros(String(student.roll || 1)));

      const batchYear = current_year + 11 - classNum;
      student.batch = String(batchYear);

      student.department =
        classNum >= 9 ? student.department?.trim() || null : null;

      if (
        (classNum === 9 || classNum === 10) &&
        !VALID_DEPARTMENTS.includes(student.department || "")
      ) {
        throw new ApiError(
          400,
          `Student at index ${i}: Department is required for class 9-10`,
        );
      }

      if (classNum < 9) {
        student.department = null;
      }
      student.year = student.year || current_year;

      if (!batchLoginIdMap[student.batch]) {
        const result = await prisma.students.findMany({
          where: { batch: student.batch },
          orderBy: { login_id: "desc" },
          take: 1,
        });

        batchLoginIdMap[student.batch] =
          result.length > 0 && result[0].login_id
            ? result[0].login_id + 1
            : parseInt(student.batch.toString().slice(-2) + "001");
      }

      student.login_id = batchLoginIdMap[student.batch];

      const existingRecord = await prisma.students.findUnique({
        where: { login_id: student.login_id },
        select: { id: true },
      });

      while (usedLoginIds.has(student.login_id) || existingRecord) {
        student.login_id += 1;
        const existingRecord = await prisma.students.findUnique({
          where: { login_id: student.login_id },
          select: { id: true },
        });
        if (!existingRecord) break;
      }

      usedLoginIds.add(student.login_id);
      batchLoginIdMap[student.batch] = student.login_id + 1;

      processedStudents.push(student);
    }

    const insertedEnrollments = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const returnEnrollments: any[] = [];
        for (const student of processedStudents) {
          const insertedStudent = await tx.students.create({
            data: {
              login_id: student.login_id,
              name: student.name,
              father_name: student.father_name,
              mother_name: student.mother_name,
              father_phone: student.father_phone,
              mother_phone: student.mother_phone,
              batch: student.batch,
              village: student.village,
              post_office: student.post_office,
              upazila: student.upazila,
              district: student.district,
              dob: student.dob,
              has_stipend: student.has_stipend,
              password: student.password,
            },
          });

          const insertedEnrollment = await tx.student_enrollments.create({
            data: {
              student_id: insertedStudent.id,
              class: student.class,
              roll: student.roll,
              section: student.section,
              year: student.year,
              department: student.department,
            },
          });
          returnEnrollments.push(insertedEnrollment);
        }
        return returnEnrollments;
      },
    );

    const excelData = processedStudents.map((student) => ({
      "Login ID": student.login_id,
      Name: student.name,
      Password: student.originalPassword,
      Batch: student.batch,
      Class: student.class,
      Section: student.section,
      Roll: student.roll,
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
      body: `Hello Headmaster,\n\nPlease find attached the login credentials for the ${processedStudents.length} newly registered students.\n\nBest regards,\nSchool Management System`,
      attachment: {
        filename: "students_credentials.xlsx",
        content: excelBuffer,
      },
    }).catch((err) => console.error("Failed to send headmaster email:", err));

    return {
      data: insertedEnrollments,
      inserted_count: processedStudents.length,
      excelBuffer,
    };
  }

  static async updateStudent(id: number | string, updates: any) {
    const result = await prisma.students.update({
      where: { id },
      data: updates,
    });

    return sanitizeStudent(result);
  }

  static async deleteStudent(id: number | string) {
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

  static async deleteStudentsBulk(studentIds: (number | string)[]) {
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

  static async rotatePasswordsBulk(studentIds: (number | string)[]) {
    const students = await prisma.students.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, login_id: true, name: true, batch: true },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No matching students found");
    }

    const rotatedStudents: Array<{
      login_id: number;
      name: string;
      batch: string;
      password: string;
    }> = [];
    const processedStudents: any[] = [];
    for (const student of students) {
      const password = generatePassword();
      const hashedPassword = await bcrypt.hash(password, 10);
      processedStudents.push({
        ...student,
        password,
        hashedPassword,
      });
    }

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
          password: student.password,
        });
      }
    });

    const excelData = rotatedStudents.map(
      (student: {
        login_id: number;
        name: string;
        batch: string;
        password: string;
      }) => ({
        "Login ID": student.login_id,
        Name: student.name,
        Batch: student.batch,
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

    // Send email to headmaster
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

  static async updateAcademicInfo(enrollmentId: number | string, updates: any) {
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
      (!updates.department || !VALID_DEPARTMENTS.includes(updates.department))
    ) {
      throw new ApiError(
        400,
        "Department is required for class 9-10 and must be valid.",
      );
    }

    if (classForValidation !== 9 && classForValidation !== 10) {
      updates.department = null;
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
            ? maxLoginId + 1
            : parseInt(newBatch.toString().slice(-2) + "001");

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
      where: { id },
    });
    if (!existingStudent) {
      throw new ApiError(404, "Student not found");
    }
    if (existingStudent.image) {
      await deleteFromR2(existingStudent.image);
    }
    return prisma.students.update({
      where: { id },
      data: { image: key || null },
    });
  }

  static async changePassword(
    studentId: number | string,
    currentPassword: string,
    newPassword: string,
  ) {
    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new ApiError(404, "Student not found");
    }
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      throw new ApiError(400, "Current password is incorrect");
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await prisma.students.update({
      where: { id: studentId },
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

    const data = {
      school_name: "Panchbibi Lal Bihari Pilot Govt. High School",
      school_location: "Panchbibi, Joypurhat",
      school_website: "www.lbphs.gov.bd",
      name: result.name,
      father_name: result.father_name,
      mother_name: result.mother_name,
      roll: result.enrollments[0]?.roll || "N/A",
      class: result.enrollments[0]?.class || "N/A",
      section: result.enrollments[0]?.section || "N/A",
      session: result.enrollments[0]?.year || "N/A",
      batch: result.batch || "N/A",
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
  batch: string;
}): Promise<{ pdfBuffer: Buffer; studentName: string }> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () =>
      resolve({ pdfBuffer: Buffer.concat(chunks), studentName: data.name }),
    );
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const M = 40; // margin

    // Outer double border
    doc
      .rect(M, M, W - M * 2, H - M * 2)
      .lineWidth(8)
      .stroke("#2c3e50");
    doc
      .rect(M + 6, M + 6, W - M * 2 - 12, H - M * 2 - 12)
      .lineWidth(2)
      .stroke("#2c3e50");

    let y = M + 30;

    // School name
    doc
      .font("Helvetica-Bold")
      .fontSize(18)
      .fillColor("#1a252f")
      .text(data.school_name.toUpperCase(), M + 20, y, {
        align: "center",
        width: W - (M + 20) * 2,
      });

    y += 28;
    doc
      .font("Helvetica")
      .fontSize(11)
      .fillColor("#333333")
      .text(data.school_location, M + 20, y, {
        align: "center",
        width: W - (M + 20) * 2,
      });

    y += 18;
    doc
      .font("Helvetica")
      .fontSize(10)
      .text(`Website: ${data.school_website}`, M + 20, y, {
        align: "center",
        width: W - (M + 20) * 2,
      });

    y += 30;

    // Divider line
    doc
      .moveTo(M + 20, y)
      .lineTo(W - M - 20, y)
      .lineWidth(1)
      .stroke("#2c3e50");
    y += 20;

    // Title: TESTIMONIAL (underlined)
    doc
      .font("Helvetica-Bold")
      .fontSize(26)
      .fillColor("#1a252f")
      .text("TESTIMONIAL", M + 20, y, {
        align: "center",
        width: W - (M + 20) * 2,
        underline: true,
      });

    y += 55;

    // Helper to render inline segments with underlined bold spans
    // We build the body text using low-level text drawing for inline bolding
    const bodyFont = "Times-Roman";
    const bodyFontBold = "Times-Bold";
    const bodySize = 13;
    const bodyColor = "#333333";
    const textWidth = W - (M + 20) * 2;
    const textX = M + 20;

    type Seg = { text: string; bold: boolean };

    const renderLine = (segments: Seg[], startY: number): number => {
      // We render each line manually to handle inline formatting
      // For simplicity we use PDFKit's continued:true trick
      let first = true;
      for (const seg of segments) {
        doc
          .font(seg.bold ? bodyFontBold : bodyFont)
          .fontSize(bodySize)
          .fillColor(bodyColor);
        if (first) {
          doc.text(seg.text, textX, startY, {
            continued: true,
            width: textWidth,
            lineGap: 4,
          });
          first = false;
        } else {
          doc.text(seg.text, { continued: true, width: textWidth, lineGap: 4 });
        }
      }
      // End continuation
      doc.text("", { continued: false });
      return doc.y;
    };

    // Paragraph 1
    y = renderLine(
      [
        { text: "This is to certify that ", bold: false },
        { text: data.name, bold: true },
        { text: ", son/daughter of ", bold: false },
        { text: data.father_name, bold: true },
        { text: " and ", bold: false },
        { text: data.mother_name, bold: true },
        {
          text: ", was a student of this institution. He/She was enrolled in Class ",
          bold: false,
        },
        { text: String(data.class), bold: true },
        { text: ", Section ", bold: false },
        { text: data.section, bold: true },
        { text: " with Roll No. ", bold: false },
        { text: String(data.roll), bold: true },
        { text: " during the academic session ", bold: false },
        { text: String(data.session), bold: true },
        { text: ". His/Her batch was ", bold: false },
        { text: data.batch, bold: true },
        { text: ".", bold: false },
      ],
      y,
    );

    y += 14;
    // Paragraph 2
    doc
      .font(bodyFont)
      .fontSize(bodySize)
      .fillColor(bodyColor)
      .text(
        "To the best of my knowledge, he/she bears a good moral character and took active part in co-curricular activities. I wish him/her every success in life.",
        textX,
        y,
        { width: textWidth, lineGap: 4 },
      );

    y = doc.y + 60;

    // Footer: Date (left) and Signature (right)
    doc
      .font("Times-Italic")
      .fontSize(11)
      .fillColor("#555555")
      .text(`Date: ${new Date().toLocaleDateString("en-GB")}`, textX, y);

    const sigBoxWidth = 200;
    const sigBoxX = W - M - 20 - sigBoxWidth;
    const sigLineY = y + 24;
    doc
      .moveTo(sigBoxX, sigLineY)
      .lineTo(sigBoxX + sigBoxWidth, sigLineY)
      .lineWidth(1)
      .stroke("#000000");

    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor("#1a252f")
      .text("Headmaster", sigBoxX, sigLineY + 6, {
        width: sigBoxWidth,
        align: "center",
      });

    doc.end();
  });
}
