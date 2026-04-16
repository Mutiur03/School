import { Request, Response } from "express";
import asyncHandler from "../../utils/asyncHandler.js";
import { SchoolService } from "./school.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";

export class SchoolController {
  static createSchool = asyncHandler(async (req: Request, res: Response) => {
    const school = await SchoolService.createSchool(req.body);
    res
      .status(201)
      .json(new ApiResponse(201, school, "School created successfully"));
  });

  static getSchools = asyncHandler(async (_req: Request, res: Response) => {
    const schools = await SchoolService.getSchools();
    res
      .status(200)
      .json(new ApiResponse(200, schools, "Schools fetched successfully"));
  });

  static getSchoolById = asyncHandler(async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, "Invalid school id");
    
    const school = await SchoolService.getSchoolById(id);
    if (!school) throw new ApiError(404, "School not found");
    
    res
      .status(200)
      .json(new ApiResponse(200, school, "School fetched successfully"));
  });

  static updateSchool = asyncHandler(async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, "Invalid school id");
    
    const school = await SchoolService.updateSchool(id, req.body);
    res
      .status(200)
      .json(new ApiResponse(200, school, "School updated successfully"));
  });

  static deleteSchool = asyncHandler(async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, "Invalid school id");
    
    await SchoolService.deleteSchool(id);
    res
      .status(200)
      .json(new ApiResponse(200, null, "School deleted successfully"));
  });

  static getSchoolPublicInfo = asyncHandler(async (req: any, res: Response) => {
    const parsedParamId = parseInt(req.params.id, 10);
    const resolvedSchoolId = !isNaN(parsedParamId) ? parsedParamId : req.schoolId;

    if (!resolvedSchoolId) {
      throw new ApiError(400, "School could not be resolved by middleware");
    }

    const info = await SchoolService.getCurrentSchoolInfo({
      schoolId: resolvedSchoolId,
      hostname: req.hostname,
    });

    if (!info) throw new ApiError(404, "School not found");

    res
      .status(200)
      .json(new ApiResponse(200, info, "School info fetched successfully"));
  });
}
