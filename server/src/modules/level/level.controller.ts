import asyncHandler from "@/utils/asyncHandler.js";
import { LevelService } from "@/modules/level/level.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import { Request, Response } from "express";
import { levelFormSchema } from "@school/shared-schemas";

export class LevelController {
  static addLevelController = asyncHandler(async (req: Request, res: Response) => {
    const parsedData = levelFormSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiError(
        400,
        parsedData.error.issues[0]?.message || "Invalid level data",
        parsedData.error.issues
      );
    }
    const result = await LevelService.addLevel(parsedData.data);
    res.status(201).json(new ApiResponse(201, result, "Level added successfully"));
  });

  static getLevelsController = asyncHandler(async (_req: Request, res: Response) => {
    const levels = await LevelService.getAllLevels();
    res.status(200).json(new ApiResponse(200, levels, "Levels fetched successfully"));
  });

  static updateLevelController = asyncHandler(async (req: Request, res: Response) => {
    const id = (req.params as any).id as string;
    const parsedData = levelFormSchema.safeParse(req.body);
    if (!parsedData.success) {
      throw new ApiError(
        400,
        parsedData.error.issues[0]?.message || "Invalid level data",
        parsedData.error.issues
      );
    }
    const result = await LevelService.updateLevel(parseInt(id), parsedData.data);
    res.status(200).json(new ApiResponse(200, result, "Level updated successfully"));
  });

  static deleteLevelController = asyncHandler(async (req: Request, res: Response) => {
    const id = req.params.id as string;
    await LevelService.deleteLevel(parseInt(id));
    res.status(200).json(new ApiResponse(200, null, "Level deleted successfully"));
  });
}
