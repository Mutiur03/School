import { prisma } from "../config/prisma.js";
import fs from "fs";
import cloudinary from "../config/cloudinary.js";

export async function uploadPDFToCloudinary(file) {
  try {
    console.log("Uploading file to Cloudinary:", file.path);

    // Check if file exists before uploading
    if (!fs.existsSync(file.path)) {
      throw new Error(`File not found: ${file.path}`);
    }

    const result = await cloudinary.uploader.upload(file.path, {
      folder: "notices",
      resource_type: "raw",
      use_filename: true,
      unique_filename: false,
    });

    // Use synchronous unlink to avoid race conditions
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

export const createOrUpdateSSCReg = async (req, res) => {
  try {
    console.log("Request body:", req.body);
    console.log("Request file:", req.file);

    const {
      a_sec_roll,
      b_sec_roll,
      ssc_year,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
    } = req.body;
    let updateData = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      ssc_year: ssc_year ? parseInt(ssc_year) : null,
      reg_open: reg_open === "true" || reg_open === true,
      instruction_for_a:
        instruction_for_a || "Please follow the instructions carefully",
      instruction_for_b:
        instruction_for_b || "Please follow the instructions carefully",
      attachment_instruction:
        attachment_instruction || "Please attach all required documents",
    };

    if (req.file) {
      try {
        console.log("Processing file upload...");

        // Check if file exists
        if (!fs.existsSync(req.file.path)) {
          throw new Error(`Uploaded file not found: ${req.file.path}`);
        }

        const existingRecord = await prisma.ssc_reg.findFirst();
        if (
          existingRecord &&
          existingRecord.notice &&
          existingRecord.notice.includes("cloudinary")
        ) {
          try {
            const publicIdMatch =
              existingRecord.notice.match(/\/notices\/([^\/]+)$/);
            const publicId = publicIdMatch
              ? `notices/${publicIdMatch[1]}`
              : null;

            if (publicId) {
              console.log("Deleting old file from Cloudinary:", publicId);
              await cloudinary.uploader.destroy(publicId, {
                resource_type: "raw",
              });
            }
          } catch (deleteError) {
            console.error("Error deleting old file:", deleteError);
          }
        }

        const { previewUrl } = await uploadPDFToCloudinary(req.file);
        updateData.notice = previewUrl;
        console.log("File uploaded successfully, URL:", previewUrl);
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        if (req.file && fs.existsSync(req.file.path)) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (cleanupError) {
            console.error("Error cleaning up file:", cleanupError);
          }
        }
        throw new Error("Failed to upload notice PDF: " + uploadError.message);
      }
    }

    console.log("Updating database with data:", updateData);
    const sscReg = await prisma.ssc_reg.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...updateData,
      },
    });

    console.log("Database operation successful:", sscReg);
    res.status(200).json({
      success: true,
      message: "SSC Registration updated successfully",
      data: sscReg,
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

    res.status(500).json({
      success: false,
      message: "Error updating SSC Registration",
      error: error.message,
    });
  }
};

export const getSSCReg = async (req, res) => {
  try {
    const sscReg = await prisma.ssc_reg.findFirst();

    if (!sscReg) {
      return res.status(404).json({
        success: false,
        message: "SSC Registration not found",
      });
    }

    res.status(200).json({
      success: true,
      data: sscReg,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching SSC Registration",
      error: error.message,
    });
  }
};

export const deleteSSCRegNotice = async (req, res) => {
  try {
    const sscReg = await prisma.ssc_reg.findFirst();

    if (!sscReg || !sscReg.notice) {
      return res.status(404).json({
        success: false,
        message: "No notice found to delete",
      });
    }

    // Delete from Cloudinary if it's a cloudinary URL
    if (sscReg.notice.includes("cloudinary")) {
      try {
        const publicIdMatch = sscReg.notice.match(/\/notices\/([^\/]+)$/);
        const publicId = publicIdMatch ? `notices/${publicIdMatch[1]}` : null;

        if (publicId) {
          await cloudinary.uploader.destroy(publicId, {
            resource_type: "raw",
          });
        }
      } catch (deleteError) {
        console.error("Error deleting file from cloudinary:", deleteError);
      }
    }

    // Update database to remove notice
    await prisma.ssc_reg.update({
      where: { id: sscReg.id },
      data: { notice: null },
    });

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting notice",
      error: error.message,
    });
  }
};
