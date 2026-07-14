import asyncHandler from "@/utils/asyncHandler.js";
import { Request, Response } from "express";
import { z } from "zod";
import {
  publicResultQuerySchema,
  publicResultVerifySchema,
} from "@school/shared-schemas";
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

function parseInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid request",
      parsed.error.issues,
    );
  }
  return parsed.data;
}

export class PublicResultController {
  static verifyController = asyncHandler(
    async (req: Request, res: Response) => {
      const body = parseInput(publicResultVerifySchema, req.body ?? {});
      const data = await PublicResultService.verify(body);
      res
        .status(200)
        .json(new ApiResponse(200, data, "Verified successfully"));
    },
  );

  static resultController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = verifyPublicResultToken(bearerToken(req));
      const { year, exam } = parseInput(publicResultQuerySchema, req.query);
      const data = await PublicResultService.getExamResult(id, year, exam);
      res
        .status(200)
        .json(new ApiResponse(200, data, "Result fetched successfully"));
    },
  );

  static downloadController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = verifyPublicResultToken(bearerToken(req));
      const { year, exam } = parseInput(publicResultQuerySchema, req.query);
      // Enforce publication before generating the marksheet.
      await PublicResultService.assertExamPublished(exam);

      const { buffer, studentName } = await MarksheetService.serve(
        Number(id),
        year,
        exam,
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
