import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import archiver from "archiver";
import XLSX from "xlsx";
import { redis } from "../config/redis.js";
import { pdfQueue } from "../utils/pdfWorker.js";

const formatQuota = (q) => {
  if (!q) return null;
  const key = String(q).trim();
  const map = {
    "(GEN)": "সাধারণ (GEN)",
    "(DIS)": "বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)",
    "(FF)": "মুক্তিযোদ্ধার সন্তান (FF)",
    "(GOV)": "সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)",
    "(ME)": "শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)",
    "(SIB)": "সহোদর ভাই (SIB)",
    "(TWN)": "যমজ (TWN)",
    "(Mutual Transfer)": "পারস্পরিক বদলি (Mutual Transfer)",
    "(Govt. Transfer)": "সরকারি বদলি (Govt. Transfer)",
  };

  if (map[key]) return map[key];

  const normalized = key.replace(/\s+/g, " ").trim();
  if (map[normalized]) return map[normalized];

  const noParens = normalized.replace(/[()]/g, "").trim();
  const withParens = `(${noParens})`;
  if (map[withParens]) return map[withParens];

  return normalized;
};
const checkDuplicates = async (data, excludeId = null) => {
  const duplicates = [];
  try {
    if (!data || !data.serial_no) return duplicates;
    const existing = await prisma.admission_form.findFirst({
      where: {
        serial_no: data.serial_no,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, student_name_en: true },
    });
    if (existing) {
      duplicates.push({
        field: "serialNo",
        message: "Serial number already exists",
        existingRecord: existing,
      });
    }
  } catch (err) {
    console.warn(
      "checkDuplicates error:",
      err && err.message ? err.message : err
    );
  }
  return duplicates;
};
const saveAdmissionPhoto = async (file, year, listType, serialNo, name) => {
  if (!file) return null;
  if (!fs.existsSync(file.path)) {
    throw new Error(`File not found: ${file.path}`);
  }

  const safeYear = year || new Date().getFullYear();

  const safeListType = String(listType || "unknown")
    .trim()
    .replace(/[^a-zA-Z0-9-_ ]+/g, "_")
    .replace(/\s+/g, "_")
    .toLowerCase();

  const safeSerial = serialNo
    ? String(serialNo)
        .trim()
        .replace(/[^a-zA-Z0-9-_]+/g, "_")
    : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;

  const safeName = name
    ? String(name)
        .trim()
        .replace(/[^a-zA-Z0-9-_ ]+/g, "_")
        .replace(/\s+/g, "_")
    : null;

  const uploadDir = path.join(
    "uploads",
    "admission",
    String(safeYear),
    safeListType
  );
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const ext = path.extname(file.originalname) || ".jpg";
  const baseName = safeName
    ? `${safeListType}-${safeSerial}-${safeName}`
    : `${safeListType}-${safeSerial}`;
  let filename = `${baseName}${ext}`;
  let finalPath = path.join(uploadDir, filename);
  let counter = 1;
  while (fs.existsSync(finalPath)) {
    filename = `${baseName}(${counter})${ext}`;
    finalPath = path.join(uploadDir, filename);
    counter++;
  }

  try {
    fs.renameSync(file.path, finalPath);
    return finalPath;
  } catch (err) {
    try {
      fs.copyFileSync(file.path, finalPath);
      fs.unlinkSync(file.path);
      return finalPath;
    } catch (err2) {
      throw new Error(
        `Failed to save uploaded file: ${
          err2 && err2.message ? err2.message : err2
        }`
      );
    }
  }
};
export const createForm = async (req, res) => {
  try {
    const body = req.body || {};
    const settings = await prisma.admission.findFirst();
    const payload = {
      student_name_bn: body.studentNameBn || null,
      student_nick_name_bn: body.studentNickNameBn || null,
      student_name_en: body.studentNameEn || null,
      birth_reg_no: body.birthRegNo || null,
      registration_no: body.registration_no || null,

      father_name_bn: body.fatherNameBn || null,
      father_name_en: body.fatherNameEn || null,
      father_nid: body.fatherNid || null,
      father_phone: body.fatherPhone || null,

      mother_name_bn: body.motherNameBn || null,
      mother_name_en: body.motherNameEn || null,
      mother_nid: body.motherNid || null,
      mother_phone: body.motherPhone || null,

      birth_date: body.birthDate || null,
      birth_year: body.birthYear || null,
      birth_month: body.birthMonth || null,
      birth_day: body.birthDay || null,
      blood_group: body.bloodGroup || null,
      email: body.email || null,
      religion: body.religion || null,

      present_district: body.presentDistrict || null,
      present_upazila: body.presentUpazila || null,
      present_post_office: body.presentPostOffice || null,
      present_post_code: body.presentPostCode || null,
      present_village_road: body.presentVillageRoad || null,

      permanent_district: body.permanentDistrict || null,
      permanent_upazila: body.permanentUpazila || null,
      permanent_post_office: body.permanentPostOffice || null,
      permanent_post_code: body.permanentPostCode || null,
      permanent_village_road: body.permanentVillageRoad || null,

      guardian_name: body.guardianName || null,
      guardian_phone: body.guardianPhone || null,
      guardian_relation: body.guardianRelation || null,
      guardian_nid: body.guardianNid || null,
      guardian_district: body.guardianDistrict || null,
      guardian_upazila: body.guardianUpazila || null,
      guardian_post_office: body.guardianPostOffice || null,
      guardian_post_code: body.guardianPostCode || null,
      guardian_village_road: body.guardianVillageRoad || null,

      prev_school_name: body.prevSchoolName || null,
      prev_school_district: body.prevSchoolDistrict || null,
      prev_school_upazila: body.prevSchoolUpazila || null,
      section_in_prev_school: body.sectionInprevSchool || null,
      roll_in_prev_school: body.rollInprevSchool || null,
      prev_school_passing_year: body.prevSchoolPassingYear || null,

      father_profession: body.father_profession || null,
      mother_profession: body.mother_profession || null,
      parent_income: body.parent_income || null,

      admission_class: body.admissionClass || null,
      admission_year: settings.admission_year || null,
      list_type: body.listType || null,
      admission_user_id: body.admissionUserId || null,
      serial_no: body.serialNo || null,
      qouta: body.qouta || null,
      whatsapp_number: body.whatsappNumber || body.whatsapp_number || null,
    };

    const duplicates = await checkDuplicates(payload);
    if (duplicates.length > 0) {
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates,
        error: duplicates.reduce((acc, d) => {
          acc[d.field] = d.message;
          return acc;
        }, {}),
      });
    }
    if (
      (!payload.admission_year || payload.admission_year === null) &&
      settings &&
      settings.admission_year
    )
      payload.admission_year = settings.admission_year;
    let photoPath = null;
    if (req.file) {
      try {
        photoPath = await saveAdmissionPhoto(
          req.file,
          settings.admission_year,
          payload.list_type,
          payload.serial_no,
          payload.student_name_en || payload.student_name_bn
        );
      } catch (err) {
        if (req.file && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Photo save failed",
          error: err.message,
        });
      }
    }

    const dataToCreate = { ...payload, photo_path: photoPath };

    const rec = await prisma.admission_form.create({ data: dataToCreate });
    {
      const { id } = rec;
      const statusKey = `pdf:${id}:status`;
      await redis.set(statusKey, "generating");
      try {
        await pdfQueue.add({ admissionId: id });
      } catch (queueErr) {
        console.error(
          "Failed to add PDF job to queue:",
          queueErr && queueErr.message ? queueErr.message : queueErr
        );
        await redis.set(statusKey, "failed");
      }
    }
    res.status(201).json({
      success: true,
      message: "Admission form submitted",
      data: {
        id: rec.id,
        status: rec.status,
        submissionDate: rec.submission_date,
      },
    });
  } catch (error) {
    console.error("createForm error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: "Failed to submit form",
      error: error.message,
    });
  }
};

export const getForms = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (status && status !== "all") where.status = status;
    if (search) {
      where.OR = [
        { student_name_en: { contains: String(search), mode: "insensitive" } },
        { student_name_bn: { contains: String(search), mode: "insensitive" } },
        { birth_reg_no: { contains: String(search), mode: "insensitive" } },
        { registration_no: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.admission_form.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { created_at: "desc" },
      }),
      prisma.admission_form.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: items,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(total / Number(limit)),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("getForms error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch forms",
      error: error.message,
    });
  }
};

export const getFormById = async (req, res) => {
  try {
    const { id } = req.params;
    const rec = await prisma.admission_form.findUnique({ where: { id } });
    if (!rec)
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    res.status(200).json({ success: true, data: rec });
  } catch (error) {
    console.error("getFormById error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form",
      error: error.message,
    });
  }
};

export const updateForm = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    const settings = await prisma.admission.findFirst();
    const body = req.body || {};
    const payload = {
      student_name_bn: body.studentNameBn || null,
      student_nick_name_bn: body.studentNickNameBn || null,
      student_name_en: body.studentNameEn || null,
      birth_reg_no: body.birthRegNo || null,
      registration_no: body.registration_no || null,
      father_name_bn: body.fatherNameBn || null,
      father_name_en: body.fatherNameEn || null,
      father_nid: body.fatherNid || null,
      father_phone: body.fatherPhone || null,
      mother_name_bn: body.motherNameBn || null,
      mother_name_en: body.motherNameEn || null,
      mother_nid: body.motherNid || null,
      mother_phone: body.motherPhone || null,
      birth_date: body.birthDate || null,
      birth_year: body.birthYear || null,
      birth_month: body.birthMonth || null,
      birth_day: body.birthDay || null,
      blood_group: body.bloodGroup || null,
      email: body.email || null,
      religion: body.religion || null,
      present_district: body.presentDistrict || null,
      present_upazila: body.presentUpazila || null,
      present_post_office: body.presentPostOffice || null,
      present_post_code: body.presentPostCode || null,
      present_village_road: body.presentVillageRoad || null,

      permanent_district: body.permanentDistrict || null,
      permanent_upazila: body.permanentUpazila || null,
      permanent_post_office: body.permanentPostOffice || null,
      permanent_post_code: body.permanentPostCode || null,
      permanent_village_road: body.permanentVillageRoad || null,

      guardian_name: body.guardianName || null,
      guardian_phone: body.guardianPhone || null,
      guardian_relation: body.guardianRelation || null,
      guardian_nid: body.guardianNid || null,
      guardian_district: body.guardianDistrict || null,
      guardian_upazila: body.guardianUpazila || null,
      guardian_post_office: body.guardianPostOffice || null,
      guardian_post_code: body.guardianPostCode || null,
      guardian_village_road: body.guardianVillageRoad || null,

      prev_school_name: body.prevSchoolName || null,
      prev_school_district: body.prevSchoolDistrict || null,
      prev_school_upazila: body.prevSchoolUpazila || null,
      section_in_prev_school: body.sectionInprevSchool || null,
      roll_in_prev_school: body.rollInprevSchool || null,
      prev_school_passing_year: body.prevSchoolPassingYear || null,

      father_profession: body.father_profession || null,
      mother_profession: body.mother_profession || null,
      parent_income: body.parent_income || null,

      admission_class: body.admissionClass || null,
      admission_year: settings.admission_year,
      list_type: body.listType || null,
      admission_user_id: body.admissionUserId || null,
      serial_no: body.serialNo || null,
      qouta: body.qouta || null,
      whatsapp_number: body.whatsappNumber || body.whatsapp_number || null,
    };
    const duplicates = await checkDuplicates(payload, id);
    if (duplicates.length > 0) {
      if (req.file && fs.existsSync(req.file.path))
        fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates,
        error: duplicates.reduce((acc, d) => {
          acc[d.field] = d.message;
          return acc;
        }, {}),
      });
    }

    let photoPath = existing.photo_path;
    if (req.file) {
      try {
        if (existing.photo_path && fs.existsSync(existing.photo_path))
          fs.unlinkSync(existing.photo_path);
        photoPath = await saveAdmissionPhoto(
          req.file,
          settings.admission_year,
          payload.list_type,
          payload.serial_no,
          payload.student_name_en || payload.student_name_bn
        );
      } catch (err) {
        if (req.file && fs.existsSync(req.file.path))
          fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: "Photo save failed",
          error: err.message,
        });
      }
    }

    const updated = await prisma.admission_form.update({
      where: { id },
      data: { ...payload, photo_path: photoPath },
    });
    {
      const statusKey = `pdf:${id}:status`;
      await redis.set(statusKey, "generating");
      try {
        await pdfQueue.add({ admissionId: id });
      } catch (queueErr) {
        console.error(
          "Failed to add PDF job to queue:",
          queueErr && queueErr.message ? queueErr.message : queueErr
        );
        await redis.set(statusKey, "failed");
        // throw queueErr;
      }
    }
    res
      .status(200)
      .json({ success: true, message: "Form updated", data: updated });
  } catch (error) {
    console.error("updateForm error:", error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({
      success: false,
      message: "Failed to update form",
      error: error.message,
    });
  }
};

export const deleteForm = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    if (existing.photo_path && fs.existsSync(existing.photo_path))
      fs.unlinkSync(existing.photo_path);
    await prisma.admission_form.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Form deleted" });
  } catch (error) {
    console.error("deleteForm error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete form",
      error: error.message,
    });
  }
};

export const approveForm = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });

    const updated = await prisma.admission_form.update({
      where: { id },
      data: { status: "approved" },
    });
    res
      .status(200)
      .json({ success: true, message: "Form approved", data: updated });
  } catch (error) {
    console.error("approveForm error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve form",
      error: error.message,
    });
  }
};

export const pendingForm = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.admission_form.findUnique({ where: { id } });
    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    const updated = await prisma.admission_form.update({
      where: { id },
      data: { status: "pending" },
    });
    res.status(200).json({
      success: true,
      message: "Form marked as pending",
      data: updated,
    });
  } catch (error) {
    console.error("pendingForm error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark form as pending",
      error: error.message,
    });
  }
};

export const generateAdmissionPDF = async (admission) => {
  try {
    console.log(`Generating pdf for ${admission.id}`);

    const admissionSettings = await prisma.admission.findFirst();
    function normalizeClassKey(c) {
      if (!c) return "";
      const s = String(c).trim().toLowerCase();
      if (s === "6" || s.includes("6") || s.includes("six")) return "6";
      if (s === "7" || s.includes("7") || s.includes("seven")) return "7";
      if (s === "8" || s.includes("8") || s.includes("eight")) return "8";
      if (s === "9" || s.includes("9") || s.includes("nine")) return "9";
      return "";
    }
    const classNumMatch = String(admission.admission_class || "");
    const classNum = normalizeClassKey(classNumMatch);
    const sectionInstructions = admissionSettings?.instruction || null;
    const attachmentInstructions =
      (classNum &&
        admissionSettings?.[`attachment_instruction_class${classNum}`]) ||
      "-";

    const logoPath = path.join("public", "icon.jpg");
    const logoExists = fs.existsSync(logoPath);

    let logoBase64 = "";
    if (logoExists) {
      try {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoExtension = path.extname(logoPath).toLowerCase();
        const mimeType =
          logoExtension === ".png"
            ? "image/png"
            : logoExtension === ".jpg" || logoExtension === ".jpeg"
            ? "image/jpeg"
            : "image/png";
        logoBase64 = `data:${mimeType};base64,${logoBuffer.toString("base64")}`;
      } catch (logoError) {
        console.warn("Failed to load logo:", logoError);
      }
    }

    const solaimanLipiPath = path.join("public", "fonts", "SolaimanLipi.woff2");
    const timesNewRomanPath = path.join("public", "fonts", "times.ttf");

    function loadFontAsBase64(fontPath) {
      try {
        if (!fontPath || !fs.existsSync(fontPath)) return null;
        const buf = fs.readFileSync(fontPath);
        return buf.toString("base64");
      } catch (err) {
        console.warn(
          "Failed to load font:",
          fontPath,
          err && err.message ? err.message : err
        );
        return null;
      }
    }

    const solaimanLipiBase64 = loadFontAsBase64(solaimanLipiPath);
    const timesNewRomanBase64 = loadFontAsBase64(timesNewRomanPath);

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
      if (!text) return "";
      return text.normalize("NFC");
    }
    function handleList(text) {
      if (!text) return "";
      let normalizedText = text.normalize("NFC");
      normalizedText = normalizedText.replace(
        /([\u0980-\u09FF\u0964-\u096F]+)|([^\u0980-\u09FF\u0964-\u096F]+)/g,
        (_, bn, nonBn) => {
          if (bn) return `<span >${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return _;
        }
      );

      return normalizedText;
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
        }
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

    const studentDetailsRaw = [
      ["ছাত্রের নাম:", admission.student_name_bn || null],
      [
        "Student's Name:",
        admission.student_name_en
          ? admission.student_name_en.toUpperCase()
          : null,
      ],
      ["Birth Registration Number:", admission.birth_reg_no || null],
      ["Registration Number:", admission.registration_no || null],
      [
        "Date of Birth:",
        admission.birth_date ? formatDateLong(admission.birth_date) : null,
      ],
      ["Email Address:", admission.email || null],
      [
        "Mobile Numbers:",
        [admission.father_phone, admission.mother_phone]
          .filter(Boolean)
          .join(", ") || null,
      ],
      // ["Whatsapp Number:", admission.whatsapp_number || null],
      ["পিতার নাম:", admission.father_name_bn || null],
      [
        "Father's Name:",
        admission.father_name_en
          ? admission.father_name_en.toUpperCase()
          : null,
      ],
      ["Father's National ID Number:", admission.father_nid || null],
      ["মাতার নাম:", admission.mother_name_bn || null],
      [
        "Mother's Name:",
        admission.mother_name_en
          ? admission.mother_name_en.toUpperCase()
          : null,
      ],
      ["Mother's National ID Number:", admission.mother_nid || null],
      [
        "Guardian's Name:",
        [
          admission.guardian_name ? `Name: ${admission.guardian_name}` : null,
          admission.guardian_relation
            ? `Relation: ${admission.guardian_relation}`
            : null,
          admission.guardian_phone
            ? `Phone: ${admission.guardian_phone}`
            : null,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
      [
        "Guardian's Address:",
        joinAddr(
          admission.guardian_village_road,
          admission.guardian_post_office,
          admission.guardian_post_code,
          admission.guardian_upazila,
          admission.guardian_district
        ) || null,
      ],
      [
        "Permanent Address:",
        joinAddr(
          admission.permanent_village_road,
          admission.permanent_post_office,
          admission.permanent_post_code,
          admission.permanent_upazila,
          admission.permanent_district
        ) || null,
      ],
      [
        "Present Address:",
        joinAddr(
          admission.present_village_road,
          admission.present_post_office,
          admission.present_post_code,
          admission.present_upazila,
          admission.present_district
        ) || null,
      ],
      [
        "Previous School Name & Address:",
        [
          admission.prev_school_name,
          admission.prev_school_upazila,
          admission.prev_school_district,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
      [
        "Previous School Academic Info:",
        [
          admission.section_in_prev_school
            ? `Section: ${admission.section_in_prev_school}`
            : null,
          admission.roll_in_prev_school
            ? `Roll: ${admission.roll_in_prev_school}`
            : null,
          admission.prev_school_passing_year
            ? `Passing Year: ${admission.prev_school_passing_year}`
            : null,
        ]
          .filter(Boolean)
          .join(", ") || null,
      ],
    ];

    const studentDetails = studentDetailsRaw
      .map(([label, value]) => [label, value ? wrapBnEn(String(value)) : ""])
      .filter(
        ([, value]) =>
          value && value.trim() !== "" && value !== '<span class="en">No</span>'
      );

    let tableRows = "";
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });
    const defaultOngikar = `১. বিদ্যালয় কর্তৃক নির্ধারিত পোষাক (ইউনিফর্ম) পরে উপস্থিত থাকতে হবে।
                  ২. বিদ্যালয়ে নিয়মিত উপস্থিত থাকতে হবে এবং শ্রেণি কার্যক্রমে সক্রিয় অংশগ্রহণ করতে হবে।
                  ৩. মাথার চুল, হাত-পায়ের পরিচ্ছন্নতা সংক্রান্ত নিয়ম মেনে চলবে এবং নির্ধারিত নিয়ম অনুযায়ী হবে।
                  ৪. বিদ্যালয়ের স্থাপত্য ও সকল নিয়মাবলী যথাযথভাবে মেনে চলতে হবে এবং বিদ্যালয়ের পরিবেশ সুপরিচ্ছন্ন রাখা হবে।
                  ৫. বিদ্যালয়ের শিষ্টাচার ও আচরণবিধি মেনে চলতে হবে; লজ্জাজনক বা অশোভন আচরণ করলে প্রয়োজনীয় শাস্তিমূলক ব্যবস্থা নেওয়া হবে।
                  ৬. উপরোক্ত শর্তাবলী বা বিদ্যালয়ের নিয়ম লঙ্ঘন করলে ভর্তি বাতিলসহ কর্তৃপক্ষ অনুযায়ী সিদ্ধান্ত নেওয়া হবে।`;

    const ongikar =
      admissionSettings && admissionSettings.ingikar
        ? String(admissionSettings.ingikar)
        : defaultOngikar;
    const schoolName = "Panchbibi Lal Bihari Pilot Govt. High School";
    const schoolAddr = "Panchbibi, Joypurhat";
    const schoolWeb = "www.lbphs.gov.bd";
    const admission_year = admission.admission_year || "";

    // prepare display strings for title: use list_type, admission_class and admission_year
    const admission_class_raw = admission.admission_class || "";
    const list_type_raw = admission.list_type || "";
    // const numToWord = {
    //   1: "One",
    //   2: "Two",
    //   3: "Three",
    //   4: "Four",
    //   5: "Five",
    //   6: "Six",
    //   7: "Seven",
    //   8: "Eight",
    //   9: "Nine",
    //   10: "Ten",
    //   11: "Eleven",
    //   12: "Twelve",
    // };
    const admission_class_display = String(admission_class_raw).trim();
    // ? numToWord[String(admission_class_raw).trim()] ||
    //   String(admission_class_raw)
    // : "";
    const list_type_display = String(list_type_raw)
      .trim()
      .replace(/(^|\s)\S/g, (s) => s.toUpperCase());

    const titleLabel = `Student's Information for Admission ${
      list_type_display ? `(${list_type_display})` : ""
    }${admission_class_display ? ` in Class ${admission_class_display}` : ""}${
      admission_year ? ` ${admission_year}` : ""
    }`;
    // formatQuota is defined at module scope for reuse across PDF/Excel generators

    const slNoRaw = admission.serial_no || "";
    const registrationRaw = admission.registration_no || "";
    const admissionUserIdRaw = admission.admission_user_id || "";
    const quotaRaw = wrapBnEn(formatQuota(admission.qouta)) || "";

    const slNoDisplay = String(slNoRaw).trim();
    const registrationDisplay = String(registrationRaw).trim();
    const admissionUserIdDisplay = String(admissionUserIdRaw).trim();
    const quotaDisplay = String(quotaRaw)
      .trim()
      .replace(/(^|\s)\S/g, (s) => s.toUpperCase());
    const religionDisplay = admission.religion || "";

    const currentDateTime = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
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
  <title>${titleLabel || "Admission Form"}</title>
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
      padding: 0 0 100px 0;
      min-height: 0;
      height: calc(100vh - 100px);
      overflow: hidden;
      font-size: 1rem;
    }
    
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
      font-size: 0.95rem;
    }
    .en, .en * {
      font-family: ${
        timesNewRomanBase64
          ? "'TimesNewRoman', 'Times New Roman'"
          : "'Times New Roman'"
      }, serif !important;
      letter-spacing: 0.02em;
      font-size: .95rem;
    }
    
    * {
      unicode-bidi: bidi-override;
      direction: ltr;
      font-size: 1rem;
    }
    
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
      font-size: 1rem; 
      font-weight: bold; 
      margin-bottom: 6px;
      line-height: 1.3;
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
      font-size: 0.9rem;
      line-height: 1;
      text-align: justify;
    }
    .instructions-title {
      font-weight: bold;
      color: #8b5a00;
      margin-bottom: 8px;
      font-size: 1rem;
      line-height: 1;
    }
    .instructions-content {
      white-space: pre-line;
      text-align: justify;
      line-height: 0.9;
      font-size: 0.9rem;
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
    .footer .note .b {
      font-weight: 400;
      margin-bottom: 4px;
      font-size: 1rem;
    }
    .footer .note .bn {
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
      font-size: 1rem;
      white-space: pre-wrap;
    }
    .footer .note .en {
      font-family: ${
        timesNewRomanBase64 ? "'TimesNewRoman'" : "'Times New Roman'"
      }, serif !important;
      font-size: 1rem;
    }
    .document-list {
      margin-top: 6px;
      padding-left: 0;
      font-size: 0.98rem;
    }
    .document-list .bn {
      display: block;
      font-size: 0.98rem;
      line-height: 1.02;
      white-space: pre-line;
      margin-bottom: 3px;
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali'"
          : "'Noto Sans Bengali'"
      }, sans-serif !important;
    }
    .document-list .bn.document-list-title,
    .document-list-title.bn,
    .document-list-title {
      font-weight: 600 !important;
      font-size: 0.9rem !important;
      display: block !important;
      margin-bottom: 1px !important;
      font-family: ${
        solaimanLipiBase64
          ? "'SolaimanLipi', 'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
          : "'Noto Sans Bengali', 'Mukti', 'Solaiman Lipi'"
      }, sans-serif !important;
    }
    .footer .note p {
      margin: 4px 0;
      line-height: 1.05;
      font-size: 0.95rem;
    }
    .instructions-section {
      border: 1px solid #000;
      border-radius: 4px;
      padding: 10px;
      margin: 6px 0;
      font-size: 0.9rem;
      text-align: justify;
    }
    .signature-row {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 20px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 8px;
      background: white;
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
      margin-bottom: 0px;
      width: 95%;
      height: 6px;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-label {
      font-size: 1rem;
      font-weight: 500;
      margin-top: 0px;
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
      font-size: 0.75rem;
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
        ${titleLabel}
      </div>
      <div class="section-row"> 
  <span class="en">SL No:</span> <span class="en">${slNoDisplay}</span>,
  ${
    registrationDisplay
      ? `<span class="en"> Reg No:</span> <span class="en">${registrationDisplay}</span>,`
      : ""
  }
  <span class="en"> User ID:</span> <span class="en">${admissionUserIdDisplay}</span>,
        <span class="en"> Quota:</span> ${quotaDisplay},
        <span class="en"> Religion:</span> ${wrapBnEn(religionDisplay)}
      </div>
      <table>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
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
            <span class="bn document-list-title">* প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:</span>
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
          <p style="font-size:1rem; margin-top:8px;">
          * পূর্ববর্তী বিদ্যালয়ের মূল ছাড়পত্র ভর্তির সময় দিতে না পারলে পরীক্ষার ফল প্রকাশের পর অবশ্যই জমা দিতে হবে। অন্যথায় ভর্তি বাতিল হবে।
          </br>
          ** ভর্তির সময় উল্লিখিত সকল কাগজপত্রের মূলকপি অবশ্যই ভর্তি কমিটিকে দেখাতে হবে।
          </p>
          <div style="margin-top:8px;">
            <div class="bn" style="font-weight:700 !important; font-size:1.05rem; text-align:center; display:block;">ছাত্রের অঙ্গীকারনামা</div>
            ${
              ongikar
                ? `
              <div class="instructions-section">
                <div class="instructions-content">${wrapBnEn(ongikar)}</div>
              </div>
              `
                : ""
            }
          </div>
        </div>
      </div>
    </div>
    <div class="signature-row bn" style="gap: 8px; padding-bottom: 0px;">
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
    const launchOptions = {
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
    };
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    let browser = null;
    const page = null;
    // keys to record worker-side status/errors when called directly or from worker
    const statusKey = `pdf:${admission.id}:status`;
    const errorKey = `pdf:${admission.id}:error`;
    try {
      try {
        browser = await puppeteer.launch(launchOptions);
      } catch (launchErr) {
        console.error(
          "Puppeteer launch failed for admissionId:",
          admission.id,
          launchErr && launchErr.stack ? launchErr.stack : launchErr
        );
        try {
          await redis.set(statusKey, "failed");
          await redis.set(
            errorKey,
            `launch error: ${
              launchErr && launchErr.stack ? launchErr.stack : launchErr
            }`
          );
        } catch (rErr) {
          console.error(
            "Failed to write launch error to Redis:",
            rErr && rErr.message ? rErr.message : rErr
          );
        }
        throw launchErr;
      }
      const page = await browser.newPage();

      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
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
          false
        );

        let node;
        while ((node = walker.nextNode())) {
          if (node.nodeValue) {
            node.nodeValue = node.nodeValue.normalize("NFC");
          }
        }

        return new Promise((resolve) => {
          if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => {
              setTimeout(resolve, 1000);
            });
          } else {
            setTimeout(resolve, 2000);
          }
        });
      });

      let pdfBuffer;
      try {
        pdfBuffer = await page.pdf({
          format: "legal",
          printBackground: true,
          margin: { top: 24, bottom: 24, left: 24, right: 24 },
          preferCSSPageSize: true,
          pageRanges: "1",
        });
      } catch (pdfErr) {
        console.error(
          "page.pdf failed for admissionId:",
          admission.id,
          pdfErr && pdfErr.stack ? pdfErr.stack : pdfErr
        );
        try {
          await redis.set(statusKey, "failed");
          await redis.set(
            errorKey,
            `pdf render error: ${
              pdfErr && pdfErr.stack ? pdfErr.stack : pdfErr
            }`
          );
        } catch (rErr) {
          console.error(
            "Failed to write pdf error to Redis:",
            rErr && rErr.message ? rErr.message : rErr
          );
        }
        throw pdfErr;
      }
      console.log(pdfBuffer);

      // let buf;
      // try {
      //   if (Buffer.isBuffer(pdfBuffer)) {
      //     buf = pdfBuffer;
      //   } else if (
      //     typeof ArrayBuffer !== "undefined" &&
      //     ArrayBuffer.isView(pdfBuffer)
      //   ) {
      //     buf = Buffer.from(
      //       pdfBuffer.buffer
      //         ? new Uint8Array(
      //             pdfBuffer.buffer,
      //             pdfBuffer.byteOffset || 0,
      //             pdfBuffer.byteLength || pdfBuffer.length
      //           )
      //         : pdfBuffer
      //     );
      //   } else if (pdfBuffer instanceof ArrayBuffer) {
      //     buf = Buffer.from(new Uint8Array(pdfBuffer));
      //   } else if (Array.isArray(pdfBuffer)) {
      //     buf = Buffer.from(pdfBuffer);
      //   } else if (typeof pdfBuffer === "string") {
      //     try {
      //       buf = Buffer.from(pdfBuffer, "base64");
      //     } catch (e) {
      //       buf = Buffer.from(pdfBuffer);
      //     }
      //   } else if (pdfBuffer && typeof pdfBuffer === "object") {
      //     // Handle various object shapes that can represent binary data:
      //     // - { type: 'Buffer', data: [...] }
      //     // - { data: Uint8Array } or { data: { data: [...] } }
      //     // - { buffer: ArrayBuffer | TypedArray }
      //     // - toJSON() result of a Buffer
      //     try {
      //       // Buffer.toJSON() style
      //       if (pdfBuffer.type === "Buffer" && Array.isArray(pdfBuffer.data)) {
      //         buf = Buffer.from(pdfBuffer.data);
      //       }

      //       // Direct .data which may be TypedArray, ArrayBuffer, or plain array
      //       if (!buf && pdfBuffer.data) {
      //         const d = pdfBuffer.data;
      //         if (Buffer.isBuffer(d)) buf = d;
      //         else if (ArrayBuffer.isView(d)) {
      //           buf = Buffer.from(
      //             d.buffer
      //               ? new Uint8Array(
      //                   d.buffer,
      //                   d.byteOffset || 0,
      //                   d.byteLength || d.length
      //                 )
      //               : d
      //           );
      //         } else if (d instanceof ArrayBuffer)
      //           buf = Buffer.from(new Uint8Array(d));
      //         else if (Array.isArray(d)) buf = Buffer.from(d);
      //         else if (
      //           typeof d === "object" &&
      //           d !== null &&
      //           Array.isArray(d.data)
      //         ) {
      //           // nested { data: { data: [...] } }
      //           buf = Buffer.from(d.data);
      //         }
      //       }

      //       // .buffer property (could be ArrayBuffer or TypedArray.buffer)
      //       if (!buf && pdfBuffer.buffer) {
      //         const b = pdfBuffer.buffer;
      //         if (Buffer.isBuffer(b)) buf = b;
      //         else if (ArrayBuffer.isView(b))
      //           buf = Buffer.from(new Uint8Array(b.buffer || b));
      //         else if (b instanceof ArrayBuffer)
      //           buf = Buffer.from(new Uint8Array(b));
      //       }

      //       // toJSON() result might be nested elsewhere
      //       if (!buf && typeof pdfBuffer.toJSON === "function") {
      //         try {
      //           const json = pdfBuffer.toJSON();
      //           if (json && Array.isArray(json.data))
      //             buf = Buffer.from(json.data);
      //         } catch (e) {
      //           // ignore
      //         }
      //       }

      //       // As a last resort, gather numeric values from enumerable properties
      //       if (!buf) {
      //         const nums = [];
      //         for (const val of Object.values(pdfBuffer)) {
      //           if (typeof val === "number") nums.push(val);
      //           else if (
      //             Array.isArray(val) &&
      //             val.every((x) => typeof x === "number")
      //           ) {
      //             nums.push(...val);
      //           }
      //         }
      //         if (nums.length >= 4) buf = Buffer.from(nums);
      //       }
      //     } catch (inner) {
      //       console.warn(
      //         "generateAdmissionPDF: object->Buffer conversion failed:",
      //         inner && inner.message ? inner.message : inner
      //       );
      //     }
      //   }
      // } catch (convErr) {
      //   console.warn(
      //     "generateAdmissionPDF: conversion to Buffer failed:",
      //     convErr && convErr.message ? convErr.message : convErr
      //   );
      // }

      // if (!buf || !Buffer.isBuffer(buf) || buf.length < 4) {
      //   throw new Error(
      //     `generateAdmissionPDF: invalid pdf buffer returned (type=${typeof pdfBuffer})`
      //   );
      // }

      console.log(
        "PDF generated for admission ID:",
        admission.id,
        "bytes=",
        pdfBuffer.length
      );
      return pdfBuffer;
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch (closeErr) {
          console.warn(
            "Failed to close browser after PDF generation:",
            closeErr && closeErr.message ? closeErr.message : closeErr
          );
        }
      }
    }
    // res.setHeader("Content-Type", "application/pdf");
    // const filenameNamePart = admission.student_name_en
    //   ? String(admission.student_name_en).replace(/[^a-zA-Z0-9-_\. ]/g, "_")
    //   : admission.roll || admission.id;
    // res.setHeader(
    //   "Content-Disposition",
    //   `attachment; filename="Admission_${filenameNamePart}.pdf"`
    // );
    // res.end(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    // Re-throw so callers (workers / request handlers) can detect failure
    throw error;
    // res.status(500).json({
    //   success: false,
    //   message: "Failed to generate PDF",
    //   error: error.message,
    // });
  }
};

export const exportAllAdmissionsExcel = async (req, res) => {
  try {
    const { status, search, admission_year, class: admissionClass } = req.query;
    const where = {};
    if (status && status !== "all") where.status = status;
    if (admission_year) {
      const yearNum = Number(admission_year);
      where.admission_year = yearNum;
    }
    if (admissionClass) where.admission_class = admissionClass;
    if (search) {
      where.OR = [
        { student_name_en: { contains: String(search), mode: "insensitive" } },
        { student_name_bn: { contains: String(search), mode: "insensitive" } },
        { birth_reg_no: { contains: String(search), mode: "insensitive" } },
      ];
    }

    const items = await prisma.admission_form.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
    let columns = [];
    if (items && items.length > 0) {
      columns = Object.keys(items[0]);
    } else {
      columns = [
        "id",
        "student_name_bn",
        "student_nick_name_bn",
        "student_name_en",
        "birth_reg_no",
        "registration_no",
        "father_name_bn",
        "father_name_en",
        "father_nid",
        "father_phone",
        "mother_name_bn",
        "mother_name_en",
        "mother_nid",
        "mother_phone",
        "birth_date",
        "birth_year",
        "birth_month",
        "birth_day",
        "blood_group",
        "email",
        "religion",
        "present_district",
        "present_upazila",
        "present_post_office",
        "present_post_code",
        "present_village_road",
        "permanent_district",
        "permanent_upazila",
        "permanent_post_office",
        "permanent_post_code",
        "permanent_village_road",
        "guardian_name",
        "guardian_phone",
        "guardian_relation",
        "guardian_nid",
        "guardian_district",
        "guardian_upazila",
        "guardian_post_office",
        "guardian_post_code",
        "guardian_village_road",
        "prev_school_name",
        "prev_school_district",
        "prev_school_upazila",
        "section_in_prev_school",
        "roll_in_prev_school",
        "prev_school_passing_year",
        "father_profession",
        "mother_profession",
        "parent_income",
        "admission_class",
        "list_type",
        "admission_user_id",
        "serial_no",
        "qouta",
        "whatsapp_number",
        "photo_path",
        "status",
        "submission_date",
        "created_at",
        "updated_at",
      ];
    }

    const rows = [columns];
    items.forEach((a) => {
      const row = columns.map((col) => {
        let val = a[col];
        if (col === "qouta") {
          val = formatQuota(val);
        }
        if (val instanceof Date) return val.toISOString();
        if (val === null || typeof val === "undefined") return "";
        return String(val);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const colWidths = [];
    rows.forEach((r) => {
      r.forEach((cell, idx) => {
        const l = cell ? String(cell).length : 0;
        colWidths[idx] = Math.max(colWidths[idx] || 10, l + 2);
      });
    });
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admissions");
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="admissions_export_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`
    );
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Bulk Excel generation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to export Excel",
      error: error.message,
    });
  }
};

export const exportAdmissionImagesZip = async (req, res) => {
  try {
    const { admission_year } = req.query;
    let yearNum = null;
    if (
      typeof admission_year !== "undefined" &&
      admission_year !== null &&
      String(admission_year).trim() !== ""
    ) {
      yearNum = Number(admission_year);
      if (isNaN(yearNum)) yearNum = null;
    }

    const uploadsBase = path.join(process.cwd(), "uploads", "admission");
    if (!fs.existsSync(uploadsBase)) {
      return res.status(404).json({
        success: false,
        message: "No admission uploads directory found",
      });
    }

    const fileName =
      yearNum !== null
        ? `admission_images_${String(yearNum)}.zip`
        : `admission_images_all_years.zip`;

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      console.error("Archiver error:", err);
      if (!res.headersSent)
        res.status(500).json({
          success: false,
          message: "Failed to create archive",
          error: err.message,
        });
    });
    archive.pipe(res);

    if (yearNum !== null) {
      const targetDir = path.join(uploadsBase, String(yearNum));
      if (!fs.existsSync(targetDir)) {
        return res.status(404).json({
          success: false,
          message: `No uploads found for year ${yearNum}`,
        });
      }
      archive.directory(targetDir, String(yearNum));
    } else {
      const entries = fs.readdirSync(uploadsBase, { withFileTypes: true });
      const dirs = entries.filter((d) => d.isDirectory());
      const files = entries.filter((d) => d.isFile());

      if (dirs.length === 0 && files.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "No admission uploads found" });
      }

      for (const d of dirs) {
        const dirPath = path.join(uploadsBase, d.name);
        archive.directory(dirPath, d.name);
      }
      for (const f of files) {
        const filePath = path.join(uploadsBase, f.name);
        archive.file(filePath, { name: f.name });
      }
    }

    await archive.finalize();
  } catch (error) {
    console.error("exportAdmissionImagesZip error:", error);
    if (!res.headersSent)
      res.status(500).json({
        success: false,
        message: "Failed to export images",
        error: error.message,
      });
  }
};

export const downloadPDF = async (req, res) => {
  const { id } = req.params;
  // const admission = await prisma.admission_form.findUnique({
  //   where: { id: id },
  // });
  // if (!admission) {
  //   return res.status(404).json({ error: "Admission not found" });
  // }
  // const pdfBuffer = await generateAdmissionPDF(admission);
  // res.setHeader("Content-Type", "application/pdf");
  // res.end(pdfBuffer);
  const statusKey = `pdf:${id}:status`;
  const pdfKey = `pdf:${id}`;
  try {
    let status = await redis.get(statusKey);
    console.log(status);
    if (status !== "done") {
      if (status !== "generating") {
        await redis.set(statusKey, "generating");
        await pdfQueue.add({ admissionId: id });
      }
      await waitForJobCompletion(id);
    }
    const b64 = await redis.get(pdfKey);
    if (!b64) {
      return res
        .status(500)
        .json({ success: false, message: "PDF not available" });
    }

    const pdfBuffer = Buffer.from(b64, "base64");
    if (
      !pdfBuffer ||
      pdfBuffer.length < 4 ||
      pdfBuffer.indexOf(Buffer.from("%PDF")) === -1
    ) {
      return res
        .status(500)
        .json({ success: false, message: "Invalid PDF data" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Admission_${id}.pdf"`
    );
    return res.end(pdfBuffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
function waitForJobCompletion(admissionId, timeout = 90000) {
  return new Promise((resolve, reject) => {
    const checkInterval = 1000;
    let elapsed = 0;
    const interval = setInterval(async () => {
      elapsed += checkInterval;
      const status = await redis.get(`pdf:${admissionId}:status`);
      if (status === "done") {
        clearInterval(interval);
        return resolve();
      }
      if (status === "failed") {
        const errorKey = `pdf:${admissionId}:error`;
        const msg = await redis.get(errorKey);
        clearInterval(interval);
        return reject(new Error(msg || "PDF generation failed"));
      }
      if (elapsed >= timeout) {
        clearInterval(interval);
        return reject(new Error("PDF generation timeout"));
      }
    }, checkInterval);

    const onCompleted = (job) => {
      if (job.data.admissionId === admissionId) {
        pdfQueue.off("completed", onCompleted);
        pdfQueue.off("failed", onFailed);
        clearInterval(interval);
        resolve();
      }
    };
    const onFailed = (job, err) => {
      if (job.data.admissionId === admissionId) {
        pdfQueue.off("completed", onCompleted);
        pdfQueue.off("failed", onFailed);
        clearInterval(interval);
        reject(err);
      }
    };

    pdfQueue.on("completed", onCompleted);
    pdfQueue.on("failed", onFailed);
  });
}
