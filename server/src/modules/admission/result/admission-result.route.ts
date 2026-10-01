import express from 'express';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import {
  admissionResultCreateSchema,
  admissionResultMultipartCompleteSchema,
  admissionResultMultipartSignSchema,
  admissionResultUpdateSchema,
  admissionResultUploadRequestSchema,
} from '@school/shared-schemas';
import { AdmissionResultController } from './admission-result.controller.js';

const router = express.Router();

const adminOnly = AuthMiddleware.authenticate(['admin']);

router.get('/', AdmissionResultController.getAdmissionResults);
router.get('/:id', AdmissionResultController.getAdmissionResultById);
router.post(
  '/upload',
  adminOnly,
  validate(admissionResultUploadRequestSchema),
  AdmissionResultController.handleUploadRequest,
);
router.post(
  '/multipart/sign-part',
  adminOnly,
  validate(admissionResultMultipartSignSchema),
  AdmissionResultController.signMultipartUploadPart,
);
router.post(
  '/multipart/complete',
  adminOnly,
  validate(admissionResultMultipartCompleteSchema),
  AdmissionResultController.completeMultipartUploadHandler,
);
router.post(
  '/',
  adminOnly,
  validate(admissionResultCreateSchema),
  AdmissionResultController.createAdmissionResult,
);
router.put(
  '/:id',
  adminOnly,
  validate(admissionResultUpdateSchema),
  AdmissionResultController.updateAdmissionResult,
);
router.delete('/:id', adminOnly, AdmissionResultController.deleteAdmissionResult);

const admissionResultRouter = express.Router();
admissionResultRouter.use('/api/admission-result', router);

export default admissionResultRouter;
