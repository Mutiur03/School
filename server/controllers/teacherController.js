import generatePassword from "../utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import { initGoogleSheets } from "./studController.js";
import { fixUrl } from "../utils/fixURL.js"; // Add this import
const removeNonNumber = (str) => str.replace(/\D/g, "");
const { sheets, spreadsheetId } = await initGoogleSheets();
import { prisma } from "../config/prisma.js";

const validateFieldLengths = (data) => {
  const limits = {
    name: 100,
    email: 100,
    subject: 50,
    phone: 15,
    academic_qualification: 200,
    designation: 50,
    address: 255,
    blood_group: 5,
  };

  const validated = { ...data };

  Object.keys(limits).forEach((field) => {
    if (validated[field] && validated[field].length > limits[field]) {
      validated[field] = validated[field].substring(0, limits[field]);
    }
  });

  return validated;
};

export const addTeacher = async (req, res) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "An array of teachers is required",
      });
    }
    console.log(teachers);

    const teacherData = await Promise.all(
      teachers.map(
        async ({
          name,
          email,
          subject,
          phone,
          address,
          dob,
          blood_group,
          academic_qualification,
          designation,
        }) => {
          const originalPassword = generatePassword();
          const hashedPassword = await bcrypt.hash(originalPassword, 10);
          const rawData = {
            name: name?.trim() || null,
            email: email?.trim() || null,
            subject: subject?.trim() || null,
            phone: "0" + removeNonNumber(String(phone)).slice(-10) || null,
            academic_qualification: academic_qualification?.trim() || null,
            designation: designation?.trim() || null,
            address: address?.trim() || null,
            dob: dob ? dob.replace("/", "-") : null,
            blood_group: blood_group?.trim() || null,
            password: hashedPassword || null,
            originalPassword,
          };

          return validateFieldLengths(rawData);
        }
      )
    );

    const result = await prisma.teachers.createMany({
      data: teacherData.map(({ originalPassword, ...data }) => data),
    });

    // Fetch created teachers with their IDs
    const createdTeachers = await prisma.teachers.findMany({
      where: {
        email: {
          in: teacherData.map((t) => t.email),
        },
      },
    });

    // Append to sheet: [id, name, email, phone, subject, originalPassword]
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "teachers!A:F",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: createdTeachers.map((teacher, index) => [
          teacher.id,
          teacher.name,
          teacher.email,
          teacher.phone,
          teacher.subject,
          teacherData[index].originalPassword,
        ]),
      },
    });

    res.status(201).json({
      success: true,
      data: createdTeachers,
      message: "Teachers added successfully",
    });
  } catch (error) {
    console.error("Error adding teachers:", error.message);
    res.status(500).json({ success: false, error: "Error adding teachers" });
  }
};

export const getTeachers = async (_, res) => {
  try {
    const teachers = await prisma.teachers.findMany();
    res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    console.error("Error fetching teachers:", error.message);
    res.status(500).json({ success: false, error: "Error fetching teachers" });
  }
};

export const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    phone,
    subject,
    address,
    dob,
    blood_group,
    academic_qualification,
    designation,
  } = req.body;
  console.log(req.body);

  try {
    // Fetch previous teacher info to get the old email
    const prevTeacher = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });

    const rawData = {
      name: name || null,
      email: email || null,
      phone: "0" + removeNonNumber(phone).slice(-10) || null,
      subject: subject?.trim() || null,
      address: address || null,
      dob: dob ? dob.replace("/", "-") : null,
      blood_group: blood_group?.trim() || null,
      academic_qualification: academic_qualification?.trim() || null,
      designation: designation?.trim() || null,
    };

    const validatedData = validateFieldLengths(rawData);

    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: validatedData,
    });

    try {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "teachers!A:F",
      });

      const rows = sheetData.data.values || [];
      let rowIndex = -1;

      // Use previous email to find the correct row
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][2] === prevTeacher.email) {
          // column C is email
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `teachers!A${rowIndex}:E${rowIndex}`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [
              [
                id, // update teacher id in column A
                name?.trim() || "",
                email?.trim() || "",
                "0" + removeNonNumber(phone).slice(-10),
                subject?.trim() || "",
              ],
            ],
          },
        });
      }
    } catch (sheetError) {
      console.error("Error updating Google Sheet:", sheetError.message);
    }

    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher updated successfully",
    });
  } catch (error) {
    console.error("Error updating teacher:", error.message);
    res.status(500).json({ success: false, error: "Error updating teacher" });
  }
};

export const deleteTeacher = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: { available: false },
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting teacher:", error.message);
    res.status(500).json({ success: false, error: "Error deleting teacher" });
  }
};

export const UpdateTeacherImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = req.file;
    console.log(req.file);

    if (!image) {
      return res
        .status(400)
        .json({ success: false, error: "Image is required" });
    }

    const exists = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });

    if (exists?.image) {
      const oldImage = exists.image;
      if (fs.existsSync(oldImage)) {
        fs.unlinkSync(oldImage);
      }
    }

    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: { image: fixUrl(image.path) }, // Fix here
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        image: fixUrl(result.image), // Fix here for response
      },
      message: "Teacher image updated successfully",
    });
  } catch (error) {
    console.error("Error updating teacher image:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error updating teacher image" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    // You may want to get teacher id from session/auth, here we assume it's from req.user or req.body
    // For demo, let's assume req.user.id is available (set by auth middleware)
    const teacherId = req.user?.id || req.body.id;
    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }
    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Password must be at least 8 characters",
        });
    }
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Current password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.teachers.update({
      where: { id: teacherId },
      data: { password: hashedPassword },
    });

    // --- Update password in Google Sheet ---
    try {
      // Find the row for this teacher by email (column C, index 2)
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "teachers!A:F",
      });
      const rows = sheetData.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][2] === teacher.email) {
          rowIndex = i + 1; // 1-based index for Sheets API
          break;
        }
      }
      if (rowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `teachers!F${rowIndex}:F${rowIndex}`, // Column F is password
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [[newPassword]],
          },
        });
      }
    } catch (sheetError) {
      console.error(
        "Error updating password in Google Sheet:",
        sheetError.message
      );
      // Do not fail the API if sheet update fails
    }
    // --- End update password in Google Sheet ---

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error.message);
    res.status(500).json({ success: false, error: "Error changing password" });
  }
};
