import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { RegistrationFormClass9Service } from "./registrationFormClass9.service.js";

export class RegistrationFormClass9Controller {
  static createRegistration = asyncHandler(async (req: Request, res: Response) => {
    const registration = await RegistrationFormClass9Service.createRegistration(req.body);
    res
      .status(201)
      .json(new ApiResponse(201, registration, "Registration submitted successfully"));
  });

  static getAllRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass9Service.getAllRegistrations(req.query);
    res.status(200).json(new ApiResponse(200, result, "Registrations fetched successfully"));
  });

  static getRegistrationById = asyncHandler(async (req: Request, res: Response) => {
    const registration = await RegistrationFormClass9Service.getRegistrationById(req.params.id as string);
    res.status(200).json(new ApiResponse(200, registration, "Registration fetched successfully"));
  });

  static updateRegistration = asyncHandler(async (req: Request, res: Response) => {
    const updated = await RegistrationFormClass9Service.updateRegistration(req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(200, updated, "Registration updated successfully"));
  });

  static updateRegistrationStatus = asyncHandler(async (req: Request, res: Response) => {
    const updated = await RegistrationFormClass9Service.updateRegistrationStatus(req.params.id as string, req.body.status);
    res.status(200).json(new ApiResponse(200, updated, `Registration ${req.body.status} successfully`));
  });

  static deleteRegistration = asyncHandler(async (req: Request, res: Response) => {
    await RegistrationFormClass9Service.deleteRegistration(req.params.id as string);
    res.status(200).json(new ApiResponse(200, null, "Registration deleted successfully"));
  });

  static getRegistrationPhotoUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass9Service.getRegistrationPhotoUploadUrl(req.body);
    res.status(200).json(new ApiResponse(200, result, "Upload URL generated successfully"));
  });

  static exportRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const buffer = await RegistrationFormClass9Service.exportRegistrations(req.query);

    res.setHeader("Content-Disposition", "attachment; filename=Class_9_Registrations.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.status(200).send(buffer);
  });

  static exportRegistrationPhotos = asyncHandler(async (req: Request, res: Response) => {
    const { archive, registrations } = await RegistrationFormClass9Service.exportRegistrationPhotos(req.query);

    const ssc_batch = req.query.ssc_batch as string;
    const section = req.query.section as string;

    res.setHeader("Content-Disposition", `attachment; filename=Class_9_Photos_${ssc_batch || "All"}_${section || "All"}.zip`);
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const reg of registrations) {
      try {
        const { getFileBuffer } = await import("@/config/r2.js");
        const path = await import("path");
        if (reg.photo_path) {
          const buffer = await getFileBuffer(reg.photo_path);
          if (buffer) {
            const extension = path.extname(reg.photo_path) || ".jpg";
            const fileName = `${reg.section || "NoSection"}_${reg.roll || "NoRoll"}${extension}`;
            archive.append(buffer, { name: fileName });
          }
        }
      } catch (err) {
        console.error(`Failed to fetch photo for student ${reg.student_name_en}:`, err);
      }
    }

    archive.finalize();
  });

  static downloadRegistrationPDF = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass9Service.downloadRegistrationPDF(req.params.id as string, req.query.preview as string);

    if ("html" in result) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(result.html);
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const pdfResult = result as any;
    const studentName = (pdfResult.studentName || "Student").replace(/\s+/g, "_");
    const fileName = `Class_9_Reg_${studentName}.pdf`;
    res.setHeader("Content-Disposition", `${pdfResult.isInlinePreview ? "inline" : "attachment"}; filename="${fileName}"`);
    res.end(pdfResult.pdfBuffer);
    return;
  });
}
