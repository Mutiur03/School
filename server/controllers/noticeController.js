import fs from "fs";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import { redis } from "../config/redis.js";
import {
  LONG_TERM_CACHE_TTL,
  SHORT_TERM_CACHE_TTL,
} from "../utils/globalVars.js";
export async function uploadPDFToCloudinary(file) {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "notices",
      resource_type: "raw",
      use_filename: true,
      unique_filename: false,
    });

    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      previewUrl: result.secure_url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/raw/upload/fl_attachment/${result.public_id}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.log("Error uploading to Cloudinary:", error);
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Cloudinary upload failed");
  }
}

export async function deletePDFFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
}

export const addNoticeController = async (req, res) => {
  try {
    const { title, created_at } = req.body;
    const { previewUrl, downloadUrl, public_id } = await uploadPDFToCloudinary(
      req.file
    );

    const result = await prisma.notices.create({
      data: {
        title,
        file: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
        ...(created_at && { created_at: new Date(created_at) }),
      },
    });
    const key=`notices_limit`;
    await redis.del(key);
    const allKey="notices_all";
    await redis.del(allKey);
    res.status(201).json(result);
  } catch (error) {
    console.error("Error adding notice:", error);
    res.status(500).json({ error: "Error adding notice" });
  }
};

export const getNoticesController = async (req, res) => {
  try {
    const { limit } = req.query;
    const take = limit !== undefined ? parseInt(limit, 10) : undefined;

    if (take !== undefined && (Number.isNaN(take) || take <= 0)) {
      return res.status(400).json({ error: "Invalid 'limit' query parameter" });
    }
    if (take !== undefined) {
      const key = `notices_limit`;
      const cachedNotices = await redis.get(key);
      if (cachedNotices) {
        return res.status(200).json(JSON.parse(cachedNotices));
      }
    } else {
      const key = "notices_all";
      const cachedNotices = await redis.get(key);
      if (cachedNotices) {
        return res.status(200).json(JSON.parse(cachedNotices));
      }
    }
    if (take !== undefined) {
      console.log(`Cache miss for key: notices_limit`);
    } else {
      console.log("Cache miss for key: notices_all");
    }
    const notices = await prisma.notices.findMany({
      orderBy: { created_at: "desc" },
      ...(take !== undefined ? { take } : {}),
    });
    if (take !== undefined) {
      const key = `notices_limit`;
      await redis.set(key, JSON.stringify(notices), "EX", LONG_TERM_CACHE_TTL);
      return res.status(200).json(notices);
    } else {
      const key = "notices_all";
      await redis.set(key, JSON.stringify(notices), "EX", SHORT_TERM_CACHE_TTL);
    }
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

    if (notice.public_id) {
      await deletePDFFromCloudinary(notice.public_id);
    }
    const key=`notices_limit`;
    await redis.del(key);
    const allKey="notices_all";
    await redis.del(allKey);
    res.status(200).json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("Error deleting notice:", error.message);
    res.status(500).json({ error: "Error deleting notice" });
  }
};

export const updateNoticeController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, created_at } = req.body;
    const { file } = req;

    const existingNotice = await prisma.notices.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingNotice) {
      return res.status(404).json({ error: "Notice not found" });
    }

    let updatedData = { title };
    if (created_at) {
      updatedData.created_at = new Date(created_at);
    }

    if (file) {
      const { previewUrl, downloadUrl, public_id } =
        await uploadPDFToCloudinary(file);

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
    const key=`notices_limit`;
    await redis.del(key);
    const allKey="notices_all";
    await redis.del(allKey);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating notice:", error.message);
    res.status(500).json({ error: "Error updating notice" });
  }
};
