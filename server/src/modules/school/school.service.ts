import bcrypt from "bcrypt";
import ExcelJS from "exceljs";
import { prisma } from "../../config/prisma.js";
import generatePassword from "../../utils/pwgenerator.js";
import { ApiError } from "../../utils/ApiError.js";

export class SchoolService {
  static async createSchool(data: any) {
    return prisma.school.create({
      data,
    });
  }

  static async getSchools() {
    return prisma.school.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  static async getSchoolById(id: number) {
    return prisma.school.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            students: true,
            teachers: true,
            exams: true,
            notices: true,
          },
        },
      },
    });
  }

  static async updateSchool(id: number, data: any) {
    return prisma.school.update({
      where: { id },
      data,
    });
  }

  static async deleteSchool(id: number) {
    return prisma.school.delete({
      where: { id },
    });
  }

  static async getSchoolInfo(id: number) {
    return prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        shortName: true,
        logo: true,
        favicon: true,
        district: true,
        upazila: true,
        phone: true,
        email: true,
        website: true,
        slogan: true,
        establishedIn: true,
      },
    });
  }

  static async getCurrentSchoolInfo({ schoolId }: { schoolId?: number }) {
    if (!schoolId) return null;

    return this.getSchoolInfo(schoolId);
  }

  /** Rotate the password of every student belonging to a school; returns an .xlsx of new credentials. */
  static async rotateStudentPasswords(schoolId: number) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new ApiError(404, "School not found");

    const students = await prisma.students.findMany({
      where: { school_id: schoolId },
      select: {
        id: true,
        login_id: true,
        name: true,
        batch: true,
        religion: true,
      },
    });

    if (students.length === 0) {
      throw new ApiError(404, "No students found for this school");
    }

    const processed = await Promise.all(
      students.map(async (student) => {
        const password = generatePassword(8);
        const hashedPassword = await bcrypt.hash(password, 10);
        return { ...student, password, hashedPassword };
      }),
    );

    await prisma.$transaction(async (tx) => {
      for (const student of processed) {
        await tx.students.update({
          where: { id: student.id },
          data: {
            password: student.hashedPassword,
            tokenVersion: { increment: 1 },
          },
        });
      }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Rotated Passwords");
    sheet.columns = [
      { header: "Login ID", key: "login_id", width: 14 },
      { header: "Name", key: "name", width: 26 },
      { header: "Batch", key: "batch", width: 8 },
      { header: "Religion", key: "religion", width: 12 },
      { header: "New Password", key: "password", width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const student of processed) {
      sheet.addRow({
        login_id: student.login_id.toString(),
        name: student.name,
        batch: student.batch,
        religion: student.religion,
        password: student.password,
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }

  /** Build an .xlsx of all students for a school, embedding each student image. */
  static async exportStudentsExcel(schoolId: number) {
    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new ApiError(404, "School not found");

    const students = await prisma.students.findMany({
      where: { school_id: schoolId },
      include: {
        enrollments: { orderBy: { year: "desc" }, take: 1 },
      },
      orderBy: { login_id: "asc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Students");

    sheet.columns = [
      { header: "Login ID", key: "login_id", width: 14 },
      { header: "Name", key: "name", width: 26 },
      { header: "Father Name", key: "father_name", width: 24 },
      { header: "Mother Name", key: "mother_name", width: 24 },
      { header: "Batch", key: "batch", width: 8 },
      { header: "Class", key: "class", width: 8 },
      { header: "Section", key: "section", width: 9 },
      { header: "Roll", key: "roll", width: 8 },
      { header: "Religion", key: "religion", width: 12 },
      { header: "Father Phone", key: "father_phone", width: 14 },
      { header: "Mother Phone", key: "mother_phone", width: 14 },
      { header: "DOB", key: "dob", width: 12 },
      { header: "Village", key: "village", width: 18 },
      { header: "Post Office", key: "post_office", width: 16 },
      { header: "Upazila", key: "upazila", width: 16 },
      { header: "District", key: "district", width: 16 },
      { header: "Available", key: "available", width: 10 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const student of students) {
      const enrollment = student.enrollments[0];
      sheet.addRow({
        login_id: student.login_id.toString(),
        name: student.name,
        father_name: student.father_name ?? "",
        mother_name: student.mother_name ?? "",
        batch: student.batch,
        class: enrollment?.class ?? "",
        section: enrollment?.section ?? "",
        roll: enrollment?.roll ?? "",
        religion: student.religion,
        father_phone: student.father_phone ?? "",
        mother_phone: student.mother_phone ?? "",
        dob: student.dob ?? "",
        village: student.village ?? "",
        post_office: student.post_office ?? "",
        upazila: student.upazila ?? "",
        district: student.district ?? "",
        available: student.available ? "Yes" : "No",
      });
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer);
  }
}
