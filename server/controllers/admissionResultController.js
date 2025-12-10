import fs from "fs";
import path from "path";
import { prisma } from "../config/prisma.js";

export async function uploadPDFToLocal(file, folder = "admission-results") {
  try {
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const destDir = path.join(uploadsRoot, folder);
    await fs.promises.mkdir(destDir, { recursive: true });

    const originalName = file.originalname || path.basename(file.path);
    const filename = `${Date.now()}-${originalName}`.replace(/\s+/g, "_");
    const destPath = path.join(destDir, filename);
    try {
      await fs.promises.rename(file.path, destPath);
    } catch (err) {
      await fs.promises.copyFile(file.path, destPath);
      await fs.promises.unlink(file.path).catch(() => {});
    }
    try {
      await fs.promises.unlink(file.path);
    } catch (err) {
      // File might have been moved, ignore error
    }
    const relativeUrl = path
      .join("/uploads", folder, filename)
      .split(path.sep)
      .join("/");

    return {
      url: relativeUrl,
      downloadUrl: relativeUrl,
      public_id: relativeUrl,
    };
  } catch (error) {
    console.error("Local upload failed:", error.message);
    throw new Error("Local upload failed");
  }
}

export async function deleteLocalPDF(publicId) {
  try {
    if (!publicId) return;
    const relativePath = publicId.startsWith("/")
      ? publicId.slice(1)
      : publicId;
    const filePath = path.join(process.cwd(), relativePath);

    await fs.promises.unlink(filePath).catch((err) => {
      if (err.code !== "ENOENT") {
        console.error("Error deleting local file:", err.message);
      }
    });
  } catch (err) {
    console.error("Error deleting local file:", err.message);
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
      const { url, public_id } = await uploadPDFToLocal(
        files.merit_list[0],
        `admission-results/class-${class_name}/merit`
      );
      resultData.merit_list = url;
      resultData.merit_list_public_id = public_id;
    }

    if (files?.waiting_list_1?.[0]) {
      const { url, public_id } = await uploadPDFToLocal(
        files.waiting_list_1[0],
        `admission-results/class-${class_name}/waiting-1`
      );
      resultData.waiting_list_1 = url;
      resultData.waiting_list_1_public_id = public_id;
    }

    if (files?.waiting_list_2?.[0]) {
      const { url, public_id } = await uploadPDFToLocal(
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
        await deleteLocalPDF(existingResult.merit_list_public_id);
      }

      const { url, public_id } = await uploadPDFToLocal(
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
        await deleteLocalPDF(existingResult.waiting_list_1_public_id);
      }

      const { url, public_id } = await uploadPDFToLocal(
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
        await deleteLocalPDF(existingResult.waiting_list_2_public_id);
      }

      const { url, public_id } = await uploadPDFToLocal(
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
      await deleteLocalPDF(existingResult.merit_list_public_id);
    }
    if (existingResult.waiting_list_1_public_id) {
      await deleteLocalPDF(existingResult.waiting_list_1_public_id);
    }
    if (existingResult.waiting_list_2_public_id) {
      await deleteLocalPDF(existingResult.waiting_list_2_public_id);
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
