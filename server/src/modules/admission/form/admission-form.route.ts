import express from 'express';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import { admissionPhotoUploadSchema } from '@school/shared-schemas';
import { AdmissionFormController } from './admission-form.controller.js';

const router = express.Router();

router.post(
  '/upload-url',
  validate(admissionPhotoUploadSchema),
  AdmissionFormController.getAdmissionUploadUrl,
);
router.post('/', AdmissionFormController.createForm);

router.get('/', AuthMiddleware.authenticate(['admin']), AdmissionFormController.getForms);
router.get(
  '/excel',
  AuthMiddleware.authenticate(['admin']),
  AdmissionFormController.exportAllAdmissionsExcel,
);
router.get(
  '/download',
  AuthMiddleware.authenticate(['admin']),
  AdmissionFormController.exportAllAdmissionsExcel,
);
router.get(
  '/images-export',
  AuthMiddleware.authenticate(['admin']),
  AdmissionFormController.exportAdmissionImagesZip,
);

router.get('/:id', AdmissionFormController.getFormById);
router.get('/:id/pdf', AdmissionFormController.downloadPDF);
router.put('/:id', AuthMiddleware.authenticateOptional(), AdmissionFormController.updateForm);
router.put(
  '/:id/pending',
  AuthMiddleware.authenticate(['admin']),
  AdmissionFormController.pendingForm,
);
router.put(
  '/:id/approve',
  AuthMiddleware.authenticateOptional(),
  AdmissionFormController.approveForm,
);
router.delete('/:id', AuthMiddleware.authenticate(['admin']), AdmissionFormController.deleteForm);

const admissionFormRouter = express.Router();
admissionFormRouter.use('/api/admission/form', router);

export default admissionFormRouter;
