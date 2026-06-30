import { prisma } from "@/config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "@/config/r2.js";
import { ApiError } from "@/utils/ApiError.js";

const buildImageData = (image: any) => ({
  id: image.id,
  image_path: image.image_path,
  caption: image.caption,
  event_id: image.event?.id ?? image.event_id ?? null,
  event_name: image.event?.title ?? null,
  category: image.category?.category ?? null,
  category_id: image.category?.id ?? image.category_id ?? null,
  created_at: image.created_at,
  student_name:
    image.uploader_type !== "admin" ? image.uploader?.name ?? null : null,
  student_batch:
    image.uploader_type !== "admin" ? image.uploader?.batch ?? null : null,
  uploader_type: image.uploader_type,
  status: image.status,
});

const groupImages = (images: any[]) => {
  const grouped: {
    events: Record<string, any[]>;
    categories: Record<string, any[]>;
  } = { events: {}, categories: {} };

  images.forEach((image) => {
    const imgData = buildImageData(image);
    if (image.event?.title) {
      (grouped.events[image.event.title] ??= []).push(imgData);
    } else if (image.category?.category) {
      (grouped.categories[image.category.category] ??= []).push(imgData);
    }
  });

  return grouped;
};

const galleryInclude = {
  event: { select: { id: true, title: true } },
  category: { select: { id: true, category: true } },
  uploader: { select: { name: true, batch: true } },
};

export class GalleryService {
  static async getPresignedUploadUrl(
    filename: string,
    contentType: string,
    schoolId?: number,
  ) {
    const folder = schoolId ? `gallery/${schoolId}` : "gallery";
    const key = `${folder}/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  static async addGallery(
    data: {
      keys: string[];
      caption?: string;
      eventId?: string | number;
      category?: string | number;
      status?: string;
    },
    uploaderId: number,
    uploaderType: string,
    schoolId?: number,
  ) {
    if (!data.keys?.length) throw new ApiError(400, "No image keys provided");

    const eventId =
      data.eventId !== undefined && data.eventId !== ""
        ? parseInt(String(data.eventId), 10)
        : null;
    const categoryId =
      data.category !== undefined && data.category !== ""
        ? parseInt(String(data.category), 10)
        : null;

    await prisma.gallery.createMany({
      data: data.keys.map((key) => ({
        event_id: eventId,
        category_id: categoryId,
        uploader_id: uploaderType === "student" ? uploaderId : null,
        uploader_type: uploaderType,
        image_path: key,
        caption: data.caption ?? null,
        status: data.status ?? "pending",
        ...(schoolId ? { school_id: schoolId } : {}),
      })),
    });

    return { count: data.keys.length };
  }

  static async updateGallery(
    id: number,
    data: {
      imageKey?: string;
      caption?: string;
      eventId?: string | number;
      category?: string | number;
    },
    schoolId?: number,
  ) {
    const existing = await prisma.gallery.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, "Image not found");

    const eventId =
      data.eventId !== undefined && data.eventId !== ""
        ? parseInt(String(data.eventId), 10)
        : null;
    const categoryId =
      data.category !== undefined && data.category !== ""
        ? parseInt(String(data.category), 10)
        : null;

    const updateData: Record<string, any> = {
      caption: data.caption ?? null,
      event_id: eventId,
      category_id: categoryId,
    };

    if (data.imageKey) {
      updateData.image_path = data.imageKey;
      if (existing.image_path) await deleteFromR2(existing.image_path);
    }

    return prisma.gallery.update({ where: { id }, data: updateData });
  }

  static async getGalleries(schoolId?: number) {
    const images = await prisma.gallery.findMany({
      where: { status: "approved", ...(schoolId ? { school_id: schoolId } : {}) },
      include: galleryInclude,
    });
    return groupImages(images);
  }

  static async getPending(schoolId?: number) {
    const images = await prisma.gallery.findMany({
      where: { status: "pending", ...(schoolId ? { school_id: schoolId } : {}) },
      include: galleryInclude,
    });
    return groupImages(images);
  }

  static async getRejected(schoolId?: number) {
    const images = await prisma.gallery.findMany({
      where: { status: "rejected", ...(schoolId ? { school_id: schoolId } : {}) },
      include: galleryInclude,
    });
    return groupImages(images);
  }

  static async getStudentGalleries(
    studentId: number,
    status: string,
    schoolId?: number,
  ) {
    const images = await prisma.gallery.findMany({
      where: {
        status,
        uploader_id: studentId,
        uploader_type: "student",
        ...(schoolId ? { school_id: schoolId } : {}),
      },
      include: galleryInclude,
    });
    return groupImages(images);
  }

  static async getByEventId(eventId: number, schoolId?: number) {
    const images = await prisma.gallery.findMany({
      where: {
        event_id: eventId,
        status: "approved",
        ...(schoolId ? { school_id: schoolId } : {}),
      },
      include: galleryInclude,
    });
    return images.map(buildImageData);
  }

  static async getByCategoryId(categoryId: number, schoolId?: number) {
    const images = await prisma.gallery.findMany({
      where: {
        category_id: categoryId,
        status: "approved",
        ...(schoolId ? { school_id: schoolId } : {}),
      },
      include: galleryInclude,
    });
    return images.map(buildImageData);
  }

  static async setStatus(id: number, status: string, schoolId?: number) {
    const existing = await prisma.gallery.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, "Image not found");
    return prisma.gallery.update({ where: { id }, data: { status } });
  }

  static async setStatusMany(ids: number[], status: string, schoolId?: number) {
    return prisma.gallery.updateMany({
      where: { id: { in: ids }, ...(schoolId ? { school_id: schoolId } : {}) },
      data: { status },
    });
  }

  static async rejectByCategory(categoryId: number, schoolId?: number) {
    return prisma.gallery.updateMany({
      where: {
        category_id: categoryId,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
      data: { status: "rejected" },
    });
  }

  static async deleteGallery(id: number, schoolId?: number) {
    const existing = await prisma.gallery.findFirst({
      where: schoolId ? { id, school_id: schoolId } : { id },
    });
    if (!existing) throw new ApiError(404, "Image not found");
    await prisma.gallery.delete({ where: { id } });
    if (existing.image_path) await deleteFromR2(existing.image_path);
  }

  static async deleteMany(ids: number[], schoolId?: number) {
    const existing = await prisma.gallery.findMany({
      where: { id: { in: ids }, ...(schoolId ? { school_id: schoolId } : {}) },
    });
    await prisma.gallery.deleteMany({
      where: { id: { in: ids }, ...(schoolId ? { school_id: schoolId } : {}) },
    });
    await Promise.all(
      existing
        .filter((img) => img.image_path)
        .map((img) => deleteFromR2(img.image_path!)),
    );
  }

  static async deleteByEvent(eventId: number, schoolId?: number) {
    const existing = await prisma.gallery.findMany({
      where: {
        event_id: eventId,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });
    await prisma.gallery.deleteMany({
      where: {
        event_id: eventId,
        ...(schoolId ? { school_id: schoolId } : {}),
      },
    });
    await Promise.all(
      existing
        .filter((img) => img.image_path)
        .map((img) => deleteFromR2(img.image_path!)),
    );
  }

  static async getCategories(schoolId?: number) {
    const result = await prisma.categories.findMany({
      where: schoolId ? { school_id: schoolId } : undefined,
    });
    return result.map((category) => ({
      ...category,
      thumbnail: category.thumbnail ?? null,
    }));
  }

  static async addCategory(category: string, schoolId?: number) {
    return prisma.categories.create({
      data: { category, ...(schoolId ? { school_id: schoolId } : {}) },
    });
  }

  static async setCategoryThumbnail(
    categoryId: number,
    imageId: number,
    schoolId?: number,
  ) {
    const image = await prisma.gallery.findFirst({
      where: schoolId ? { id: imageId, school_id: schoolId } : { id: imageId },
    });
    if (!image) throw new ApiError(404, "Image not found");
    return prisma.categories.update({
      where: { id: categoryId },
      data: { thumbnail: image.image_path },
    });
  }

  static async setEventThumbnail(
    eventId: number,
    imageId: number,
    schoolId?: number,
  ) {
    const image = await prisma.gallery.findFirst({
      where: schoolId ? { id: imageId, school_id: schoolId } : { id: imageId },
    });
    if (!image) throw new ApiError(404, "Image not found");
    return prisma.events.update({
      where: { id: eventId },
      data: { thumbnail: image.image_path, image: image.image_path },
    });
  }
}
