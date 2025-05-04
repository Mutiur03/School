import pool from "../config/db.js";

// Update addExamController to include dates
export const addExamController = async (req, res) => {
  const { exams } = req.body;

  try {
    if (!Array.isArray(exams) || exams.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Exams must be an array with at least one element.",
      });
    }

    for (let exam of exams) {
      exam.exam_name = exam.exam_name?.trim();
      const exists = await pool.query(
        "SELECT * FROM exams WHERE exam_name = $1 AND exam_year = $2",
        [exam.exam_name, exam.exam_year]
      );
      if (exists.rows.length !== 0) {
        return res.status(400).json({
          success: false,
          error: `Exam "${exam.exam_name}" for year ${exam.exam_year} already exists`,
        });
      }
    }

    const examValues = exams.map((exam) => [
      exam.exam_name || null,
      exam.exam_year || null,
      exam.levels || null,
      exam.start_date || null,
      exam.end_date || null,
      exam.result_date || null,
    ]);
    const placeholders = examValues
      .map(
        (_, index) =>
          `($${index * 6 + 1}, $${index * 6 + 2}, $${index * 6 + 3}, $${
            index * 6 + 4
          }, $${index * 6 + 5}, $${index * 6 + 6})`
      )
      .join(", ");
    const flattenedValues = examValues.flat();

    const query = `INSERT INTO exams (exam_name, exam_year, levels, start_date, end_date, result_date) VALUES ${placeholders} RETURNING *`;
    const insertedExams = await pool.query(query, flattenedValues);

    res.status(201).json({
      success: true,
      data: insertedExams.rows,
      message: "Exam added successfully",
    });
  } catch (error) {
    console.error("Error adding exams:", error);
    res.status(500).json({
      success: false,
      error: "Error adding exams. Check if there are any duplicates or issues",
    });
  }
};

// Update updateExamController to include dates
export const updateExamController = async (req, res) => {
  const { examId } = req.params;
  const { exam_name, exam_year, levels, start_date, end_date, result_date } =
    req.body;

  try {
    console.log(start_date);

    const updated = await pool.query(
      `UPDATE exams 
       SET exam_name = $1, exam_year = $2, levels = $3, start_date = $4, end_date = $5, result_date = $6
       WHERE id = $7 
       RETURNING *`,
      [
        exam_name.trim() || null,
        exam_year || null,
        levels || null,
        start_date || null,
        end_date || null,
        result_date || null,
        examId ,
      ]
    );

    if (updated.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.status(200).json({
      success: true,
      data: updated.rows[0],
      message: "Exam updated successfully",
    });
  } catch (error) {
    console.error("Error updating exam:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update exam. Check for duplicates or data issues.",
    });
  }
};

// Get Exams
export const getExamsController = async (req, res) => {
  try {
    const exams = await pool.query("SELECT * FROM exams");
    res.status(200).json({ success: true, data: exams.rows });
  } catch (error) {
    console.error("Error fetching exams:", error);
    res.status(500).json({ success: false, error: "Error fetching exams" });
  }
};

// Update Visibility
export const updateExamVisibilityController = async (req, res) => {
  const { examId } = req.params;
  const { visible } = req.body;

  try {
    const result = await pool.query(
      "UPDATE exams SET visible = $1 WHERE id = $2 RETURNING *",
      [visible, examId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    res.status(200).json({
      success: true,
      data: result.rows[0],
      message: `Exam visibility updated to ${visible}`,
    });
  } catch (error) {
    console.error("Error updating exam visibility:", error);
    res
      .status(500)
      .json({ success: false, error: "Error updating visibility" });
  }
};


export const deleteExamController = async (req, res) => {
  const { examId } = req.params;

  try {
    const deleted = await pool.query(
      "DELETE FROM exams WHERE id = $1 RETURNING *",
      [examId]
    );

    if (deleted.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Exam not found" });
    }

    res.status(200).json({
      success: true,
      data: deleted.rows[0],
      message: "Exam deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting exam:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete exam. Please try again later.",
    });
  }
};
