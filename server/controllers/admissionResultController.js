import fs from "fs";
import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";

export async function uploadPDFToCloudinary(
  file,
  folder = "admission-results"
) {
  try {
    const result = await cloudinary.uploader.upload(file.path, {
      folder: folder,
      resource_type: "raw",
      use_filename: true,
      unique_filename: true,
    });

    fs.unlink(file.path, (err) => {
      if (err) console.error("Error deleting local file:", err);
    });

    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      url: result.secure_url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/raw/upload/fl_attachment/${result.public_id}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Cloudinary upload failed");
  }
}

export async function deletePDFFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.error("Error deleting file from Cloudinary:", err.message);
  }
}

export const getAdmissionResults = async (req, res) => {
  try {
    const { class_name, admission_year } = req.query;

    const whereCondition = {};
    if (class_name) {
      whereCondition.class_name = class_name;
    }
    if (admission_year) {
      whereCondition.admission_year = parseInt(admission_year);
    }

    const results = await prisma.admission_result.findMany({
      where: whereCondition,
      orderBy: [{ admission_year: "desc" }, { class_name: "asc" }],
    });

    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching admission results:", error);
    res.status(500).json({
      message: "Error fetching admission results",
      error: error.message,
    });
  }
};

export const createAdmissionResult = async (req, res) => {
  try {
    console.log(req.body);

    const { class_name, admission_year } = req.body;
    const files = req.files;
    console.log(files);

    if (!class_name || !admission_year) {
      return res.status(400).json({
        message: "Class name and admission year are required",
      });
    }

    const existingResult = await prisma.admission_result.findFirst({
      where: {
        class_name,
        admission_year: parseInt(admission_year),
      },
    });

    if (existingResult) {
      return res.status(409).json({
        message: `Result already exists for Class ${class_name} - Year ${admission_year}. Please update the existing result instead.`,
      });
    }

    const resultData = {
      class_name,
      admission_year: parseInt(admission_year),
    };

    if (files?.merit_list?.[0]) {
      const { url, public_id } = await uploadPDFToCloudinary(
        files.merit_list[0],
        `admission-results/class-${class_name}/merit`
      );
      resultData.merit_list = url;
      resultData.merit_list_public_id = public_id;
    }

    if (files?.waiting_list_1?.[0]) {
      const { url, public_id } = await uploadPDFToCloudinary(
        files.waiting_list_1[0],
        `admission-results/class-${class_name}/waiting-1`
      );
      resultData.waiting_list_1 = url;
      resultData.waiting_list_1_public_id = public_id;
    }

    if (files?.waiting_list_2?.[0]) {
      const { url, public_id } = await uploadPDFToCloudinary(
        files.waiting_list_2[0],
        `admission-results/class-${class_name}/waiting-2`
      );
      resultData.waiting_list_2 = url;
      resultData.waiting_list_2_public_id = public_id;
    }

    const result = await prisma.admission_result.create({
      data: resultData,
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating admission result:", error);
    res.status(500).json({
      message: "Error creating admission result",
      error: error.message,
    });
  }
};

export const updateAdmissionResult = async (req, res) => {
  try {
    const { id } = req.params;
    const { class_name, admission_year } = req.body;
    const files = req.files;

    const existingResult = await prisma.admission_result.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingResult) {
      return res.status(404).json({ message: "Admission result not found" });
    }

    const updateData = {};

    if (class_name) {
      updateData.class_name = class_name;
    }
    if (admission_year) {
      updateData.admission_year = parseInt(admission_year);
    }

    if (files?.merit_list?.[0]) {
      if (existingResult.merit_list_public_id) {
        await deletePDFFromCloudinary(existingResult.merit_list_public_id);
      }

      const { url, public_id } = await uploadPDFToCloudinary(
        files.merit_list[0],
        `admission-results/class-${
          class_name || existingResult.class_name
        }/merit`
      );
      updateData.merit_list = url;
      updateData.merit_list_public_id = public_id;
    }

    if (files?.waiting_list_1?.[0]) {
      if (existingResult.waiting_list_1_public_id) {
        await deletePDFFromCloudinary(existingResult.waiting_list_1_public_id);
      }

      const { url, public_id } = await uploadPDFToCloudinary(
        files.waiting_list_1[0],
        `admission-results/class-${
          class_name || existingResult.class_name
        }/waiting-1`
      );
      updateData.waiting_list_1 = url;
      updateData.waiting_list_1_public_id = public_id;
    }

    if (files?.waiting_list_2?.[0]) {
      if (existingResult.waiting_list_2_public_id) {
        await deletePDFFromCloudinary(existingResult.waiting_list_2_public_id);
      }

      const { url, public_id } = await uploadPDFToCloudinary(
        files.waiting_list_2[0],
        `admission-results/class-${
          class_name || existingResult.class_name
        }/waiting-2`
      );
      updateData.waiting_list_2 = url;
      updateData.waiting_list_2_public_id = public_id;
    }

    const result = await prisma.admission_result.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error updating admission result:", error);
    res.status(500).json({
      message: "Error updating admission result",
      error: error.message,
    });
  }
};

export const deleteAdmissionResult = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await prisma.admission_result.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingResult) {
      return res.status(404).json({ message: "Admission result not found" });
    }

    if (existingResult.merit_list_public_id) {
      await deletePDFFromCloudinary(existingResult.merit_list_public_id);
    }
    if (existingResult.waiting_list_1_public_id) {
      await deletePDFFromCloudinary(existingResult.waiting_list_1_public_id);
    }
    if (existingResult.waiting_list_2_public_id) {
      await deletePDFFromCloudinary(existingResult.waiting_list_2_public_id);
    }

    await prisma.admission_result.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Admission result deleted successfully" });
  } catch (error) {
    console.error("Error deleting admission result:", error);
    res.status(500).json({
      message: "Error deleting admission result",
      error: error.message,
    });
  }
};

export const getAdmissionResultById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.admission_result.findUnique({
      where: { id: parseInt(id) },
    });

    if (!result) {
      return res.status(404).json({ message: "Admission result not found" });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error("Error fetching admission result:", error);
    res.status(500).json({
      message: "Error fetching admission result",
      error: error.message,
    });
  }
};
