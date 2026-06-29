import { Request, Response } from "express";
import { z } from "zod";
import {
  addStaffRequestSchema,
  staffFormSchema,
  staffIdParamSchema,
  staffImageKeySchema,
  staffPresignedUrlQuerySchema,
} from "@school/shared-schemas";
import { StaffService } from "./staff.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

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

export class StaffController {
  static getStaffsController = asyncHandler(
    async (req: Request, res: Response) => {
      const { page, limit, search } = req.query;
      const pageValue = typeof page === "string" ? parseInt(page, 10) : NaN;
      const limitValue = typeof limit === "string" ? parseInt(limit, 10) : NaN;
      const searchValue = typeof search === "string" ? search : undefined;

      const isPaginatedRequest =
        (typeof page === "string" && page.trim().length > 0) ||
        (typeof limit === "string" && limit.trim().length > 0) ||
        (typeof search === "string" && search.trim().length > 0);

      if (isPaginatedRequest) {
        const result = await StaffService.getStaffsPaginated({
          page: pageValue,
          limit: limitValue,
          search: searchValue,
        });
        return res
          .status(200)
          .json(new ApiResponse(200, result, "Staffs fetched successfully"));
      }

      const data = await StaffService.getStaffs();
      return res
        .status(200)
        .json(new ApiResponse(200, data, "Staffs fetched successfully"));
    },
  );

  static addStaffController = asyncHandler(
    async (req: Request, res: Response) => {
      const staff = parseInput(addStaffRequestSchema, req.body);
      const data = await StaffService.addStaff(staff);

      res
        .status(201)
        .json(new ApiResponse(201, data, "Staffs added successfully"));
    },
  );

  static updateStaffController = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseInput(staffIdParamSchema, req.params.id);
      const data = parseInput(staffFormSchema, req.body);
      const result = await StaffService.updateStaff(id, data);

      res
        .status(200)
        .json(new ApiResponse(200, result, "Staff updated successfully"));
    },
  );

  static deleteStaffController = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseInput(staffIdParamSchema, req.params.id);
      const data = await StaffService.deleteStaff(id);

      res
        .status(200)
        .json(new ApiResponse(200, data, "Staff deleted successfully"));
    },
  );

  static getStaffPresignedUrlController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, filename, contentType } = parseInput(
        staffPresignedUrlQuerySchema,
        req.query,
      );

      const result = await StaffService.getPresignedUploadUrl(
        id,
        filename,
        contentType,
      );

      res.json(
        new ApiResponse(
          200,
          result,
          "Presigned URL generated successfully",
        ),
      );
    },
  );

  static saveStaffImageController = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseInput(staffIdParamSchema, req.params.id);
      const { key } = parseInput(staffImageKeySchema, req.body);
      const result = await StaffService.saveStaffImage(id, key);

      res
        .status(200)
        .json(new ApiResponse(200, result, "Staff image updated successfully"));
    },
  );

  static removeStaffImageController = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseInput(staffIdParamSchema, req.params.id);
      const result = await StaffService.saveStaffImage(id, null);

      res
        .status(200)
        .json(new ApiResponse(200, result, "Staff image removed successfully"));
    },
  );
}
