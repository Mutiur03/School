import fs from "fs";
import { uploadPDFToDrive, DeletePDF } from "./noticeController.js";

import { prisma } from "../config/prisma.js";

export const addEventController = async (req, res) => {
  try {
    let { title, details, date, location } = req.body;
    const image = req.files.image[0];
    const file = req.files.file[0];
    date = new Date(date)
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-");
    const { previewUrl } = await uploadPDFToDrive(file);
    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    const result = await prisma.events.create({
      data: {
        title,
        details,
        date,
        image: image.path,
        file: previewUrl,
        location,
      },
    });
    res.json([result]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const getEventsController = async (req, res) => {
  try {
    const result = await prisma.events.findMany();
    const thumbnails = result.map((event) => {
      if (fs.existsSync(event.thumbnail)) {
        return { ...event, thumbnail: event.thumbnail.replace(/\\/g, "/") };
      }
      return { ...event, thumbnail: event.image.replace(/\\/g, "/") };
    });
    res.json(thumbnails);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.events.delete({
      where: { id: parseInt(id) },
    });

    const filePath = result.file;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const imagePath = result.image;
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
    await DeletePDF(result.file);
    res.status(200).json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Event not found" });
    }
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

export const updateEventController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, details, date, location } = req.body;
    const file = req.files?.file?.[0];
    const image = req.files?.image?.[0];

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

    if (file) {
      const { previewUrl } = await uploadPDFToDrive(file);
      updateData.file = previewUrl;
      fs.unlink(file.path, (err) => {
        if (err) console.error("Error deleting local file:", err);
      });
    }
    if (image) {
      updateData.image = image.filename;
    }
    if (file || image) {
      const exists = await prisma.events.findUnique({
        where: { id: parseInt(id) },
      });
      const filePath = exists.file;
      const imagePath = exists.image;
      if (fs.existsSync(filePath) && file) {
        fs.unlinkSync(filePath);
      }
      if (fs.existsSync(imagePath) && image) {
        fs.unlinkSync(imagePath);
      }
      await DeletePDF(exists.file);
    }

    const result = await prisma.events.update({
      where: { id: parseInt(id) },
      data: updateData,
    });
    res.json([result]);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};
