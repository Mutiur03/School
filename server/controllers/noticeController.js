import fs from "fs";
import { google } from "googleapis";
import { prisma } from "../config/prisma.js";


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
    parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
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

    const result = await prisma.notices.create({
      data: {
        title,
        details,
        file: previewUrl,
        download_url: downloadUrl,
      },
    });

    fs.unlink(req.file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error adding notice:", error);
    res.status(500).json({ error: "Error adding notice" });
  }
};

export const getNoticesController = async (_, res) => {
  try {
    const notices = await prisma.notices.findMany();
    console.log(notices);

    res.status(200).json(notices);
  } catch (error) {
    console.error("Error fetching notices:", error.message);
    res.status(500).json({ error: "Error fetching notices" });
  }
};

export const deleteNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await prisma.notices.findUnique({
      where: { id: parseInt(id) },
    });

    if (!notice) {
      return res.status(404).json({ error: "Notice not found" });
    }

    await prisma.notices.delete({
      where: { id: parseInt(id) },
    });

    const filePath = notice.file;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    await DeletePDF(notice.download_url);
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
      result = await prisma.notices.update({
        where: { id: parseInt(id) },
        data: { title, details },
      });
    } else {
      const { previewUrl, downloadUrl } = await uploadPDFToDrive(file);
      const existingNotice = await prisma.notices.findUnique({
        where: { id: parseInt(id) },
      });

      if (!existingNotice) {
        return res.status(404).json({ error: "Notice not found" });
      }

      const filePath = existingNotice.file;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await DeletePDF(existingNotice.download_url);

      result = await prisma.notices.update({
        where: { id: parseInt(id) },
        data: {
          title,
          details,
          file: previewUrl,
          download_url: downloadUrl,
        },
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating notice:", error.message);
    res.status(500).json({ error: "Error updating notice" });
  }
};
