import { Request, Response } from "express";
import { NoticeService } from "./notice.service.js";

const service = new NoticeService();

export const getPresignedUrlController = async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    const result = await service.getPresignedUploadUrl(filename as string, contentType as string);
    return res.json(result);
  } catch (error: any) {
    console.error("Error generating presigned URL:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const addNoticeController = async (req: Request, res: Response) => {
  try {
    const { title, key, created_at } = req.body;
    if (!title || !key) {
      return res.status(400).json({ error: "title and key are required" });
    }
    const result = await service.createNotice({ title, key, created_at });
    return res.status(201).json(result);
  } catch (error: any) {
    console.error("Error adding notice:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getNoticesController = async (req: Request, res: Response) => {
  try {
    const { limit } = req.query;
    const take = limit !== undefined ? parseInt(limit as string, 10) : undefined;
    const result = await service.getNotices(take);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching notices:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateNoticeController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, key, created_at } = req.body;
    const result = await service.updateNotice(parseInt(id as string), { title, key, created_at });
    res.json(result);
  } catch (error: any) {
    console.error("Error updating notice:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};

export const deleteNoticeController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await service.deleteNotice(parseInt(id as string));
    res.json({ message: "Notice deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting notice:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
};
