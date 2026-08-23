import { prisma } from '../config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '../config/r2.js';
import { redis } from '../config/redis.js';
import { LONG_TERM_CACHE_TTL } from '../utils/globalVars.js';

/**
 * GET /api/class-routine/presigned-url?filename=&contentType=
 */
export const getClassRoutinePresignedUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({ error: 'filename and contentType are required' });
    }
    const key = `class_routines/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return res.status(500).json({ error: 'Error generating presigned URL' });
  }
};

/**
 * POST /api/class-routine/pdf
 * Body: { key }   (R2 key after browser PUT)
 */
export const uploadClassRoutinePDF = async (req, res) => {
  try {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'key is required' });

    const pdf = await prisma.class_routine_pdf.create({
      data: {
        pdf_url: key,
        download_url: key,
        public_id: key,
      },
    });
    await redis.del('class_routine_pdfs');
    res.status(201).json(pdf);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save PDF record' });
  }
};

export const getClassRoutinePDFs = async (req, res) => {
  const cacheKey = `class_routine_pdfs`;
  const cachedPDFs = await redis.get(cacheKey).then((data) => (data ? JSON.parse(data) : null));
  if (cachedPDFs) {
    return res.json(cachedPDFs);
  }
  try {
    const pdfs = await prisma.class_routine_pdf.findMany({
      orderBy: [{ id: 'desc' }],
    });
    await redis.set(cacheKey, JSON.stringify(pdfs), 'EX', LONG_TERM_CACHE_TTL);
    res.json(pdfs);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PDFs' });
  }
};

export const deleteClassRoutinePDF = async (req, res) => {
  const { id } = req.params;
  try {
    const pdf = await prisma.class_routine_pdf.findUnique({
      where: { id: Number(id) },
    });
    if (!pdf) return res.status(404).json({ error: 'PDF not found' });

    await deleteFromR2(pdf.public_id);
    await prisma.class_routine_pdf.delete({ where: { id: Number(id) } });
    await redis.del('class_routine_pdfs');
    res.json({ success: true });
  } catch {
    res.status(400).json({ error: 'Failed to delete PDF' });
  }
};

/**
 * PUT /api/class-routine/pdf/:id
 * Body: { key }   (optional — only if replacing the file)
 */
export const updateClassRoutinePDF = async (req, res) => {
  const { id } = req.params;
  try {
    const pdf = await prisma.class_routine_pdf.findUnique({
      where: { id: Number(id) },
    });
    if (!pdf) return res.status(404).json({ error: 'PDF not found' });

    const { key } = req.body;
    let updateData = {};

    if (key) {
      await deleteFromR2(pdf.public_id);
      updateData.pdf_url = key;
      updateData.download_url = key;
      updateData.public_id = key;
    }

    const updated = await prisma.class_routine_pdf.update({
      where: { id: Number(id) },
      data: updateData,
    });
    await redis.del('class_routine_pdfs');
    res.json(updated);
  } catch {
    res.status(400).json({ error: 'Failed to update PDF' });
  }
};
