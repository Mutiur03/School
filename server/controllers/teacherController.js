import pool from "../config/db.js";
import { google } from "googleapis";
import generatePassword from "../utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import fs from "fs";
import { initGoogleSheets } from "./studController.js";
const removeNonNumber = (str) => str.replace(/\D/g, "");
const { sheets, spreadsheetId } = await initGoogleSheets();

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
    const values = await Promise.all(
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
          return [
            name.trim() || null,
            email.trim() || null,
            subject?.trim() || null,
            "0" + removeNonNumber(String(phone)).slice(-10) || null,
            academic_qualification?.trim() || null,
            designation?.trim() || null,
            address?.trim() || null,
            dob ? dob.replace("/", "-") : null,
            blood_group?.trim() || null,
            hashedPassword || null,
            originalPassword || null,
          ];
        }
      )
    );

    const placeholders = values
      .map(
        (_, index) =>
          `($${index * 10 + 1}, $${index * 10 + 2}, $${index * 10 + 3}, $${
            index * 10 + 4
          }, $${index * 10 + 5}, $${index * 10 + 6}, $${index * 10 + 7}, $${
            index * 10 + 8
          }, $${index * 10 + 9}, $${index * 10 + 10})`
      )
      .join(", ");

    const flatValues = values.map((v) => v.slice(0, -1)).flat(); // Exclude original password for DB query

    const query = `
      INSERT INTO teachers (name, email,subject, phone, academic_qualification, designation, address, dob, blood_group, password)
      VALUES ${placeholders}
      RETURNING *
    `;

    const result = await pool.query(query, flatValues);
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "teachers!A:E",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: teachers.map(({ name, email, phone, subject }, index) => [
          name,
          email,
          phone,
          subject,
          values[index][values[index].length - 1],
        ]),
      },
    });
    res.status(201).json({
      success: true,
      data: result.rows,
      message: "Teachers added successfully",
    });
  } catch (error) {
    console.error("Error adding teachers:", error.message);
    res.status(500).json({ success: false, error: "Error adding teachers" });
  }
};

export const getTeachers = async (_, res) => {
  try {
    const teachers = await pool.query(`SELECT * FROM teachers`);
    res.status(200).json({ success: true, data: teachers.rows });
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
    const result = await pool.query(
      `UPDATE teachers SET name = $1, email = $2, phone = $3,subject = $4, address = $6, dob = $7, blood_group = $8, academic_qualification = $9, designation = $10 WHERE id = $5 RETURNING *`,
      [
        name || null,
        email || null,
        "0" + removeNonNumber(phone).slice(-10) || null,
        subject.trim() || null,
        id,
        address || null,
        dob ? dob.replace("/", "-") : null,
        blood_group?.trim() || null,
        academic_qualification?.trim() || null,
        designation?.trim() || null,
      ]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
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
    const result = await pool.query(
      `update teachers set available = false where id = $1 RETURNING *`,
      [id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
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
    const exists = await pool.query(`SELECT * FROM teachers WHERE id = $1`, [
      id,
    ]);
    if (exists.rows[0].image) {
      const oldImage = exists.rows[0].image;
      if (fs.existsSync(oldImage)) {
        fs.unlinkSync(oldImage);
      }
    }
    const result = await pool.query(
      `UPDATE teachers SET image = $1 WHERE id = $2 RETURNING *`,
      [image.path, id]
    );
    res.status(200).json({
      success: true,
      data: result.rows,
      message: "Teacher image updated successfully",
    });
  } catch (error) {
    console.error("Error updating teacher image:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error updating teacher image" });
  }
};
