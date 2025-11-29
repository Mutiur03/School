import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import XLSX from "xlsx";

// Normalize/format quota strings for display in PDFs/Excels
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

const saveAdmissionPhoto = async (file, year) => {
  if (!file) return null;
  if (!fs.existsSync(file.path)) {
    throw new Error(`File not found: ${file.path}`);
  }

  const uploadDir = path.join(
    "uploads",
    "admission",
    `${year || new Date().getFullYear()}`
  );
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const ext = path.extname(file.originalname) || ".jpg";
  const filename = `photo-${Date.now()}-${Math.round(
    Math.random() * 1e9
  )}${ext}`;
  const finalPath = path.join(uploadDir, filename);

  fs.renameSync(file.path, finalPath);
  return finalPath;
};

const checkDuplicates = async (data, excludeId = null) => {
  const duplicates = [];
  if (data.birth_reg_no) {
    const existing = await prisma.admission_form.findFirst({
      where: {
        birth_reg_no: data.birth_reg_no,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, student_name_en: true },
    });
    if (existing)
      duplicates.push({
        field: "birthRegNo",
        message: "Birth registration number already exists",
        existingRecord: existing,
      });
  }
  if (data.admission_user_id) {
    const existing = await prisma.admission_form.findFirst({
      where: {
        admission_user_id: data.admission_user_id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, student_name_en: true },
    });
    if (existing)
      duplicates.push({
        field: "admissionUserId",
        message: "Admission user id already exists",
        existingRecord: existing,
      });
  }

  if (data.serial_no) {
    const existing = await prisma.admission_form.findFirst({
      where: {
        serial_no: data.serial_no,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, student_name_en: true },
    });
    if (existing)
      duplicates.push({
        field: "serialNo",
        message: "Serial number already exists",
        existingRecord: existing,
      });
  }
  return duplicates;
};

export const createForm = async (req, res) => {
  try {
    const body = req.body || {};

    const payload = {
      student_name_bn: body.studentNameBn || null,
      student_nick_name_bn: body.studentNickNameBn || null,
      student_name_en: body.studentNameEn || null,
      birth_reg_no: body.birthRegNo || null,

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
      list_type: body.listType || null,
      admission_user_id: body.admissionUserId || null,
      serial_no: body.serialNo || null,
      qouta: body.qouta || null,
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
    const settings = await prisma.admission.findFirst();
    let photoPath = null;
    if (req.file) {
      try {
        photoPath = await saveAdmissionPhoto(req.file, settings.admission_year);
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

    const body = req.body || {};
    const payload = {
      student_name_bn: body.studentNameBn || existing.student_name_bn,
      student_nick_name_bn:
        body.studentNickNameBn || existing.student_nick_name_bn,
      student_name_en: body.studentNameEn || existing.student_name_en,
      birth_reg_no: body.birthRegNo || existing.birth_reg_no,
      father_name_bn: body.fatherNameBn || existing.father_name_bn,
      father_name_en: body.fatherNameEn || existing.father_name_en,
      father_nid: body.fatherFid || existing.father_nid,
      father_phone: body.fatherPhone || existing.father_phone,
      mother_name_bn: body.motherNameBn || existing.mother_name_bn,
      mother_name_en: body.motherNameEn || existing.mother_name_en,
      mother_nid: body.motherNid || existing.mother_nid,
      mother_phone: body.motherPhone || existing.mother_phone,
      birth_date: body.birthDate || existing.birth_date,
      birth_year: body.birthYear || existing.birth_year,
      birth_month: body.birthMonth || existing.birth_month,
      birth_day: body.birthDay || existing.birth_day,
      blood_group: body.bloodGroup || existing.blood_group,
      email: body.email || existing.email,
      // preserve or update religion
      religion: body.religion || existing.religion,

      present_district: body.presentDistrict || existing.present_district,
      present_upazila: body.presentUpazila || existing.present_upazila,
      present_post_office:
        body.presentPostOffice || existing.present_post_office,
      present_post_code: body.presentPostCode || existing.present_post_code,
      present_village_road:
        body.presentVillageRoad || existing.present_village_road,

      permanent_district: body.permanentDistrict || existing.permanent_district,
      permanent_upazila: body.permanentUpazila || existing.permanent_upazila,
      permanent_post_office:
        body.permanentPostOffice || existing.permanent_post_office,
      permanent_post_code:
        body.permanentPostCode || existing.permanent_post_code,
      permanent_village_road:
        body.permanentVillageRoad || existing.permanent_village_road,

      guardian_name: body.guardianName || existing.guardian_name,
      guardian_phone: body.guardianPhone || existing.guardian_phone,
      guardian_relation: body.guardianRelation || existing.guardian_relation,
      guardian_nid: body.guardianNid || existing.guardian_nid,
      guardian_district: body.guardianDistrict || existing.guardian_district,
      guardian_upazila: body.guardianUpazila || existing.guardian_upazila,
      guardian_post_office:
        body.guardianPostOffice || existing.guardian_post_office,
      guardian_post_code: body.guardianPostCode || existing.guardian_post_code,
      guardian_village_road:
        body.guardianVillageRoad || existing.guardian_village_road,

      prev_school_name: body.prevSchoolName || existing.prev_school_name,
      prev_school_district:
        body.prevSchoolDistrict || existing.prev_school_district,
      prev_school_upazila:
        body.prevSchoolUpazila || existing.prev_school_upazila,
      section_in_prev_school:
        body.sectionInprevSchool || existing.section_in_prev_school,
      roll_in_prev_school:
        body.rollInprevSchool || existing.roll_in_prev_school,
      prev_school_passing_year:
        body.prevSchoolPassingYear || existing.prev_school_passing_year,

      father_profession: body.father_profession || existing.father_profession,
      mother_profession: body.mother_profession || existing.mother_profession,
      parent_income: body.parent_income || existing.parent_income,

      admission_class: body.admissionClass || existing.admission_class,
      list_type: body.listType || existing.list_type,
      admission_user_id: body.admissionUserId || existing.admission_user_id,
      serial_no: body.serialNo || existing.serial_no,
      qouta: body.qouta || existing.qouta,
    };
    // check duplicates (exclude current record)
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

    // handle photo

    const settings = await prisma.admission.findFirst();

    let photoPath = existing.photo_path;
    if (req.file) {
      try {
        if (existing.photo_path && fs.existsSync(existing.photo_path))
          fs.unlinkSync(existing.photo_path);
        photoPath = await saveAdmissionPhoto(req.file, settings.admission_year);
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

export const generateAdmissionPDF = async (req, res) => {
  try {
    console.log("Generating PDF for Admission ID:", req.params.id);

    const { id } = req.params;
    const admission = await prisma.admission_form.findUnique({ where: { id } });

    if (!admission) {
      return res.status(404).json({
        success: false,
        message: "Admission not found",
      });
    }

    const admissionSettings = await prisma.admission.findFirst();

    const sectionInstructions = admissionSettings?.section_instructions || null;
    const attachmentInstructions =
      admissionSettings?.attachment_instruction || null;

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
    const admissionUserIdRaw = admission.admission_user_id || "";
    const quotaRaw = wrapBnEn(formatQuota(admission.qouta)) || "";

    const slNoDisplay = String(slNoRaw).trim();
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
      font-size: 1rem;
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
      margin-top: 8px;
      padding-left: 0;
      font-size: 1rem;
    }
    .document-list .bn {
      display: block;
      font-size: 1rem;
      line-height: 1;
      white-space: pre;
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
      height: 12px;
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
        ${titleLabel}
      </div>
      <div class="section-row">
        <span class="en">SL No:</span> <span class="en">${slNoDisplay}</span>,
        <span class="en"> User ID:</span> <span class="en">${admissionUserIdDisplay}</span>,
        <span class="en"> Quota:</span> ${quotaDisplay},
        <span class="en"> Religion:</span> ${wrapBnEn(religionDisplay)}
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

    // Set user agent and locale for Bengali
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Enable UTF-8 encoding and Bengali locale
    await page.setExtraHTTPHeaders({
      "Accept-Charset": "utf-8",
      "Accept-Language": "bn-BD,bn;q=0.9,en;q=0.8",
    });

    await page.setContent(html, {
      waitUntil: ["networkidle0", "domcontentloaded"],
    });

    // Force font loading and Unicode normalization
    await page.evaluate(() => {
      // Normalize all text content
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
            // Additional wait for proper Bengali rendering
            setTimeout(resolve, 1000);
          });
        } else {
          setTimeout(resolve, 2000);
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
    console.log("PDF generated for admission ID:", id);

    res.setHeader("Content-Type", "application/pdf");
    const filenameNamePart = admission.student_name_en
      ? String(admission.student_name_en).replace(/[^a-zA-Z0-9-_\. ]/g, "_")
      : admission.roll || id;
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Admission_${filenameNamePart}.pdf"`
    );
    res.end(pdfBuffer);
  } catch (error) {
    console.error("PDF generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate PDF",
      error: error.message,
    });
  }
};

export const generateAdmissionExcel = async (req, res) => {
  try {
    const { id } = req.params;
    const admission = await prisma.admission_form.findUnique({ where: { id } });
    if (!admission) {
      return res
        .status(404)
        .json({ success: false, message: "Admission not found" });
    }

    const rows = [
      ["Field", "Value"],
      ["Student Name (BN)", admission.student_name_bn || ""],
      ["Student Name (EN)", admission.student_name_en || ""],
      ["Birth Registration Number", admission.birth_reg_no || ""],
      ["Date of Birth", admission.birth_date || ""],
      ["Email", admission.email || ""],
      ["Father Name (BN)", admission.father_name_bn || ""],
      ["Father Name (EN)", admission.father_name_en || ""],
      ["Father NID", admission.father_nid || ""],
      ["Father Phone", admission.father_phone || ""],
      ["Mother Name (BN)", admission.mother_name_bn || ""],
      ["Mother Name (EN)", admission.mother_name_en || ""],
      ["Mother NID", admission.mother_nid || ""],
      ["Mother Phone", admission.mother_phone || ""],
      [
        "Present Address",
        [
          admission.present_village_road,
          admission.present_post_office,
          admission.present_post_code,
          admission.present_upazila,
          admission.present_district,
        ]
          .filter(Boolean)
          .join(", ") || "",
      ],
      [
        "Permanent Address",
        [
          admission.permanent_village_road,
          admission.permanent_post_office,
          admission.permanent_post_code,
          admission.permanent_upazila,
          admission.permanent_district,
        ]
          .filter(Boolean)
          .join(", ") || "",
      ],
      ["Guardian Name", admission.guardian_name || ""],
      ["Guardian Phone", admission.guardian_phone || ""],
      ["Guardian Relation", admission.guardian_relation || ""],
      ["Previous School", admission.prev_school_name || ""],
      ["Previous School District", admission.prev_school_district || ""],
      ["Previous School Upazila", admission.prev_school_upazila || ""],
      ["Previous School Section", admission.section_in_prev_school || ""],
      ["Previous School Roll", admission.roll_in_prev_school || ""],
      [
        "Previous School Passing Year",
        admission.prev_school_passing_year || "",
      ],
      ["Admission Class", admission.admission_class || ""],
      ["List Type", admission.list_type || ""],
      ["Admission User ID", admission.admission_user_id || ""],
      ["Serial No", admission.serial_no || ""],
      ["Quota", formatQuota(admission.qouta) || ""],
      ["Status", admission.status || ""],
      ["Submission Date", admission.submission_date || ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Auto-width columns (lightweight): compute max length per column
    const colWidths = [];
    rows.forEach((r) => {
      r.forEach((cell, idx) => {
        const l = cell ? String(cell).length : 0;
        colWidths[idx] = Math.max(colWidths[idx] || 10, l + 2);
      });
    });
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Admission");

    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    const filenameNamePart = admission.student_name_en
      ? String(admission.student_name_en).replace(/[^a-zA-Z0-9-_\. ]/g, "_")
      : id;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Admission_${filenameNamePart}.xlsx"`
    );

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Excel generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Excel",
      error: error.message,
    });
  }
};

export const exportAllAdmissionsExcel = async (req, res) => {
  try {
    const { status, search, admission_year, class: admissionClass } = req.query;
    const where = {};
    if (status && status !== "all") where.status = status;
    if (admission_year) {
      const yearNum = Number(admission_year);
      if (!isNaN(yearNum)) {
        const gte = new Date(Date.UTC(yearNum, 0, 1));
        const lt = new Date(Date.UTC(yearNum + 1, 0, 1));
        where.created_at = { gte, lt };
      }
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

    // Export every column from the admission_form table as separate Excel columns.
    // Prefer using returned item keys (keeps DB order returned by Prisma). If no items,
    // fall back to a schema-aware column list to keep headers predictable.
    let columns = [];
    if (items && items.length > 0) {
      // collect union of keys in first record (Prisma returns all model fields)
      columns = Object.keys(items[0]);
    } else {
      columns = [
        "id",
        "student_name_bn",
        "student_nick_name_bn",
        "student_name_en",
        "birth_reg_no",
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
        // Apply quota formatter when exporting qouta column
        if (col === "qouta") {
          val = formatQuota(val);
        }
        // normalize dates to ISO strings for Excel
        if (val instanceof Date) return val.toISOString();
        if (val === null || typeof val === "undefined") return "";
        return String(val);
      });
      rows.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // compute column widths
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
