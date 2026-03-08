import { getUploadUrl } from "@/config/r2.js";
import {
  addStudentsRequestSchema,
  updateStudentSchema,
  updateAcademicSchema,
  deleteStudentsBulkRequestSchema,
  rotatePasswordsBulkRequestSchema,
  enrollmentIdParamSchema,
} from "@school/shared-schemas";
import asyncHandler from "@/utils/asyncHandler.js";
import { StudentService } from "@/api/student/student.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";
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

  static getStudentsQueryController = asyncHandler(
    async (req: Request, res: Response) => {
      const yearValue = req.query.year;
      const year = typeof yearValue === "string" ? parseInt(yearValue, 10) : NaN;

      if (!year || Number.isNaN(year)) {
        throw new ApiError(400, "Invalid year query. Year must be a valid number.");
      }

      const classValue = req.query.class;
      const level = typeof classValue === "string" ? parseInt(classValue, 10) : undefined;

      const data = typeof level === "number" && !Number.isNaN(level)
        ? await StudentService.getClassStudents(year, level)
        : await StudentService.getStudents(year, req.user);

      res
        .status(200)
        .json(new ApiResponse(200, data, "Students fetched successfully"));
    },
  );

  static getStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        throw new ApiError(401, "Unauthorized");
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
        throw new ApiError(
          400,
          parsedRequest.error.issues[0]?.message || "Invalid request payload",
          parsedRequest.error.issues,
        );
      }

      const result = await StudentService.addStudents(
        parsedRequest.data.students,
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=students_credentials.xlsx",
      );

      res.status(201).send(result.excelBuffer);
    },
  );

  static updateStudentController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedUpdates = updateStudentSchema.safeParse(req.body);
      if (!parsedUpdates.success) {
        throw new ApiError(
          400,
          parsedUpdates.error.issues[0]?.message || "Invalid student update data",
          parsedUpdates.error.issues,
        );
      }

      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        throw new ApiError(400, "Invalid student id", parsedId.error.issues);
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
        throw new ApiError(400, "Invalid student id", parsedId.error.issues);
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
        throw new ApiError(
          400,
          parsedRequest.error.issues[0]?.message || "Invalid bulk delete payload",
          parsedRequest.error.issues,
        );
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

  static rotatePasswordsBulkController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedRequest = rotatePasswordsBulkRequestSchema.safeParse(
        req.body,
      );
      if (!parsedRequest.success) {
        throw new ApiError(
          400,
          parsedRequest.error.issues[0]?.message || "Invalid bulk rotation payload",
          parsedRequest.error.issues,
        );
      }

      const studentIds = Array.from(new Set(parsedRequest.data.studentIds));
      const excelBuffer = await StudentService.rotatePasswordsBulk(studentIds);

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

  static updateAcademicInfoController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedEnrollmentId = enrollmentIdParamSchema.safeParse(
        req.params.enrollment_id,
      );
      if (!parsedEnrollmentId.success) {
        throw new ApiError(
          400,
          "Invalid enrollment_id parameter",
          parsedEnrollmentId.error.issues,
        );
      }

      const parsedAcademicUpdates = updateAcademicSchema.safeParse(req.body);
      if (!parsedAcademicUpdates.success) {
        throw new ApiError(
          400,
          parsedAcademicUpdates.error.issues[0]?.message || "Invalid academic update data",
          parsedAcademicUpdates.error.issues,
        );
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

  static getStudentImageUploadUrlParamsController = asyncHandler(
    async (req: Request, res: Response) => {
      const { key, contentType } = req.body;
      const { id } = req.params;

      if (!id || !key || !contentType) {
        throw new ApiError(400, "id, key, and contentType are required");
      }

      const parsedId = enrollmentIdParamSchema.safeParse(id);
      if (!parsedId.success) {
        throw new ApiError(400, "Invalid student id", parsedId.error.issues);
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
        throw new ApiError(400, "Invalid student id", parsedId.error.issues);
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
        throw new ApiError(401, "Unauthorized");
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

  static generateTestimonialsController = asyncHandler(
    async (req: Request, res: Response) => {
      const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
      if (!parsedId.success) {
        throw new ApiError(400, "Invalid student id", parsedId.error.issues);
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
