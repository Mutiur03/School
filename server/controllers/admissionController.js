import fs from "fs";
import cloudinary from "../config/cloudinary.js";
import { prisma } from "../config/prisma.js";

export async function uploadPDFToCloudinary(file) {
  try {
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
    const body = req.body || {};
    const parseBoolean = (v) => {
      if (v === undefined || v === null) return undefined;
      if (typeof v === "boolean") return v;
      const s = String(v).toLowerCase();
      return s === "1" || s === "true" || s === "yes";
    };

    const updateData = {};
    if (body.admission_year !== undefined && body.admission_year !== "") {
      const n = Number(body.admission_year);
      if (!Number.isNaN(n)) updateData.admission_year = n;
    }
    const ao = parseBoolean(body.admission_open);
    if (ao !== undefined) updateData.admission_open = ao;

    if (body.instruction !== undefined)
      updateData.instruction = String(body.instruction);
    if (body.attachment_instruction !== undefined)
      updateData.attachment_instruction = String(body.attachment_instruction);
    if (body.ingikar !== undefined) updateData.ingikar = String(body.ingikar);
    if (body.class_list !== undefined)
      updateData.class_list = String(body.class_list);
    if (body.list_type !== undefined)
      updateData.list_type = String(body.list_type);
    if (body.user_id_class6 !== undefined)
      updateData.user_id_class6 = String(body.user_id_class6);
    if (body.user_id_class7 !== undefined)
      updateData.user_id_class7 = String(body.user_id_class7);
    if (body.user_id_class8 !== undefined)
      updateData.user_id_class8 = String(body.user_id_class8);
    if (body.user_id_class9 !== undefined)
      updateData.user_id_class9 = String(body.user_id_class9);
    if (body.serial_no !== undefined)
      updateData.serial_no = String(body.serial_no);

    if (req.file) {
      if (!fs.existsSync(req.file.path)) {
        throw new Error(`Uploaded file not found: ${req.file.path}`);
      }
      const { previewUrl, downloadUrl, public_id } =
        await uploadPDFToCloudinary(req.file);
      updateData.preview_url = previewUrl;
      updateData.download_url = downloadUrl;
      updateData.public_id = public_id;
    }

    const notice = await prisma.admission.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        preview_url: updateData.preview_url ?? null,
        download_url: updateData.download_url ?? null,
        public_id: updateData.public_id ?? null,
        admission_year: updateData.admission_year ?? null,
        admission_open: updateData.admission_open ?? false,
        instruction: updateData.instruction ?? null,
        attachment_instruction: updateData.attachment_instruction ?? null,
        ingikar: updateData.ingikar ?? null,
        class_list: updateData.class_list ?? null,
        list_type: updateData.list_type ?? null,
        user_id_class6: updateData.user_id_class6 ?? null,
        user_id_class7: updateData.user_id_class7 ?? null,
        user_id_class8: updateData.user_id_class8 ?? null,
        user_id_class9: updateData.user_id_class9 ?? null,
        serial_no: updateData.serial_no ?? null,
      },
    });

    return res
      .status(200)
      .json({ success: true, message: "Settings saved", data: notice });
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

export const deleteAdmission = async (req, res) => {
  try {
    const existing = await prisma.admission.findFirst();
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Admission not found" });
    }

    if (existing.public_id) {
      try {
        await cloudinary.uploader.destroy(existing.public_id, {
          resource_type: "raw",
        });
      } catch (err) {
        console.error("Failed to delete remote file:", err.message || err);
        // continue even if deletion fails
      }
    }

    const updated = await prisma.admission.update({
      where: { id: existing.id },
      data: { preview_url: null, download_url: null, public_id: null },
    });

    return res
      .status(200)
      .json({ success: true, message: "Notice removed", data: updated });
  } catch (error) {
    console.error("Error removing notice:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove notice",
      error: error.message,
    });
  }
};
