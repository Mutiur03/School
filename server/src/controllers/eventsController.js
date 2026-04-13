import { prisma } from "../config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "../config/r2.js";

export const getPresignedUrlController = async (req, res) => {
  try {
    const { filename, contentType, type } = req.query;
    if (!filename || !contentType || !type) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const folder = type === "image" ? "events/images" : "events/files";
    const key = `${folder}/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);

    res.json({ uploadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    res.status(500).json({ error: "Error generating presigned URL" });
  }
};

export const addEventController = async (req, res) => {
  try {
    let { title, details, date, location, imageKey, fileKey } = req.body;

    date = new Date(date)
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");

    const result = await prisma.events.create({
      data: {
        title,
        details,
        date,
        location,
        image: imageKey || null,
        file: fileKey || null,
        download_url: fileKey || null,
        public_id: fileKey || null,
      },
    });

    res.json([result]);
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getEventsController = async (req, res) => {
  try {
    const result = await prisma.events.findMany({
      orderBy: {
        date: "desc",
      },
    });
    res.json(result);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.events.delete({
      where: { id: parseInt(id) },
    });

    if (result.image) {
      await deleteFromR2(result.image);
    }

    if (result.file) {
      await deleteFromR2(result.file);
    }

    res
      .status(200)
      .json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    console.error("Error deleting event:", error);
    res.status(500).json({ error: error.message });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, details, date, location, imageKey, fileKey } = req.body;

    const existingEvent = await prisma.events.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingEvent) {
      return res.status(404).json({ error: "Event not found" });
    }

    const updateData = {
      title,
      details,
      location,
      date: new Date(date)
        .toLocaleDateString("en-US", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
        .replace(/\//g, "-"),
    };

    if (fileKey) {
      updateData.file = fileKey;
      updateData.public_id = fileKey;
      updateData.download_url = fileKey;

      if (existingEvent.file) {
        await deleteFromR2(existingEvent.file);
      }
    }

    if (imageKey) {
      updateData.image = imageKey;

      if (existingEvent.image) {
        await deleteFromR2(existingEvent.image);
      }
    }

    const result = await prisma.events.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.json([result]);
  } catch (error) {
    console.error("Error updating event:", error);
    res.status(500).json({ error: error.message });
  }
};
