import { getUploadUrl } from "@/config/r2.js";
import {
  addStudentsRequestSchema,
  updateStudentSchema,
  updateAcademicSchema,
  deleteStudentsBulkRequestSchema,
  enrollmentIdParamSchema,
  yearParamSchema,
  classStudentsParamSchema,
} from "@school/shared-schemas";
import asyncHandler from "../../utils/asyncHandler.js";
import { StudentService } from "./student.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { Request, Response } from "express";

export class StudentController {
  static getAlumniController = asyncHandler(
    async (_req: Request, res: Response) => {
      const students = await StudentService.getAlumni();
      res
        .status(200)
        .json(new ApiResponse(200, students, "Alumni fetched successfully"));
    },
  );

  static getStudentsController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedParams = yearParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        res.status(400).json({
          success: false,
          message: "Invalid year parameter. Year must be a valid number.",
        });
        return;
      }

      const { year: parsedYear } = parsedParams.data;
      const formattedResult = await StudentService.getStudents(
        parsedYear,
        req.user,
      );
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            formattedResult,
            "Students fetched successfully",
          ),
        );
    },
  );

  static getStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const responseData = await StudentService.getStudentById(req.user.id);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            responseData,
            "Student details fetched successfully",
          ),
        );
    },
  );

  static addStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedRequest = addStudentsRequestSchema.safeParse(req.body);
      if (!parsedRequest.success) {
        res.status(400).json({
          success: false,
          error:
            parsedRequest.error.issues[0]?.message || "Invalid request payload",
        });
        return;
      }

      const result = await StudentService.addStudents(
        parsedRequest.data.students,
      );
      res
        .status(201)
        .json(
          new ApiResponse(
            201,
            result.data,
            `Successfully added ${result.inserted_count} students`,
          ),
        );
    },
  );

  static updateStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedUpdates = updateStudentSchema.safeParse(req.body);
      if (!parsedUpdates.success) {
        res.status(400).json({
          success: false,
          error:
            parsedUpdates.error.issues[0]?.message ||
            "Invalid student update data",
        });
        return;
      }

      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        res.status(400).json({ success: false, error: "Invalid student id" });
        return;
      }

      const updatedStudent = await StudentService.updateStudent(
        parsedId.data,
        parsedUpdates.data,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, updatedStudent, "Student updated successfully"),
        );
    },
  );

  static deleteStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        res.status(400).json({ success: false, error: "Invalid student id" });
        return;
      }

      await StudentService.deleteStudent(parsedId.data);
      res
        .status(200)
        .json(new ApiResponse(200, null, "Student deleted successfully"));
    },
  );

  static deleteStudentsBulkController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedRequest = deleteStudentsBulkRequestSchema.safeParse(req.body);
      if (!parsedRequest.success) {
        res.status(400).json({
          success: false,
          error:
            parsedRequest.error.issues[0]?.message ||
            "Invalid bulk delete payload",
        });
        return;
      }

      const studentIds = Array.from(new Set(parsedRequest.data.studentIds));
      const deletedCount = await StudentService.deleteStudentsBulk(studentIds);
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { deletedCount },
            `Deleted ${deletedCount} students successfully`,
          ),
        );
    },
  );

  static updateAcademicInfoController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedEnrollmentId = enrollmentIdParamSchema.safeParse(
        req.params.enrollment_id,
      );
      if (!parsedEnrollmentId.success) {
        res.status(400).json({
          success: false,
          error: "Invalid enrollment_id parameter",
        });
        return;
      }

      const parsedAcademicUpdates = updateAcademicSchema.safeParse(req.body);
      if (!parsedAcademicUpdates.success) {
        res.status(400).json({
          success: false,
          error:
            parsedAcademicUpdates.error.issues[0]?.message ||
            "Invalid academic update data",
        });
        return;
      }

      const updatedEnrollment = await StudentService.updateAcademicInfo(
        parsedEnrollmentId.data,
        parsedAcademicUpdates.data,
      );
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            updatedEnrollment,
            "Academic info updated successfully",
          ),
        );
    },
  );

  static getStudentImageUploadUrlController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, key, contentType } = req.body;
      if (!id || !key || !contentType) {
        res.status(400).json({
          success: false,
          message: "id, key, and contentType are required",
        });
        return;
      }

      const parsedId = enrollmentIdParamSchema.safeParse(id);
      if (!parsedId.success) {
        res.status(400).json({ success: false, error: "Invalid student id" });
        return;
      }

      await StudentService.getStudentById(parsedId.data);

      const r2Key = `students/${key}`;
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

  static saveStudentImageController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        res.status(400).json({ success: false, error: "Invalid student id" });
        return;
      }
      const { key } = req.body;

      const result = await StudentService.saveStudentImage(parsedId.data, key);
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "Student image updated successfully"),
        );
    },
  );

  static changePasswordController = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      const { currentPassword, newPassword } = req.body;
      await StudentService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
      );
      res
        .status(200)
        .json(new ApiResponse(200, null, "Password changed successfully"));
    },
  );

  static getClassStudentsController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedParams = classStudentsParamSchema.safeParse(req.params);
      if (!parsedParams.success) {
        res.status(400).json({
          success: false,
          message: "Invalid parameters.",
        });
        return;
      }

      const data = await StudentService.getClassStudents(
        parsedParams.data.year,
        parsedParams.data.level,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, data, "Class students fetched successfully"),
        );
    },
  );

  static generateTestimonialsController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        res.status(400).json({ success: false, error: "Invalid student id" });
        return;
      }
      const result = await StudentService.generateTestimonials(parsedId.data);
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "Testimonials generated successfully"),
        );
    },
  );
}
