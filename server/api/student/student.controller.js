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

export class StudentController {
  static getAlumniController = asyncHandler(async (_req, res) => {
    const students = await StudentService.getAlumni();
    res
      .status(200)
      .json(new ApiResponse(200, students, "Alumni fetched successfully"));
  });

  static getStudentsController = asyncHandler(async (req, res) => {
    const parsedParams = yearParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid year parameter. Year must be a valid number.",
      });
    }

    const { year: parsedYear } = parsedParams.data;
    const formattedResult = await StudentService.getStudents(
      parsedYear,
      req.user,
    );
    res
      .status(200)
      .json(
        new ApiResponse(200, formattedResult, "Students fetched successfully"),
      );
  });

  static getStudentController = asyncHandler(async (req, res) => {
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
  });

  static addStudentController = asyncHandler(async (req, res) => {
    const parsedRequest = addStudentsRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      return res.status(400).json({
        success: false,
        error:
          parsedRequest.error.issues[0]?.message || "Invalid request payload",
      });
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
  });

  static updateStudentController = asyncHandler(async (req, res) => {
    const parsedUpdates = updateStudentSchema.safeParse(req.body);
    if (!parsedUpdates.success) {
      return res.status(400).json({
        error:
          parsedUpdates.error.issues[0]?.message ||
          "Invalid student update data",
      });
    }

    const parsedId = enrollmentIdParamSchema.safeParse(req.params.id);
    if (!parsedId.success) {
      return res.status(400).json({ error: "Invalid student id" });
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
  });

  static deleteStudentController = asyncHandler(async (req, res) => {
    await StudentService.deleteStudent(parseInt(req.params.id));
    res
      .status(200)
      .json(new ApiResponse(200, null, "Student deleted successfully"));
  });

  static deleteStudentsBulkController = asyncHandler(async (req, res) => {
    const parsedRequest = deleteStudentsBulkRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      return res.status(400).json({
        success: false,
        error:
          parsedRequest.error.issues[0]?.message ||
          "Invalid bulk delete payload",
      });
    }

    const studentIds = [...new Set(parsedRequest.data.studentIds)];
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
  });

  static updateAcademicInfoController = asyncHandler(async (req, res) => {
    const parsedEnrollmentId = enrollmentIdParamSchema.safeParse(
      req.params.enrollment_id,
    );
    if (!parsedEnrollmentId.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid enrollment_id parameter",
      });
    }

    const parsedAcademicUpdates = updateAcademicSchema.safeParse(req.body);
    if (!parsedAcademicUpdates.success) {
      return res.status(400).json({
        success: false,
        error:
          parsedAcademicUpdates.error.issues[0]?.message ||
          "Invalid academic update data",
      });
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
  });

  static getStudentImageUploadUrlController = asyncHandler(async (req, res) => {
    const { id, key, contentType } = req.body;
    if (!id || !key || !contentType) {
      return res.status(400).json({
        success: false,
        message: "id, key, and contentType are required",
      });
    }

    await StudentService.getStudentById(parseInt(id));

    const r2Key = `students/${key}`;
    const uploadUrl = await getUploadUrl(r2Key, contentType);
    res.json(
      new ApiResponse(
        200,
        { uploadUrl, key: r2Key },
        "Upload URL generated successfully",
      ),
    );
  });

  static saveStudentImageController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { key } = req.body;

    const result = await StudentService.saveStudentImage(parseInt(id), key);
    res
      .status(200)
      .json(new ApiResponse(200, result, "Student image updated successfully"));
  });

  static changePasswordController = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await StudentService.changePassword(
      req.user.id,
      currentPassword,
      newPassword,
    );
    res
      .status(200)
      .json(new ApiResponse(200, null, "Password changed successfully"));
  });

  static getClassStudentsController = asyncHandler(async (req, res) => {
    const parsedParams = classStudentsParamSchema.safeParse(req.params);
    if (!parsedParams.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid parameters.",
      });
    }

    const data = await StudentService.getClassStudents(
      parsedParams.data.year,
      parsedParams.data.level,
    );
    res
      .status(200)
      .json(new ApiResponse(200, data, "Class students fetched successfully"));
  });

  static generateTestimonialsController = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await StudentService.generateTestimonials(parseInt(id));
    res
      .status(200)
      .json(
        new ApiResponse(200, result, "Testimonials generated successfully"),
      );
  });
}
