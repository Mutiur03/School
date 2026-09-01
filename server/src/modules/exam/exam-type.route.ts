import { Router } from 'express';
import { ExamTypeController } from './exam-type.controller.js';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import { examTypeSchema, schoolExamTypesSchema } from '@school/shared-schemas';

const superAdminInternal = Router();
superAdminInternal.get(
  '/',
  AuthMiddleware.authenticate(['super_admin']),
  ExamTypeController.listAll,
);
superAdminInternal.post(
  '/',
  AuthMiddleware.authenticate(['super_admin']),
  validate(examTypeSchema),
  ExamTypeController.create,
);
superAdminInternal.put(
  '/school/:schoolId',
  AuthMiddleware.authenticate(['super_admin']),
  validate(schoolExamTypesSchema),
  ExamTypeController.setSchoolTypes,
);
superAdminInternal.put(
  '/:id',
  AuthMiddleware.authenticate(['super_admin']),
  validate(examTypeSchema),
  ExamTypeController.update,
);
superAdminInternal.delete(
  '/:id',
  AuthMiddleware.authenticate(['super_admin']),
  ExamTypeController.delete,
);

export const superAdminExamTypeRouter = Router();
superAdminExamTypeRouter.use('/api/exam-types', superAdminInternal);

const tenantInternal = Router();
tenantInternal.get(
  '/assigned',
  AuthMiddleware.authenticate(['admin']),
  ExamTypeController.listAssigned,
);

export const tenantExamTypeRouter = Router();
tenantExamTypeRouter.use('/api/exam-types', tenantInternal);
