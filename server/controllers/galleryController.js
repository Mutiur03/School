import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import fs from "fs";
export const getGalleryController = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
FROM gallery g
LEFT JOIN events e ON g.event_id = e.id
LEFT JOIN students s ON g.uploader_id = s.id
LEFT JOIN categories c ON g.category_id = c.id
WHERE g.status = 'approved';
    `);
    const images = result.rows;
    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id,
        event_name: image.event_name,
        category: image.category,
        category_id: image.category_id,
        created_at: image.created_at,
        student_name: image.student_name,
        student_batch: image.student_batch,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event_name) {
        if (!grouped.events[image.event_name]) {
          grouped.events[image.event_name] = [];
        }
        grouped.events[image.event_name].push(imgData);
      } else if (image.category) {
        if (!grouped.categories[image.category]) {
          grouped.categories[image.category] = [];
        }
        grouped.categories[image.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (err) {
    console.error("Error fetching grouped gallery data:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
export const addGalleryController = async (req, res) => {
  const { caption, eventId, category, status } = req.body;
  const token = req.cookies.token;
  const user = jwt.verify(token, process.env.JWT_SECRET);
  const uploaderId = user.id;
  const uploaderType = user.role;
  console.log(uploaderId, uploaderType, caption, eventId, category, status);
  try {
    const insertPromises = req.files.map((file) => {
      console.log(file);
      const imagePath = `${file.path}`;
      return pool.query(
        "INSERT INTO gallery (event_id, category_id, uploader_id, uploader_type, image_path, caption, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          eventId || null,
          category,
          uploaderId,
          uploaderType,
          imagePath,
          caption,
          status || "pending",
        ]
      );
    });
    await Promise.all(insertPromises);
    res.json({ message: "Images uploaded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
export const deleteGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const exist = await pool.query("SELECT * FROM gallery WHERE id = $1", [id]);
    const filePath = exist.rows[0].image_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const result = await pool.query("DELETE FROM gallery WHERE id = $1", [id]);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const updateGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, eventId, category } = req.body;
    const image = req.file ? req.file.path : null;
    console.log(caption, eventId, category, image);
    if (image) {
      const exist = await pool.query("SELECT * FROM gallery WHERE id = $1", [
        id,
      ]);
      const filePath = exist.rows[0].image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const result = await pool.query(
        "UPDATE gallery SET image_path = $1, caption = $2, event_id = $3, category_id = $4 WHERE id = $5 RETURNING *",
        [image, caption, eventId, category, id]
      );
      res.json(result.rows);
    } else {
      const result = await pool.query(
        "UPDATE gallery SET caption = $1, event_id = $2, category_id = $3 WHERE id = $4 RETURNING *",
        [caption, eventId, category, id]
      );
      res.json(result.rows);
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const deleteEventGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await pool.query(
      "SELECT * FROM gallery WHERE event_id = $1",
      [id]
    );
    exists.rows.forEach((image) => {
      const filePath = image.image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    const result = await pool.query("DELETE FROM gallery WHERE event_id = $1", [
      id,
    ]);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const deleteCategoryGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    // const exists = await pool.query(
    //   "SELECT * FROM gallery WHERE category_id = $1",
    //   [id]
    // );
    // exists.rows.forEach((image) => {
    //   const filePath = image.image_path;
    //   if (fs.existsSync(filePath)) {
    //     fs.unlinkSync(filePath);
    //   }
    // });
    // const result = await pool.query(
    //   "DELETE FROM gallery WHERE category_id = $1",
    //   [id]
    // );
    const result = await pool.query(
      "UPDATE gallery SET status = 'rejected' WHERE category_id = $1",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const addCategoryController = async (req, res) => {
  try {
    const { category } = req.body;
    const result = await pool.query(
      "INSERT INTO categories (category) VALUES ($1) RETURNING *",
      [category]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const getCategoriesController = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM categories");
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getPendingGalleriesController = async (req, res) => {
  try {
    try {
      const result = await pool.query(`
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
  FROM gallery g
  LEFT JOIN events e ON g.event_id = e.id
  LEFT JOIN students s ON g.uploader_id = s.id
  LEFT JOIN categories c ON g.category_id = c.id
  WHERE g.status = 'pending';
    `);
      const images = result.rows;
      const grouped = { events: {}, categories: {} };
      images.forEach((image) => {
        const imgData = {
          id: image.id,
          image_path: image.image_path,
          caption: image.caption,
          event_id: image.event_id,
          event_name: image.event_name,
          category: image.category,
          category_id: image.category_id,
          created_at: image.created_at,
          student_name: image.student_name,
          student_batch: image.student_batch,
          uploader_type: image.uploader_type,
          status: image.status,
        };
        if (image.event_name) {
          if (!grouped.events[image.event_name]) {
            grouped.events[image.event_name] = [];
          }
          grouped.events[image.event_name].push(imgData);
        } else if (image.category) {
          if (!grouped.categories[image.category]) {
            grouped.categories[image.category] = [];
          }
          grouped.categories[image.category].push(imgData);
        }
      });
      res.json(grouped);
    } catch (err) {
      console.error("Error fetching grouped gallery data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const approveGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE gallery SET status = 'approved' WHERE id = $1",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const rejectGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE gallery SET status = 'rejected' WHERE id = $1",
      [id]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const rejectMultipleGalleryController = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await pool.query(
      "UPDATE gallery SET status = 'rejected' WHERE id = ANY($1)",
      [ids]
    );
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const getRejectedGalleriesController = async (req, res) => {
  try {
    try {
      const result = await pool.query(`
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
  FROM gallery g
  LEFT JOIN events e ON g.event_id = e.id
  LEFT JOIN students s ON g.uploader_id = s.id
  LEFT JOIN categories c ON g.category_id = c.id
  WHERE g.status = 'rejected';
    `);
      const images = result.rows;
      const grouped = { events: {}, categories: {} };
      images.forEach((image) => {
        const imgData = {
          id: image.id,
          image_path: image.image_path,
          caption: image.caption,
          event_id: image.event_id,
          event_name: image.event_name,
          category: image.category,
          category_id: image.category_id,
          created_at: image.created_at,
          student_name: image.student_name,
          student_batch: image.student_batch,
          uploader_type: image.uploader_type,
          status: image.status,
        };
        if (image.event_name) {
          if (!grouped.events[image.event_name]) {
            grouped.events[image.event_name] = [];
          }
          grouped.events[image.event_name].push(imgData);
        } else if (image.category) {
          if (!grouped.categories[image.category]) {
            grouped.categories[image.category] = [];
          }
          grouped.categories[image.category].push(imgData);
        }
      });
      res.json(grouped);
    } catch (err) {
      console.error("Error fetching grouped gallery data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
export const deleteMultipleGalleryController = async (req, res) => {
  try {
    const { ids } = req.body;
    const exists = await pool.query(
      "SELECT * FROM gallery WHERE id = ANY($1)",
      [ids]
    );
    exists.rows.forEach((image) => {
      const filePath = image.image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    const result = await pool.query("DELETE FROM gallery WHERE id = ANY($1)", [
      ids,
    ]);
    res.json(result.rows);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

// Students part

export const getApprovedStudentGalleryController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const result = await pool.query(
      `
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
FROM gallery g
LEFT JOIN events e ON g.event_id = e.id
LEFT JOIN students s ON g.uploader_id = s.id
LEFT JOIN categories c ON g.category_id = c.id
WHERE g.status = 'approved' AND g.uploader_id = $1 AND g.uploader_type = 'student';
    `,
      [studentId]
    );
    const images = result.rows;
    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id,
        event_name: image.event_name,
        category: image.category,
        category_id: image.category_id,
        created_at: image.created_at,
        student_name: image.student_name,
        student_batch: image.student_batch,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event_name) {
        if (!grouped.events[image.event_name]) {
          grouped.events[image.event_name] = [];
        }
        grouped.events[image.event_name].push(imgData);
      } else if (image.category) {
        if (!grouped.categories[image.category]) {
          grouped.categories[image.category] = [];
        }
        grouped.categories[image.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getPendingStudentGalleriesController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const result = await pool.query(
        `
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
  FROM gallery g
  LEFT JOIN events e ON g.event_id = e.id
  LEFT JOIN students s ON g.uploader_id = s.id
  LEFT JOIN categories c ON g.category_id = c.id
  WHERE g.status = 'pending' AND g.uploader_id = $1 AND g.uploader_type = 'student';
    `,
        [studentId]
      );
      const images = result.rows;
      const grouped = { events: {}, categories: {} };
      images.forEach((image) => {
        const imgData = {
          id: image.id,
          image_path: image.image_path,
          caption: image.caption,
          event_id: image.event_id,
          event_name: image.event_name,
          category: image.category,
          category_id: image.category_id,
          created_at: image.created_at,
          student_name: image.student_name,
          student_batch: image.student_batch,
          uploader_type: image.uploader_type,
          status: image.status,
        };
        if (image.event_name) {
          if (!grouped.events[image.event_name]) {
            grouped.events[image.event_name] = [];
          }
          grouped.events[image.event_name].push(imgData);
        } else if (image.category) {
          if (!grouped.categories[image.category]) {
            grouped.categories[image.category] = [];
          }
          grouped.categories[image.category].push(imgData);
        }
      });
      res.json(grouped);
    } catch (err) {
      console.error("Error fetching grouped gallery data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getRejectedStudentGalleriesController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const result = await pool.query(
        `
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at 
  FROM gallery g
  LEFT JOIN events e ON g.event_id = e.id
  LEFT JOIN students s ON g.uploader_id = s.id
  LEFT JOIN categories c ON g.category_id = c.id
  WHERE g.status = 'rejected' AND g.uploader_id = $1 AND g.uploader_type = 'student';
    `,
        [studentId]
      );
      const images = result.rows;
      const grouped = { events: {}, categories: {} };
      images.forEach((image) => {
        const imgData = {
          id: image.id,
          image_path: image.image_path,
          caption: image.caption,
          event_id: image.event_id,
          event_name: image.event_name,
          category: image.category,
          category_id: image.category_id,
          created_at: image.created_at,
          student_name: image.student_name,
          student_batch: image.student_batch,
          uploader_type: image.uploader_type,
          status: image.status,
        };
        if (image.event_name) {
          if (!grouped.events[image.event_name]) {
            grouped.events[image.event_name] = [];
          }
          grouped.events[image.event_name].push(imgData);
        } else if (image.category) {
          if (!grouped.categories[image.category]) {
            grouped.categories[image.category] = [];
          }
          grouped.categories[image.category].push(imgData);
        }
      });
      res.json(grouped);
    } catch (err) {
      console.error("Error fetching grouped gallery data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

// Client side routes
export const getGalleriesByEventId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT
    g.id,
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at
FROM gallery g
LEFT JOIN events e ON g.event_id = e.id
LEFT JOIN students s ON g.uploader_id = s.id
LEFT JOIN categories c ON g.category_id = c.id
WHERE g.event_id = $1 AND g.status = 'approved';
    `,
      [id]
    );
    const images = result.rows;
    res.json(images);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getGalleriesByCategoryId = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT
    g.id,   
    e.title AS event_name,
    e.id AS event_id,
    c.category AS category,
    c.id AS category_id,
    g.image_path,
    g.caption,
    g.status,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.name
        ELSE NULL
    END AS student_name,
    CASE 
        WHEN g.uploader_type != 'admin' THEN s.batch
        ELSE NULL
    END AS student_batch,
    g.uploader_type,
    g.created_at
FROM gallery g
LEFT JOIN events e ON g.event_id = e.id
LEFT JOIN students s ON g.uploader_id = s.id
LEFT JOIN categories c ON g.category_id = c.id
WHERE g.category_id = $1 AND g.status = 'approved';
    `,
      [id]
    );
    const images = result.rows;
    res.json(images);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
