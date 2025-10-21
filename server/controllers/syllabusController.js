import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";
import path from "path";
export async function uploadPDFToCloudinary(file) {
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "syllabus",
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

    const ext = path.extname(file.originalname); 

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

export async function deletePDFFromCloudinary(publicId) {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
    console.log(`File with public ID "${publicId}" deleted successfully.`);
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
}

export const uploadSyllabus = async (req, res) => {
  try {
    const { class: classNum, year } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const { previewUrl, downloadUrl, public_id } = await uploadPDFToCloudinary(
      req.file
    );
    const syllabus = await prisma.syllabus.create({
      data: {
        class: parseInt(classNum),
        year: parseInt(year),
        pdf_url: previewUrl,
        download_url: downloadUrl,
        public_id,
      },
    });
    res.json(syllabus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listSyllabus = async (req, res) => {
  const { class: classNum, year } = req.query;
  const where = {};
  if (classNum) where.class = parseInt(classNum);
  if (year) where.year = parseInt(year);
  const syllabuses = await prisma.syllabus.findMany({ where });
  res.json(syllabuses);
};

export const deleteSyllabus = async (req, res) => {
  const { id } = req.params;
  const syllabus = await prisma.syllabus.findUnique({
    where: { id: parseInt(id) },
  });
  if (!syllabus) return res.status(404).json({ error: "Not found" });
  await deletePDFFromCloudinary(syllabus.public_id);
  await prisma.syllabus.delete({ where: { id: parseInt(id) } });
  res.json({ success: true });
};

export const updateSyllabus = async (req, res) => {
  try {
    const { id } = req.params;
    const { class: classNum, subject, year } = req.body;
    const syllabus = await prisma.syllabus.findUnique({
      where: { id: parseInt(id) },
    });
    if (!syllabus) return res.status(404).json({ error: "Not found" });

    let pdf_url = syllabus.pdf_url;
    let public_id = syllabus.public_id;

    const {
      previewUrl,
      downloadUrl,
      public_id: newPublicId,
    } = req.file ? await uploadPDFToCloudinary(req.file) : {};
    if (req.file) {
      pdf_url = previewUrl;
      public_id = newPublicId;
      await cloudinary.uploader.destroy(syllabus.public_id, {
        resource_type: "raw",
      });
    }

    const updated = await prisma.syllabus.update({
      where: { id: parseInt(id) },
      data: {
        class: parseInt(classNum),
        subject,
        year: parseInt(year),
        pdf_url,
        download_url: downloadUrl,
        public_id,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
