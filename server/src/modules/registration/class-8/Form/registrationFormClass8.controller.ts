import { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { RegistrationFormClass8Service } from "./registrationFormClass8.service.js";

export class RegistrationFormClass8Controller {
  static createRegistration = asyncHandler(async (req: Request, res: Response) => {
    const registration = await RegistrationFormClass8Service.createRegistration(req.body);
    res
      .status(201)
      .json(new ApiResponse(201, registration, "Registration submitted successfully"));
  });

  static getAllRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass8Service.getAllRegistrations(req.query);
    res.status(200).json(new ApiResponse(200, result, "Registrations fetched successfully"));
  });

  static getRegistrationById = asyncHandler(async (req: Request, res: Response) => {
    const registration = await RegistrationFormClass8Service.getRegistrationById(req.params.id as string);
    res.status(200).json(new ApiResponse(200, registration, "Registration fetched successfully"));
  });

  static updateRegistration = asyncHandler(async (req: Request, res: Response) => {
    const updated = await RegistrationFormClass8Service.updateRegistration(req.params.id as string, req.body);
    res.status(200).json(new ApiResponse(200, updated, "Registration updated successfully"));
  });

  static updateRegistrationStatus = asyncHandler(async (req: Request, res: Response) => {
    const updated = await RegistrationFormClass8Service.updateRegistrationStatus(req.params.id as string, req.body.status);
    res.status(200).json(new ApiResponse(200, updated, `Registration ${req.body.status} successfully`));
  });

  static deleteRegistration = asyncHandler(async (req: Request, res: Response) => {
    await RegistrationFormClass8Service.deleteRegistration(req.params.id as string);
    res.status(200).json(new ApiResponse(200, null, "Registration deleted successfully"));
  });

  static getRegistrationPhotoUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass8Service.getRegistrationPhotoUploadUrl(req.body);
    res.status(200).json(new ApiResponse(200, result, "Upload URL generated successfully"));
  });

  static exportRegistrations = asyncHandler(async (req: Request, res: Response) => {
    const buffer = await RegistrationFormClass8Service.exportRegistrations(req.query);

    res.setHeader("Content-Disposition", "attachment; filename=Class8_Registrations.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.status(200).send(buffer);
  });

  static exportRegistrationPhotos = asyncHandler(async (req: Request, res: Response) => {
    const { archive, registrations } = await RegistrationFormClass8Service.exportRegistrationPhotos(req.query);

    const class8_year = req.query.class8_year as string;
    const section = req.query.section as string;

    res.setHeader("Content-Disposition", `attachment; filename=Class8_Photos_${class8_year || "All"}_${section || "All"}.zip`);
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const reg of registrations) {
      try {
        const { getFileBuffer } = await import("@/config/r2.js");
        const path = await import("path");
        const buffer = await getFileBuffer(reg.photo);
        if (buffer) {
          const extension = path.extname(reg.photo) || ".jpg";
          const fileName = `${reg.section || "NoSection"}_${reg.roll || "NoRoll"}${extension}`;
          archive.append(buffer, { name: fileName });
        }
      } catch (err) {
        console.error(`Failed to fetch photo for student ${reg.student_name_en}:`, err);
      }
    }

    archive.finalize();
  });

  static downloadRegistrationPDF = asyncHandler(async (req: Request, res: Response) => {
    const result = await RegistrationFormClass8Service.downloadRegistrationPDF(req.params.id as string, req.query.preview as string);

    if (result && typeof result === 'object' && "html" in result) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send((result as any).html);
      return;
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    const fileName = `Class8_Reg_${result.studentName.replace(/\s+/g, "_")}.pdf`;
    res.setHeader("Content-Disposition", `${result.isInlinePreview ? "inline" : "attachment"}; filename="${fileName}"`);
    res.send(result.pdfBuffer);
    return;
  });
}
