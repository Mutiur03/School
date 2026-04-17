import { prisma } from "../../config/prisma.js";

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
}
