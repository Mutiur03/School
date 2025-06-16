import jwt from "jsonwebtoken";
import fs from "fs";
import { prisma } from "../config/prisma.js";


export const getGalleryController = async (req, res) => {
  try {
    const images = await prisma.gallery.findMany({
      where: { status: 'approved' },
      include: {
        event: { select: { id: true, title: true } },
        category: { select: { id: true, category: true } },
        uploader: { select: { name: true, batch: true } }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event?.id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category?.id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addGalleryController = async (req, res) => {
  const { caption, eventId, category, status } = req.body;
  const token = req.cookies.token;
  const user = jwt.verify(token, process.env.JWT_SECRET);
  const uploaderId = user.id;
  const uploaderType = user.role;

  try {
    const insertPromises = req.files.map((file) => {
      const imagePath = `${file.path}`;
      return prisma.gallery.create({
        data: {
          event_id: eventId && eventId !== "" ? parseInt(eventId) : null,
          category_id: category && category !== "" ? parseInt(category) : null,
          uploader_id: uploaderType === 'student' ? parseInt(uploaderId) : null,
          uploader_type: uploaderType,
          image_path: imagePath,
          caption: caption,
          status: status || "pending"
        }
      });
    });
    await Promise.all(insertPromises);
    res.json({ message: "Images uploaded successfully" });
  } catch (err) {
    console.error('Error in addGalleryController:', err);
    res.status(500).json({ error: err.message });
  }
};

export const deleteGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const exist = await prisma.gallery.findUnique({ where: { id: parseInt(id) } });
    const filePath = exist.image_path;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    const result = await prisma.gallery.delete({ where: { id: parseInt(id) } });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, eventId, category } = req.body;
    const image = req.file ? req.file.path : null;

    if (image) {
      const exist = await prisma.gallery.findUnique({ where: { id: parseInt(id) } });
      const filePath = exist.image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      const result = await prisma.gallery.update({
        where: { id: parseInt(id) },
        data: {
          image_path: image,
          caption: caption,
          event_id: eventId && eventId !== "" ? parseInt(eventId) : null,
          category_id: category && category !== "" ? parseInt(category) : null
        }
      });
      res.json(result);
    } else {
      const result = await prisma.gallery.update({
        where: { id: parseInt(id) },
        data: {
          caption: caption,
          event_id: eventId && eventId !== "" ? parseInt(eventId) : null,
          category_id: category && category !== "" ? parseInt(category) : null
        }
      });
      res.json(result);
    }
  } catch (error) {
    console.error('Error in updateGalleryController:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteEventGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const exists = await prisma.gallery.findMany({ where: { event_id: parseInt(id) } });
    exists.forEach((image) => {
      const filePath = image.image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    const result = await prisma.gallery.deleteMany({ where: { event_id: parseInt(id) } });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteCategoryGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.gallery.updateMany({
      where: { category_id: parseInt(id) },
      data: { status: 'rejected' }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addCategoryController = async (req, res) => {
  try {
    const { category } = req.body;
    const result = await prisma.categories.create({
      data: { category: category }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCategoriesController = async (req, res) => {
  try {
    const result = await prisma.categories.findMany();
    const categories = result.map((category) => {
      if (fs.existsSync(category.thumbnail)) {
        return { ...category, thumbnail: category.thumbnail.replace(/\\/g, "/") };
      }
      return { ...category, thumbnail: null };
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingGalleriesController = async (req, res) => {
  try {
    const images = await prisma.gallery.findMany({
      where: { status: 'pending' },
      include: {
        event: { 
          select: { id: true, title: true }
        },
        category: { 
          select: { id: true, category: true }
        },
        uploader: { 
          select: { name: true, batch: true }
        }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category_id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    console.error('Error in getPendingGalleriesController:', error);
    res.status(500).json({ error: error.message });
  }
};

export const approveGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.gallery.update({
      where: { id: parseInt(id) },
      data: { status: 'approved' }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectGalleryController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.gallery.update({
      where: { id: parseInt(id) },
      data: { status: 'rejected' }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const rejectMultipleGalleryController = async (req, res) => {
  try {
    const { ids } = req.body;
    const result = await prisma.gallery.updateMany({
      where: { id: { in: ids } },
      data: { status: 'rejected' }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getRejectedGalleriesController = async (req, res) => {
  try {
    const images = await prisma.gallery.findMany({
      where: { status: 'rejected' },
      include: {
        event: { 
          select: { id: true, title: true }
        },
        category: { 
          select: { id: true, category: true }
        },
        uploader: { 
          select: { name: true, batch: true }
        }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category_id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    console.error('Error in getRejectedGalleriesController:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteMultipleGalleryController = async (req, res) => {
  try {
    const { ids } = req.body;
    const exists = await prisma.gallery.findMany({ where: { id: { in: ids } } });
    exists.forEach((image) => {
      const filePath = image.image_path;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
    const result = await prisma.gallery.deleteMany({ where: { id: { in: ids } } });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getApprovedStudentGalleryController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const images = await prisma.gallery.findMany({
      where: { 
        status: 'approved',
        uploader_id: studentId,
        uploader_type: 'student'
      },
      include: {
        event: { select: { id: true, title: true } },
        category: { select: { id: true, category: true } },
        uploader: { select: { name: true, batch: true } }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event?.id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category?.id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPendingStudentGalleriesController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const images = await prisma.gallery.findMany({
      where: { 
        status: 'pending',
        uploader_id: studentId,
        uploader_type: 'student'
      },
      include: {
        event: { 
          select: { id: true, title: true }
        },
        category: { 
          select: { id: true, category: true }
        },
        uploader: { 
          select: { name: true, batch: true }
        }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category_id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    console.error('Error in getPendingStudentGalleriesController:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getRejectedStudentGalleriesController = async (req, res) => {
  try {
    const token = req.cookies.token;
    const user = jwt.verify(token, process.env.JWT_SECRET);
    const studentId = user.id;
    const studentRole = user.role;
    if (studentRole !== "student") {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const images = await prisma.gallery.findMany({
      where: { 
        status: 'rejected',
        uploader_id: studentId,
        uploader_type: 'student'
      },
      include: {
        event: { 
          select: { id: true, title: true }
        },
        category: { 
          select: { id: true, category: true }
        },
        uploader: { 
          select: { name: true, batch: true }
        }
      }
    });

    const grouped = { events: {}, categories: {} };
    images.forEach((image) => {
      const imgData = {
        id: image.id,
        image_path: image.image_path,
        caption: image.caption,
        event_id: image.event_id || null,
        event_name: image.event?.title || null,
        category: image.category?.category || null,
        category_id: image.category_id || null,
        created_at: image.created_at,
        student_name: image.uploader_type !== 'admin' ? image.uploader?.name : null,
        student_batch: image.uploader_type !== 'admin' ? image.uploader?.batch : null,
        uploader_type: image.uploader_type,
        status: image.status,
      };
      if (image.event?.title) {
        if (!grouped.events[image.event.title]) {
          grouped.events[image.event.title] = [];
        }
        grouped.events[image.event.title].push(imgData);
      } else if (image.category?.category) {
        if (!grouped.categories[image.category.category]) {
          grouped.categories[image.category.category] = [];
        }
        grouped.categories[image.category.category].push(imgData);
      }
    });
    res.json(grouped);
  } catch (error) {
    console.error('Error in getRejectedStudentGalleriesController:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getGalleriesByEventId = async (req, res) => {
  try {
    const { id } = req.params;
    const images = await prisma.gallery.findMany({
      where: { 
        event_id: parseInt(id),
        status: 'approved'
      },
      include: {
        event: { select: { id: true, title: true } },
        category: { select: { id: true, category: true } },
        uploader: { select: { name: true, batch: true } }
      }
    });
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getGalleriesByCategoryId = async (req, res) => {
  try {
    const { id } = req.params;
    const images = await prisma.gallery.findMany({
      where: { 
        category_id: parseInt(id),
        status: 'approved'
      },
      include: {
        event: { select: { id: true, title: true } },
        category: { select: { id: true, category: true } },
        uploader: { select: { name: true, batch: true } }
      }
    });
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateCategoryThumbnailController = async (req, res) => {
  try {
    const { image_id, category_id } = req.params;
    const exist = await prisma.gallery.findUnique({ where: { id: parseInt(image_id) } });
    if (!exist) {
      return res.status(404).json({ error: "Image not found" });
    }
    const filePath = exist.image_path;
    const result = await prisma.categories.update({
      where: { id: parseInt(category_id) },
      data: { thumbnail: filePath }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateEventThumbnailController = async (req, res) => {
  try {
    const { image_id, event_id } = req.params;
    const exist = await prisma.gallery.findUnique({ where: { id: parseInt(image_id) } });
    if (!exist) {
      return res.status(404).json({ error: "Image not found" });
    }
    const filePath = exist.image_path;
    const result = await prisma.events.update({
      where: { id: parseInt(event_id) },
      data: { thumbnail: filePath }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
