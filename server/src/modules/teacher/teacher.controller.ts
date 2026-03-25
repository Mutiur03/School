import { getUploadUrl } from "@/config/r2.js";
import { teacherFormSchema, rotateTeachersPasswordsBulkRequestSchema } from "@school/shared-schemas";
import asyncHandler from "@/utils/asyncHandler.js";
import { TeacherService } from "@/modules/teacher/teacher.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
import { Request, Response } from "express";

export class TeacherController {
  static getTeachersController = asyncHandler(
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
        const result = await TeacherService.getTeachersPaginated({
          page: pageValue,
          limit: limitValue,
          search: searchValue,
        });
        res
          .status(200)
          .json(new ApiResponse(200, result, "Teachers fetched successfully"));
        return;
      }

      const teachers = await TeacherService.getAllTeachers();
      res
        .status(200)
        .json(new ApiResponse(200, teachers, "Teachers fetched successfully"));
    },
  );

  static addTeacherController = asyncHandler(
    async (req: Request, res: Response) => {
      const { teachers } = req.body;

      if (!Array.isArray(teachers) || teachers.length === 0) {
        throw new ApiError(400, "An array of teachers is required");
      }

      const result = await TeacherService.addTeachers(teachers);

      res.status(201).json(
        new ApiResponse(
          201,
          {
            teachers: result.data,
            inserted_count: result.inserted_count,

            excelBuffer: result.excelBuffer.toString("base64"),
          },
          "Teachers added successfully",
        ),
      );
    },
  );

  static updateTeacherController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const parsedUpdates = teacherFormSchema.safeParse(req.body);
      if (!parsedUpdates.success) {
        throw new ApiError(
          400,
          parsedUpdates.error.issues[0]?.message ||
            "Invalid teacher update data",
          parsedUpdates.error.issues,
        );
      }

      const updatedTeacher = await TeacherService.updateTeacher(
        parseInt(id as string),
        parsedUpdates.data,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, updatedTeacher, "Teacher updated successfully"),
        );
    },
  );

  static deleteTeacherController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;

      await TeacherService.deleteTeacher(parseInt(id as string));
      res
        .status(200)
        .json(new ApiResponse(200, null, "Teacher deleted successfully"));
    },
  );

  static getTeacherImageUploadUrlController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, key, contentType } = req.body;

      if (!id || !key || !contentType) {
        throw new ApiError(400, "id, key, and contentType are required");
      }

      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own image");
      }

      await TeacherService.getTeacherById(teacherId);

      const r2Key = `teachers/${key}`;
      const uploadUrl = await getUploadUrl(r2Key, contentType);
      res.json(
        new ApiResponse(
          200,
          { uploadUrl, key: r2Key },
          "Upload URL generated successfully",
        ),
      );
    },
  );

  static saveTeacherImageController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { key } = req.body;
      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own image");
      }

      const result = await TeacherService.saveTeacherImage(teacherId, key);
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "Teacher image updated successfully"),
        );
    },
  );

  static getTeacherSignatureUploadUrlController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, key, contentType } = req.body;

      if (!id || !key || !contentType) {
        throw new ApiError(400, "id, key, and contentType are required");
      }

      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own signature");
      }

      await TeacherService.getTeacherById(teacherId);

      const r2Key = `signatures/${key}`;
      const uploadUrl = await getUploadUrl(r2Key, contentType);
      res.json(
        new ApiResponse(
          200,
          { uploadUrl, key: r2Key },
          "Upload URL generated successfully",
        ),
      );
    },
  );

  static saveTeacherSignatureController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const { key } = req.body;
      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own signature");
      }

      const result = await TeacherService.saveTeacherSignature(teacherId, key);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            result,
            "Teacher signature updated successfully",
          ),
        );
    },
  );

  static removeTeacherSignatureController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own signature");
      }

      const result = await TeacherService.saveTeacherSignature(teacherId, null);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            result,
            "Teacher signature removed successfully",
          ),
        );
    },
  );

  static removeTeacherImageController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id } = req.params;
      const teacherId = parseInt(id as string);
      if (req.user?.role === "teacher" && req.user.id !== teacherId) {
        throw new ApiError(403, "You can only update your own image");
      }

      const result = await TeacherService.saveTeacherImage(
        teacherId,
        null,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "Teacher image removed successfully"),
        );
    },
  );

  static changePasswordController = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized");
      }
      const { currentPassword, newPassword } = req.body;
      await TeacherService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
      );
      res
        .status(200)
        .json(new ApiResponse(200, null, "Password changed successfully"));
    },
  );

  static rotatePasswordsBulkController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedRequest = rotateTeachersPasswordsBulkRequestSchema.safeParse(
        req.body,
      );
      if (!parsedRequest.success) {
        throw new ApiError(
          400,
          parsedRequest.error.issues[0]?.message ||
            "Invalid bulk rotation payload",
          parsedRequest.error.issues,
        );
      }

      const teacherIds = Array.from(new Set(parsedRequest.data.teacherIds));
      const excelBuffer = await TeacherService.rotatePasswordsBulk(teacherIds);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=rotated_passwords.xlsx",
      );

      res.status(200).send(excelBuffer);
    },
  );

  static updateHeadMessageController = asyncHandler(
    async (req: Request, res: Response) => {
      const { teacherId, message } = req.body;

      const result = await TeacherService.updateHeadMessage(teacherId, message);
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "Head message updated successfully"),
        );
    },
  );

  static getHeadMessageController = asyncHandler(
    async (_req: Request, res: Response) => {
      const headMsg = await TeacherService.getHeadMessage();
      res
        .status(200)
        .json(
          new ApiResponse(200, headMsg, "Head message fetched successfully"),
        );
    },
  );
}
