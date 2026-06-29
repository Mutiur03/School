import type { Prisma } from "@prisma/client";
import { prisma } from "@/config/prisma.js";
import { deleteFromR2, getUploadUrl } from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";
import type { StaffFormData } from "@school/shared-schemas";

export class StaffService {
  static async getStaffsPaginated(params: {
    page: number;
    limit: number;
    search?: string;
  }) {
    const normalizedPage =
      Number.isFinite(params.page) && params.page > 0
        ? Math.floor(params.page)
        : 1;
    const normalizedLimit =
      Number.isFinite(params.limit) && params.limit > 0
        ? Math.min(Math.floor(params.limit), 200)
        : 20;
    const skip = (normalizedPage - 1) * normalizedLimit;
    const search = params.search?.trim();

    const where: Prisma.staffsWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, data] = await prisma.$transaction([
      prisma.staffs.count({ where }),
      prisma.staffs.findMany({
        where,
        orderBy: { id: "asc" },
        skip,
        take: normalizedLimit,
      }),
    ]);

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

  static getStaffs() {
    return prisma.staffs.findMany({ orderBy: { id: "asc" } });
  }

  static async addStaff(staff: StaffFormData[]) {
    const emails = staff.map((row) => row.email).filter(Boolean) as string[];

    if (emails.length) {
      const existing = await prisma.staffs.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      });

      if (existing.length) {
        throw new ApiError(
          409,
          "One or more emails already exist",
          existing.map((row) => row.email),
        );
      }
    }

    await prisma.staffs.createMany({
      data: staff,
      skipDuplicates: true,
    });

    if (emails.length) {
      return prisma.staffs.findMany({ where: { email: { in: emails } } });
    }

    return prisma.staffs.findMany({
      where: { phone: { in: staff.map((row) => row.phone) } },
    });
  }

  static async requireStaff(id: number) {
    const staff = await prisma.staffs.findUnique({ where: { id } });
    if (!staff) {
      throw new ApiError(404, "Staff not found");
    }
    return staff;
  }

  static async updateStaff(id: number, data: StaffFormData) {
    if (data.email) {
      const conflict = await prisma.staffs.findFirst({
        where: { email: data.email, NOT: { id } },
        select: { id: true },
      });

      if (conflict) {
        throw new ApiError(409, "Email already in use by another staff");
      }
    }

    return prisma.staffs.update({
      where: { id },
      data,
    });
  }

  static async deleteStaff(id: number) {
    const existing = await StaffService.requireStaff(id);

    if (existing.image) {
      await deleteFromR2(existing.image);
    }

    return prisma.staffs.delete({ where: { id } });
  }

  static async getPresignedUploadUrl(
    id: number,
    filename: string,
    contentType: string,
  ) {
    await StaffService.requireStaff(id);
    const key = `staff/${id}-${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  static async saveStaffImage(id: number, key: string | null) {
    const existing = await StaffService.requireStaff(id);

    if (existing.image && existing.image !== key) {
      await deleteFromR2(existing.image);
    }

    return prisma.staffs.update({
      where: { id },
      data: { image: key },
    });
  }
}
