import fs from "fs";
import cloudinary from "../config/cloudinary.js";
import { prisma } from "../config/prisma.js";

export async function uploadPDFToCloudinary(file) {
  try {
    console.log("Uploading file to Cloudinary:", file.path);

    if (!fs.existsSync(file.path)) {
      throw new Error(`File not found: ${file.path}`);
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "notices",
      resource_type: "raw",
      use_filename: true,
      unique_filename: false,
    });

    try {
      fs.unlinkSync(file.path);
    } catch (unlinkError) {
      console.error("Error deleting local file:", unlinkError);
    }

    console.log("Cloudinary upload result:", result);
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      previewUrl: result.secure_url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/raw/upload/fl_attachment/${result.public_id}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw new Error("Cloudinary upload failed: " + error.message);
  }
}

export const creatOrUpdateAdmission = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    if (!fs.existsSync(req.file.path)) {
      throw new Error(`Uploaded file not found: ${req.file.path}`);
    }

    const { previewUrl, downloadUrl, public_id } = await uploadPDFToCloudinary(
      req.file
    );

    const notice = await prisma.admission.upsert({
      where: { id: 1 },
      update: {
        preview_url: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
      },
      create: {
        id: 1,
        preview_url: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
      },
    });

    console.log("Notice uploaded and saved:", notice);
    return res.status(200).json({
      success: true,
      message: "Notice uploaded and saved",
      data: notice,
    });
  } catch (error) {
    console.error("Controller error:", error);

    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Error cleaning up file:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Error uploading notice",
      error: error.message,
    });
  }
};

export const getAdmission = async (req, res) => {
  try {
    const data = await prisma.admission.findFirst();

    // if (!notice) {
    //   return res.status(404).json({
    //     success: false,
    //     message: "Admission notice not found",
    //   });
    // }

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching admission notice:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching admission notice",
      error: error.message,
    });
  }
};
