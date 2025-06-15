import pool from "../config/db.js";
import fs from "fs";
import { google } from "googleapis";

function extractFileIdFromUrl(url) {
  const regex = /\/d\/([a-zA-Z0-9_-]+)|id=([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  return match ? match[1] || match[2] : null;
}

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.client_email_drive,
    private_key: process.env.private_key_drive.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const driveService = google.drive({ version: "v3", auth });

export async function uploadPDFToDrive(file) {
  const fileMetadata = {
    name: file.originalname,
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID], // 👈 your target folder
  };

  const media = {
    mimeType: file.mimetype,
    body: fs.createReadStream(file.path),
  };

  const response = await driveService.files.create({
    resource: fileMetadata,
    media: media,
    fields: "id",
  });

  const fileId = response.data.id;

  // Make the file public
  await driveService.permissions.create({
    fileId,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  return { previewUrl, downloadUrl };
}
 
export async function DeletePDF(url) {
  const fileId = extractFileIdFromUrl(url);
  try {
    await driveService.files.delete({ fileId });
    console.log(`File with ID ${fileId} deleted successfully.`);
  } catch (err) { 
    console.error("Error deleting file:", err.message);
  }
}

export const addNoticeController = async (req, res) => {
  try {
    const { title, details } = req.body;
    const { previewUrl, downloadUrl } = await uploadPDFToDrive(req.file);

    const insert = `INSERT INTO notices (title, details, file, download_url) VALUES ($1, $2, $3, $4) RETURNING *`;
    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    pool.query(
      insert,
      [title, details, previewUrl, downloadUrl],
      (err, result) => {
        if (err) {
          console.error("Error inserting notice:", err);
          res.status(500).json({ error: "Error inserting notice" });
        } else {
          res.status(201).json(result.rows[0]);
        }
      }
    );
  } catch (error) {
    console.error("Error adding notice:", error);
    res.status(500).json({ error: "Error adding notice" });
  }
};

export const getNoticesController = async (_, res) => {
  try {
    const notices = await pool.query(`SELECT * FROM notices`);
    console.log(notices.rows);

    res.status(200).json(notices.rows);
  } catch (error) {
    console.error("Error fetching notices:", error.message);
    res.status(500).json({ error: "Error fetching notices" });
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
    await DeletePDF(result.rows[0].download_url);
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
    let result;
    if (!file) {
      result = await pool.query(
        `UPDATE notices SET title = $1, details = $2 WHERE id = $3 RETURNING *`,
        [title, details, id]
      );
    } else {
      const { previewUrl, downloadUrl } = await uploadPDFToDrive(file);
      const exists = await pool.query("SELECT * FROM notices WHERE id = $1", [
        id,
      ]);
      const filePath = exists.rows[0].file;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await DeletePDF(exists.rows[0].download_url);
      result = await pool.query(
        `UPDATE notices SET title = $1, details = $2, file = $3, download_url = $4 WHERE id = $5 RETURNING *`,
        [title, details, previewUrl, downloadUrl, id]
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
