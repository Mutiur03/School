import { prisma } from "../config/prisma.js";
import {
  getUploadUrl,
  deleteFromR2,
  getDownloadUrl,
  getFileBuffer,
} from "../config/r2.js";
import path from "path";
import XLSX from "xlsx";
import archiver from "archiver";
import fs from "fs";
import puppeteer from "puppeteer";
import axios from "axios";

const loadFontAsBase64 = (fontPath) => {
  try {
    if (fs.existsSync(fontPath)) {
      const fontBuffer = fs.readFileSync(fontPath);
      return fontBuffer.toString("base64");
    }
    return null;
  } catch (error) {
    console.warn(`Failed to load font: ${fontPath}`, error);
    return null;
  }
};

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
          message: `একটি নিবন্ধন এই জন্ম নিবন্ধন নম্বর (Birth Reg No) দিয়ে ইতিমধ্যেই বিদ্যমান`,
        });
      }
    }

    if (data && data.section && data.roll && data.class6_year) {
      const existing = await prisma.student_registration_class6.findFirst({
        where: {
          section: data.section,
          roll: data.roll,
          class6_year: parseInt(data.class6_year),
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "rollSection",
          message: `${data.class6_year} শিক্ষাবর্ষে ${data.section} শাখায় এই রোল নম্বর (${data.roll}) ইতিমধ্যেই নিবন্ধিত`,
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

    // Auto-calculate birth_year, birth_month, birth_day if birth_date is provided (Legacy/Input)
    // OR construct birth_date if separate fields provided (for Storage)
    if (data.birth_day && data.birth_month && data.birth_year) {
      data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
    } else if (data.birth_date && data.birth_date.includes("/")) {
      const [d, m, y] = data.birth_date.split("/");
      data.birth_day = d;
      data.birth_month = m;
      data.birth_year = y;
    }

    // Default class6_year from settings
    if (!data.class6_year) {
      const settings = await prisma.class6_reg.findFirst();
      data.class6_year = settings?.class6_year || new Date().getFullYear();
    }
    // Ensure class6_year is Int
    data.class6_year = parseInt(data.class6_year);

    // Map photo_path to photo
    if (data.photo_path && !data.photo) {
      data.photo = data.photo_path;
    }

    // Validate that photo is uploaded
    if (!data.photo) {
      return res.status(400).json({
        success: false,
        message: "Student photo is required",
      });
    }

    const duplicates = await checkDuplicates(data);
    if (duplicates.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates,
      });
    }

    // Remove frontend-only fields that don't exist in database schema
    // and remove photo_path since mapped to photo
    const {
      same_as_permanent,
      guardian_address_same_as_permanent,
      guardian_is_not_father,
      photo_path,
      ...dbData
    } = data;

    const registration = await prisma.student_registration_class6.create({
      data: {
        ...dbData,
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
    if (class6_year) where.class6_year = parseInt(class6_year);
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

    const registrationsWithUrls = await Promise.all(
      registrations.map(async (reg) => {
        if (reg.photo_path) {
          reg.photo_path = await getDownloadUrl(reg.photo_path);
        }
        return reg;
      }),
    );

    res.status(200).json({
      success: true,
      data: registrationsWithUrls,
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

    // Validate that photo is not being removed
    if (data.photo === "") {
      return res.status(400).json({
        success: false,
        message: "Student photo is required",
      });
    }

    // Handle photo deletion if changed
    // Check against existing.photo
    if (
      data.photo_path &&
      existing.photo &&
      data.photo_path !== existing.photo
    ) {
      await deleteFromR2(existing.photo);
    }

    // Construct birth_date if fields present
    if (data.birth_day && data.birth_month && data.birth_year) {
      data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
    }

    // Map photo_path to photo
    if (data.photo_path) {
      data.photo = data.photo_path;
    }

    // Ensure class6_year is Int if updated
    if (data.class6_year) {
      data.class6_year = parseInt(data.class6_year);
    }

    // Remove frontend-only fields that don't exist in database schema
    const {
      same_as_permanent,
      guardian_address_same_as_permanent,
      guardian_is_not_father,
      photo_path,
      ...dbData
    } = data;

    const updated = await prisma.student_registration_class6.update({
      where: { id },
      data: dbData,
    });

    if (updated.photo) {
      updated.photo_path = await getDownloadUrl(updated.photo);
    }

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

    if (existing.photo) {
      await deleteFromR2(existing.photo);
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
    const { filename, filetype, name, roll, year, section } = req.body;
    if (!filename || !filetype) {
      return res.status(400).json({
        success: false,
        message: "Filename and filetype are required",
      });
    }

    const settings = await prisma.class6_reg.findFirst();
    const academicYear =
      settings?.class6_year || new Date().getFullYear().toString();

    const safeSection = String(section || "X")
      .trim()
      .toUpperCase();
    const safeRoll = String(roll || "00")
      .trim()
      .padStart(2, "0");
    const randomId = Date.now();
    const ext = path.extname(filename);

    const key = `registrations/class6/${academicYear}/${safeSection}-${safeRoll}-${randomId}${ext}`;
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
    console.log("Exporting registrations sheet:", {
      class6_year,
      section,
      status,
    });

    const where = {};
    if (class6_year) where.class6_year = parseInt(class6_year);
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

export const exportRegistrationPhotos = async (req, res) => {
  try {
    const { class6_year, section, status } = req.query;
    console.log("Exporting registration photos:", {
      class6_year,
      section,
      status,
    });

    const where = {
      photo: { not: "" },
    };
    if (class6_year) where.class6_year = parseInt(class6_year);
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;

    const registrations = await prisma.student_registration_class6.findMany({
      where,
      orderBy: { roll: "asc" },
    });

    console.log(
      `Found ${registrations.length} registrations with photos for export.`,
    );

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No photos found for the selected filters",
      });
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Class6_Photos_${class6_year || "All"}_${section || "All"}.zip`,
    );
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const reg of registrations) {
      try {
        const buffer = await getFileBuffer(reg.photo);
        if (buffer) {
          const extension = path.extname(reg.photo) || ".jpg";
          const fileName = `${reg.section || "NoSection"}_${reg.roll || "NoRoll"}${extension}`;
          archive.append(buffer, { name: fileName });
        }
      } catch (err) {
        console.error(
          `Failed to fetch photo for student ${reg.student_name_en}:`,
          err,
        );
      }
    }

    archive.finalize();
  } catch (error) {
    console.error("exportRegistrationPhotos error:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ success: false, message: "Failed to export photos" });
    }
  }
};
export const downloadRegistrationPDF = async (req, res) => {
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

    // Fetch Class 6 registration settings for instructions
    let settings = null;
    try {
      settings = await prisma.class6_reg.findFirst();
    } catch (error) {
      console.warn("Failed to fetch Class 6 settings:", error);
    }

    // Get section-specific instructions
    const getInstructionsForSection = (section) => {
      if (!settings) return null;
      const sectionLower = section?.toLowerCase();
      if (sectionLower === "a" && settings.instruction_for_a) {
        return settings.instruction_for_a;
      }
      if (sectionLower === "b" && settings.instruction_for_b) {
        return settings.instruction_for_b;
      }
      return null;
    };

    const sectionInstructions = getInstructionsForSection(registration.section);
    const attachmentInstructions = settings?.attachment_instruction || null;

    const logoPath = path.join("public", "icon.jpg");
    const logoBase64 = fs.existsSync(logoPath)
      ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString("base64")}`
      : "";

    // Load font files as base64
    const solaimanLipiPath = path.join("public", "fonts", "SolaimanLipi.woff2");
    const timesNewRomanPath = path.join("public", "fonts", "times.ttf");
    const solaimanLipiBase64 = fs.existsSync(solaimanLipiPath)
      ? fs.readFileSync(solaimanLipiPath).toString("base64")
      : "";
    const timesNewRomanBase64 = fs.existsSync(timesNewRomanPath)
      ? fs.readFileSync(timesNewRomanPath).toString("base64")
      : "";

    // Helper: Signature of student photo (fetch from R2 and convert to base64)
    let studentPhotoBase64 = "";
    if (registration.photo_path) {
      try {
        const photoUrl = await getDownloadUrl(registration.photo_path);
        const response = await axios.get(photoUrl, {
          responseType: "arraybuffer",
        });
        const contentType = response.headers["content-type"];
        const buffer = Buffer.from(response.data, "binary");
        studentPhotoBase64 = `data:${contentType};base64,${buffer.toString(
          "base64",
        )}`;
      } catch (photoError) {
        console.warn("Failed to fetch student photo for PDF:", photoError);
      }
    }

    function formatDateLong(dateStr) {
      if (!dateStr) return "";
      let d, m, y;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        [d, m, y] = dateStr.split("/");
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        [y, m, d] = dateStr.split("-");
      } else {
        return dateStr;
      }
      const dateObj = new Date(`${y}-${m}-${d}`);
      if (isNaN(dateObj)) return dateStr;
      return dateObj
        .toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
        .replace(/(\w+)\s(\d{4})/, "$1, $2");
    }

    function normalizeUnicode(text) {
      return text ? text.normalize("NFC") : "";
    }

    function handleList(text) {
      if (!text) return "";
      let normalizedText = normalizeUnicode(text);
      return normalizedText.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (_, bn, nonBn) => {
          if (bn) return `<span>${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return _;
        },
      );
    }

    function wrapBnEn(text) {
      if (!text) return "";
      text = normalizeUnicode(text);
      return text.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (match, bn, nonBn) => {
          if (bn) return `<span class="bn">${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return match;
        },
      );
    }

    const row = (label, value, rowIndex = 0) => `
      <tr style="background:${rowIndex % 2 === 1 ? "#e0e7ef" : "inherit"};">
        <td style="border:1px solid #bbb;padding:4px 8px;width:270px;background:${
          rowIndex % 2 === 1 ? "#e0e7ef" : "#f9fafb"
        };font-weight:500;">${wrapBnEn(label)}</td>
        <td style="border:1px solid #bbb;padding:4px 8px;background:${
          rowIndex % 2 === 1 ? "#e0e7ef" : "inherit"
        };">${value || '<span style="color:#aaa;">N/A</span>'}</td>
      </tr>
    `;

    const joinAddr = (v, po, pc, upz, dist) =>
      [v, po ? (pc ? `${po} (${pc})` : po) : "", upz, dist]
        .filter(Boolean)
        .map((s) => s.trim())
        .filter(Boolean)
        .join(", ");

    const studentDetails = [
      ["ছাত্রের নাম (বাংলায়):", wrapBnEn(registration.student_name_bn || "")],
      [
        "Student's Name:",
        wrapBnEn(registration.student_name_en.toUpperCase() || ""),
      ],
      ["Birth Registration Number:", wrapBnEn(registration.birth_reg_no || "")],
      [
        "Date of Birth:",
        wrapBnEn(formatDateLong(registration.birth_date) || ""),
      ],
      ["Email Address:", wrapBnEn(registration.email || "No")],
      [
        "Mobile Numbers:",
        wrapBnEn(
          [registration.father_phone || "", registration.mother_phone || ""]
            .filter(Boolean)
            .join(", ") || "No",
        ),
      ],
      ["পিতার নাম:", wrapBnEn(registration.father_name_bn || "")],
      [
        "Father's Name:",
        wrapBnEn(registration.father_name_en.toUpperCase() || ""),
      ],
      ["Father's National ID Number:", wrapBnEn(registration.father_nid || "")],
      ["মাতার নাম:", wrapBnEn(registration.mother_name_bn || "")],
      [
        "Mother's Name:",
        wrapBnEn(registration.mother_name_en.toUpperCase() || ""),
      ],
      ["Mother's National ID Number:", wrapBnEn(registration.mother_nid || "")],
      [
        "Guardian's Name:",
        wrapBnEn(
          [
            registration.guardian_name
              ? `Name: ${registration.guardian_name}`
              : "Not Applicable",
            registration.guardian_relation
              ? `Relation: ${registration.guardian_relation}`
              : "",
            registration.guardian_phone
              ? `Phone: ${registration.guardian_phone}`
              : "",
          ]
            .filter(Boolean)
            .join(", "),
        ),
      ],
      [
        "Guardian's Address:",
        wrapBnEn(
          joinAddr(
            registration.guardian_village_road,
            registration.guardian_post_office,
            registration.guardian_post_code,
            registration.guardian_upazila,
            registration.guardian_district,
          ) || "Not Applicable",
        ),
      ],
      [
        "Permanent Address:",
        wrapBnEn(
          joinAddr(
            registration.permanent_village_road,
            registration.permanent_post_office,
            registration.permanent_post_code,
            registration.permanent_upazila,
            registration.permanent_district,
          ),
        ),
      ],
      [
        "Present Address:",
        wrapBnEn(
          joinAddr(
            registration.present_village_road,
            registration.present_post_office,
            registration.present_post_code,
            registration.present_upazila,
            registration.present_district,
          ),
        ),
      ],
      [
        "Previous School Name & Address:",
        wrapBnEn(
          [
            registration.prev_school_name,
            registration.prev_school_upazila,
            registration.prev_school_district,
          ]
            .filter(Boolean)
            .join(", "),
        ),
      ],
      [
        "Previous School Information:",
        wrapBnEn(
          [
            registration.section_in_prev_school
              ? `Section: ${registration.section_in_prev_school}`
              : "",
            registration.roll_in_prev_school
              ? `Roll: ${registration.roll_in_prev_school}`
              : "",
            registration.prev_school_passing_year
              ? `Year: ${registration.prev_school_passing_year}`
              : "",
          ]
            .filter(Boolean)
            .join(", "),
        ),
      ],
      // [
      //   "Religion and Blood Group:",
      //   wrapBnEn(
      //     [
      //       registration.religion ? `Religion: ${registration.religion}` : "",
      //       registration.blood_group
      //         ? `Blood Group: ${registration.blood_group}`
      //         : "",
      //     ]
      //       .filter(Boolean)
      //       .join(", "),
      //   ),
      // ],
    ];

    // Render table rows without section headers
    let tableRows = "";
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });

    const schoolName = "Panchbibi Lal Bihari Pilot Govt. High School";
    const schoolAddr = "Panchbibi, Joypurhat";
    const schoolWeb = "www.lbphs.gov.bd";
    const class6Year = registration.class6_year || "";
    const section = registration.section || "";
    const roll = registration.roll || "";
    const religion = registration.religion || "";

    // Get current date and time
    const currentDateTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" }),
    ).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Enhanced HTML with better Unicode and font support
    const html = `
     <!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <title>Class 6 Registration Info</title>
  <style>
    @page {
      size: legal;
      margin: 24px;
    }
    
    ${
      solaimanLipiBase64
        ? `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;charset=utf-8;base64,${solaimanLipiBase64}') format('woff2');
      font-weight: normal;
      font-style: normal;
      font-display: block;
      unicode-range: U+0980-U+09FF, U+0964-U+096F;
    }`
        : ""
    }
    
    ${
      timesNewRomanBase64
        ? `
    @font-face {
      font-family: 'TimesNewRoman';
      src: url('data:font/truetype;charset=utf-8;base64,${timesNewRomanBase64}') format('truetype');
      font-weight: normal;
      font-style: normal;
      font-display: block;
      unicode-range: U+0020-U+007F, U+00A0-U+00FF;
    }`
        : ""
    }
    
    body, html {
      height: 100%;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
      page-break-after: avoid;
      font-size: 1rem;
    }
    .page-container {
      position: relative;
      min-height: 100vh;
      height: 100vh;
      width: 100vw;
      box-sizing: border-box;
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
          : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif;
      background: #fff;
      page-break-inside: avoid;
      page-break-after: avoid;
      font-size: 1rem;
    }
    .content-area {
      box-sizing: border-box;
      padding: 0 0 140px 0;
      min-height: 0;
      height: calc(100vh - 140px);
      overflow: hidden;
      font-size: 1rem;
    }
    
    /* Enhanced Bangla font rendering with better fallbacks */
    .bn, .bn * {
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
          : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif !important;
      font-weight: 400 !important;
      font-feature-settings: "liga" 1, "kern" 1, "calt" 1;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      -webkit-text-stroke: 0.01em transparent;
      font-variant-ligatures: common-ligatures contextual;
      font-size: 1rem;
    }
    .en, .en * {
      font-family: ${
        timesNewRomanBase64
          ? "'TimesNewRoman', 'Times New Roman'"
          : "'Times New Roman'"
      }, serif !important;
      letter-spacing: 0.02em;
      font-size: 1rem;
    }
    
    /* Ensure proper Unicode rendering */
    * {
      unicode-bidi: bidi-override;
      direction: ltr;
      font-size: 1rem;
    }
    
    /* Special handling for Bengali punctuation */
    .bn::before, .bn::after {
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
      font-size: 1rem;
    }
    
    .header { 
      position: relative;
      text-align: center; 
      margin-bottom: 12px;
      padding: 12px 0 8px 0;
      font-size: 1rem;
    }
    .monogram {
      position: absolute;
      left: 0;
      top: 8px;
      width: 80px;
      height: 80px;
      ${
        !logoBase64
          ? `
        background: #f0f0f0;
        border: 2px solid #ccc;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        color: #666;
        text-align: center;
        line-height: 1.2;
      `
          : ""
      }
    }
    .monogram img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 50%;
    }
    .header .school { 
      font-size: 1.25rem; 
      font-weight: bold; 
      margin-bottom: 6px;
      line-height: 1.3;
      color: #1e3a8a;
    }
    .header .addr { 
      font-size: 1rem; 
      margin-bottom: 4px;
      font-weight: 500;
    }
    .header .web { 
      font-size: 1rem; 
    }
    .title-row { 
      background: #e3f0fa; 
      font-size: 1rem; 
      font-weight: bold; 
      text-align: center; 
      border: 1px solid #bbb; 
      padding: 8px 0; 
      margin-top: 8px;
    }
    .section-row { 
      background: #f1f5f9; 
      font-size: 1rem; 
      font-weight: 500; 
      text-align: center; 
      border: 1px solid #bbb; 
      padding: 6px 0; 
    }
    .instructions-section {
      border: 1px solid #000;
      border-radius: 4px;
      padding: 12px;
      margin: 8px 0;
      font-size: 1rem;
      line-height: 1;
      text-align: justify;
    }
    .instructions-content {
      white-space: pre-line;
      text-align: justify;
      line-height: 1;
      font-size: 1rem;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin-top: 0.5rem; 
      font-size: 1rem; 
      page-break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
    }
    th, td { 
      border: 1px solid #bbb; 
      padding: 4px 8px;
      font-size: 1rem;
    }
    th { 
      background: #f3f6fa; 
    }
    .footer .note .bn {
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
      font-size: 1rem;
    }
    .document-list {
      margin-top: 8px;
      font-size: 1rem;
    }
    .document-list .bn {
      display: block;
      font-size: 1rem;
      line-height: 1.2;
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
    }
    .signature-row {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 40px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px;
      padding-bottom: 18px;
      background: white;
      height: 110px;
      box-sizing: border-box;
      font-size: 1rem;
    }
    .signature-cell {
      flex: 1 1 0;
      text-align: center;
      vertical-align: bottom;
      min-width: 120px;
      max-width: 180px;
      padding: 0 4px;
      font-size: 1rem;
    }
    .signature-line {
      border-top: 1px dotted #222;
      margin-bottom: 2px;
      width: 95%;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      font-size: 1rem;
      font-weight: 500;
      margin-top: 1px;
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
      white-space: nowrap;
    }
    .bottom-info {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -4px;
      width: 100%;
      text-align: center;
      font-size: 1rem;
      color: #555;
      background: white;
      padding: 4px 0;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="content-area">
      <div class="header">
        <div class="monogram">
          ${
            logoBase64
              ? `<img src="${logoBase64}" alt="School Logo" />`
              : "School<br>Logo"
          }
        </div>
        <div class="school en">${schoolName}</div>
        <div class="addr en">${schoolAddr}</div>
        <div class="web en">${schoolWeb}</div>
      </div>
      <div class="title-row en">
        Student's Information for Admission of Class Six ${class6Year}
      </div>
      <div class="section-row en">
        Section: <span class="en">${section}</span>, Roll No: <span class="en">${roll}</span>, Religion: <span class="en">${religion}</span>
      </div>
      <table>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <br />
      ${
        sectionInstructions
          ? `
      <div class="instructions-section">
        <div class="instructions-content">${wrapBnEn(sectionInstructions)}</div>
      </div>
      `
          : ""
      }
      <div class="footer">
        <div class="note">
          <div class="document-list">
            <span class="bn"><b>* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:</b></span>
            ${
              attachmentInstructions
                ? attachmentInstructions
                    .split(/\r?\n|\r/)
                    .map((line) => {
                      if (line) {
                        return `<span class="bn">${handleList(line)}</span>`;
                      }
                      return "";
                    })
                    .filter(Boolean)
                    .join("")
                : ""
            }
          </div>
        </div>
      </div>
    </div>
    <div class="signature-row bn" style="gap: 8px; padding-bottom: 12px;">
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">ছাত্রের স্বাক্ষর</div>
      </div>
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">পিতা/মাতা/বৈধ অভিভাবকের স্বাক্ষর</div>
      </div>
      <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;">
        <div class="signature-line"></div>
        <div class="signature-label bn" style="font-size: 0.9rem;">দায়িত্বপ্রাপ্ত শিক্ষকের স্বাক্ষর, তারিখ ও সিল</div>
      </div>
    </div>
    <div class="bottom-info en">
      Emergency Contact: 01309-121983 | Generated: ${currentDateTime}
    </div>
  </div>
</body>
</html>
    `;

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-font-subpixel-positioning",
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--font-render-hinting=medium",
        "--enable-font-antialiasing",
        "--disable-extensions",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-default-apps",
        "--force-device-scale-factor=1",
        "--disable-lcd-text",
        "--lang=bn-BD",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    );
    await page.setExtraHTTPHeaders({
      "Accept-Charset": "utf-8",
      "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
    });

    await page.setContent(html, {
      waitUntil: ["networkidle0", "domcontentloaded"],
    });

    await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue) node.nodeValue = node.nodeValue.normalize("NFC");
      }
      return new Promise((resolve) => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => setTimeout(resolve, 500));
        } else {
          setTimeout(resolve, 1000);
        }
      });
    });

    const pdfBuffer = await page.pdf({
      format: "legal",
      printBackground: true,
      margin: { top: 24, bottom: 24, left: 24, right: 24 },
      preferCSSPageSize: true,
      pageRanges: "1",
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Class6_Reg_${registration.student_name_en.replace(
        /\s+/g,
        "_",
      )}.pdf"`,
    );
    res.end(pdfBuffer);
  } catch (error) {
    console.error("PDF generator error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};
