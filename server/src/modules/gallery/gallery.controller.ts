import { Request, Response } from "express";
import { GalleryService } from "./gallery.service.js";
import asyncHandler from "@/utils/asyncHandler.js";
import { ApiResponse } from "@/utils/ApiResponse.js";
import { ApiError } from "@/utils/ApiError.js";

const parseId = (value: string | string[] | undefined, label = "id") => {
  const id = parseInt(String(value), 10);
  if (Number.isNaN(id)) throw new ApiError(400, `Invalid ${label}`);
  return id;
};

export class GalleryController {
  static getPresignedUrl = asyncHandler(
    async (req: Request, res: Response) => {
      const { filename, contentType } = req.query;
      if (typeof filename !== "string" || typeof contentType !== "string") {
        throw new ApiError(400, "filename and contentType are required");
      }
      const result = await GalleryService.getPresignedUploadUrl(
        filename,
        contentType,
        req.schoolId,
      );
      return res
        .status(200)
        .json(new ApiResponse(200, result, "Presigned URL generated"));
    },
  );

  static addGallery = asyncHandler(async (req: Request, res: Response) => {
    const { keys, caption, eventId, category, status } = req.body;
    const result = await GalleryService.addGallery(
      { keys, caption, eventId, category, status },
      req.user!.id,
      req.user!.role,
      req.schoolId,
    );
    return res
      .status(201)
      .json(new ApiResponse(201, result, "Images uploaded successfully"));
  });

  static updateGallery = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const { imageKey, caption, eventId, category } = req.body;
    const result = await GalleryService.updateGallery(
      id,
      { imageKey, caption, eventId, category },
      req.schoolId,
    );
    return res
      .status(200)
      .json(new ApiResponse(200, result, "Image updated successfully"));
  });

  static getGalleries = asyncHandler(async (req: Request, res: Response) => {
    const result = await GalleryService.getGalleries(req.schoolId);
    return res.status(200).json(result);
  });

  static getPending = asyncHandler(async (req: Request, res: Response) => {
    const result = await GalleryService.getPending(req.schoolId);
    return res.status(200).json(result);
  });

  static getRejected = asyncHandler(async (req: Request, res: Response) => {
    const result = await GalleryService.getRejected(req.schoolId);
    return res.status(200).json(result);
  });

  static getApprovedStudent = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await GalleryService.getStudentGalleries(
        req.user!.id,
        "approved",
        req.schoolId,
      );
      return res.status(200).json(result);
    },
  );

  static getPendingStudent = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await GalleryService.getStudentGalleries(
        req.user!.id,
        "pending",
        req.schoolId,
      );
      return res.status(200).json(result);
    },
  );

  static getRejectedStudent = asyncHandler(
    async (req: Request, res: Response) => {
      const result = await GalleryService.getStudentGalleries(
        req.user!.id,
        "rejected",
        req.schoolId,
      );
      return res.status(200).json(result);
    },
  );

  static getByEventId = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const result = await GalleryService.getByEventId(id, req.schoolId);
    return res.status(200).json(result);
  });

  static getByCategoryId = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const result = await GalleryService.getByCategoryId(id, req.schoolId);
    return res.status(200).json(result);
  });

  static approve = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const result = await GalleryService.setStatus(id, "approved", req.schoolId);
    return res.status(200).json(result);
  });

  static reject = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const result = await GalleryService.setStatus(id, "rejected", req.schoolId);
    return res.status(200).json(result);
  });

  static rejectMultiple = asyncHandler(async (req: Request, res: Response) => {
    const { ids } = req.body;
    const result = await GalleryService.setStatusMany(
      ids,
      "rejected",
      req.schoolId,
    );
    return res.status(200).json(result);
  });

  static deleteCategoryGallery = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseId(req.params.id);
      const result = await GalleryService.rejectByCategory(id, req.schoolId);
      return res.status(200).json(result);
    },
  );

  static deleteGallery = asyncHandler(async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await GalleryService.deleteGallery(id, req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Image deleted successfully"));
  });

  static deleteMultiple = asyncHandler(async (req: Request, res: Response) => {
    const { ids } = req.body;
    await GalleryService.deleteMany(ids, req.schoolId);
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Images deleted successfully"));
  });

  static deleteEventGallery = asyncHandler(
    async (req: Request, res: Response) => {
      const id = parseId(req.params.id);
      await GalleryService.deleteByEvent(id, req.schoolId);
      return res
        .status(200)
        .json(new ApiResponse(200, null, "Images deleted successfully"));
    },
  );

  static getCategories = asyncHandler(async (req: Request, res: Response) => {
    const result = await GalleryService.getCategories(req.schoolId);
    return res.status(200).json(result);
  });

  static addCategory = asyncHandler(async (req: Request, res: Response) => {
    const { category } = req.body;
    if (!category) throw new ApiError(400, "category is required");
    const result = await GalleryService.addCategory(category, req.schoolId);
    return res.status(201).json(result);
  });

  static setCategoryThumbnail = asyncHandler(
    async (req: Request, res: Response) => {
      const categoryId = parseId(req.params.category_id, "category_id");
      const imageId = parseId(req.params.image_id, "image_id");
      const result = await GalleryService.setCategoryThumbnail(
        categoryId,
        imageId,
        req.schoolId,
      );
      return res.status(200).json(result);
    },
  );

  static setEventThumbnail = asyncHandler(
    async (req: Request, res: Response) => {
      const eventId = parseId(req.params.event_id, "event_id");
      const imageId = parseId(req.params.image_id, "image_id");
      const result = await GalleryService.setEventThumbnail(
        eventId,
        imageId,
        req.schoolId,
      );
      return res.status(200).json(result);
    },
  );
}
