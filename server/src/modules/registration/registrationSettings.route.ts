import express, { Request, Response } from 'express';
import type { ZodType } from 'zod';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import {
  class6RegistrationSettingsSchema,
  class8RegistrationSettingsSchema,
  juniorScholarshipRegistrationSettingsSchema,
  class9RegistrationSettingsSchema,
  registrationNoticeUploadSchema,
} from '@school/shared-schemas';
import {
  class6SettingsConfig,
  class8SettingsConfig,
  juniorScholarshipSettingsConfig,
  class9SettingsConfig,
  createRegistrationSettingsService,
  type RegistrationSettingsConfig,
} from './registrationSettings.service.js';

export function makeRegistrationSettingsRouter(opts: {
  mountPath: string;
  settingsSchema: ZodType;
  config: RegistrationSettingsConfig;
  updateSuccessMessage: string;
  fetchSuccessMessage: string;
}) {
  const service = createRegistrationSettingsService(opts.config);
  const router = express.Router();

  router.post(
    '/',
    AuthMiddleware.authenticate(['admin']),
    validate(opts.settingsSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const row = await service.createOrUpdate(req.body);
      res.status(200).json(new ApiResponse(200, row, opts.updateSuccessMessage));
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req: Request, res: Response) => {
      const row = await service.get(req.query);
      res.status(200).json(new ApiResponse(200, row, opts.fetchSuccessMessage));
    }),
  );

  router.get(
    '/years',
    asyncHandler(async (_req: Request, res: Response) => {
      const years = await service.getYears();
      res.status(200).json(new ApiResponse(200, years, 'Registration setting years fetched'));
    }),
  );

  router.delete(
    '/notice',
    AuthMiddleware.authenticate(['admin']),
    asyncHandler(async (req: Request, res: Response) => {
      await service.deleteNotice(req.query);
      res.status(200).json(new ApiResponse(200, null, 'Notice deleted successfully'));
    }),
  );

  router.post(
    '/upload-url',
    AuthMiddleware.authenticate(['admin']),
    validate(registrationNoticeUploadSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getNoticeUploadUrl(req.body);
      res.status(200).json(new ApiResponse(200, result, 'Upload URL generated successfully'));
    }),
  );

  const outer = express.Router();
  outer.use(opts.mountPath, router);
  return outer;
}

export const registrationSettingsClass6Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-6',
  settingsSchema: class6RegistrationSettingsSchema,
  config: class6SettingsConfig,
  updateSuccessMessage: 'Class Six Registration updated successfully',
  fetchSuccessMessage: 'Class Six Registration fetched successfully',
});

export const registrationSettingsClass8Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-8',
  settingsSchema: class8RegistrationSettingsSchema,
  config: class8SettingsConfig,
  updateSuccessMessage: 'Class Eight Registration updated successfully',
  fetchSuccessMessage: 'Class Eight Registration fetched successfully',
});

export const registrationSettingsJuniorScholarshipRouter = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/junior-scholarship',
  settingsSchema: juniorScholarshipRegistrationSettingsSchema,
  config: juniorScholarshipSettingsConfig,
  updateSuccessMessage: 'Junior Scholarship settings updated successfully',
  fetchSuccessMessage: 'Junior Scholarship settings fetched successfully',
});

export const registrationSettingsClass9Router = makeRegistrationSettingsRouter({
  mountPath: '/api/reg/class-9',
  settingsSchema: class9RegistrationSettingsSchema,
  config: class9SettingsConfig,
  updateSuccessMessage: 'Class 9 Registration updated successfully',
  fetchSuccessMessage: 'Class 9 Registration fetched successfully',
});
