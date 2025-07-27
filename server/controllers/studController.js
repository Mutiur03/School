import { google } from "googleapis";
import generatePassword from "../utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import { prisma } from "../config/prisma.js";
import { fixUrl } from "../utils/fixURL.js";

export const initGoogleSheets = async () => {
  try {
    const requiredEnvVars = {
      client_email: process.env.client_email,
      private_key: process.env.private_key,
      SHEET_ID: process.env.SHEET_ID,
    };

    const missingVars = Object.entries(requiredEnvVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(", ")}`
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.client_email,
        private_key: process.env.private_key.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;
    return { sheets, spreadsheetId };
  } catch (error) {
    throw new Error(
      `Google Sheets API initialization failed: ${error.message}`
    );
  }
};

const { sheets, spreadsheetId } = await initGoogleSheets();

const removeNonNumber = (str) => str.replace(/\D/g, "");
const removeInitialZeros = (str) => str.replace(/^0+/, "");
const current_year = new Date().getFullYear();

export const getAlumniController = async (_req, res) => {
  try {
    const students = await prisma.students.findMany();
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: "Error fetching students" });
  }
};

export const getStudentsController = async (_req, res) => {
  try {
    const { year } = _req.params;

    // Validate year parameter
    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({
        success: false,
        message: "Invalid year parameter. Year must be a valid number.",
      });
    }

    const parsedYear = parseInt(year);

    // Validate year range (optional but recommended)
    const currentYear = new Date().getFullYear();
    if (parsedYear < 2000 || parsedYear > currentYear + 5) {
      return res.status(400).json({
        success: false,
        message: `Invalid year. Year must be between 2000 and ${
          currentYear + 5
        }.`,
      });
    }

    console.log(`Fetching students for year: ${parsedYear}`);

    const result = await prisma.students.findMany({
      include: {
        enrollments: {
          where: { year: parsedYear },
          orderBy: { year: "desc" },
        },
      },
    });

    console.log(`Found ${result.length} students`);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found for the specified year",
      });
    }

    const formattedResult = result.flatMap((student) =>
      student.enrollments.map((enrollment) => ({
        ...student,
        ...enrollment,
        enrollment_id: enrollment.id,
      }))
    );

    console.log(`Formatted ${formattedResult.length} student enrollments`);

    res.status(200).json({ success: true, data: formattedResult });
  } catch (error) {
    console.error("Error in getStudentsController:", error);
    console.error("Error stack:", error.stack);

    // More specific error responses
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "Database constraint violation",
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Record not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Error fetching students",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const getStudentController = async (req, res) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = decoded.id;

    const result = await prisma.students.findUnique({
      where: { id: studentId },
      include: {
        enrollments: {
          where: { year: new Date().getFullYear() },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    if (!result || result.enrollments.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const responseData = {
      ...result,
      ...result.enrollments[0],
      enrollment_id: result.enrollments[0].id,
    };

    res.status(200).json({ success: true, data: responseData });
  } catch (error) {
    res.status(500).json({ error: "Error fetching student" });
  }
};

export const addStudentController = async (req, res) => {
  try {
    const { students } = req.body;

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Students must be an array with at least one element.",
      });
    }

    console.log(`Processing ${students.length} students`);

    const batchLoginIdMap = {};
    const processedStudents = [];

    for (let i = 0; i < students.length; i++) {
      try {
        const student = students[i];

        // Basic validation
        if (!student.name || !student.name.trim()) {
          throw new Error(`Student at index ${i}: Name is required`);
        }

        student.name = student.name?.trim();
        student.father_name = student.father_name?.trim() || null;
        student.mother_name = student.mother_name?.trim() || null;

        // Fix phone number processing
        if (student.phone) {
          const cleanPhone = removeNonNumber(String(student.phone));
          student.phone =
            cleanPhone.length >= 10 ? "0" + cleanPhone.slice(-10) : null;
        } else {
          student.phone = null;
        }

        if (student.parent_phone) {
          const cleanParentPhone = removeNonNumber(
            String(student.parent_phone)
          );
          student.parent_phone =
            cleanParentPhone.length >= 10
              ? "0" + cleanParentPhone.slice(-10)
              : null;
        } else {
          student.parent_phone = null;
        }

        student.address = student.address?.trim() || null;
        student.dob = student.dob ? student.dob.replace("/", "-") : null;
        student.has_stipend = Boolean(student.has_stipend);
        student.blood_group = student.blood_group?.trim() || null;

        // Generate and hash password
        let password = generatePassword();
        student.originalPassword = password;
        student.password = await bcrypt.hash(password, 10);

        // Process academic data
        const classNum = Number(removeInitialZeros(String(student.class || 1)));
        if (classNum < 1 || classNum > 12) {
          throw new Error(
            `Student at index ${i}: Invalid class number: ${classNum}`
          );
        }

        student.class = classNum;
        student.section = (student.section?.trim() || "A").toUpperCase();
        student.roll = Number(removeInitialZeros(String(student.roll || 1)));

        // Fix batch calculation - convert to string as required by schema
        const batchYear = current_year + 11 - classNum;
        student.batch = String(batchYear); // Convert to string to match Char(4) type

        student.department =
          classNum >= 9 ? student.department?.trim() || null : null;
        student.year = student.year || current_year;

        // Generate login_id
        if (!batchLoginIdMap[student.batch]) {
          const result = await prisma.students.findMany({
            where: { batch: student.batch },
            orderBy: { login_id: "desc" },
            take: 1,
          });

          batchLoginIdMap[student.batch] =
            result.length > 0 && result[0].login_id
              ? result[0].login_id + 1
              : parseInt(student.batch.toString().slice(-2) + "001");
        }

        student.login_id = batchLoginIdMap[student.batch];
        batchLoginIdMap[student.batch] += 1;

        processedStudents.push(student);
        console.log(`Processed student ${i + 1}:`, {
          name: student.name,
          login_id: student.login_id,
          batch: student.batch,
          class: student.class,
        });
      } catch (error) {
        console.error(`Error processing student at index ${i}:`, error.message);
        return res.status(400).json({
          success: false,
          error: `Error processing student at index ${i}: ${error.message}`,
        });
      }
    }

    // Use transaction to ensure data consistency
    const insertedStudents = [];
    const insertedEnrollments = [];

    for (let i = 0; i < processedStudents.length; i++) {
      const student = processedStudents[i];

      try {
        const result = await prisma.$transaction(async (tx) => {
          const insertedStudent = await tx.students.create({
            data: {
              login_id: student.login_id,
              name: student.name,
              father_name: student.father_name,
              mother_name: student.mother_name,
              phone: student.phone,
              parent_phone: student.parent_phone,
              batch: student.batch,
              address: student.address,
              dob: student.dob,
              blood_group: student.blood_group,
              has_stipend: student.has_stipend,
              password: student.password,
            },
          });

          const insertedEnrollment = await tx.student_enrollments.create({
            data: {
              student_id: insertedStudent.id,
              class: student.class,
              roll: student.roll,
              section: student.section,
              year: student.year,
              department: student.department,
            },
          });

          return { insertedStudent, insertedEnrollment };
        });

        insertedStudents.push(result.insertedStudent);
        insertedEnrollments.push(result.insertedEnrollment);

        console.log(`Inserted student ${i + 1}: ${student.name}`);
      } catch (error) {
        console.error(
          `Error inserting student "${student.name}":`,
          error.message
        );
        return res.status(500).json({
          success: false,
          error: `Failed to insert student "${student.name}": ${error.message}`,
        });
      }
    }

    // Update Google Sheets
    try {
      const sheetData = processedStudents.map((student) => [
        student.login_id,
        student.name,
        student.phone || "",
        student.originalPassword,
        student.batch,
      ]);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "students!A1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: sheetData,
        },
      });
      console.log("Successfully updated Google Sheets");
    } catch (sheetError) {
      console.error("Google Sheets update failed:", sheetError.message);
      // Don't fail the entire operation if sheets update fails
    }

    console.log(
      `Successfully inserted ${insertedStudents.length} students and ${insertedEnrollments.length} enrollments`
    );

    res.status(201).json({
      success: true,
      data: insertedEnrollments,
      message: `Successfully added ${insertedStudents.length} students`,
      inserted_count: insertedStudents.length,
    });
  } catch (error) {
    console.error("Error in addStudentController:", error);
    console.error("Error stack:", error.stack);

    // More specific error responses
    if (error.code === "P2002") {
      const target = error.meta?.target;
      return res.status(409).json({
        success: false,
        error: `Duplicate entry detected${
          target ? ` for ${target.join(", ")}` : ""
        }`,
        details: "A student with this login_id or phone number already exists",
      });
    }

    if (error.code === "P2003") {
      return res.status(400).json({
        success: false,
        error: "Foreign key constraint failed",
        details: error.message,
      });
    }

    res.status(500).json({
      success: false,
      error: "Error adding students",
      details:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const columnMapping = {
  login_id: 0,
  name: 1,
  phone: 2,
  originalPassword: 3,
  batch: 4,
};

const getColumnIndex = (field) => {
  return columnMapping[field] !== undefined ? columnMapping[field] : -1;
};

export const updateStudentController = async (req, res) => {
  try {
    if (req.body.phone) {
      req.body.phone = "0" + removeNonNumber(String(req.body.phone)).slice(-10);
    }
    if (req.body.parent_phone) {
      req.body.parent_phone =
        "0" + removeNonNumber(String(req.body.parent_phone)).slice(-10);
    }
    if (req.body.dob) {
      req.body.dob = new Date(req.body.dob).toISOString().split("T")[0];
    }

    const { id } = req.params;
    const updates = req.body;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const result = await prisma.students.update({
      where: { id: parseInt(id) },
      data: updates,
    });

    const loginId = result.login_id;

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });

    const rows = sheetData.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === String(loginId));

    if (rowIndex !== -1) {
      const updatedRow = rows[rowIndex];
      Object.keys(updates).forEach((key) => {
        const columnIndex = getColumnIndex(key);
        if (columnIndex !== -1) {
          updatedRow[columnIndex] = result[key];
        }
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `students!A${rowIndex + 1}:Z${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [updatedRow],
        },
      });
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: "Error updating student" });
  }
};

export const deleteStudentController = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await prisma.students.findUnique({
      where: { id: parseInt(id) },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const loginId = student.login_id;

    await prisma.students.delete({
      where: { id: parseInt(id) },
    });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });

    const rows = sheetData.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === String(loginId));

    if (rowIndex !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: 0,
                  dimension: "ROWS",
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1,
                },
              },
            },
          ],
        },
      });
    }

    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting student" });
  }
};

export const updateAcademicInfoController = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const updates = req.body;

    // Validate enrollment_id
    if (!enrollment_id || isNaN(parseInt(enrollment_id))) {
      return res.status(400).json({
        success: false,
        error: "Invalid enrollment_id parameter",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No valid academic fields provided",
      });
    }

    // Validate and convert data types
    const processedUpdates = {};

    if (updates.class !== undefined) {
      const classNum = parseInt(updates.class);
      if (isNaN(classNum) || classNum < 1 || classNum > 12) {
        return res.status(400).json({
          success: false,
          error: "Invalid class number. Must be between 1 and 12.",
        });
      }
      processedUpdates.class = classNum;
    }

    if (updates.roll !== undefined) {
      const rollNum = parseInt(updates.roll);
      if (isNaN(rollNum) || rollNum < 1) {
        return res.status(400).json({
          success: false,
          error: "Invalid roll number. Must be a positive integer.",
        });
      }
      processedUpdates.roll = rollNum;
    }

    if (updates.section !== undefined) {
      processedUpdates.section = updates.section
        .toString()
        .trim()
        .toUpperCase();
    }

    if (updates.department !== undefined) {
      processedUpdates.department = updates.department
        ? updates.department.toString().trim()
        : null;
    }

    if (updates.year !== undefined) {
      const yearNum = parseInt(updates.year);
      if (isNaN(yearNum)) {
        return res.status(400).json({
          success: false,
          error: "Invalid year. Must be a valid number.",
        });
      }
      processedUpdates.year = yearNum;
    }

    console.log(
      `Updating academic info for enrollment_id: ${enrollment_id}`,
      processedUpdates
    );

    // Use transaction for data consistency
    const result = await prisma.$transaction(async (tx) => {
      const enrollment = await tx.student_enrollments.update({
        where: { id: parseInt(enrollment_id) },
        data: processedUpdates,
      });

      if (!enrollment) {
        throw new Error("Enrollment record not found");
      }

      const updatedClass = enrollment.class;

      const studentInfo = await tx.students.findUnique({
        where: { id: enrollment.student_id },
        select: { batch: true, login_id: true, id: true },
      });

      if (!studentInfo) {
        throw new Error("Student not found");
      }

      const oldBatch = parseInt(studentInfo.batch);
      const currentLoginId = studentInfo.login_id;
      const currentYear = new Date().getFullYear();
      const newBatch = currentYear + 11 - updatedClass;

      let newLoginId = currentLoginId;
      let updatedStudent = null;

      if (newBatch !== oldBatch) {
        console.log(`Batch change detected: ${oldBatch} -> ${newBatch}`);

        const maxLoginResult = await tx.students.findMany({
          where: { batch: String(newBatch) },
          orderBy: { login_id: "desc" },
          take: 1,
        });

        const maxLoginId =
          maxLoginResult.length > 0 ? maxLoginResult[0].login_id : null;
        newLoginId = maxLoginId
          ? maxLoginId + 1
          : parseInt(newBatch.toString().slice(-2) + "001");

        updatedStudent = await tx.students.update({
          where: { id: enrollment.student_id },
          data: {
            batch: String(newBatch),
            login_id: newLoginId,
          },
        });

        console.log(`Updated student batch and login_id: ${newLoginId}`);
      }

      return {
        enrollment,
        updatedStudent,
        oldLoginId: currentLoginId,
        newLoginId,
      };
    });

    // Update Google Sheets (non-blocking)
    if (result.updatedStudent) {
      try {
        const sheetData = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: "students!A1:Z",
        });

        const rows = sheetData.data.values || [];
        const batchCol = getColumnIndex("batch");
        const loginIdCol = getColumnIndex("login_id");

        const rowIndex = rows.findIndex((row) => {
          return (
            String(row[loginIdCol]).trim() === String(result.oldLoginId).trim()
          );
        });

        if (rowIndex !== -1) {
          rows[rowIndex][loginIdCol] = result.newLoginId;
          rows[rowIndex][batchCol] = result.updatedStudent.batch;

          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `students!A${rowIndex + 1}:Z${rowIndex + 1}`,
            valueInputOption: "RAW",
            requestBody: {
              values: [rows[rowIndex]],
            },
          });
          console.log("Successfully updated Google Sheets");
        }
      } catch (sheetError) {
        console.error(
          "Google Sheets update failed (non-blocking):",
          sheetError.message
        );
      }
    }

    res.status(200).json({
      success: true,
      message: "Academic info updated successfully",
      data: result.enrollment,
    });
  } catch (error) {
    console.error("Error in updateAcademicInfoController:", error);
    console.error("Error stack:", error.stack);

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Enrollment record not found",
      });
    }

    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "Duplicate entry detected",
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export const updateStudentImageController = async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = req.file ? fixUrl(req.file.path) : null;

    const existingStudent = await prisma.students.findUnique({
      where: { id: parseInt(id) },
    });

    if (existingStudent?.image) {
      const oldFilePath = existingStudent.image;
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }
    
    const result = await prisma.students.update({
      where: { id: parseInt(id) },
      data: { image: filePath },
    });

    if (!result) {
      return res.status(404).json({ error: "Student not found" });
    }

    res.status(200).json({
      success: true,
      message: "Student image updated successfully",
      data: result,
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const changePasswordController = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = decoded.id;

    const student = await prisma.students.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.students.update({
      where: { id: studentId },
      data: { password: hashedNewPassword },
    });

    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });

    const rows = sheetData.data.values || [];
    const rowIndex = rows.findIndex(
      (row) => row[0] === String(student.login_id)
    );

    if (rowIndex !== -1) {
      const updatedRow = rows[rowIndex];
      const columnIndex = getColumnIndex("originalPassword");
      if (columnIndex !== -1) {
        updatedRow[columnIndex] = newPassword;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `students!A${rowIndex + 1}:Z${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [updatedRow],
        },
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getClassStudentsController = async (_req, res) => {
  try {
    const { year, level } = _req.params;

    // Validate year parameter
    if (!year || isNaN(parseInt(year)) || !level || isNaN(parseInt(level))) {
      return res.status(400).json({
        success: false,
        message: "Invalid year parameter. Year must be a valid number.",
      });
    }

    const parsedYear = parseInt(year);
    const parsedLevel = parseInt(level);

    // Validate year range (optional but recommended)
    const currentYear = new Date().getFullYear();
    if (parsedYear < 2000 || parsedYear > currentYear + 5) {
      return res.status(400).json({
        success: false,
        message: `Invalid year. Year must be between 2000 and ${
          currentYear + 5
        }.`,
      });
    }

    console.log(`Fetching students for year: ${parsedYear}`);

    const result = await prisma.students.findMany({
      include: {
        enrollments: {
          where: { year: parsedYear, class: parsedLevel },
          orderBy: { year: "desc" },
        },
      },
    });

    console.log(`Found ${result.length} students`);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No students found for the specified year",
      });
    }

    const formattedResult = result.flatMap((student) =>
      student.enrollments.map((enrollment) => ({
        ...student,
        ...enrollment,
        enrollment_id: enrollment.id,
      }))
    );

    console.log(`Formatted ${formattedResult.length} student enrollments`);

    res.status(200).json({ success: true, data: formattedResult });
  } catch (error) {
    console.error("Error in getStudentsController:", error);
    console.error("Error stack:", error.stack);

    // More specific error responses
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "Database constraint violation",
      });
    }

    if (error.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Record not found",
      });
    }

    res.status(500).json({
      success: false,
      error: "Error fetching students",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
