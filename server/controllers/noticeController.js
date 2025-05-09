import pool from "../config/db.js";
import fs from "fs";

export const addNoticeController = async (req, res) => {
  try {
    const { title, details } = req.body;
    const { file } = req;

    console.log(title, details, file);
    const insert = `INSERT INTO notices (title, details, file) VALUES ($1, $2, $3) RETURNING *`;
    pool.query(insert, [title, details, file.path], (err, result) => {
      if (err) {
        console.error("Error inserting notice:", err);
        res.status(500).json({ error: "Error inserting notice" });
      } else {
        res.status(201).json(result.rows[0]);
      }
    });
  } catch (error) {
    console.error("Error adding notice:", error);
    res.status(500).json({ error: "Error adding notice" });
  }
};

export const getNoticesController = async (_, res) => {
  try {
    const notices = await pool.query(`SELECT * FROM notices`);
    res.status(200).json(notices.rows);
  } catch (error) {
    console.error("Error fetching notices:", error.message);
    res.status(500).json({ error: "Error fetching notices" });
  }
};

export const getNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`SELECT file FROM notices WHERE id = $1`, [
      id,
    ]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Notice not found" });
    }
    const filePath = path.join(__dirname, "..", "uploads", result.rows[0].file);
    res.download(filePath);
  } catch (error) {
    console.error("Error fetching notice:", error.message);
    res.status(500).json({ success: false, error: "Error fetching notice" });
  }
};

export const deleteNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM notices WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Notice not found" });
    }

    const filePath = result.rows[0].file;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("Error deleting notice:", error.message);
    res.status(500).json({ error: "Error deleting notice" });
  }
};

export const updateNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, details } = req.body;
    const { file } = req;
    console.log(title, details, file);
    let result;
    if (!file) {
      result = await pool.query(
        `UPDATE notices SET title = $1, details = $2 WHERE id = $3 RETURNING *`,
        [title, details, id]
      );
    } else {
      const exists = await pool.query("SELECT * FROM notices WHERE id = $1", [
        id,
      ]);
      const filePath = exists.rows[0].file;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      result = await pool.query(
        `UPDATE notices SET title = $1, details = $2, file = $3 WHERE id = $4 RETURNING *`,
        [title, details, file.path, id]
      );
    }
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Notice not found" });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error updating notice:", error.message);
    res.status(500).json({ error: "Error updating notice" });
  }
};
