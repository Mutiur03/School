import pool from "../config/db.js";

export const addHolidayController = async (req, res) => {
  try {
    const { title, start_date, end_date, description, is_optional } = req.body;
    console.log(title, start_date, end_date, description, is_optional);

    const result = await pool.query(
      "INSERT INTO holidays (title, start_date, end_date, description, is_optional) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [title, start_date, end_date, description, is_optional]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getHolidaysController = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM holidays ORDER BY start_date ASC"
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteHolidayController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM holidays WHERE id = $1", [id]);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const updateHolidayController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, start_date, end_date, description, is_optional } = req.body;
    const result = await pool.query(
      "UPDATE holidays SET title = $1, start_date = $2, end_date = $3, description = $4, is_optional = $5 WHERE id = $6 RETURNING *",
      [title, start_date, end_date, description, is_optional, id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
