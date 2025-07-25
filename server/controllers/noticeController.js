import fs from "fs";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js"; // Cloudinary config must be correctly imported

export async function uploadPDFToCloudinary(file) {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "notices",
      use_filename: true,
      unique_filename: false,
    });

    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    console.log(result);
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      previewUrl: result.url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/image/upload/fl_attachment:${result.original_filename}/${result.public_id}.${result.format}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Cloudinary upload failed");
  }
}

export async function deletePDFFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId);
    console.log(`File with public ID "${publicId}" deleted successfully.`);
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
}

// Add notice
export const addNoticeController = async (req, res) => {
  try {
    const { title } = req.body;
    const { previewUrl, downloadUrl, public_id } = await uploadPDFToCloudinary(
      req.file
    );

    const result = await prisma.notices.create({
      data: {
        title,
        file: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
      },
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error adding notice:", error);
    res.status(500).json({ error: "Error adding notice" });
  }
};

// Get notices
export const getNoticesController = async (_, res) => {
  try {
    const notices = await prisma.notices.findMany();
    res.status(200).json(notices);
  } catch (error) {
    console.error("Error fetching notices:", error.message);
    res.status(500).json({ error: "Error fetching notices" });
  }
};

// Delete notice
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

    if (notice.public_id) {
      await deletePDFFromCloudinary(notice.public_id);
    }

    res.status(200).json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("Error deleting notice:", error.message);
    res.status(500).json({ error: "Error deleting notice" });
  }
};

// Update notice
export const updateNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const { file } = req;

    const existingNotice = await prisma.notices.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNotice) {
      return res.status(404).json({ error: "Notice not found" });
    }

    let updatedData = { title };

    if (file) {
      const { previewUrl, downloadUrl, public_id } =
        await uploadPDFToCloudinary(file);

      // Delete previous PDF from Cloudinary
      if (existingNotice.public_id) {
        await deletePDFFromCloudinary(existingNotice.public_id);
      }

      updatedData = {
        ...updatedData,
        file: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
      };
    }

    const result = await prisma.notices.update({
      where: { id: parseInt(id) },
      data: updatedData,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating notice:", error.message);
    res.status(500).json({ error: "Error updating notice" });
  }
};
