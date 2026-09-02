import { Router } from 'express';
import { SchoolController } from './school.controller.js';
import { SmsSettingsController } from '@/modules/sms-settings/sms-settings.controller.js';
import AuthMiddleware from '../../middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import { createSchoolSchema, updateSchoolSchema } from '@school/shared-schemas';

const tenantSchoolRouterInternal = Router();
tenantSchoolRouterInternal.get('/public', SchoolController.getSchoolPublicInfo);
tenantSchoolRouterInternal.put(
  '/:id',
  AuthMiddleware.authenticate(['super_admin']),
  validate(updateSchoolSchema),
  SchoolController.updateSchool,
);

const superAdminSchoolRouterInternal = Router();
superAdminSchoolRouterInternal.post(
  '/logo-upload-url',
  AuthMiddleware.authenticate(['super_admin']),
  SchoolController.getLogoUploadUrl,
);
superAdminSchoolRouterInternal.post(
  '/',
  AuthMiddleware.authenticate(['super_admin']),
  validate(createSchoolSchema),
  SchoolController.createSchool,
);
superAdminSchoolRouterInternal.get(
  '/',
  AuthMiddleware.authenticate(['super_admin']),
  SchoolController.getSchools,
);
superAdminSchoolRouterInternal.put(
  '/:id',
  AuthMiddleware.authenticate(['super_admin']),
  validate(updateSchoolSchema),
  SchoolController.updateSchool,
);
superAdminSchoolRouterInternal.post(
  '/:id/rotate-student-passwords',
  AuthMiddleware.authenticate(['super_admin']),
  SchoolController.rotateStudentPasswords,
);
superAdminSchoolRouterInternal.get(
  '/:id/students/export',
  AuthMiddleware.authenticate(['super_admin']),
  SchoolController.exportStudents,
);
superAdminSchoolRouterInternal.get(
  '/sms-overview',
  AuthMiddleware.authenticate(['super_admin']),
  SmsSettingsController.getOverview,
);
superAdminSchoolRouterInternal.get(
  '/:id/sms-credentials',
  AuthMiddleware.authenticate(['super_admin']),
  SmsSettingsController.getCredentials,
);
superAdminSchoolRouterInternal.put(
  '/:id/sms-credentials',
  AuthMiddleware.authenticate(['super_admin']),
  SmsSettingsController.updateCredentials,
);
superAdminSchoolRouterInternal.post(
  '/:id/sms-balance',
  AuthMiddleware.authenticate(['super_admin']),
  SmsSettingsController.addBalanceForSchool,
);

export const tenantSchoolRouter = Router();
tenantSchoolRouter.use('/api/schools', tenantSchoolRouterInternal);

export const superAdminSchoolRouter = Router();
superAdminSchoolRouter.use('/api/schools', superAdminSchoolRouterInternal);
