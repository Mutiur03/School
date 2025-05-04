import pool from "../config/db.js";
import { google } from "googleapis";
import generatePassword from "../utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";

const auth = new google.auth.GoogleAuth({
  keyFile: "../server/utils/lbpghs-76d5794c5a45.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = "1a49EfWqAsH9BQLCHMLunVlC9-mqgdOmH685GjOaadtI";
const removeNonNumber = (str) => str.replace(/\D/g, "");
const removeInitialZeros = (str) => str.replace(/^0+/, "");
const current_year = new Date().getFullYear();
export const getAlumniController = async (_req, res) => {
  try {
    const students = await pool.query("SELECT * FROM students");
    res.status(200).json(students.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error fetching students" });
  }
};
export const getStudentsController = async (_req, res) => {
  try {
    const { year } = _req.params;
    const result = await pool.query(
      `SELECT
        s.*,
        se.*,
        se.id AS enrollment_id
        FROM students s
        JOIN student_enrollments se ON s.id = se.student_id
        WHERE se.year = $1
        ORDER BY se.year DESC;
        `,
      [year]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No students found" });
    }
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Error fetching students" });
  }
};
export const getStudentController = async (req, res) => {
  try {
    const token = req.cookies?.token;
    console.log(token);
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = decoded.id;
    console.log(studentId);
    const result = await pool.query(
      `SELECT s.*, se.*, se.id AS enrollment_id FROM students s JOIN student_enrollments se ON s.id = se.student_id WHERE s.id = $1 and se.year = $2 ORDER BY se.year DESC LIMIT 1;`,
      [studentId, new Date().getFullYear()]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Error fetching student" });
  }
};
export const addStudentController = async (req, res) => {
  try {
    const { students } = req.body;
    console.log(students);
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Students must be an array with at least one element.",
      });
    }
    const batchLoginIdMap = {};
    for (let student of students) {
      console.log(student);
      student.name = student.name?.trim();
      student.father_name = student.father_name?.trim();
      student.mother_name = student.mother_name?.trim();
      student.phone = "0" + removeNonNumber(String(student.phone)).slice(-10);
      student.parent_phone =
        "0" + removeNonNumber(String(student.parent_phone)).slice(-10);
      student.address = student.address?.trim();
      student.dob = student.dob ? student.dob.replace("/", "-") : null;
      student.has_stipend = student.has_stipend || false;
      student.blood_group = student.blood_group?.trim() || null;
      let password = generatePassword();
      student.originalPassword = password;
      student.password = await bcrypt.hash(password, 10);
      student.class = Number(removeInitialZeros(String(student.class)));
      student.section = student.section?.trim() || "Z";
      student.roll = Number(removeInitialZeros(String(student.roll)));
      student.batch = current_year + 11 - Number(student.class);
      student.department = student.class >= 9 && student.department?.trim();
      if (!batchLoginIdMap[student.batch]) {
        const result = await pool.query(
          "SELECT MAX(login_id) AS max_login_id FROM students WHERE batch = $1",
          [student.batch]
        );
        batchLoginIdMap[student.batch] = result.rows[0].max_login_id
          ? result.rows[0].max_login_id + 1
          : parseInt(student.batch.toString().slice(-2) + "001");
      }
      student.login_id = batchLoginIdMap[student.batch];
      batchLoginIdMap[student.batch] += 1;
    }
    const valuesForStudent = students.map(
      ({
        name,
        phone,
        batch,
        address,
        dob,
        password,
        login_id,
        father_name,
        mother_name,
        parent_phone,
        has_stipend,
        blood_group,
      }) => [
        login_id || null,
        name || null,
        phone || null,
        batch || null,
        address || null,
        dob || null,
        password || null,
        father_name || null,
        mother_name || null,
        parent_phone || null,
        has_stipend,
        blood_group || null,
      ]
    );
    const flatValuesForStudent = valuesForStudent.flat();
    const placeholderForStudent = valuesForStudent
      .map(
        (_, index) =>
          `($${index * 12 + 1}, $${index * 12 + 2}, $${index * 12 + 3}, $${
            index * 12 + 4
          }, $${index * 12 + 5}, $${index * 12 + 6}, $${index * 12 + 7}, $${
            index * 12 + 8
          }, $${index * 12 + 9}, $${index * 12 + 10}, $${index * 12 + 11}, $${
            index * 12 + 12
          })`
      )
      .join(",");
    const queryForStudent = `INSERT INTO students (login_id, name, phone, batch, address, dob, password, father_name, mother_name, parent_phone, has_stipend, blood_group) VALUES ${placeholderForStudent} RETURNING id`;
    const insertedStudents = await pool.query(
      queryForStudent,
      flatValuesForStudent
    );
    const studentIds = insertedStudents.rows.map((student) => student.id);
    const valuesForEnrollment = students.map((student, index) => [
      studentIds[index],
      student.class,
      student.roll,
      student.section,
      student.year || new Date().getFullYear(),
      student.department === false ? null : student.department,
    ]);
    const flatValuesForEnrollment = valuesForEnrollment.flat();
    const placeholderForEnrollment = valuesForEnrollment
      .map(
        (_, index) =>
          `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${
            index * 6 + 4
          }, $${index * 6 + 5}, $${index * 6 + 6})`
      )
      .join(",");
    const queryForEnrollment = `INSERT INTO student_enrollments (student_id, class, roll, section, year, department) VALUES ${placeholderForEnrollment} RETURNING *`;
    const insertedEnrollments = await pool.query(
      queryForEnrollment,
      flatValuesForEnrollment
    );
    const sheetData = students.map((student) => [
      student.login_id,
      student.name,
      student.phone,
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
    res.status(201).json({
      success: true,
      data: insertedEnrollments.rows,
      message: "Students added successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Error adding students" });
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
    const fields = [];
    const values = [];
    let index = 1;
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${index}`);
      values.push(value || null);
      index++;
    }
    if (fields.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    console.log(req.body);
    values.push(id);
    const query = `UPDATE students SET ${fields.join(
      ", "
    )} WHERE id = $${index} RETURNING *`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const updatedStudent = result.rows[0];
    const loginId = updatedStudent.login_id;
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });
    const rows = sheetData.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === String(loginId));
    if (rowIndex !== -1) {
      const updatedRow = rows[rowIndex];
      Object.keys(updates).forEach((key, i) => {
        const columnIndex = getColumnIndex(key);
        if (columnIndex !== -1) {
          updatedRow[columnIndex] = updatedStudent[key];
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
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({ error: "Error updating student" });
  }
};
export const deleteStudentController = async (req, res) => {
  try {
    const { id } = req.params;
    const studentResult = await pool.query(
      "SELECT login_id FROM students WHERE id = $1",
      [id]
    );
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const loginId = studentResult.rows[0].login_id;
    await pool.query("DELETE FROM students WHERE id = $1", [id]);
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
    console.log(error);
    res.status(500).json({ error: "Error deleting student" });
  }
};
export const updateAcademicInfoController = async (req, res) => {
  try {
    const { enrollment_id } = req.params;
    const updates = req.body;
    const fields = [];
    const values = [];
    let index = 1;
    console.log(updates);
    
    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = $${index}`);
      values.push(value || null);
      index++;
    }
    if (fields.length === 0) {
      return res
        .status(400)
        .json({ error: "No valid academic fields provided" });
    }
    values.push(enrollment_id);
    const enrollmentQuery = `
      UPDATE student_enrollments
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *`;
    const result = await pool.query(enrollmentQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Enrollment record not found" });
    }
    const updatedEnrollment = result.rows[0];
    const updatedClass = updatedEnrollment.class;
    const studentInfo = await pool.query(
      "SELECT batch, login_id FROM students WHERE id = $1",
      [updatedEnrollment.student_id]
    );
    if (studentInfo.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const oldBatch = parseInt(studentInfo.rows[0].batch);
    const currentLoginId = studentInfo.rows[0].login_id;
    const currentYear = new Date().getFullYear();
    const newBatch = currentYear + 11 - updatedClass;
    let newLoginId = currentLoginId;
    if (newBatch !== oldBatch) {
      const loginIdResult = await pool.query(
        "SELECT MAX(login_id) AS max_login_id FROM students WHERE batch = $1",
        [newBatch]
      );
      const maxLoginId = loginIdResult.rows[0].max_login_id;
      newLoginId = maxLoginId
        ? maxLoginId + 1
        : parseInt(newBatch.toString().slice(-2) + "001");
      await pool.query(
        "UPDATE students SET batch = $1, login_id = $2 WHERE id = $3",
        [newBatch, newLoginId, updatedEnrollment.student_id]
      );
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "students!A1:Z",
      });
      const rows = sheetData.data.values || [];
      const batchCol = getColumnIndex("batch");
      const loginIdCol = getColumnIndex("login_id");
      const rowIndex = rows.findIndex((row, i) => {
        return String(row[loginIdCol]).trim() === String(currentLoginId).trim();
      });
      if (rowIndex !== -1) {
        rows[rowIndex][loginIdCol] = newLoginId;
        rows[rowIndex][batchCol] = newBatch;
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `students!A${rowIndex + 1}:Z${rowIndex + 1}`,
          valueInputOption: "RAW",
          requestBody: {
            values: [rows[rowIndex]],
          },
        });
      }
    }
    res.status(200).json({
      success: true,
      message: "Academic info updated successfully",
      data: updatedEnrollment,
    });
  } catch (error) {
    console.error("Error updating academic info:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const updateStudentImageController = async (req, res) => {
  try {
    const { id } = req.params;
    const filePath = req.file? req.file.path : null;
    console.log(filePath);
    const exists = await pool.query("SELECT * FROM students WHERE id = $1", [
      id,
    ]);
    if (exists.rows[0].image) {
      const filePath = exists.rows[0].image;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    const result = await pool.query(
      "UPDATE students SET image = $1 WHERE id = $2 RETURNING *",
      [filePath, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    res.status(200).json({
      success: true,
      message: "Student image updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating student image:", error);
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
    const result = await pool.query(
      "SELECT * FROM students WHERE id = $1",
      [studentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }
    const student = result.rows[0];
    const isMatch = await bcrypt.compare(currentPassword, student.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE students SET password = $1 WHERE id = $2",
      [hashedNewPassword, studentId]
    );


    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "students!A1:Z",
    });
    const rows = sheetData.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === String(result.rows[0].login_id));
    console.log(rowIndex);
    const loginId = result.rows[0].login_id;
    console.log(loginId);
    
    if (rowIndex !== -1) {
      const updatedRow = rows[rowIndex];
        const columnIndex = getColumnIndex("originalPassword");
        if (columnIndex !== -1) {
          updatedRow[columnIndex] = newPassword;
        }
      console.log(updatedRow,columnIndex);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `students!A${rowIndex + 1}:Z${rowIndex + 1}`,
        valueInputOption: "RAW",
        requestBody: {
          values: [updatedRow],
        },
      });
    }


    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};