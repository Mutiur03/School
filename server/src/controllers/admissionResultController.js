import { prisma } from "../config/prisma.js";
import {
  getUploadUrl,
  deleteFromR2,
  createMultipartUpload,
  getMultipartPartUrl,
  completeMultipartUpload,
} from "../config/r2.js";
import path from "path";
import crypto from "crypto";

const CONFIG = {
  MAX_FILE_SIZE: 5 * 1024 * 1024 * 1024,
  MULTIPART_THRESHOLD: 50 * 1024 * 1024,
};

const validateFile = (filename, contentType, fileSize) => {
  const errors = [];
  if (!filename || filename.trim() === "") errors.push("Filename is required");
  if (!contentType || contentType.trim() === "")
    errors.push("Content type is required");
  if (!fileSize || fileSize <= 0) {
    errors.push("File size must be greater than 0");
  } else if (fileSize > CONFIG.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum allowed size`);
  }
  return errors;
};

const generateKey = (filename, className, admissionYear, type) => {
  const safeClassName = String(className)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, "_");
  const safeYear = String(admissionYear).trim();
  const ext = path.extname(filename);
  const safeFilename = `${type}-${safeYear}-${Date.now()}-${crypto.randomUUID()}${ext}`;
  return `admission-results/${safeYear}/class-${safeClassName}/${safeFilename}`;
};

export const handleUploadRequest = async (req, res) => {
  try {
    const { files, className, admissionYear } = req.body;

    if (!files || !Array.isArray(files) || !className || !admissionYear) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const validTypes = ["merit_list", "waiting_list_1", "waiting_list_2"];

    const results = await Promise.all(
      files.map(async (file) => {
        const { filename, contentType, fileSize, type } = file;

        if (!validTypes.includes(type)) {
          return {
            success: false,
            filename,
            error: `Invalid result type: ${type}`,
          };
        }

        const validationErrors = validateFile(filename, contentType, fileSize);
        if (validationErrors.length > 0) {
          return { success: false, filename, errors: validationErrors };
        }

        const key = generateKey(filename, className, admissionYear, type);

        // Decision: Multipart vs Simple
        if (fileSize > CONFIG.MULTIPART_THRESHOLD) {
          try {
            const uploadId = await createMultipartUpload(key, contentType);
            return {
              success: true,
              mode: "multipart",
              filename,
              type,
              key,
              uploadId,
              chunkSize: 10 * 1024 * 1024,
              endpoints: {
                signPart: "/api/admission-result/multipart/sign-part",
                complete: "/api/admission-result/multipart/complete",
              },
            };
          } catch (err) {
            console.error("Multipart init error:", err);
            return {
              success: false,
              filename,
              error: "Failed to init multipart upload",
            };
          }
        } else {
          try {
            const url = await getUploadUrl(key, contentType);
            return {
              success: true,
              mode: "simple",
              filename,
              type,
              key,
              uploadUrl: url,
            };
          } catch (err) {
            console.error("Simple auth error:", err);
            return {
              success: false,
              filename,
              error: "Failed to generate upload URL",
            };
          }
        }
      }),
    );

    const hasErrors = results.some((r) => !r.success);
    res.json({ success: !hasErrors, data: results });
  } catch (error) {
    console.error("Upload request error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to process request" });
  }
};

// Multipart: Sign Part
export const signMultipartUploadPart = async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body;
    if (!key || !uploadId || !partNumber) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }
    const url = await getMultipartPartUrl(key, uploadId, parseInt(partNumber));
    res.json({ success: true, url });
  } catch (error) {
    console.error("Sign Part error:", error);
    res.status(500).json({ success: false, message: "Failed to sign part" });
  }
};

// Multipart: Complete
export const completeMultipartUploadHandler = async (req, res) => {
  try {
    const { key, uploadId, parts } = req.body;
    if (!key || !uploadId || !parts) {
      return res
        .status(400)
        .json({ success: false, message: "Missing fields" });
    }
    await completeMultipartUpload(key, uploadId, parts);
    res.json({ success: true, key });
  } catch (error) {
    console.error("Complete Multipart error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to complete multipart upload" });
  }
};

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
    // Fix legacy paths starting with /
    const itemsToFix = await prisma.admission_result.findMany({
      where: {
        OR: [
          { merit_list: { startsWith: "/" } },
          { waiting_list_1: { startsWith: "/" } },
          { waiting_list_2: { startsWith: "/" } },
        ],
      },
    });

    for (const item of itemsToFix) {
      const updateData = {};
      if (item.merit_list?.startsWith("/"))
        updateData.merit_list = item.merit_list.slice(1);
      if (item.waiting_list_1?.startsWith("/"))
        updateData.waiting_list_1 = item.waiting_list_1.slice(1);
      if (item.waiting_list_2?.startsWith("/"))
        updateData.waiting_list_2 = item.waiting_list_2.slice(1);

      if (Object.keys(updateData).length > 0) {
        await prisma.admission_result.update({
          where: { id: item.id },
          data: updateData,
        });
      }
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
    const {
      class_name,
      admission_year,
      merit_list,
      waiting_list_1,
      waiting_list_2,
    } = req.body;

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
      merit_list: merit_list || null,
      merit_list_public_id: merit_list ? "r2" : null,
      waiting_list_1: waiting_list_1 || null,
      waiting_list_1_public_id: waiting_list_1 ? "r2" : null,
      waiting_list_2: waiting_list_2 || null,
      waiting_list_2_public_id: waiting_list_2 ? "r2" : null,
    };

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
    const {
      class_name,
      admission_year,
      merit_list,
      waiting_list_1,
      waiting_list_2,
    } = req.body;

    const existingResult = await prisma.admission_result.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingResult) {
      return res.status(404).json({ message: "Admission result not found" });
    }

    const updateData = {};

    if (class_name) updateData.class_name = class_name;
    if (admission_year) updateData.admission_year = parseInt(admission_year);

    if (merit_list !== undefined) {
      if (
        existingResult.merit_list &&
        existingResult.merit_list !== merit_list
      ) {
        await deleteFromR2(existingResult.merit_list);
      }
      updateData.merit_list = merit_list;
      updateData.merit_list_public_id = merit_list ? "r2" : null;
    }

    if (waiting_list_1 !== undefined) {
      if (
        existingResult.waiting_list_1 &&
        existingResult.waiting_list_1 !== waiting_list_1
      ) {
        await deleteFromR2(existingResult.waiting_list_1);
      }
      updateData.waiting_list_1 = waiting_list_1;
      updateData.waiting_list_1_public_id = waiting_list_1 ? "r2" : null;
    }

    if (waiting_list_2 !== undefined) {
      if (
        existingResult.waiting_list_2 &&
        existingResult.waiting_list_2 !== waiting_list_2
      ) {
        await deleteFromR2(existingResult.waiting_list_2);
      }
      updateData.waiting_list_2 = waiting_list_2;
      updateData.waiting_list_2_public_id = waiting_list_2 ? "r2" : null;
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

    if (existingResult.merit_list) {
      await deleteFromR2(existingResult.merit_list);
    }
    if (existingResult.waiting_list_1) {
      await deleteFromR2(existingResult.waiting_list_1);
    }
    if (existingResult.waiting_list_2) {
      await deleteFromR2(existingResult.waiting_list_2);
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
