import asyncHandler from "@/utils/asyncHandler.js";
import { Request, Response } from "express";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import { MarksheetService } from "./marksheet.service.js";
import {
  PublicResultService,
  verifyPublicResultToken,
} from "./public-result.service.js";

function bearerToken(req: Request): string | undefined {
  return req.headers.authorization?.split(" ")[1];
}

export class PublicResultController {
  static verifyController = asyncHandler(
    async (req: Request, res: Response) => {
      const { loginId, phone } = req.body ?? {};
      if (!loginId || !phone) {
        throw new ApiError(400, "Login ID and phone number are required");
      }
      const data = await PublicResultService.verify(
        String(loginId),
        String(phone),
      );
      res
        .status(200)
        .json(new ApiResponse(200, data, "Verified successfully"));
    },
  );

  static resultController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = verifyPublicResultToken(bearerToken(req));
      const { year, exam } = req.query;
      if (!year || !exam) {
        throw new ApiError(400, "year and exam are required");
      }
      const data = await PublicResultService.getExamResult(
        id,
        String(year),
        String(exam),
      );
      res
        .status(200)
        .json(new ApiResponse(200, data, "Result fetched successfully"));
    },
  );

  static downloadController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = verifyPublicResultToken(bearerToken(req));
      const { year, exam } = req.query;
      if (!year || !exam) {
        throw new ApiError(400, "year and exam are required");
      }
      // Enforce publication before generating the marksheet.
      await PublicResultService.assertExamPublished(String(exam));

      const { buffer, studentName } = await MarksheetService.serve(
        Number(id),
        Number(year),
        String(exam),
        PublicResultService.synthUser(id),
      );
      const filename = `marksheet_${studentName}_${exam}_${year}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.end(buffer);
    },
  );
}
