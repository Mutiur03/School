import pool from "../config/db.js";

export const addLevelController = async (req, res) => {
  try {
    const { class_name, section, year, teacher_id } = req.body;
    await pool.query(
      "INSERT INTO levels (class_name, section, year, teacher_id) VALUES ($1, $2, $3, $4)",
      [class_name, section, year, teacher_id]
    );

    res.status(201).json({ message: "Level added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while adding the level" });
  }
};

export const getLevelsController = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT levels.id AS id, class_name, section, year, teachers.name AS teacher_name, teachers.id AS teacher_id FROM levels JOIN teachers ON levels.teacher_id = teachers.id ORDER BY class_name, section"
    );
    res.status(200).json({ data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching levels" }); 
  }
};

export const updateLevelController = async (req, res) => {
  try {
    const { class_name, section, year, teacher_id } = req.body;
    const { id } = req.params;

    // Update data in the 'levels' table
    await pool.query(
      "UPDATE levels SET class_name = $1, section = $2, year = $3, teacher_id = $4 WHERE id = $5",
      [class_name, section, year, teacher_id, id]
    );

    res.status(200).json({ message: "Level updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the level" });
  }
};
export const deleteLevelController = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete data from the 'levels' table
    await pool.query("DELETE FROM levels WHERE id = $1", [id]);

    res.status(200).json({ message: "Level deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the level" });
  }
};
