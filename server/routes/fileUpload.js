import express from "express";
import multer from "multer";
import cloudinary from "../config/cloudinary.js";
import fs from "fs";
import { prisma } from "../config/prisma.js";
const fileUploadRouter = express.Router();
export async function uploadPDFToCloudinary(file) {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "Random",
      resource_type: "raw", 
      use_filename: true,
      unique_filename: false,
    });

    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });
    console.log(result);
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
    console.log(`File with public ID "${publicId}" deleted successfully.`);
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("Only PDF files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

fileUploadRouter.post(
  "/citizen-charter",
  upload.single("pdf"),
  async (req, res) => {
    try {
      const { type } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { previewUrl, downloadUrl, public_id } =
        await uploadPDFToCloudinary(req.file);

      let result;

      if (type === "citizen_charter") {
        const existingCharter = await prisma.citizenCharter.findFirst();
        if (existingCharter) {
          result = await prisma.citizenCharter.update({
            where: { id: existingCharter.id },
            data: {
              file: previewUrl,
              download_url: downloadUrl,
              public_id: public_id,
              updated_at: new Date(),
            },
          });
        } else {
          result = await prisma.citizenCharter.create({
            data: {
              file: previewUrl,
              download_url: downloadUrl,
              public_id: public_id,
            },
          });
        }
      } else {
            return res.status(400).json({ error: "Invalid document type" });
      }

      res.status(200).json({
        message: "Document uploaded successfully",
        data: result,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: "Upload failed",
        message: error.message,
      });
    }
  }
);

// Get citizen charter
fileUploadRouter.get("/citizen-charter", async (req, res) => {
  try {
    const charter = await prisma.citizenCharter.findFirst({
      orderBy: { updated_at: "desc" },
    });

    if (!charter) {
      return res.status(404).json({ error: "Citizen charter not found" });
    }

    res.status(200).json(charter);
  } catch (error) {
    console.error("Error fetching citizen charter:", error);
    res.status(500).json({ error: "Error fetching citizen charter" });
  }
});

export default fileUploadRouter;
