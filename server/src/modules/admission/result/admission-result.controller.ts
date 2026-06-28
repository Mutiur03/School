import type { Request, Response } from "express";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiError } from "@/utils/ApiError.js";
import { AdmissionResultService } from "./admission-result.service.js";

export class AdmissionResultController {
  static getAdmissionResults = asyncHandler(
    async (req: Request, res: Response) => {
      const { class_name, admission_year } = req.query;
      const results = await AdmissionResultService.getAdmissionResults({
        class_name:
          typeof class_name === "string" ? class_name : undefined,
        admission_year:
          typeof admission_year === "string" ? admission_year : undefined,
      });
      res.status(200).json(results);
    },
  );

  static getAdmissionResultById = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = parseInt(req.params.id as string, 10);
      if (Number.isNaN(parsedId)) {
        throw new ApiError(400, "Invalid admission result id");
      }

      const result =
        await AdmissionResultService.getAdmissionResultById(parsedId);
      res.status(200).json(result);
    },
  );

  static createAdmissionResult = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await AdmissionResultService.createAdmissionResult(
        req.body,
      );
      res.status(201).json(result);
    },
  );

  static updateAdmissionResult = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = parseInt(req.params.id as string, 10);
      if (Number.isNaN(parsedId)) {
        throw new ApiError(400, "Invalid admission result id");
      }

      const result = await AdmissionResultService.updateAdmissionResult(
        parsedId,
        req.body,
      );
      res.status(200).json(result);
    },
  );

  static deleteAdmissionResult = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = parseInt(req.params.id as string, 10);
      if (Number.isNaN(parsedId)) {
        throw new ApiError(400, "Invalid admission result id");
      }

      await AdmissionResultService.deleteAdmissionResult(parsedId);
      res
        .status(200)
        .json({ message: "Admission result deleted successfully" });
    },
  );

  static handleUploadRequest = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await AdmissionResultService.handleUploadRequest(req.body);
      res.status(200).json(result);
    },
  );

  static signMultipartUploadPart = asyncHandler(
    async (req: Request, res: Response) => {
      const result =
        await AdmissionResultService.signMultipartUploadPart(req.body);
      res.status(200).json(result);
    },
  );

  static completeMultipartUploadHandler = asyncHandler(
    async (req: Request, res: Response) => {
      const result =
        await AdmissionResultService.completeMultipartUploadHandler(req.body);
      res.status(200).json(result);
    },
  );
}
