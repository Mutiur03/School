import { Router } from 'express';
import { ClassRoutineController } from './class-routine.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';

const router = Router();

router.get('/pdf', ClassRoutineController.listPdfs);
router.get(
  '/presigned-url',
  AuthMiddleware.authenticate(['admin']),
  ClassRoutineController.getPresignedUrl,
);
router.post('/pdf', AuthMiddleware.authenticate(['admin']), ClassRoutineController.uploadPdf);
router.put('/pdf/:id', AuthMiddleware.authenticate(['admin']), ClassRoutineController.updatePdf);
router.delete('/pdf/:id', AuthMiddleware.authenticate(['admin']), ClassRoutineController.deletePdf);

const classRoutineRouter = router.use('/api/class-routine', router);
export default classRoutineRouter;
