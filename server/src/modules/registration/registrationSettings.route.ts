import express, { Request, Response } from 'express';
import type { ZodType } from 'zod';
import AuthMiddleware from '@/middlewares/auth.middleware.js';
import { validate } from '@/middlewares/validate.middleware.js';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import { registrationNoticeUploadSchema } from '@school/shared-schemas';
import {
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
