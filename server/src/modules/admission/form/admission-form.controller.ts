import type { Request, Response, NextFunction } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import {
  AdmissionFormService,
  DuplicateAdmissionFormError,
} from "./admission-form.service.js";

export class AdmissionFormController {
  static getAdmissionUploadUrl = asyncHandler(
    async (req: Request, res: Response) => {
      const { url, key } = await AdmissionFormService.getAdmissionUploadUrl(req.body);
      res.json({ success: true, url, key });
    },
  );

  static createForm = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const data = await AdmissionFormService.createForm(req.body);
        res.status(201).json({
          success: true,
          message: "Admission form submitted",
          data,
        });
      } catch (error) {
        if (error instanceof DuplicateAdmissionFormError) {
          res.status(400).json({
            success: false,
            message: error.message,
            duplicates: error.duplicates,
          });
          return;
        }
        next(error);
      }
    },
  );

  static getForms = asyncHandler(async (_req: Request, res: Response) => {
    const items = await AdmissionFormService.getForms();
    res.status(200).json({ success: true, data: items });
  });

  static getFormById = asyncHandler(async (req: Request, res: Response) => {
    const rec = await AdmissionFormService.getFormById(req.params.id as string);
    res.status(200).json({ success: true, data: rec });
  });

  static updateForm = asyncHandler(
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const updated = await AdmissionFormService.updateForm(
          req.params.id as string,
          req.body,
        );
        res.status(200).json({ success: true, message: "Form updated", data: updated });
      } catch (error) {
        if (error instanceof DuplicateAdmissionFormError) {
          res.status(400).json({
            success: false,
            message: error.message,
            duplicates: error.duplicates,
          });
          return;
        }
        next(error);
      }
    },
  );

  static deleteForm = asyncHandler(async (req: Request, res: Response) => {
    await AdmissionFormService.deleteForm(req.params.id as string);
    res.status(200).json({ success: true, message: "Form deleted" });
  });

  static approveForm = asyncHandler(async (req: Request, res: Response) => {
    const updated = await AdmissionFormService.approveForm(req.params.id as string);
    res.status(200).json({ success: true, message: "Form approved", data: updated });
  });

  static pendingForm = asyncHandler(async (req: Request, res: Response) => {
    const updated = await AdmissionFormService.pendingForm(req.params.id as string);
    res.status(200).json({
      success: true,
      message: "Form marked as pending",
      data: updated,
    });
  });

  static exportAllAdmissionsExcel = asyncHandler(
    async (req: Request, res: Response) => {
      const buffer = await AdmissionFormService.exportAllAdmissionsExcel(req.query);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="admissions_export_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,
      );
      res.status(200).send(buffer);
    },
  );

  static exportAdmissionImagesZip = asyncHandler(
    async (req: Request, res: Response) => {
      const { archive, forms, fileName } =
        await AdmissionFormService.exportAdmissionImagesZip(req.query);

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

      archive.on("error", (err) => {
        console.error("Archiver error:", err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: "Failed to create archive",
            error: err.message,
          });
        }
      });

      archive.pipe(res);
      await AdmissionFormService.appendAdmissionImagesToArchive(archive, forms);
    },
  );

  static downloadPDF = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const pdfBuffer = await AdmissionFormService.downloadPDF(req.params.id as string);
      res.setHeader("Content-Type", "application/pdf");
      res.end(pdfBuffer);
    } catch (error: any) {
      if (error?.statusCode === 404) {
        res.status(404).json({ error: "Admission not found" });
        return;
      }
      throw error;
    }
  });
}
