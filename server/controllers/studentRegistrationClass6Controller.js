import { prisma } from "../config/prisma.js";
import { getUploadUrl, deleteFromR2, getDownloadUrl } from "../config/r2.js";
import path from "path";
import XLSX from "xlsx";
import archiver from "archiver";

const checkDuplicates = async (data, excludeId = null) => {
  const duplicates = [];
  try {
    if (data && data.birth_reg_no) {
      const existing = await prisma.student_registration_class6.findFirst({
        where: {
          birth_reg_no: data.birth_reg_no,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "birthRegNo",
          message: `A registration with this Birth Reg No already exists (ID: ${existing.id})`,
        });
      }
    }
  } catch (err) {
    console.warn("checkDuplicates error:", err);
  }
  return duplicates;
};

export const createRegistration = async (req, res) => {
  try {
    const data = req.body;

    // Auto-calculate birth_year, birth_month, birth_day if birth_date is provided
    if (data.birth_date && data.birth_date.includes("/")) {
      const [d, m, y] = data.birth_date.split("/");
      data.birth_day = d;
      data.birth_month = m;
      data.birth_year = y;
    }

    const duplicates = await checkDuplicates(data);
    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates,
      });
    }

    const registration = await prisma.student_registration_class6.create({
      data: {
        ...data,
        status: "pending",
      },
    });

    res.status(201).json({
      success: true,
      message: "Registration submitted successfully",
      data: registration,
    });
  } catch (error) {
    console.error("createRegistration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit registration",
      error: error.message,
    });
  }
};

export const getAllRegistrations = async (req, res) => {
  try {
    const { class6_year, section, status, search } = req.query;

    const where = {};
    if (class6_year) where.class6_year = class6_year;
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { student_name_en: { contains: search, mode: "insensitive" } },
        { student_name_bn: { contains: search, mode: "insensitive" } },
        { roll: { contains: search, mode: "insensitive" } },
        { birth_reg_no: { contains: search, mode: "insensitive" } },
      ];
    }

    const registrations = await prisma.student_registration_class6.findMany({
      where,
      orderBy: { created_at: "desc" },
    });

    res.status(200).json({
      success: true,
      data: registrations,
    });
  } catch (error) {
    console.error("getAllRegistrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: error.message,
    });
  }
};

export const getRegistrationById = async (req, res) => {
  try {
    const { id } = req.params;
    const registration = await prisma.student_registration_class6.findUnique({
      where: { id },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      data: registration,
    });
  } catch (error) {
    console.error("getRegistrationById error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registration",
      error: error.message,
    });
  }
};

export const updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const existing = await prisma.student_registration_class6.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    const duplicates = await checkDuplicates(data, id);
    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates,
      });
    }

    // Handle photo deletion if changed
    if (
      data.photo_path &&
      existing.photo_path &&
      data.photo_path !== existing.photo_path
    ) {
      await deleteFromR2(existing.photo_path);
    }

    const updated = await prisma.student_registration_class6.update({
      where: { id },
      data,
    });

    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("updateRegistration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update registration",
      error: error.message,
    });
  }
};

export const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await prisma.student_registration_class6.update({
      where: { id },
      data: { status },
    });

    res.status(200).json({
      success: true,
      message: `Registration ${status} successfully`,
      data: updated,
    });
  } catch (error) {
    console.error("updateRegistrationStatus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update registration status",
      error: error.message,
    });
  }
};

export const deleteRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.student_registration_class6.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (existing.photo_path) {
      await deleteFromR2(existing.photo_path);
    }

    await prisma.student_registration_class6.delete({
      where: { id },
    });

    res.status(200).json({
      success: true,
      message: "Registration deleted successfully",
    });
  } catch (error) {
    console.error("deleteRegistration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete registration",
      error: error.message,
    });
  }
};

export const getRegistrationPhotoUploadUrl = async (req, res) => {
  try {
    const { filename, filetype, name, roll, year } = req.body;
    if (!filename || !filetype) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Filename and filetype are required",
        });
    }

    const safeName = String(name || "student")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_");
    const safeRoll = String(roll || "no-roll")
      .trim()
      .replace(/[^a-zA-Z0-9-_]+/g, "_");
    const safeYear = String(year || new Date().getFullYear());
    const ext = path.extname(filename);

    const key = `registrations/class6/${safeYear}/${safeRoll}_${safeName}_${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    res.json({ success: true, url, key });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate upload URL" });
  }
};

export const exportRegistrations = async (req, res) => {
  try {
    const { class6_year, section, status } = req.query;

    const where = {};
    if (class6_year) where.class6_year = class6_year;
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;

    const registrations = await prisma.student_registration_class6.findMany({
      where,
      orderBy: { roll: "asc" },
    });

    const worksheet = XLSX.utils.json_to_sheet(registrations);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Class6_Registrations.xlsx",
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  } catch (error) {
    console.error("exportRegistrations error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to export registrations" });
  }
};
