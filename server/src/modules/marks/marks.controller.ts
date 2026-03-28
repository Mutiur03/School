import asyncHandler from "@/utils/asyncHandler.js";
import { Request, Response } from "express";
import { MarksService } from "./marks.service.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

export class MarksController {
  static addMarksController = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.body) {
        throw new ApiError(400, "Request body is required");
      }
      const result = await MarksService.addMarks(req.body, req.user);
      res
        .status(200)
        .json(new ApiResponse(200, result, "Marks processed successfully"));
    },
  );

  static getStudentsForMarksController = asyncHandler(
    async (req: Request, res: Response) => {
      const { class: className, year, section } = req.query;
      const result = await MarksService.getStudentsForMarks(
        className as string,
        year as string,
        section as string,
        req.user,
      );
      res
        .status(200)
        .json(new ApiResponse(200, result, "Students fetched successfully"));
    },
  );

  static getClassMarksController = asyncHandler(
    async (req: Request, res: Response) => {
      const { className, year, exam } = req.params;
      if (!className || !year || !exam) {
        throw new ApiError(
          400,
          "className, year, and exam are required parameters",
        );
      }
      const data = await MarksService.getClassMarks(
        className as string,
        year as string,
        exam as string,
        req.user,
      );
      res
        .status(200)
        .json(new ApiResponse(200, data, "Class marks fetched successfully"));
    },
  );

  static getIndividualMarksController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, year, exam } = req.params;
      if (!id || !year || !exam) {
        throw new ApiError(
          400,
          "Student id, year, and exam are required parameters",
        );
      }
      const data = await MarksService.getIndividualMarks(
        id as string,
        year as string,
        exam as string,
        req.user,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, data, "Individual marks fetched successfully"),
        );
    },
  );

  static getIndividualSessionMarksPreviewController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, year } = req.params;
      if (!id || !year) {
        throw new ApiError(400, "Student id and year are required");
      }
      const data = await MarksService.getIndividualSessionMarksPreview(
        id as string,
        year as string,
        req.user,
      );
      res
        .status(200)
        .json(
          new ApiResponse(
            200,
            data,
            "Individual session marks preview fetched",
          ),
        );
    },
  );

  static generateMarksheetController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, year, exam } = req.params;
      if (!id || !year || !exam) {
        throw new ApiError(
          400,
          "Student id, year, and exam are required parameters",
        );
      }
      const { buffer, studentName } = await MarksService.generateMarksheetPDF(
        id as string,
        year as string,
        exam as string,
        req.user,
      );
      const filename = `marksheet_${studentName}_${exam}_${year}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.end(buffer);
    },
  );

  static downloadAllMarksheetPDFController = asyncHandler(
    async (req: Request, res: Response) => {
      const { year } = req.params;
      if (!year) {
        throw new ApiError(400, "Year parameter is required");
      }
      const pdfBuffer = await MarksService.generateAllMarksheetsPDF(
        year as string,
      );
      const filename = `all_marksheets_${year}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.end(pdfBuffer);
    },
  );

  static downloadIndividualSessionMarksheetController = asyncHandler(
    async (req: Request, res: Response) => {
      const { id, year } = req.params;
      if (!id || !year) {
        throw new ApiError(400, "Student id and year are required");
      }
      const pdfBuffer = await MarksService.generateAllMarksheetsPDF(
        year as string,
        id as string,
      );
      const filename = `session_marksheet_${id}_${year}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.end(pdfBuffer);
    },
  );

  static downloadClassExamMarksheetPDFController = asyncHandler(
    async (req: Request, res: Response) => {
      const { className, year, exam } = req.params;
      if (!className || !year || !exam) {
        throw new ApiError(
          400,
          "className, year, and exam are required parameters",
        );
      }
      const pdfBuffer = await MarksService.generateBulkExamMarksheetsPDF(
        year as string,
        className as string,
        exam as string,
      );
      const filename = `class_${className}_${exam}_${year}.pdf`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${filename}"`,
      );
      res.end(pdfBuffer);
    },
  );

  static updateFourthSubjectController = asyncHandler(
    async (req: Request, res: Response) => {
      const { studentId, year, subjectId } = req.body;
      if (!studentId || !year) {
        throw new ApiError(400, "studentId and year are required");
      }
      const result = await MarksService.updateFourthSubject(
        studentId,
        year,
        subjectId,
        req.user,
      );
      res
        .status(200)
        .json(
          new ApiResponse(200, result, "4th subject updated successfully"),
        );
    },
  );
}
