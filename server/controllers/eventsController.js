import pool from "../config/db.js";
import fs from "fs";
export const addEventController = async (req, res) => {
  
  try {
    const { title, details, date,location } = req.body;
    const image = req.files.image[0];
    const file = req.files.file[0];
    console.log(title, details, date, image, file);

    const result = await pool.query(
      "INSERT INTO events (title, details, date, image, file,location) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [title, details, date, image.path, file.path,location]
    );
    res.json(result.rows);
    // res.json({ message: "Event added successfully" });
  } catch (error) {
    console.log(error); 
    res.status(500).json({ error: error.message });
  }
};

export const getEventsController = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM events");
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM events WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    const filePath = result.rows[0].file;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const imagePath = result.rows[0].image;
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    res
      .status(200)
      .json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, details, date,location } = req.body;
    const file = req.files?.file?.[0];
    const image = req.files?.image?.[0];

    let paramIndex = 5;
    const fields = [];
    const values = [title, details,location, date];

    if (file) {
      fields.push(`file = $${paramIndex++}`);
      values.push(file.filename); 
    }
    if (image) {
      fields.push(`image = $${paramIndex++}`);
      values.push(image.filename);
    }
    if (file || image) {
      const exists = await pool.query("SELECT * FROM events WHERE id = $1", [
        id,
      ]);
      const filePath = exists.rows[0].file;
      const imagePath = exists.rows[0].image;
      if (fs.existsSync(filePath) && file) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(imagePath) && image) {
        fs.unlinkSync(imagePath);
      }
    }
    const setClause = fields.length > 0 ? `, ${fields.join(", ")}` : "";

    const query = `UPDATE events SET title = $1, details = $2, location = $3, date = $4${setClause} WHERE id = $${paramIndex} RETURNING *`;
    values.push(id);

    console.log(query);
    console.log(values);

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
