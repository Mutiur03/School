import express from 'express';
import { testimonialSchema } from '@school/shared-schemas';
import { validate } from '@/middlewares/validate.middleware.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { generateTestimonialPdf } from './testimonial.service.js';

const router = express.Router();

// Public: stateless — student fills info, gets Bangla + English testimonial in one A4 PDF.
router.post(
  '/api/testimonial/pdf',
  validate(testimonialSchema),
  asyncHandler(async (req, res) => {
    const pdf = await generateTestimonialPdf(req.body);
    const name = String(req.body.student_name_en).replace(/[^A-Za-z0-9]+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `inline; filename="Testimonial_${name}.pdf"`);
    res.end(pdf);
  }),
);

export default router;
