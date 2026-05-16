import { prisma } from "../config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "../config/r2.js";
import { redis } from "../config/redis.js";
import { LONG_TERM_CACHE_TTL } from "../utils/globalVars.js";

/**
 * GET /api/syllabus/presigned-url?filename=&contentType=
 */
export const getSyllabusPresignedUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    const key = `syllabus/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return res.status(500).json({ error: "Error generating presigned URL" });
  }
};

/**
 * POST /api/syllabus/upload
 * Body: { key, class, year }   (key = R2 key after browser PUT)
 */
export const uploadSyllabus = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { class: classNum, year, key } = req.body;
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }
    const syllabus = await prisma.syllabus.create({
      data: {
        class: parseInt(classNum),
        year: parseInt(year),
        pdf_url: key,
        download_url: key,
        public_id: key,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });
    const cacheKey = `syllabus_${schoolId ?? "global"}_all_all`;
    await redis.del(cacheKey);
    res.json(syllabus);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const listSyllabus = async (req, res) => {
  const schoolId = req.schoolId;
  const { class: classNum, year } = req.query;
  const key = `syllabus_${schoolId ?? "global"}_${classNum ?? "all"}_${year ?? "all"}`;
  const cachedSyllabus = await redis
    .get(key)
    .then((data) => (data ? JSON.parse(data) : null))
    .catch(() => null);
  if (cachedSyllabus) {
    return res.json(cachedSyllabus);
  }
  const where = {};
  if (classNum) where.class = parseInt(classNum);
  if (year) where.year = parseInt(year);
  if (schoolId) where.school_id = schoolId;
  const syllabuses = await prisma.syllabus.findMany({ where });
  await redis.set(key, JSON.stringify(syllabuses), "EX", LONG_TERM_CACHE_TTL);
  res.json(syllabuses);
};

export const deleteSyllabus = async (req, res) => {
  const schoolId = req.schoolId;
  const { id } = req.params;
  const syllabus = await prisma.syllabus.findFirst({
    where: schoolId
      ? { id: parseInt(id), school_id: schoolId }
      : { id: parseInt(id) },
  });
  if (!syllabus) return res.status(404).json({ error: "Not found" });

  await deleteFromR2(syllabus.public_id);

  await prisma.syllabus.delete({ where: { id: parseInt(id) } });
  const cacheKey = `syllabus_${schoolId ?? "global"}_all_all`;
  await redis.del(cacheKey);
  res.json({ success: true });
};

/**
 * PUT /api/syllabus/:id
 * Body: { key, class, year }   (key is optional — only if replacing file)
 */
export const updateSyllabus = async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { id } = req.params;
    const { class: classNum, year, key } = req.body;
    const syllabus = await prisma.syllabus.findFirst({
      where: schoolId
        ? { id: parseInt(id), school_id: schoolId }
        : { id: parseInt(id) },
    });
    if (!syllabus) return res.status(404).json({ error: "Not found" });

    let pdf_url = syllabus.pdf_url;
    let public_id = syllabus.public_id;
    let download_url = syllabus.download_url;

    if (key) {
      // Delete old R2 file
      await deleteFromR2(syllabus.public_id);
      pdf_url = key;
      download_url = key;
      public_id = key;
    }

    const updated = await prisma.syllabus.update({
      where: { id: parseInt(id) },
      data: {
        class: parseInt(classNum),
        year: parseInt(year),
        pdf_url,
        download_url,
        public_id,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });
    const cacheKey = `syllabus_${schoolId ?? "global"}_all_all`;
    await redis.del(cacheKey);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
