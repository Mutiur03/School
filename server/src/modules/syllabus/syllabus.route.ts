import { Router } from 'express';
import { SyllabusController } from './syllabus.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

const router = Router();

router.get('/', SyllabusController.listSyllabus);
router.get(
  '/presigned-url',
  AuthMiddleware.authenticate(['admin']),
  SyllabusController.getPresignedUrl,
);
router.post('/upload', AuthMiddleware.authenticate(['admin']), SyllabusController.uploadSyllabus);
router.put('/:id', AuthMiddleware.authenticate(['admin']), SyllabusController.updateSyllabus);
router.delete('/:id', AuthMiddleware.authenticate(['admin']), SyllabusController.deleteSyllabus);

const syllabusRouter = router.use('/api/syllabus', router);
export default syllabusRouter;
