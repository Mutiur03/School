import { Request, Response } from "express";
import { EventService } from "./events.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

export class EventController {
  static getPresignedUrl = asyncHandler(
    async (req: Request, res: Response) => {
      const { filename, contentType, type } = req.query;

      if (
        typeof filename !== "string" ||
        typeof contentType !== "string" ||
        (type !== "image" && type !== "file")
      ) {
        throw new ApiError(400, "filename, contentType and type (image|file) are required");
      }

      const result = await EventService.getPresignedUploadUrl(filename, contentType, type);
      return res
        .status(200)
        .json(new ApiResponse(200, result, "Presigned URL generated successfully"));
    },
  );

  static getEvents = asyncHandler(async (req: Request, res: Response) => {
    const result = await EventService.getEvents(req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Events fetched successfully"));
  });

  static addEvent = asyncHandler(async (req: Request, res: Response) => {
    const { title, details, date, location, imageKey, fileKey } = req.body;

    if (!title || !date) {
      throw new ApiError(400, "title and date are required");
    }

    const result = await EventService.createEvent(
      { title, details, location, date, imageKey, fileKey },
      req.schoolId,
    );
    return res
      .status(201)
      .json(new ApiResponse(201, result, "Event created successfully"));
  });

  static updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsedId = parseInt(id as string, 10);
    if (Number.isNaN(parsedId)) throw new ApiError(400, "Invalid event id");

    const { title, details, date, location, imageKey, fileKey } = req.body;

    const result = await EventService.updateEvent(
      parsedId,
      { title, details, location, date, imageKey, fileKey },
      req.schoolId,
    );
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Event updated successfully"));
  });

  static deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const parsedId = parseInt(id as string, 10);
    if (Number.isNaN(parsedId)) throw new ApiError(400, "Invalid event id");

    await EventService.deleteEvent(parsedId, req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Event deleted successfully"));
  });
}
