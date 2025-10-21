import fs from "fs";
import {
  uploadPDFToCloudinary,
  deletePDFFromCloudinary,
} from "./noticeController.js";
import { prisma } from "../config/prisma.js";
import { fixUrl } from "../utils/fixURL.js";

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

    const { previewUrl, public_id, downloadUrl } = await uploadPDFToCloudinary(
      file
    );

    // Remove both local PDF and image files after upload (check existence)
    const filePath = file.path.startsWith("uploads")
      ? `${process.cwd()}/${file.path}`
      : file.path;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error("Error deleting local file:", err);
      }
    }

    const result = await prisma.events.create({
      data: {
        title,
        details,
        date,
        location,
        image: fixUrl(image.path),
        file: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
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
      return {
        ...event,
        thumbnail: event.image ? fixUrl(event.image).replace(/\\/g, "/") : "",
      };
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

    const imagePath = result.image;
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    if (result.public_id) {
      await deletePDFFromCloudinary(result.public_id);
    }

    res
      .status(200)
      .json({ success: true, message: "Event deleted successfully" });
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
    console.log("====================================");
    console.log(file);
    console.log("====================================");
    if (file) {
      const { previewUrl, public_id, downloadUrl } =
        await uploadPDFToCloudinary(file);
      updateData.file = previewUrl;
      updateData.public_id = public_id;
      updateData.download_url = downloadUrl;

      // Remove local PDF file after upload (check existence)
      const filePath = file.path.startsWith("uploads")
        ? `${process.cwd()}/${file.path}`
        : file.path;
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error("Error deleting local file:", err);
        }
      }

      if (existingEvent.public_id) {
        await deletePDFFromCloudinary(existingEvent.public_id);
      }
    }

    if (image) {
      updateData.image = fixUrl(image.path);

      if (fs.existsSync(existingEvent.image)) {
        fs.unlinkSync(existingEvent.image);
      }
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
