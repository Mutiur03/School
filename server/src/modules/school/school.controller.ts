import { Request, Response } from "express";
import path from "path";
import asyncHandler from "../../utils/asyncHandler.js";
import { SchoolService } from "./school.service.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { getUploadUrl } from "@/config/r2.js";

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
    const requestedId = parseInt(req.params.id);
    if (isNaN(requestedId)) throw new ApiError(400, "Invalid school id");

    const isSuperAdmin = req.user?.role === "super_admin";
    const id = isSuperAdmin ? requestedId : req.schoolId;

    if (!id) throw new ApiError(400, "School context missing");

    const school = await SchoolService.updateSchool(id, req.body);
    res
      .status(200)
      .json(new ApiResponse(200, school, "School updated successfully"));
  });

  static getSchoolPublicInfo = asyncHandler(async (req: any, res: Response) => {
    const info = await SchoolService.getCurrentSchoolInfo({
      schoolId: req.schoolId,
    });

    if (!info) throw new ApiError(404, "School not found");

    res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res
      .status(200)
      .json(new ApiResponse(200, info, "School info fetched successfully"));
  });

  static rotateStudentPasswords = asyncHandler(
    async (req: any, res: Response) => {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ApiError(400, "Invalid school id");

      const buffer = await SchoolService.rotateStudentPasswords(id);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="school-${id}-rotated-passwords.xlsx"`,
      );
      res.status(200).send(buffer);
    },
  );

  static exportStudents = asyncHandler(async (req: any, res: Response) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) throw new ApiError(400, "Invalid school id");

    const buffer = await SchoolService.exportStudentsExcel(id);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="school-${id}-students.xlsx"`,
    );
    res.status(200).send(buffer);
  });

  static getLogoUploadUrl = asyncHandler(async (req: Request, res: Response) => {
    const { fileName, contentType } = req.body as {
      fileName?: string;
      contentType?: string;
    };

    if (!fileName || !contentType) {
      throw new ApiError(400, "fileName and contentType are required");
    }

    if (!contentType.startsWith("image/")) {
      throw new ApiError(400, "Only image files are allowed");
    }

    const ext = path.extname(fileName) || ".png";
    const base = path.basename(fileName, ext).replace(/[^a-zA-Z0-9-_]/g, "-");
    const key = `schools/logos/${Date.now()}-${base}${ext}`;

    const uploadUrl = await getUploadUrl(key, contentType);
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { uploadUrl, key },
          "Logo upload URL generated successfully",
        ),
      );
  });
}
