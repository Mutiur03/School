import { prisma } from "../config/prisma.js";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { createWriteStream } from "fs";

// Simplified image save function
const saveImageLocally = async (file, section, roll, sscBatch) => {
  if (!fs.existsSync(file.path)) {
    throw new Error(`File not found: ${file.path}`);
  }

  const uploadDir = path.join("uploads", "student-photos", sscBatch || "unknown");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const fileExtension = path.extname(file.originalname);
  const filename = `${section || "unknown"}-${roll || "unknown"}${fileExtension}`;
  const finalPath = path.join(uploadDir, filename);

  fs.renameSync(file.path, finalPath);
  return finalPath;
};

// Create registration
export const createRegistration = async (req, res) => {
  try {
    const formData = req.body;
    let photoPath = null;

    if (req.file) {
      try {
        const sscBatch = new Date().getFullYear().toString();
        photoPath = await saveImageLocally(req.file, formData.section, formData.roll, sscBatch);
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
      ssc_batch: new Date().getFullYear().toString(),
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
      birth_date: formData.birthDate || null,
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
      guardian_address_same_as_permanent: formData.guardianAddressSameAsPermanent === "true" || false,
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
    const { page = 1, limit = 10, status, search, sscBatch, section } = req.query;
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

// Update registration
export const updateRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const formData = req.body;

    const existingRegistration = await prisma.student_registration_ssc.findUnique({
      where: { id },
    });

    if (!existingRegistration) {
      return res.status(404).json({
        success: false,
        message: "Registration not found",
      });
    }

    let photoPath = existingRegistration.photo_path;

    if (req.file) {
      try {
        if (existingRegistration.photo_path && fs.existsSync(existingRegistration.photo_path)) {
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
      birth_date: formData.birthDate || null,
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
      guardian_address_same_as_permanent: formData.guardianAddressSameAsPermanent === "true" || false,
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
    };

    const updatedRegistration = await prisma.student_registration_ssc.update({
      where: { id },
      data: updateData,
    });

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

// // Simplified export registrations
// export const exportRegistrations = async (req, res) => {
//   try {
//     const { sscBatch, status, section } = req.query;

//     const where = {};
//     if (sscBatch) where.ssc_batch = sscBatch;
//     if (status && status !== "all") where.status = status;
//     if (section) where.section = section;

//     const registrations = await prisma.student_registration_ssc.findMany({
//       where,
//       orderBy: [{ section: "asc" }, { roll: "asc" }],
//     });

//     if (registrations.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No registrations found to export",
//       });
//     }

//     const excelData = registrations.map((reg, index) => ({
//       "Serial No": index + 1,
//       "Student Name (English)": reg.student_name_en || "",
//       "Student Name (Bangla)": reg.student_name_bn || "",
//       "Nick Name": reg.student_nick_name_bn || "",
//       Section: reg.section || "",
//       Roll: reg.roll || "",
//       Religion: reg.religion || "",
//       "Birth Registration No": reg.birth_reg_no || "",
//       "Birth Date": reg.birth_date || "",
//       "Father Name (English)": reg.father_name_en || "",
//       "Mother Name (English)": reg.mother_name_en || "",
//       "Father Phone": reg.father_phone || "",
//       "Mother Phone": reg.mother_phone || "",
//       "Present Address": `${reg.present_village_road || ""}, ${reg.present_post_office || ""}, ${reg.present_upazila || ""}, ${reg.present_district || ""}`.replace(/^,\s*|,\s*$/g, ''),
//       "Previous School": reg.prev_school_name || "",
//       "JSC Year": reg.jsc_passing_year || "",
//       "JSC Board": reg.jsc_board || "",
//       "Group": reg.group_class_nine || "",
//       "Main Subject": reg.main_subject || "",
//       "Fourth Subject": reg.fourth_subject || "",
//       Status: reg.status || "",
//       "Submission Date": reg.submission_date ? new Date(reg.submission_date).toLocaleDateString() : "",
//     }));

//     const workbook = XLSX.utils.book_new();
//     const worksheet = XLSX.utils.json_to_sheet(excelData);
//     XLSX.utils.book_append_sheet(workbook, worksheet, "SSC Registrations");

//     const currentDate = new Date().toISOString().split("T")[0];
//     let filename = `SSC_Registrations_${currentDate}`;
//     if (sscBatch) filename += `_Batch${sscBatch}`;
//     if (section) filename += `_Section${section}`;
//     if (status && status !== "all") filename += `_${status}`;
//     filename += ".xlsx";

//     const exportDir = path.join("exports");
//     if (!fs.existsSync(exportDir)) {
//       fs.mkdirSync(exportDir, { recursive: true });
//     }

//     const filePath = path.join(exportDir, filename);
//     XLSX.writeFile(workbook, filePath);

//     res.download(filePath, filename, (error) => {
//       if (error) {
//         console.error("Download error:", error);
//         res.status(500).json({
//           success: false,
//           message: "Failed to download export file",
//         });
//       } else {
//         setTimeout(() => {
//           if (fs.existsSync(filePath)) {
//             fs.unlinkSync(filePath);
//           }
//         }, 5000);
//       }
//     });
//   } catch (error) {
//     console.error("Export registrations error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to export registrations",
//       error: error.message,
//     });
//   }
// };

// // Simplified export images
// export const exportImages = async (req, res) => {
//   try {
//     const { sscBatch, status, section } = req.query;

//     const where = {
//       photo_path: { not: null },
//     };
//     if (sscBatch) where.ssc_batch = sscBatch;
//     if (status && status !== "all") where.status = status;
//     if
//       }
//     }

//     await prisma.student_registration_ssc.delete({
//       where: { id },
//     });

//     res.status(200).json({
//       success: true,
//       message: "Registration deleted successfully",
//     });
//   } catch (error) {
//     console.error("Delete registration error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to delete registration",
//       error: error.message,
//     });
//   }
// };

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
      "Birth Date": reg.birth_date || "",
      "Birth Year": reg.birth_year || "",
      "Birth Month": reg.birth_month || "",
      "Birth Day": reg.birth_day || "",
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
      "JSC Passing Year": reg.jsc_passing_year || "",
      "JSC Board": reg.jsc_board || "",
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
