import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import { redis } from "../config/redis.js";
import { LONG_TERM_CACHE_TTL } from "../utils/globalVars.js";
async function uploadPDFToCloudinary(file) {
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "class_routines",
          resource_type: "raw",
          use_filename: true,
          unique_filename: true,
          filename_override: file.originalname,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      previewUrl: result.secure_url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/raw/upload/fl_attachment/${result.public_id}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Cloudinary upload failed");
  }
}

export const getClassSlots = async (req, res) => {
  try {
    const slots = await prisma.class_slot_time.findMany({
      orderBy: { id: "asc" },
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch class slots" });
  }
};

export const createClassSlot = async (req, res) => {
  const { start_time, end_time } = req.body;
  const time12hrRegex = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
  if (!start_time || !end_time) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!time12hrRegex.test(start_time) || !time12hrRegex.test(end_time)) {
    return res.status(400).json({
      error: "Time must be in 12-hour format (e.g. 08:00 AM, 01:00 PM)",
    });
  }
  try {
    const slot = await prisma.class_slot_time.create({
      data: { start_time, end_time },
    });
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ error: "Failed to create class slot" });
  }
};

export const updateClassSlot = async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time } = req.body;
  const time12hrRegex = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
  if (!start_time || !end_time) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!time12hrRegex.test(start_time) || !time12hrRegex.test(end_time)) {
    return res.status(400).json({
      error: "Time must be in 12-hour format (e.g. 08:00 AM, 01:00 PM)",
    });
  }
  try {
    const slot = await prisma.class_slot_time.update({
      where: { id: Number(id) },
      data: { start_time, end_time },
    });
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: "Failed to update class slot" });
  }
};

export const deleteClassSlot = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.class_slot_time.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete class slot" });
  }
};

// Get all routines (optionally filter by class)
export const getRoutines = async (req, res) => {
  const { class: classNum, slot_id } = req.query;
  const where = {};
  if (classNum) where.class = Number(classNum);
  if (slot_id) where.slot_id = Number(slot_id);
  try {
    const routines = await prisma.class_routine.findMany({
      where,
      orderBy: [{ day: "asc" }],
      include: { slot: true },
    });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routines" });
  }
};

// Add a new routine entry
export const createRoutine = async (req, res) => {
  try {
    const { class: classNum, slot_id, day, subject } = req.body;
    if (!slot_id) return res.status(400).json({ error: "slot_id is required" });
    const routine = await prisma.class_routine.create({
      data: { class: Number(classNum), slot_id: Number(slot_id), day, subject },
    });
    res.status(201).json(routine);
  } catch (err) {
    res.status(400).json({ error: "Failed to create routine" });
  }
};

// Update a routine entry
export const updateRoutine = async (req, res) => {
  const { id } = req.params;
  try {
    const { class: classNum, slot_id, day, subject } = req.body;
    if (!slot_id) return res.status(400).json({ error: "slot_id is required" });
    const routine = await prisma.class_routine.update({
      where: { id: Number(id) },
      data: { class: Number(classNum), slot_id: Number(slot_id), day, subject },
    });
    res.json(routine);
  } catch (err) {
    res.status(400).json({ error: "Failed to update routine" });
  }
};

export const deleteRoutine = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.class_routine.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete routine" });
  }
};

export const uploadClassRoutinePDF = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const { previewUrl, downloadUrl, public_id } = await uploadPDFToCloudinary(
      req.file
    );

    const pdf = await prisma.class_routine_pdf.create({
      data: {
        pdf_url: previewUrl,
        download_url: downloadUrl,
        public_id: public_id,
      },
    });
    const key = `class_routine_pdfs`;
    await redis.del(key);
    res.status(201).json(pdf);
  } catch (err) {
    console.log(err);

    res.status(500).json({ error: "Failed to upload PDF" });
  }
};

export const getClassRoutinePDFs = async (req, res) => {
  const key = `class_routine_pdfs`;
  const cachedPDFs = await redis
    .get(key)
    .then((data) => (data ? JSON.parse(data) : null));
  if (cachedPDFs) {
    return res.json(cachedPDFs);
  }
  try {
    const pdfs = await prisma.class_routine_pdf.findMany({
      orderBy: [{ id: "desc" }],
    });
    await redis.set(key, JSON.stringify(pdfs), "EX", LONG_TERM_CACHE_TTL);
    res.json(pdfs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch PDFs" });
  }
};

export const deleteClassRoutinePDF = async (req, res) => {
  const { id } = req.params;
  try {
    const pdf = await prisma.class_routine_pdf.findUnique({
      where: { id: Number(id) },
    });
    if (!pdf) return res.status(404).json({ error: "PDF not found" });
    cloudinary.uploader.destroy(pdf.public_id, { resource_type: "raw" });
    await prisma.class_routine_pdf.delete({ where: { id: Number(id) } });
    const key = `class_routine_pdfs`;
    await redis.del(key);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete PDF" });
  }
};

export const updateClassRoutinePDF = async (req, res) => {
  const { id } = req.params;
  try {
    const pdf = await prisma.class_routine_pdf.findUnique({
      where: { id: Number(id) },
    });
    if (!pdf) return res.status(404).json({ error: "PDF not found" });

    let updateData = {};

    if (req.file) {
      cloudinary.uploader.destroy(pdf.public_id, {
        resource_type: "raw",
      });
      const { previewUrl, downloadUrl, public_id } =
        await uploadPDFToCloudinary(req.file);
      updateData.pdf_url = previewUrl;
      updateData.download_url = downloadUrl;
      updateData.public_id = public_id;
    }

    const updated = await prisma.class_routine_pdf.update({
      where: { id: Number(id) },
      data: updateData,
    });
    const key = `class_routine_pdfs`;
    await redis.del(key);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: "Failed to update PDF" });
  }
};
