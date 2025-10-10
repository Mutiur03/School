import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createWriteStream } from "fs";
import PDFDocument from "pdfkit";
import { Readable } from "stream";
import puppeteer from "puppeteer";

// Simplified image save function
const saveImageLocally = async (file, section, roll, sscBatch) => {
  if (!fs.existsSync(file.path)) {
    throw new Error(`File not found: ${file.path}`);
  }
  sscBatch = String(sscBatch);
  const uploadDir = path.join(
    "uploads",
    "student-photos",
    sscBatch || "unknown"
  );
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileExtension = path.extname(file.originalname);
  const filename = `${section || "unknown"}-${
    roll || "unknown"
  }${fileExtension}`;
  const finalPath = path.join(uploadDir, filename);

  fs.renameSync(file.path, finalPath);
  return finalPath;
};

const checkForDuplicates = async (formData, excludeId = null) => {
  const duplicates = [];

  let sscBatch;
  try {
    const sscReg = await prisma.ssc_reg.findUnique({
      where: { id: 1 },
    });
    sscBatch = sscReg ? String(sscReg.ssc_year) : null;
  } catch (error) {
    console.error("Error fetching SSC batch:", error);
    sscBatch = new Date().getFullYear().toString(); // fallback to current year
  }

  if (formData.birthRegNo) {
    const birthRegDuplicate = await prisma.student_registration_ssc.findFirst({
      where: {
        birth_reg_no: formData.birthRegNo,
        ssc_batch: sscBatch,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: {
        id: true,
        student_name_en: true,
        section: true,
        roll: true,
        birth_reg_no: true,
        ssc_batch: true,
      },
    });

    if (birthRegDuplicate) {
      duplicates.push({
        field: "birthRegNo",
        message: `Birth registration number ${formData.birthRegNo} already exists for student ${birthRegDuplicate.student_name_en} in SSC Batch ${birthRegDuplicate.ssc_batch} (Section: ${birthRegDuplicate.section}, Roll: ${birthRegDuplicate.roll})`,
        existingRecord: birthRegDuplicate,
      });
    }
  }

  // Check for duplicate section + roll combination within the same SSC batch
  if (formData.section && formData.roll) {
    const rollDuplicate = await prisma.student_registration_ssc.findFirst({
      where: {
        section: formData.section,
        roll: formData.roll,
        ssc_batch: sscBatch,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: {
        id: true,
        student_name_en: true,
        section: true,
        roll: true,
        birth_reg_no: true,
        ssc_batch: true,
      },
    });

    if (rollDuplicate) {
      duplicates.push({
        field: "section_roll",
        message: `Section ${formData.section} Roll ${formData.roll} is already taken by student ${rollDuplicate.student_name_en} in SSC Batch ${rollDuplicate.ssc_batch}`,
        existingRecord: rollDuplicate,
      });
    }
  }
  return duplicates;
};

// Always convert date to DD/MM/YYYY format for display/export
const convertDateFormat = (dateString) => {
  if (!dateString) return null;

  // If already in DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
    return dateString;
  }
  // If in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year}`;
  }
  // If in other format, return null
  return null;
};

export const createRegistration = async (req, res) => {
  try {
    const formData = req.body;

    const duplicates = await checkForDuplicates(formData);

    if (duplicates.length > 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      console.log("Duplicate entries found:", duplicates);

      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates: duplicates,
        error: duplicates.reduce((acc, dup) => {
          acc[dup.field] = dup.message;
          return acc;
        }, {}),
      });
    }

    let photoPath = null;
    let sscReg;
    let sscBatch;
    if (req.file) {
      try {
        sscReg = await prisma.ssc_reg.findUnique({
          where: { id: 1 },
        });
        sscBatch = sscReg ? String(sscReg.ssc_year) : null;
        photoPath = await saveImageLocally(
          req.file,
          formData.section,
          formData.roll,
          sscBatch
        );
      } catch (uploadError) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: "Photo save failed",
          error: uploadError.message,
        });
      }
    }

    const registrationData = {
      ssc_batch: sscBatch || null,
      section: formData.section || null,
      roll: formData.roll || null,
      religion: formData.religion || null,
      student_name_bn: formData.studentNameBn || null,
      student_nick_name_bn: formData.studentNickNameBn || null,
      student_name_en: formData.studentNameEn || null,
      birth_reg_no: formData.birthRegNo || null,
      father_name_bn: formData.fatherNameBn || null,
      father_name_en: formData.fatherNameEn || null,
      father_nid: formData.fatherNid || null,
      father_phone: formData.fatherPhone || null,
      mother_name_bn: formData.motherNameBn || null,
      mother_name_en: formData.motherNameEn || null,
      mother_nid: formData.motherNid || null,
      mother_phone: formData.motherPhone || null,
      birth_date: convertDateFormat(formData.birthDate) || null,
      birth_year: formData.birthYear || null,
      birth_month: formData.birthMonth || null,
      birth_day: formData.birthDay || null,
      blood_group: formData.bloodGroup || null,
      email: formData.email || null,
      present_district: formData.presentDistrict || null,
      present_upazila: formData.presentUpazila || null,
      present_post_office: formData.presentPostOffice || null,
      present_post_code: formData.presentPostCode || null,
      present_village_road: formData.presentVillageRoad || null,
      permanent_district: formData.permanentDistrict || null,
      permanent_upazila: formData.permanentUpazila || null,
      permanent_post_office: formData.permanentPostOffice || null,
      permanent_post_code: formData.permanentPostCode || null,
      permanent_village_road: formData.permanentVillageRoad || null,
      guardian_name: formData.guardianName || null,
      guardian_phone: formData.guardianPhone || null,
      guardian_relation: formData.guardianRelation || null,
      guardian_nid: formData.guardianNid || null,
      guardian_district: formData.guardianDistrict || null,
      guardian_upazila: formData.guardianUpazila || null,
      guardian_post_office: formData.guardianPostOffice || null,
      guardian_post_code: formData.guardianPostCode || null,
      guardian_village_road: formData.guardianVillageRoad || null,
      prev_school_name: formData.prevSchoolName || null,
      prev_school_district: formData.prevSchoolDistrict || null,
      prev_school_upazila: formData.prevSchoolUpazila || null,
      jsc_passing_year: formData.jscPassingYear || null,
      jsc_board: formData.jscBoard || null,
      jsc_reg_no: formData.jscRegNo || null,
      jsc_roll_no: formData.jscRollNo || null,
      group_class_nine: formData.groupClassNine || null,
      main_subject: formData.mainSubject || null,
      fourth_subject: formData.fourthSubject || null,
      photo_path: photoPath,
      nearby_nine_student_info: formData.nearbyNineStudentInfo || null,
    };

    const registration = await prisma.student_registration_ssc.create({
      data: registrationData,
    });

    res.status(201).json({
      success: true,
      message: "Registration submitted successfully",
      data: {
        id: registration.id,
        status: registration.status,
        submissionDate: registration.submission_date,
      },
    });
  } catch (error) {
    console.error("Registration creation error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: "Registration submission failed",
      error: error.message,
    });
  }
};

// Get all registrations
export const getAllRegistrations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sscBatch,
      section,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status && status !== "all") where.status = status;
    if (sscBatch) where.ssc_batch = sscBatch;
    if (section) where.section = section;
    if (search) {
      where.OR = [
        { student_name_en: { contains: search, mode: "insensitive" } },
        { student_name_bn: { contains: search, mode: "insensitive" } },
        { roll: { contains: search, mode: "insensitive" } },
        { birth_reg_no: { contains: search, mode: "insensitive" } },
      ];
    }

    const [registrations, totalCount] = await Promise.all([
      prisma.student_registration_ssc.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { created_at: "desc" },
      }),
      prisma.student_registration_ssc.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: registrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Get registrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch registrations",
      error: error.message,
    });
  }
};

// Get registration by ID
export const getRegistrationById = async (req, res) => {
  try {
    const registration = await prisma.student_registration_ssc.findUnique({
      where: { id: req.params.id },
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
    console.error("Get registration error:", error);
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
    const formData = req.body;

    const existingRegistration =
      await prisma.student_registration_ssc.findUnique({
        where: { id },
      });

    if (!existingRegistration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    const duplicates = await checkForDuplicates(formData, id);

    if (duplicates.length > 0) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        success: false,
        message: "Duplicate information found",
        duplicates: duplicates,
        error: duplicates.reduce((acc, dup) => {
          acc[dup.field] = dup.message;
          return acc;
        }, {}),
      });
    }

    let photoPath = existingRegistration.photo_path;

    if (req.file) {
      try {
        if (
          existingRegistration.photo_path &&
          fs.existsSync(existingRegistration.photo_path)
        ) {
          fs.unlinkSync(existingRegistration.photo_path);
        }
        photoPath = await saveImageLocally(
          req.file,
          formData.section || existingRegistration.section,
          formData.roll || existingRegistration.roll,
          existingRegistration.ssc_batch
        );
      } catch (uploadError) {
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          success: false,
          message: "Photo save failed",
          error: uploadError.message,
        });
      }
    }

    const updateData = {
      section: formData.section || null,
      roll: formData.roll || null,
      religion: formData.religion || null,
      student_name_bn: formData.studentNameBn || null,
      student_nick_name_bn: formData.studentNickNameBn || null,
      student_name_en: formData.studentNameEn || null,
      birth_reg_no: formData.birthRegNo || null,
      father_name_bn: formData.fatherNameBn || null,
      father_name_en: formData.fatherNameEn || null,
      father_nid: formData.fatherNid || null,
      father_phone: formData.fatherPhone || null,
      mother_name_bn: formData.motherNameBn || null,
      mother_name_en: formData.motherNameEn || null,
      mother_nid: formData.motherNid || null,
      mother_phone: formData.motherPhone || null,
      birth_date: convertDateFormat(formData.birthDate) || null,
      birth_year: formData.birthYear || null,
      birth_month: formData.birthMonth || null,
      birth_day: formData.birthDay || null,
      blood_group: formData.bloodGroup || null,
      email: formData.email || null,
      present_district: formData.presentDistrict || null,
      present_upazila: formData.presentUpazila || null,
      present_post_office: formData.presentPostOffice || null,
      present_post_code: formData.presentPostCode || null,
      present_village_road: formData.presentVillageRoad || null,
      permanent_district: formData.permanentDistrict || null,
      permanent_upazila: formData.permanentUpazila || null,
      permanent_post_office: formData.permanentPostOffice || null,
      permanent_post_code: formData.permanentPostCode || null,
      permanent_village_road: formData.permanentVillageRoad || null,
      guardian_name: formData.guardianName || null,
      guardian_phone: formData.guardianPhone || null,
      guardian_relation: formData.guardianRelation || null,
      guardian_nid: formData.guardianNid || null,
      guardian_district: formData.guardianDistrict || null,
      guardian_upazila: formData.guardianUpazila || null,
      guardian_post_office: formData.guardianPostOffice || null,
      guardian_post_code: formData.guardianPostCode || null,
      guardian_village_road: formData.guardianVillageRoad || null,
      prev_school_name: formData.prevSchoolName || null,
      prev_school_district: formData.prevSchoolDistrict || null,
      prev_school_upazila: formData.prevSchoolUpazila || null,
      jsc_passing_year: formData.jscPassingYear || null,
      jsc_board: formData.jscBoard || null,
      jsc_reg_no: formData.jscRegNo || null,
      jsc_roll_no: formData.jscRollNo || null,
      group_class_nine: formData.groupClassNine || null,
      main_subject: formData.mainSubject || null,
      fourth_subject: formData.fourthSubject || null,
      photo_path: photoPath,
      nearby_nine_student_info: formData.nearbyNineStudentInfo || null,
    };

    const updatedRegistration = await prisma.student_registration_ssc.update({
      where: { id },
      data: updateData,
    });

    console.log("Updated registration:", updatedRegistration);
    res.status(200).json({
      success: true,
      message: "Registration updated successfully",
      data: updatedRegistration,
    });
  } catch (error) {
    console.error("Update registration error:", error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: "Failed to update registration",
      error: error.message,
    });
  }
};

// Update status only
export const updateRegistrationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: pending, approved, rejected",
      });
    }

    const updatedRegistration = await prisma.student_registration_ssc.update({
      where: { id },
      data: { status, updated_at: new Date() },
    });

    res.status(200).json({
      success: true,
      message: `Registration status updated to ${status}`,
      data: updatedRegistration,
    });
  } catch (error) {
    console.error("Update registration status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update registration status",
      error: error.message,
    });
  }
};

// Delete registration
export const deleteRegistration = async (req, res) => {
  try {
    const registration = await prisma.student_registration_ssc.findUnique({
      where: { id: req.params.id },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    if (registration.photo_path && fs.existsSync(registration.photo_path)) {
      fs.unlinkSync(registration.photo_path);
    }

    await prisma.student_registration_ssc.delete({
      where: { id: req.params.id },
    });

    res.status(200).json({
      success: true,
      message: "Registration deleted successfully",
    });
  } catch (error) {
    console.error("Delete registration error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete registration",
      error: error.message,
    });
  }
};

// Export registrations to Excel
export const exportRegistrations = async (req, res) => {
  try {
    const { sscBatch, status, section } = req.query;

    // Build where clause for filtering
    const where = {};
    if (sscBatch) where.ssc_batch = sscBatch;
    if (status && status !== "all") where.status = status;
    if (section) where.section = section;

    // Fetch all registrations based on filters
    const registrations = await prisma.student_registration_ssc.findMany({
      where,
      orderBy: [{ section: "asc" }, { roll: "asc" }],
    });

    if (registrations.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No registrations found to export",
      });
    }

    // Prepare data for Excel export
    const excelData = registrations.map((reg, index) => ({
      "Serial No": index + 1,
      "Student Name (English)": reg.student_name_en || "",
      "Student Name (Bangla)": reg.student_name_bn || "",
      "Nick Name": reg.student_nick_name_bn || "",
      Section: reg.section || "",
      Roll: reg.roll || "",
      Religion: reg.religion || "",
      "Birth Registration No": reg.birth_reg_no || "",
      "Birth Date": convertDateFormat(reg.birth_date) || "",
      "Birth Year": reg.birth_year || null,
      "Birth Month": reg.birth_month || null,
      "Birth Day": reg.birth_day || null,
      "Blood Group": reg.blood_group || "",
      Email: reg.email || "",
      "Father Name (English)": reg.father_name_en || "",
      "Father Name (Bangla)": reg.father_name_bn || "",
      "Father NID": reg.father_nid || "",
      "Father Phone": reg.father_phone || "",
      "Mother Name (English)": reg.mother_name_en || "",
      "Mother Name (Bangla)": reg.mother_name_bn || "",
      "Mother NID": reg.mother_nid || "",
      "Mother Phone": reg.mother_phone || "",
      "Present District": reg.present_district || "",
      "Present Upazila": reg.present_upazila || "",
      "Present Post Office": reg.present_post_office || "",
      "Present Post Code": reg.present_post_code || "",
      "Present Village/Road": reg.present_village_road || "",
      "Permanent District": reg.permanent_district || "",
      "Permanent Upazila": reg.permanent_upazila || "",
      "Permanent Post Office": reg.permanent_post_office || "",
      "Permanent Post Code": reg.permanent_post_code || "",
      "Permanent Village/Road": reg.permanent_village_road || "",
      "Guardian Name": reg.guardian_name || "",
      "Guardian Phone": reg.guardian_phone || "",
      "Guardian Relation": reg.guardian_relation || "",
      "Guardian NID": reg.guardian_nid || "",
      "Guardian District": reg.guardian_district || "",
      "Guardian Upazila": reg.guardian_upazila || "",
      "Guardian Post Office": reg.guardian_post_office || "",
      "Guardian Post Code": reg.guardian_post_code || "",
      "Guardian Village/Road": reg.guardian_village_road || "",
      "Previous School Name": reg.prev_school_name || "",
      "Previous School District": reg.prev_school_district || "",
      "Previous School Upazila": reg.prev_school_upazila || "",
      "JSC Passing Year": reg.jsc_passing_year || null,
      "JSC Board": reg.jsc_board || null,
      "JSC Registration No": reg.jsc_reg_no || "",
      "JSC Roll No": reg.jsc_roll_no || "",
      "Group (Class Nine)": reg.group_class_nine || "",
      "Main Subject": reg.main_subject || "",
      "Fourth Subject": reg.fourth_subject || "",
      "SSC Batch": reg.ssc_batch || "",
      Status: reg.status || "",
      "Submission Date": reg.submission_date
        ? new Date(reg.submission_date).toLocaleDateString()
        : "",
      "Created At": reg.created_at
        ? new Date(reg.created_at).toLocaleDateString()
        : "",
      "Updated At": reg.updated_at
        ? new Date(reg.updated_at).toLocaleDateString()
        : "",
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths for better readability
    const columnWidths = [
      { wch: 8 }, // Serial No
      { wch: 25 }, // Student Name (English)
      { wch: 25 }, // Student Name (Bangla)
      { wch: 15 }, // Nick Name
      { wch: 8 }, // Section
      { wch: 8 }, // Roll
      { wch: 12 }, // Religion
      { wch: 20 }, // Birth Registration No
      { wch: 12 }, // Birth Date
      { wch: 8 }, // Birth Year
      { wch: 8 }, // Birth Month
      { wch: 8 }, // Birth Day
      { wch: 12 }, // Blood Group
      { wch: 25 }, // Email
      { wch: 25 }, // Father Name (English)
      { wch: 25 }, // Father Name (Bangla)
      { wch: 15 }, // Father NID
      { wch: 15 }, // Father Phone
      { wch: 25 }, // Mother Name (English)
      { wch: 25 }, // Mother Name (Bangla)
      { wch: 15 }, // Mother NID
      { wch: 15 }, // Mother Phone
      { wch: 15 }, // Present District
      { wch: 15 }, // Present Upazila
      { wch: 20 }, // Present Post Office
      { wch: 10 }, // Present Post Code
      { wch: 30 }, // Present Village/Road
      { wch: 15 }, // Permanent District
      { wch: 15 }, // Permanent Upazila
      { wch: 20 }, // Permanent Post Office
      { wch: 10 }, // Permanent Post Code
      { wch: 30 }, // Permanent Village/Road
      { wch: 20 }, // Guardian Name
      { wch: 15 }, // Guardian Phone
      { wch: 12 }, // Guardian Relation
      { wch: 15 }, // Guardian NID
      { wch: 15 }, // Guardian District
      { wch: 15 }, // Guardian Upazila
      { wch: 20 }, // Guardian Post Office
      { wch: 10 }, // Guardian Post Code
      { wch: 30 }, // Guardian Village/Road
      { wch: 30 }, // Previous School Name
      { wch: 15 }, // Previous School District
      { wch: 15 }, // Previous School Upazila
      { wch: 8 }, // JSC Passing Year
      { wch: 15 }, // JSC Board
      { wch: 15 }, // JSC Registration No
      { wch: 12 }, // JSC Roll No
      { wch: 15 }, // Group (Class Nine)
      { wch: 15 }, // Main Subject
      { wch: 15 }, // Fourth Subject
      { wch: 8 }, // SSC Batch
      { wch: 10 }, // Status
      { wch: 12 }, // Submission Date
      { wch: 12 }, // Created At
      { wch: 12 }, // Updated At
    ];

    worksheet["!cols"] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, "SSC Registrations");

    // Generate filename with current date and filters
    const currentDate = new Date().toISOString().split("T")[0];
    let filename = `SSC_Registrations_${currentDate}`;

    if (sscBatch) filename += `_Batch${sscBatch}`;
    if (section) filename += `_Section${section}`;
    if (status && status !== "all") filename += `_${status}`;

    filename += ".xlsx";

    // Create exports directory if it doesn't exist
    const exportDir = path.join("exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Write file to exports directory
    const filePath = path.join(exportDir, filename);
    XLSX.writeFile(workbook, filePath);

    // Send file as download
    res.download(filePath, filename, (error) => {
      if (error) {
        console.error("Download error:", error);
        res.status(500).json({
          success: false,
          message: "Failed to download export file",
        });
      } else {
        // Clean up file after download
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }, 5000); // Delete after 5 seconds
      }
    });
  } catch (error) {
    console.error("Export registrations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export registrations",
      error: error.message,
    });
  }
};

// Export only student images in ZIP (using built-in functionality)
export const exportImages = async (req, res) => {
  try {
    const { sscBatch, status, section } = req.query;

    // Build where clause for filtering
    const where = {};
    if (sscBatch) where.ssc_batch = sscBatch;
    if (status && status !== "all") where.status = status;
    if (section) where.section = section;

    // Fetch registrations with photos only
    const registrations = await prisma.student_registration_ssc.findMany({
      where: {
        ...where,
        photo_path: {
          not: null,
        },
      },
      select: {
        section: true,
        roll: true,
        photo_path: true,
        student_name_en: true,
        ssc_batch: true,
      },
      orderBy: [{ section: "asc" }, { roll: "asc" }],
    });

    // Filter only existing photo files
    const photosWithFiles = registrations.filter(
      (reg) => reg.photo_path && fs.existsSync(reg.photo_path)
    );

    if (photosWithFiles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No images found to export",
      });
    }

    // Generate filename with current date and filters
    const currentDate = new Date().toISOString().split("T")[0];
    let baseFilename = `SSC_Photos_${currentDate}`;

    if (sscBatch) baseFilename += `_Batch${sscBatch}`;
    if (section) baseFilename += `_Section${section}`;
    if (status && status !== "all") baseFilename += `_${status}`;

    // Create exports directory if it doesn't exist
    const exportDir = path.join("exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Create temp directory for organizing photos
    const tempDir = path.join(exportDir, `temp_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Copy photos to temp directory with proper naming
    photosWithFiles.forEach((reg) => {
      try {
        const photoExtension = path.extname(reg.photo_path);
        const photoName = `${reg.section}-${reg.roll}${photoExtension}`;
        const destPath = path.join(tempDir, photoName);
        fs.copyFileSync(reg.photo_path, destPath);
      } catch (copyError) {
        console.error(
          `Failed to copy photo for ${reg.section}-${reg.roll}:`,
          copyError
        );
      }
    });

    // Use dynamic import with better error handling
    let archiver;
    try {
      const archiverModule = await import("archiver");
      archiver = archiverModule.default;
    } catch (importError) {
      console.error("Archiver import failed:", importError);

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      return res.status(500).json({
        success: false,
        message:
          "ZIP functionality not available. Please install archiver package with: npm install archiver",
        error: importError.message,
      });
    }

    // Create ZIP file
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    const zipFilename = `${baseFilename}.zip`;
    const zipPath = path.join(exportDir, zipFilename);
    const output = createWriteStream(zipPath);

    output.on("close", () => {
      console.log(`ZIP created: ${archive.pointer()} total bytes`);

      // Clean up temp directory
      fs.rmSync(tempDir, { recursive: true, force: true });

      // Send file as download
      res.download(zipPath, zipFilename, (error) => {
        if (error) {
          console.error("Download error:", error);
          res.status(500).json({
            success: false,
            message: "Failed to download images",
          });
        } else {
          // Clean up zip file after download
          setTimeout(() => {
            if (fs.existsSync(zipPath)) {
              fs.unlinkSync(zipPath);
            }
          }, 5000);
        }
      });
    });

    output.on("error", (err) => {
      console.error("Output stream error:", err);
      fs.rmSync(tempDir, { recursive: true });
      res.status(500).json({
        success: false,
        message: "Failed to create ZIP file",
        error: err.message,
      });
    });

    archive.on("error", (err) => {
      console.error("Archive error:", err);
      fs.rmSync(tempDir, { recursive: true });
      res.status(500).json({
        success: false,
        message: "Failed to create images archive",
        error: err.message,
      });
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Archive warning:", err);
      } else {
        console.error("Archive warning (critical):", err);
      }
    });

    // Pipe archive data to the file
    archive.pipe(output);

    // Add all photos to the archive
    photosWithFiles.forEach((reg) => {
      try {
        const photoExtension = path.extname(reg.photo_path);
        const photoName = `${reg.section}-${reg.roll}${photoExtension}`;
        const sourcePath = path.join(tempDir, photoName);

        if (fs.existsSync(sourcePath)) {
          archive.file(sourcePath, { name: photoName });
        }
      } catch (archiveError) {
        console.error(
          `Failed to add photo to archive for ${reg.section}-${reg.roll}:`,
          archiveError
        );
      }
    });

    // Finalize the archive
    await archive.finalize();
  } catch (error) {
    console.error("Export images error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export images",
      error: error.message,
    });
  }
};

export const downloadRegistrationPDF = async (req, res) => {
  try {
    console.log("Generating PDF for registration ID:", req.params.id);

    const { id } = req.params;
    const registration = await prisma.student_registration_ssc.findUnique({
      where: { id },
    });

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    // Fetch SSC registration settings for instructions
    let sscRegSettings = null;
    try {
      sscRegSettings = await prisma.ssc_reg.findFirst();
    } catch (error) {
      console.warn("Failed to fetch SSC registration settings:", error);
    }

    // Get section-specific instructions
    const getInstructionsForSection = (section) => {
      if (!sscRegSettings) return null;

      const sectionLower = section?.toLowerCase();
      if (sectionLower === "a" && sscRegSettings.instruction_for_a) {
        return sscRegSettings.instruction_for_a;
      }
      if (sectionLower === "b" && sscRegSettings.instruction_for_b) {
        return sscRegSettings.instruction_for_b;
      }
      return null;
    };

    const sectionInstructions = getInstructionsForSection(registration.section);
    const attachmentInstructions =
      sscRegSettings?.attachment_instruction || null;

    const logoPath = path.join("public", "icon.jpg");
    const logoExists = fs.existsSync(logoPath);

    // Convert logo to base64 if it exists
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
    function wrapBnEn(text) {
      if (!text) return "";
      return text.replace(
        /([\u0980-\u09FF]+)|([^\u0980-\u09FF]+)/g,
        (match, bn, nonBn) => {
          if (bn) return `<span class="bn">${bn}</span>`;
          if (nonBn) return `<span class="en">${nonBn}</span>`;
          return match;
        }
      );
    }
    // Remove number column from row
    const row = (label, value, rowIndex = 0) => `
      <tr style="background:${rowIndex % 2 === 1 ? "#e0e7ef" : "inherit"};">
        <td style="border:1px solid #bbb;padding:4px 8px;width:260px;background:${
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
      [
        "ছাত্রের নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
        wrapBnEn(registration.student_name_bn || ""),
      ],
      [
        "Student's Name:",
        wrapBnEn(registration.student_name_en.toUpperCase() || ""),
      ],
      ["Birth Registration Number:", wrapBnEn(registration.birth_reg_no || "")],
      [
        "Date of Birth (According to JSC/JDC):",
        wrapBnEn(formatDateLong(registration.birth_date) || ""),
      ],
      ["Email Address:", wrapBnEn(registration.email || "No")],
      [
        "Mobile Numbers:",
        wrapBnEn(
          [
            `${registration.father_phone}` || "",
            `${registration.mother_phone}` || "",
          ]
            .filter(Boolean)
            .join(", ") || "No"
        ),
      ],
      [
        "পিতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
        wrapBnEn(registration.father_name_bn || ""),
      ],
      [
        "Father's Name:",
        wrapBnEn(registration.father_name_en.toUpperCase() || ""),
      ],
      ["Father's National ID Number:", wrapBnEn(registration.father_nid || "")],
      [
        "মাতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):",
        wrapBnEn(registration.mother_name_bn || ""),
      ],
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
            .join(", ")
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
            registration.guardian_district
          ) || "Not Applicable"
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
            registration.permanent_district
          )
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
            registration.present_district
          )
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
            .join(", ")
        ),
      ],
      [
        "Information of JSC/JDC:",
        wrapBnEn(
          [
            registration.jsc_board ? `Board: ${registration.jsc_board}` : "",
            registration.jsc_passing_year
              ? `Passing Year: ${registration.jsc_passing_year}`
              : "",
            registration.jsc_roll_no
              ? `Roll No- ${registration.jsc_roll_no}`
              : "Roll No- N/A",
          ]
            .filter(Boolean)
            .join(", ")
        ),
      ],
      [
        "Main and 4th Subject:",
        wrapBnEn(
          [
            registration.group_class_nine || "",
            registration.main_subject ? `, ${registration.main_subject}` : "",
            registration.fourth_subject
              ? `, 4th: ${registration.fourth_subject}`
              : "",
          ]
            .map((s) => s.trim())
            .filter(Boolean)
            .join(" ")
        ),
      ],
      [
        "বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের তথ্য:",
        wrapBnEn(registration.nearby_nine_student_info || ""),
      ],
    ];

    // Render table rows without section headers
    let tableRows = "";
    studentDetails.forEach(([label, value], idx) => {
      tableRows += row(label, value, idx);
    });

    const schoolName = "Panchbibi Lal Bihari Pilot Govt. High School";
    const schoolAddr = "Panchbibi, Joypurhat";
    const schoolWeb = "www.lbphs.gov.bd";
    const sscBatch = registration.ssc_batch || "";
    const section = registration.section || "";
    const roll = registration.roll || "";
    const religion = registration.religion || "";
    const jscReg = registration.jsc_reg_no || "";

    // Get current date and time
    const currentDateTime = new Date().toLocaleString("en-GB", {
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
  <title>SSC Registration Info</title>
  <style>
    @page {
      size: legal;
      margin: 24px;
    }
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('https://cdn.jsdelivr.net/gh/solaimanhossain/solaimanlipi-webfont@master/SolaimanLipi.woff') format('woff');
      font-weight: normal;
      font-style: normal;
    }
    body, html {
      height: 100%;
      margin: 0;
      padding: 0;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .page-container {
      position: relative;
      min-height: 100vh;
      height: 100vh;
      width: 100vw;
      box-sizing: border-box;
      font-family: 'SolaimanLipi', 'Noto Sans Bengali', 'Bangla', sans-serif;
      background: #fff;
      page-break-inside: avoid;
      page-break-after: avoid;
    }
    .content-area {
      box-sizing: border-box;
      padding: 0 0 140px 0;
      min-height: 0;
      height: calc(100vh - 140px);
      overflow: hidden;
    }
    .bn, .bn * {
      font-family: 'SolaimanLipi', 'Noto Sans Bengali', 'Bangla', sans-serif !important;
    }
    .en, .en * {
      font-family: 'Times New Roman', Times, serif !important;
      letter-spacing: 0.02em;
    }
    .header { 
      position: relative;
      text-align: center; 
      margin-bottom: 12px;
      padding: 12px 0 8px 0;
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
        font-size: 0.9rem;
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
      font-size: 1.6rem; 
      font-weight: bold; 
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .header .addr { 
      font-size: 1.4rem; 
      margin-bottom: 4px;
      font-weight: 500;
    }
    .header .web { 
      font-size: 1.1rem; 
    }
    .title-row { 
      background: #e3f0fa; 
      font-size: 1.25rem; 
      font-weight: bold; 
      text-align: center; 
      border: 1px solid #bbb; 
      padding: 8px 0; 
      margin-top: 8px;
    }
    .section-row { 
      background: #f1f5f9; 
      font-size: 1.1rem; 
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
      font-size: 0.95rem;
      line-height: 1.5;
      text-align: justify;
    }
    .instructions-title {
      font-weight: bold;
      color: #8b5a00;
      margin-bottom: 8px;
      font-size: 1rem;
    }
    .instructions-content {
      white-space: pre-line;
      text-align: justify;
    }
    table { 
      border-collapse: collapse; 
      width: 100%; 
      margin-top: 0.5rem; 
      font-size: 0.98rem; 
      page-break-inside: avoid;
    }
    tr {
      page-break-inside: avoid;
    }
    th, td { 
      border: 1px solid #bbb; 
      padding: 4px 8px; 
    }
    th { 
      background: #f3f6fa; 
    }
    .footer .note .b {
      font-weight: 400;
      margin-bottom: 4px;
    }
    .footer .note .bn {
      font-family: 'SolaimanLipi', 'Noto Sans Bengali', 'Bangla', sans-serif !important;
      font-size: 1.1rem;
      white-space: pre-wrap;
    }
    .footer .note .en {
      font-family: 'Times New Roman', Times, serif !important;
      font-size: 1.1rem;
    }
    .document-list {
      margin-top: 8px;
      padding-left: 0;
      font-size: 1.1rem;
    }
    .document-list .bn {
      display: block;
      font-size: 1.1rem;
      line-height: 1.3;
      white-space: pre; /* Force exact space preservation */
    }
    .signature-row {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 10px;
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 8px;
      padding-bottom: 18px;
      background: white;
      height: 110px;
      box-sizing: border-box;
    }
    .signature-cell {
      flex: 1 1 0;
      text-align: center;
      vertical-align: bottom;
      min-width: 120px;
      max-width: 180px;
      padding: 0 4px;
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
      font-size: 0.93rem;
      font-weight: 500;
      margin-top: 1px;
      font-family: 'SolaimanLipi', 'Noto Sans Bengali', 'Bangla', sans-serif;
      white-space: nowrap;
    }
    .bottom-info {
      position: absolute;
      left: 0;
      right: 0;
      bottom: -4px;
      width: 100%;
      text-align: center;
      font-size: 0.9rem;
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
        Student's Information for SSC Exam Registration ${sscBatch}
      </div>
      <div class="section-row en">
        Section: <span class="en">${section}</span>, Roll No: <span class="en">${roll}</span>, Religion: <span class="en">${religion}</span>, JSC/JDC Regi. No: <span class="en">${jscReg}</span>
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
            <span class="bn"><b>প্রিন্টকৃত ফরমের সাথে যেসব কাগজপত্র সংযুক্ত করতে হবে:</b></span>
            ${
              attachmentInstructions
                ? attachmentInstructions
                    .split(/\r?\n|\r/)
                    .map((line) => {
                      // Avoid trimming to preserve spaces
                      if (line) {
                        return `<span class="bn">${line}</span>`;
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
    <div class="signature-row bn">
      <div class="signature-cell">
        <div class="signature-line"></div>
        <div class="signature-label bn">ছাত্রের স্বাক্ষর</div>
      </div>
      <div class="signature-cell">
        <div class="signature-line"></div>
        <div class="signature-label bn">পিতা/মাতা/বৈধ অভিভাবকের স্বাক্ষর</div>
      </div>
      <div class="signature-cell">
        <div class="signature-line"></div>
        <div class="signature-label bn">দায়িত্বপ্রাপ্ত শিক্ষকের স্বাক্ষর ও তারিখ</div>
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
      // headless: "new",
      // args: [
      //   "--no-sandbox",
      //   "--disable-setuid-sandbox",
      //   "--disable-dev-shm-usage",
      // ],
      enableExtensions: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "legal",
      printBackground: true,
      margin: { top: 24, bottom: 24, left: 24, right: 24 },
      preferCSSPageSize: true,
      pageRanges: "1",
    });
    await browser.close();
    console.log("PDF generated for registration ID:", id);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="SSC_Registration_${
        registration.student_name_en || registration.roll
      }.pdf"`
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
