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
import { StudentService } from "@/modules/student/student.service.js";
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
      const year =
        typeof yearValue === "string" ? parseInt(yearValue, 10) : NaN;

      if (!year || Number.isNaN(year)) {
        throw new ApiError(
          400,
          "Invalid year query. Year must be a valid number.",
        );
      }

      const classValue = req.query.class;
      const levelValue = req.query.level;
      const parsedLevelRaw =
        typeof classValue === "string"
          ? parseInt(classValue, 10)
          : typeof levelValue === "string"
            ? parseInt(levelValue, 10)
            : NaN;
      const level = Number.isFinite(parsedLevelRaw)
        ? parsedLevelRaw
        : undefined;

      const pageValue = req.query.page;
      const limitValue = req.query.limit;
      const searchValue = req.query.search;
      const sectionValue = req.query.section;
      const religionValue = req.query.religion;
      const rollValue = req.query.roll;

      const page =
        typeof pageValue === "string" ? parseInt(pageValue, 10) : NaN;
      const limit =
        typeof limitValue === "string" ? parseInt(limitValue, 10) : NaN;
      const roll = typeof rollValue === "string" ? parseInt(rollValue, 10) : NaN;
      const search = typeof searchValue === "string" ? searchValue : undefined;
      const section =
        typeof sectionValue === "string" ? sectionValue : undefined;
      const religion = typeof religionValue === "string" ? religionValue : undefined;

      const isPaginatedRequest =
        (typeof pageValue === "string" && pageValue.trim().length > 0) ||
        (typeof limitValue === "string" && limitValue.trim().length > 0) ||
        (typeof searchValue === "string" && searchValue.trim().length > 0) ||
        (typeof sectionValue === "string" && sectionValue.trim().length > 0) ||
        (typeof religionValue === "string" && religionValue.trim().length > 0) ||
        (typeof rollValue === "string" && rollValue.trim().length > 0);

      if (isPaginatedRequest) {
        const result = await StudentService.getStudentsPaginated(
          {
            year,
            page,
            limit,
            level,
            section,
            search,
            religion,
            roll,
          },
          req.user,
        );
        res
          .status(200)
          .json(new ApiResponse(200, result, "Students fetched successfully"));
        return;
      }

      const data =
        typeof level === "number" && !Number.isNaN(level)
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
          parsedUpdates.error.issues[0]?.message ||
            "Invalid student update data",
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
          parsedRequest.error.issues[0]?.message ||
            "Invalid bulk delete payload",
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
          parsedRequest.error.issues[0]?.message ||
            "Invalid bulk rotation payload",
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
          parsedAcademicUpdates.error.issues[0]?.message ||
            "Invalid academic update data",
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
      const { pdfBuffer, studentName } =
        await StudentService.generateTestimonials(parsedId.data);
      const filename = `Testimonial_${studentName.replace(/\s+/g, "_")}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.status(200).send(pdfBuffer);
    },
  );
}
