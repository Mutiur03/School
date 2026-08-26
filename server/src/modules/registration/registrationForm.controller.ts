import path from 'path';
import { Request, Response } from 'express';
import asyncHandler from '@/utils/asyncHandler.js';
import { ApiResponse } from '@/utils/ApiResponse.js';
import {
  assertFormStatusChangeAllowed,
  assertPendingFormEditAllowed,
} from '@/utils/publicFormAccess.util.js';
import { getFileBuffer } from '@/config/r2.js';

/** Minimal surface the three class Form services already share. */
export type RegistrationFormService = {
  createRegistration: (body: any) => Promise<any>;
  getAllRegistrations: (query: any) => Promise<any>;
  getRegistrationById: (id: string) => Promise<any>;
  updateRegistration: (id: string, body: any) => Promise<any>;
  updateRegistrationStatus: (id: string, status: any) => Promise<any>;
  deleteRegistration: (id: string) => Promise<any>;
  getRegistrationPhotoUploadUrl: (body: any) => Promise<any>;
  exportRegistrations: (query: any) => Promise<Buffer>;
  exportRegistrationPhotos: (query: any) => Promise<{ archive: any; registrations: any[] }>;
  downloadRegistrationPDF: (id: string, preview?: string) => Promise<any>;
};

export function createRegistrationFormController(opts: {
  service: RegistrationFormService;
  excelFilename: string;
  photosZipPrefix: string;
  yearQueryKeys: string[];
  photoField: 'photo' | 'photo_path';
  pdfFilenamePrefix: string;
}) {
  const { service } = opts;

  const yearFromQuery = (query: any) => {
    for (const key of opts.yearQueryKeys) {
      if (query[key]) return String(query[key]);
    }
    return 'All';
  };

  return {
    createRegistration: asyncHandler(async (req: Request, res: Response) => {
      const registration = await service.createRegistration(req.body);
      res
        .status(201)
        .json(new ApiResponse(201, registration, 'Registration submitted successfully'));
    }),

    getAllRegistrations: asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getAllRegistrations(req.query);
      res.status(200).json(new ApiResponse(200, result, 'Registrations fetched successfully'));
    }),

    getRegistrationById: asyncHandler(async (req: Request, res: Response) => {
      const registration = await service.getRegistrationById(req.params.id as string);
      res.status(200).json(new ApiResponse(200, registration, 'Registration fetched successfully'));
    }),

    updateRegistration: asyncHandler(async (req: Request, res: Response) => {
      const existing = await service.getRegistrationById(req.params.id as string);
      assertPendingFormEditAllowed(req, existing.status);
      const updated = await service.updateRegistration(req.params.id as string, req.body);
      res.status(200).json(new ApiResponse(200, updated, 'Registration updated successfully'));
    }),

    updateRegistrationStatus: asyncHandler(async (req: Request, res: Response) => {
      const existing = await service.getRegistrationById(req.params.id as string);
      assertFormStatusChangeAllowed(req, existing.status, req.body.status);
      const updated = await service.updateRegistrationStatus(
        req.params.id as string,
        req.body.status,
      );
      res
        .status(200)
        .json(new ApiResponse(200, updated, `Registration ${req.body.status} successfully`));
    }),

    deleteRegistration: asyncHandler(async (req: Request, res: Response) => {
      await service.deleteRegistration(req.params.id as string);
      res.status(200).json(new ApiResponse(200, null, 'Registration deleted successfully'));
    }),

    getRegistrationPhotoUploadUrl: asyncHandler(async (req: Request, res: Response) => {
      const result = await service.getRegistrationPhotoUploadUrl(req.body);
      res.status(200).json(new ApiResponse(200, result, 'Upload URL generated successfully'));
    }),

    exportRegistrations: asyncHandler(async (req: Request, res: Response) => {
      const buffer = await service.exportRegistrations(req.query);
      res.setHeader('Content-Disposition', `attachment; filename=${opts.excelFilename}`);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.status(200).send(buffer);
    }),

    exportRegistrationPhotos: asyncHandler(async (req: Request, res: Response) => {
      const { archive, registrations } = await service.exportRegistrationPhotos(req.query);
      const year = yearFromQuery(req.query);
      const section = (req.query.section as string) || 'All';

      res.setHeader(
        'Content-Disposition',
        `attachment; filename=${opts.photosZipPrefix}_${year}_${section}.zip`,
      );
      res.setHeader('Content-Type', 'application/zip');
      archive.pipe(res);

      for (const reg of registrations) {
        try {
          const photoKey = reg[opts.photoField];
          if (!photoKey) continue;
          const buffer = await getFileBuffer(photoKey);
          if (buffer) {
            const extension = path.extname(photoKey) || '.jpg';
            const fileName = `${reg.section || 'NoSection'}_${reg.roll || 'NoRoll'}${extension}`;
            archive.append(buffer, { name: fileName });
          }
        } catch (err) {
          console.error(`Failed to fetch photo for student ${reg.student_name_en}:`, err);
        }
      }

      archive.finalize();
    }),

    downloadRegistrationPDF: asyncHandler(async (req: Request, res: Response) => {
      const result = await service.downloadRegistrationPDF(
        req.params.id as string,
        req.query.preview as string,
      );

      if ('html' in result) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(result.html);
        return;
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      const fileName = `${opts.pdfFilenamePrefix}_${result.studentName.replace(/\s+/g, '_')}.pdf`;
      res.setHeader(
        'Content-Disposition',
        `${result.isInlinePreview ? 'inline' : 'attachment'}; filename="${fileName}"`,
      );
      res.end(result.pdfBuffer);
    }),
  };
}
