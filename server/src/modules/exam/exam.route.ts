import { Router } from 'express';
import { ExamController } from './exam.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import { addExamsSchema, createExamSchema } from '@school/shared-schemas';

const router = Router();

router.get('/getExams', ExamController.getExams);
router.post(
  '/addExam',
  AuthMiddleware.authenticate(['admin']),
  validate(addExamsSchema),
  ExamController.addExam,
);
router.put(
  '/updateVisibility/:examId',
  AuthMiddleware.authenticate(['admin']),
  ExamController.updateVisibility,
);
router.put(
  '/updateExam/:examId',
  AuthMiddleware.authenticate(['admin']),
  validate(createExamSchema),
  ExamController.updateExam,
);
router.delete(
  '/deleteExam/:examId',
  AuthMiddleware.authenticate(['admin']),
  ExamController.deleteExam,
);
router.get(
  '/presigned-url',
  AuthMiddleware.authenticate(['admin']),
  ExamController.getPresignedUrl,
);
router.post(
  '/uploadRoutinePDF/:examId',
  AuthMiddleware.authenticate(['admin']),
  ExamController.uploadRoutinePdf,
);
router.delete(
  '/removeRoutinePDF/:examId',
  AuthMiddleware.authenticate(['admin']),
  ExamController.removeRoutinePdf,
);

const examRouter = router.use('/api/exams', router);
export default examRouter;
