import asyncHandler from "@/utils/asyncHandler.js";
import { SubjectService } from "./subject.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { Request, Response } from "express";
import { ApiError } from "@/utils/ApiError.js";

export class SubjectController {
  static addSubController = asyncHandler(
    async (req: Request, res: Response) => {
      const { subjects } = req.body;
      await SubjectService.addSubjects(subjects);
      res
        .status(201)
        .json(new ApiResponse(201, null, "Subjects added successfully"));
    },
  );

  static getSubsController = asyncHandler(
    async (_req: Request, res: Response) => {
      const subjects = await SubjectService.getSubjects();
      res
        .status(200)
        .json(new ApiResponse(200, subjects, "Subjects fetched successfully"));
    },
  );

  static deleteSubController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id as string))) {
        throw new ApiError(400, "Invalid subject id");
      }

      await SubjectService.deleteSubject(parseInt(id as string));
      res
        .status(200)
        .json(new ApiResponse(200, null, "Subject deleted successfully"));
    },
  );

  static updateSubController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { old_parent_id, ...data } = req.body;

      if (!id || isNaN(parseInt(id as string))) {
        throw new ApiError(400, "Invalid subject id");
      }

      const result = await SubjectService.updateSubject(
        parseInt(id as string),
        data,
        old_parent_id ? parseInt(old_parent_id) : undefined,
      );
      res
        .status(200)
        .json(new ApiResponse(200, result, "Subject updated successfully"));
    },
  );
}
