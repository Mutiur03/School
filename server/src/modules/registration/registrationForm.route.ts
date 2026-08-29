import express from 'express';
import type { ZodType } from 'zod';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import { registrationPhotoUploadSchema } from '@school/shared-schemas';
import {
  createRegistrationFormController,
  type RegistrationFormService,
} from './registrationForm.controller.js';

export function makeRegistrationFormRouter(opts: {
  mountPath: string;
  formSchema: ZodType;
  statusSchema: ZodType;
  lookupSchema: ZodType;
  service: RegistrationFormService;
  excelFilename: string;
  photosZipPrefix: string;
  yearQueryKeys: string[];
  photoField: 'photo' | 'photo_path';
  pdfFilenamePrefix: string;
}) {
  const ctrl = createRegistrationFormController(opts);
  const router = express.Router();

  router.post('/', validate(opts.formSchema), ctrl.createRegistration);
  router.get('/', AuthMiddleware.authenticate(['admin']), ctrl.getAllRegistrations);
  router.post(
    '/upload-url',
    validate(registrationPhotoUploadSchema),
    ctrl.getRegistrationPhotoUploadUrl,
  );
  router.post('/find', validate(opts.lookupSchema), ctrl.findRegistration);
  router.get('/export', AuthMiddleware.authenticate(['admin']), ctrl.exportRegistrations);
  router.get(
    '/export-photos',
    AuthMiddleware.authenticate(['admin']),
    ctrl.exportRegistrationPhotos,
  );
  router.get('/:id', ctrl.getRegistrationById);
  router.get('/:id/pdf', ctrl.downloadRegistrationPDF);
  router.put(
    '/:id/status',
    AuthMiddleware.authenticateOptional(),
    validate(opts.statusSchema),
    ctrl.updateRegistrationStatus,
  );
  router.put(
    '/:id',
    AuthMiddleware.authenticateOptional(),
    validate(opts.formSchema),
    ctrl.updateRegistration,
  );
  router.delete('/:id', AuthMiddleware.authenticate(['admin']), ctrl.deleteRegistration);

  const outer = express.Router();
  outer.use(opts.mountPath, router);
  return outer;
}
