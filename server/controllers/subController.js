import pool from "../config/db.js";

export const addSubController = async (req, res) => {
  try {
    const current_year = new Date().getFullYear();

    const { subjects } = req.body;

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Subjects data must be an array and cannot be empty",
      });
    }
    console.log(subjects);
    subjects.forEach((subject) => {
      subject.name = subject.name.trim();
      subject.department = subject.department?.trim();
      subject.department === "General" && (subject.department = null);
      subject.department === "general" && (subject.department = null);
    });

    const existingSubjects = [];
    for (let subject of subjects) {
      const result = await pool.query(
        `SELECT * FROM subjects WHERE name = $1 AND class = $2 AND department = $3 AND year = $4`,
        [subject.name, subject.class, subject.department || null, current_year]
      );

      if (result.rows.length > 0) {
        existingSubjects.push(subject.name);
      }
    }

    if (existingSubjects.length > 0) {
      return res.status(400).json({
        success: false,
        error: `The following subjects already exist: ${existingSubjects.join(
          ", "
        )}`,
      });
    }

    const subjectValues = subjects.map((subject) => [
      subject.name || null,
      subject.class || null,
      subject.full_mark || null,
      subject.pass_mark || null,
      subject.year || current_year,
      subject.teacher_id || null,
      subject.department || null,
    ]);

    const placeholders = subjectValues
      .map(
        (_, index) =>
          `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${
            index * 7 + 4
          }, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`
      )
      .join(", ");
    const flattenedValues = subjectValues.flat();

    const result = await pool.query(
      `INSERT INTO subjects (name, class, full_mark, pass_mark, year, teacher_id, department) VALUES ${placeholders} RETURNING *`,
      flattenedValues
    );
    console.log(result.rows);

    res.status(201).json({
      success: true,
      data: result.rows,
      message: "Subjects added successfully",
    });
  } catch (error) {
    console.error("Error adding subject:", error.message);
    res.status(500).json({ success: false, error: "Error adding subject" });
  }
};

export const getSubsController = async (req, res) => {
  try {
    const subjects = await pool.query(`
      SELECT 
        subjects.*, 
        teachers.name AS teacher_name 
      FROM subjects
      LEFT JOIN teachers ON subjects.teacher_id = teachers.id
    `);
    res.status(200).json({ success: true, data: subjects.rows });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: "Error fetching subjects" });
  }
};

export const deleteSubController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM subjects WHERE id = $1 RETURNING *",
      [id]
    );
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Error deleting subject:", error.message);
    res.status(500).json({ success: false, error: "Error deleting subject" });
  }
};

export const updateSubController = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      class: className,
      full_mark,
      pass_mark,
      year,
      teacher_id,
      department,
    } = req.body;

    const result = await pool.query(
      `UPDATE subjects SET name = $1, class = $2, full_mark = $3, pass_mark = $4, year = $5, teacher_id = $6, department = $7 WHERE id = $8 RETURNING *`,
      [
        name || null,
        className || null,
        full_mark || null,
        pass_mark || null,
        year || new Date().getFullYear(),
        teacher_id || null,
        department || null,
        id || null,
      ]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Subject not found" });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Error updating subject:", error.message);
    res.status(500).json({ success: false, error: "Error updating subject" });
  }
};
