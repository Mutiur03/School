import { prisma } from "@/config/prisma.js";
import { getUploadUrl, deleteFromR2, getDownloadUrl } from "@/config/r2.js";
import path from "path";
import * as XLSX from "xlsx";
import archiver from "archiver";
import fs from "fs";
import puppeteer from "puppeteer";
import axios from "axios";
import QRCode from "qrcode";
import { ApiError } from "@/utils/ApiError.js";
import { removeInitialZeros } from "@school/shared-schemas";
import { formatDateLong } from "../../class-6/Form/registrationFormClass6.service.js";

const checkDuplicates = async (data: any, excludeId: string | null = null) => {
  const duplicates = [];
  try {
    if (data && data.birth_reg_no && data.class8_year) {
      const existing = await prisma.student_registration_class8.findFirst({
        where: {
          birth_reg_no: data.birth_reg_no,
          class8_year: parseInt(data.class8_year),
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "birthRegNo",
          message: `এই জন্ম নিবন্ধন নম্বর (Birth Reg No) দিয়ে ${data.class8_year} শিক্ষাবর্ষে ইতিমধ্যেই একটি নিবন্ধন বিদ্যমান`,
        });
      }
    }

    if (data && data.section && data.roll && data.class8_year) {
      const existing = await prisma.student_registration_class8.findFirst({
        where: {
          section: data.section,
          roll: data.roll,
          class8_year: parseInt(data.class8_year),
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: { id: true, student_name_en: true },
      });
      if (existing) {
        duplicates.push({
          field: "rollSection",
          message: `${data.class8_year} শিক্ষাবর্ষে ${data.section} শাখায় এই রোল নম্বর (${data.roll}) ইতিমধ্যেই নিবন্ধিত`,
        });
      }
    }
  } catch (err) {
    console.warn("checkDuplicates error:", err);
  }
  return duplicates;
};

export class RegistrationFormClass8Service {
  static async getRegistrationPhotoUploadUrl(data: any) {
    const { filename, filetype } = data;
    if (!filename || !filetype) {
      throw new ApiError(400, "Filename and filetype are required");
    }

    const ext = path.extname(filename);
    const key = `registrations/class8/photo-${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    return { uploadUrl: url, key };
  }

  static async createRegistration(data: any) {
    const duplicates = await checkDuplicates(data);
    if (duplicates.length > 0) {
      throw new ApiError(400, "Duplicate information found", duplicates as any);
    }

    if (data.birth_day && data.birth_month && data.birth_year) {
      data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
    } else if (data.birth_date && data.birth_date.includes("/")) {
      const [d, m, y] = data.birth_date.split("/");
      data.birth_day = d;
      data.birth_month = m;
      data.birth_year = y;
    }
    const {
      same_as_permanent: _same_as_permanent,
      guardian_address_same_as_permanent: _guardian_address_same_as_permanent,
      guardian_is_not_father: _guardian_is_not_father,
      ...dbData
    } = data;

    return await prisma.student_registration_class8.create({
      data: {
        ...dbData,
        status: "pending",
      },
    });
  }

  static async getAllRegistrations(filters: any) {
    const {
      page = 1,
      limit = 50,
      section,
      status,
      class8_year,
      search,
    } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;
    if (class8_year) where.class8_year = parseInt(class8_year, 10);
    if (search) {
      where.OR = [
        { student_name_en: { contains: search, mode: "insensitive" } },
        { student_name_bn: { contains: search, mode: "insensitive" } },
        { roll: { contains: search } },
        { birth_reg_no: { contains: search } },
      ];
    }
    console.log(where);
    const [data, total] = await Promise.all([
      prisma.student_registration_class8.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { created_at: "desc" },
      }),
      prisma.student_registration_class8.count({
        where: { class8_year: Number(class8_year) },
      }),
    ]);
    console.log(total);

    return {
      data,
      meta: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getRegistrationById(id: string) {
    const registration = await prisma.student_registration_class8.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new ApiError(404, "Registration not found");
    }

    return registration;
  }

  static async updateRegistrationStatus(id: string, status: string) {
    return await prisma.student_registration_class8.update({
      where: { id },
      data: { status },
    });
  }

  static async updateRegistration(id: string, data: any) {
      const existing = await prisma.student_registration_class8.findUnique({
        where: { id },
      });
  
      if (!existing) {
        throw new ApiError(404, "Registration not found");
      }
  
      const duplicates = await checkDuplicates(data, id);
      if (duplicates.length > 0) {
        throw new ApiError(400, "Duplicate information found", duplicates as any);
      }
  
      if (!data.photo) {
        data.photo = existing.photo;
      }
  
      if (data.photo && existing.photo && data.photo !== existing.photo) {
        await deleteFromR2(existing.photo);
      }
  
      if (data.birth_day && data.birth_month && data.birth_year) {
        data.birth_date = `${data.birth_day}/${data.birth_month}/${data.birth_year}`;
      }
  
      if (data.class8_year) {
        data.class8_year = parseInt(data.class8_year, 10);
      }
  
      const {
        same_as_permanent: _same_as_permanent,
        guardian_address_same_as_permanent: _guardian_address_same_as_permanent,
        guardian_is_not_father: _guardian_is_not_father,
        ...dbData
      } = data;
  
      return await prisma.student_registration_class8.update({  
        where: { id },
        data: dbData,
      });
    }

  static async deleteRegistration(id: string) {
    const registration = await this.getRegistrationById(id);
    if (registration.photo) {
      await deleteFromR2(registration.photo);
    }
    return await prisma.student_registration_class8.delete({
      where: { id },
    });
  }

  static async exportRegistrations(query: any) {
    const { class8_year, section, status } = query;

    const where: any = {};
    if (class8_year) where.class8_year = parseInt(class8_year);
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;

    const registrations = await prisma.student_registration_class8.findMany({
      where,
      orderBy: { roll: "asc" },
    });

    const registrationsForExport = registrations.map((registration) => {
      const orderedRegistration: any = {};
      Object.entries(registration).forEach(([key, value]) => {
        orderedRegistration[key] = value;
        if (key === "birth_date") {
          orderedRegistration.birth_date_formatted = formatDateLong(
            value as string,
          );
        }
      });
      return orderedRegistration;
    });

    const importFormatData = registrations.map((reg) => ({
      name: reg.student_name_en,
      father_name: reg.father_name_en,
      mother_name: reg.mother_name_en,
      father_phone: reg.father_phone,
      mother_phone: reg.mother_phone,
      village: reg.permanent_village_road,
      post_office: reg.permanent_post_office,
      upazila: reg.permanent_upazila,
      district: reg.permanent_district,
      dob: reg.birth_date,
      class: 8,
      roll: reg.roll ? removeInitialZeros(String(reg.roll)) : "",
      section: reg.section,
      group: "",
      has_stipend: "No",
      religion: reg.religion,
    }));

    const worksheet = XLSX.utils.json_to_sheet(registrationsForExport);
    const importWorksheet = XLSX.utils.json_to_sheet(importFormatData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
    XLSX.utils.book_append_sheet(workbook, importWorksheet, "Student List");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  }

  static async exportRegistrationPhotos(query: any) {
    const { class8_year, section, status } = query;

    const where: any = { photo: { not: "" } };
    if (class8_year) where.class8_year = parseInt(class8_year);
    if (section) where.section = section;
    if (status && status !== "all") where.status = status;

    const registrations = await prisma.student_registration_class8.findMany({
      where,
      orderBy: { roll: "asc" },
    });

    if (registrations.length === 0) {
      throw new ApiError(404, "No photos found for the selected filters");
    }

    const archive = archiver("zip", { zlib: { level: 9 } });

    return {
      archive,
      registrations,
    };
  }

  static async downloadRegistrationPDF(id: string, previewParam: string = "") {
    const isInlinePreview =
      previewParam === "1" ||
      previewParam === "true" ||
      previewParam === "inline";
    const isHtmlPreview = previewParam === "html";

    const registration = await prisma.student_registration_class8.findUnique({
      where: { id },
    });

    if (!registration) {
      throw new ApiError(404, "Registration not found");
    }

    let settings = null;
    try {
      settings = await prisma.class8_reg.findFirst();
    } catch (error) {
      console.warn("Failed to fetch Class 8 settings:", error);
    }

    const getInstructionsForSection = (section: string) => {
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

    const solaimanLipiPath = path.join("public", "fonts", "SolaimanLipi.woff2");
    const timesNewRomanPath = path.join("public", "fonts", "times.ttf");
    const solaimanLipiBase64 = fs.existsSync(solaimanLipiPath)
      ? fs.readFileSync(solaimanLipiPath).toString("base64")
      : "";
    const timesNewRomanBase64 = fs.existsSync(timesNewRomanPath)
      ? fs.readFileSync(timesNewRomanPath).toString("base64")
      : "";

    let _studentPhotoBase64 = "";

    if (registration.photo) {
      try {
        const photoUrl = await getDownloadUrl(registration.photo);
        const response = await axios.get(photoUrl, {
          responseType: "arraybuffer",
        });
        const contentType = response.headers["content-type"];
        const buffer = Buffer.from(response.data, "binary");
        _studentPhotoBase64 = `data:${contentType};base64,${buffer.toString("base64")}`;
      } catch (photoError) {
        console.warn("Failed to fetch student photo for PDF:", photoError);
      }
    }

    if (!process.env.PUBLIC_FRONTEND_URL) {
      throw new ApiError(500, "Frontend URL not configured");
    }
    const frontendDomain = String(process.env.PUBLIC_FRONTEND_URL)
      .trim()
      .replace(/\/$/, "");

    let qrCodeBase64 = "";
    try {
      const qrData = `${frontendDomain}/preview/class8/${registration.id}`;
      qrCodeBase64 = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 600,
        color: { dark: "#111111", light: "#FFFFFF" },
      });
    } catch (qrError) {
      console.warn("Failed to generate QR code for PDF:", qrError);
    }

    const wrapBnEn = (text: string) => {
      if (!text) return "";
      text = text.normalize("NFC");
      return text.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (match, bn, nonBn) => {
          if (bn) return `<span class="bn">${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return match;
        },
      );
    };

    const handleList = (text: string) => {
      if (!text) return "";
      let normalizedText = text.normalize("NFC");
      return normalizedText.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (_, bn, nonBn) => {
          if (bn) return `<span>${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return _;
        },
      );
    };

    const row = (label: string, value: string, rowIndex: number = 0) => {
      const oddBg = "rgba(224, 231, 239, 0.45)";
      const evenLabelBg = "rgba(249, 250, 251, 0.35)";
      const rowBg = rowIndex % 2 === 1 ? oddBg : "transparent";
      const labelBg = rowIndex % 2 === 1 ? oddBg : evenLabelBg;
      const valueBg = rowIndex % 2 === 1 ? oddBg : "transparent";

      return `
        <tr style="background:${rowBg};">
          <td style="border:1px solid #bbb;padding:4px 8px;width:270px;background:${labelBg};font-weight:500;">${wrapBnEn(label)}</td>
          <td style="border:1px solid #bbb;padding:4px 8px;background:${valueBg};">${value || '<span style="color:#aaa;">N/A</span>'}</td>
        </tr>
      `;
    };

    const joinAddr = (v: any, po: any, pc: any, upz: any, dist: any) =>
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
      [
        "Registration Number:",
        wrapBnEn((registration as any).registration_no || ""),
      ],
      ["Birth Registration Number:", wrapBnEn(registration.birth_reg_no || "")],
      [
        "Date of Birth:",
        wrapBnEn(
          registration.birth_date
            ? `${registration.birth_date} (${formatDateLong(registration.birth_date)})`
            : "",
        ),
      ],
      ["Email Address:", wrapBnEn(registration.email || "No")],
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
        "Mobile Numbers:",
        wrapBnEn(
          [registration.father_phone || "", registration.mother_phone || ""]
            .filter(Boolean)
            .join(", ") || "No",
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
        "বাসার নিকটবর্তী অষ্টম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:",
        wrapBnEn(registration.nearby_student_info || "Not Applicable"),
      ],
    ];

    let tableRows = "";
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });

    const schoolName = "Panchbibi Lal Bihari Pilot Govt. High School";
    const schoolAddr = "Panchbibi, Joypurhat";
    const schoolWeb = "www.lbphs.gov.bd";
    const class8Year = registration.class8_year || "";
    const section = registration.section || "";
    const roll = registration.roll || "";
    const religion = registration.religion || "";
    const isPendingStatus =
      String(registration.status || "")
        .trim()
        .toLowerCase() === "pending";

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

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <title>Class 8 Registration Info</title>
        <style>
          @page { size: A4; margin: 24px; }
          ${solaimanLipiBase64 ? `@font-face { font-family: 'SolaimanLipi'; src: url('data:font/truetype;charset=utf-8;base64,${solaimanLipiBase64}') format('woff2'); font-weight: normal; font-style: normal; font-display: block; unicode-range: U+0980-U+09FF, U+0964-U+096F; }` : ""}
          ${timesNewRomanBase64 ? `@font-face { font-family: 'TimesNewRoman'; src: url('data:font/truetype;charset=utf-8;base64,${timesNewRomanBase64}') format('truetype'); font-weight: normal; font-style: normal; font-display: block; unicode-range: U+0020-U+007F, U+00A0-U+00FF; }` : ""}
          body, html { height: 100%; margin: 0; padding: 0; page-break-inside: avoid; page-break-after: avoid; font-size: 13px; }
          .page-container { position: relative; min-height: 100vh; height: 100vh; width: 100vw; box-sizing: border-box; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'" : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"}, sans-serif; background: #fff; page-break-inside: avoid; page-break-after: avoid; font-size: 1rem; }
          .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; height: 500px; opacity: 0.14; z-index: 5; pointer-events: none; user-select: none; }
          .watermark img { width: 100%; height: 100%; object-fit: contain; filter: grayscale(100%) contrast(85%) brightness(145%); }
          .pending-watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-26deg); z-index: 6; pointer-events: none; user-select: none; opacity: 0.65; width: 76%; border: 8px solid #facc15; padding: 10px 18px; box-sizing: border-box; background: transparent; text-align: center; }
          .pending-watermark-text { display: block; color: #facc15; text-transform: uppercase; letter-spacing: 0.08em; line-height: 1; white-space: nowrap; font-family: ${timesNewRomanBase64 ? "'TimesNewRoman', 'Times New Roman'" : "'Times New Roman'"}, serif; font-size: 100px; font-weight: 700; }
          .content-area { position: relative; z-index: 3; box-sizing: border-box; padding: 0 0 110px 0; min-height: 0; height: calc(100vh - 110px); font-size: 13px; }
          .bn, .bn * { font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'" : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"}, sans-serif !important; font-weight: 400 !important; font-feature-settings: "liga" 1, "kern" 1, "calt" 1; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; -webkit-text-stroke: 0.01em transparent; font-variant-ligatures: common-ligatures contextual; font-size: 1rem; }
          .en, .en * { font-family: ${timesNewRomanBase64 ? "'TimesNewRoman', 'Times New Roman'" : "'Times New Roman'"}, serif !important; letter-spacing: 0.02em; font-size: 1rem; }
          * { unicode-bidi: bidi-override; direction: ltr; font-size: 1rem; }
          .header { position: relative; text-align: center; margin-bottom: 12px; padding: 12px 0 8px 0; font-size: 1rem; }
          .header-top { display: grid; grid-template-columns: 100px 1fr 95px; align-items: start; gap: 12px; width: 100%; }
          .passport-photo { width: 90px; height: 110px; border: 1px solid #bbb; border-radius: 3px; overflow: hidden; background: rgba(255, 255, 255, 0.92); display: flex; align-items: center; justify-content: center; margin-top: 2px; }
          .passport-photo img { width: 100%; height: 100%; object-fit: cover; }
          .header-center { text-align: center; padding-top: 2px; }
          .qr-code { width: 90px; height: 90px; border: 1px solid #bbb; border-radius: 3px; overflow: hidden; background: rgba(255, 255, 255, 0.92); display: flex; align-items: center; justify-content: center; margin-top: 2px; margin-left: auto; }
          .qr-code img { width: 100%; height: 100%; object-fit: contain; image-rendering: crisp-edges; }
          .header .school { font-size: 1.9rem; font-weight: bold; margin-bottom: 4px; line-height: 1.2; }
          .header .addr { font-size: 1.5rem; margin-bottom: 4px; font-weight: 500; }
          .header .web { font-size: 1.5rem; }
          .title-row { font-size: 1.5rem; font-weight: 600; text-align: center; margin-top: 5px; }
          .section-row { background: #f1f5f9; font-size: 1.5rem; font-weight: 500; text-align: center; border: 1px solid #bbb; padding: 6px 0; }
          .section-row .en, .section-row .en * { font-size: 1.5rem !important; font-weight: 500 !important; }
          .instructions-section { border: 1px solid #000; border-radius: 4px; padding: 12px; margin: 8px 0; font-size: 1.2rem; line-height: 1; text-align: justify; }
          .instructions-content { white-space: pre-line; text-align: justify; line-height: 1; font-size: 1.2rem; }
          table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; font-size: 1.2rem; page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          th, td { border: 1px solid #bbb; padding: 4px 8px; font-size: 1.2rem; }
          th { background: #f3f6fa; }
          .document-list { margin-top: 8px; font-size: 1.2rem; }
          .document-list .bn { display: block; font-size: 1.2rem; line-height: 1.2; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali'" : "'Noto Sans Bengali'"}, sans-serif !important; }
          .signature-row { position: absolute; left: 0; right: 0; bottom: 10px; width: 100%; display: flex; justify-content: space-between; align-items: flex-end; gap: 8px; z-index: 3; height: 85px; box-sizing: border-box; font-size: 13px; }
          .signature-cell { flex: 1 1 0; text-align: center; vertical-align: bottom; min-width: 120px; max-width: 180px; padding: 0 4px; font-size: 1rem; }
          .signature-line { border-top: 1px dotted #222; margin-bottom: 2px; width: 95%; margin-left: auto; margin-right: auto; }
          .signature-label { font-size: 1rem; font-weight: 500; margin-top: 1px; font-family: ${solaimanLipiBase64 ? "'SolaimanLipi', 'Noto Sans Bengali'" : "'Noto Sans Bengali'"}, sans-serif !important; white-space: nowrap; }
          .bottom-info { position: absolute; left: 0; right: 0; bottom: -5px; width: 100%; text-align: center; font-size: 0.9rem; color: #555; background: white; z-index: 3; padding: 4px 0; }
        </style>
      </head>
      <body>
        <div class="page-container">
          ${logoBase64 ? `<div class="watermark"><img src="${logoBase64}" alt="School Watermark" /></div>` : ""}
          ${isPendingStatus ? '<div class="pending-watermark"><span class="pending-watermark-text">PENDING</span></div>' : ""}
          <div class="content-area">
            <div class="header">
              <div class="header-top">
                <div style="width: 90px;"></div>
                <div class="header-center">
                  <div class="school en">${schoolName}</div>
                  <div class="addr en">${schoolAddr}</div>
                  <div class="web en">${schoolWeb}</div>
                  <div class="title-row en">Student's Information for Registration of Class Eight ${class8Year}</div>
                </div>
                <div class="passport-photo">
                  ${_studentPhotoBase64 ? `<img src="${_studentPhotoBase64}" alt="Student Photo" />` : '<div class="passport-placeholder">Student<br/>Photo</div>'}
                </div>
              </div>
            </div>
            <div class="section-row en">Section: <span class="en">${section}</span>, Roll No: <span class="en">${roll}</span>, Religion: <span class="en">${religion}</span></div>
            <table><tbody>${tableRows}</tbody></table>
            <br />
            ${sectionInstructions ? `<div class="instructions-section"><div class="instructions-content">${wrapBnEn(sectionInstructions)}</div></div>` : ""}
            <div class="footer">
              <div class="note" style="display: flex; align-items: flex-start; gap: 12px;">
                <div class="document-list" style="flex: 1;">
                  <span class="bn"><b>* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:</b></span>
                  ${
                    attachmentInstructions
                      ? attachmentInstructions
                          .split(/\r?\n|\r/)
                          .map((line: string) =>
                            line
                              ? `<span class="bn">${handleList(line)}</span>`
                              : "",
                          )
                          .filter(Boolean)
                          .join("")
                      : ""
                  }
                </div>
                <div class="qr-code" style="flex-shrink: 0; margin-top: 0;">${qrCodeBase64 ? `<img src="${qrCodeBase64}" alt="QR Code" />` : '<div class="qr-placeholder">QR<br/>Unavailable</div>'}</div>
              </div>
            </div>
          </div>
          <div class="signature-row bn" style="gap: 8px; padding-bottom: 12px;">
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">ছাত্রের স্বাক্ষর</div></div>
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">পিতা/মাতা/বৈধ অভিভাবকের স্বাক্ষর</div></div>
            <div class="signature-cell" style="flex: 1; text-align: center; min-width: 140px;"><div class="signature-line"></div><div class="signature-label bn" style="font-size: 0.9rem;">দায়িত্বপ্রাপ্ত শিক্ষকের স্বাক্ষর, তারিখ ও সিল</div></div>
          </div>
          <div class="bottom-info en">Emergency Contact: 01309-121983 | Generated: ${currentDateTime}</div>
        </div>
      </body>
      </html>
    `;
    if (isHtmlPreview) {
      return { html };
    }

    const browser = await puppeteer.launch({
      headless: true,
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
      waitUntil: isInlinePreview
        ? ["domcontentloaded"]
        : ["networkidle0", "domcontentloaded"],
    });

    await page.evaluate((quickPreview) => {
      /* global document, NodeFilter */
      // @ts-ignore
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
      );
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue) node.nodeValue = node.nodeValue.normalize("NFC");
      }
      return new Promise((resolve) => {
        const fallbackDelay = quickPreview ? 80 : 1000;
        const fontDelay = quickPreview ? 120 : 500;
        // @ts-ignore
        if (document.fonts && document.fonts.ready) {
          // @ts-ignore
          document.fonts.ready.then(() => setTimeout(resolve, fontDelay));
        } else {
          setTimeout(resolve, fallbackDelay);
        }
      });
    }, isInlinePreview);

    const pdfBuffer = await page.pdf({
      format: "a4",
      printBackground: true,
      margin: { top: 24, bottom: 24, left: 24, right: 24 },
      preferCSSPageSize: true,
      pageRanges: "1",
    });

    await browser.close();

    return {
      pdfBuffer,
      studentName: registration.student_name_en,
      isInlinePreview,
    };
  }
}
