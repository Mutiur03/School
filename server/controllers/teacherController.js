import generatePassword from "../utils/pwgenerator.js";
import bcrypt from "bcryptjs";
import { teacherFormSchema } from "@school/shared-schemas";
import { getUploadUrl, deleteFromR2 } from "../config/r2.js";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { LONG_TERM_CACHE_TTL } from "../utils/globalVars.js";
import { sheets, spreadsheetId } from "../config/sheet.js";

export const addTeacher = async (req, res) => {
  try {
    const { teachers } = req.body;
    if (!Array.isArray(teachers) || teachers.length === 0) {
      return res.status(400).json({
        success: false,
        error: "An array of teachers is required",
      });
    }
    console.log(teachers);
    for (let i = 0; i < teachers.length; i++) {
      const parsed = teacherFormSchema.safeParse(teachers[i]);
      if (!parsed.success) {
        const msg = parsed.error.errors[0]?.message || "Invalid teacher data";
        return res.status(400).json({
          success: false,
          error: `Teacher ${i + 1}: ${msg}`,
          details: parsed.error.flatten(),
        });
      }
    }

    const teacherData = await Promise.all(
      teachers.map(async (entry) => {
        const { data } = teacherFormSchema.safeParse(entry);
        const { name, email, phone, designation, address } = data;
        const originalPassword = generatePassword();
        const hashedPassword = await bcrypt.hash(originalPassword, 10);
        const rawData = {
          name,
          email,
          phone,
          designation,
          address: address || null,
          password: hashedPassword,
          originalPassword,
        };
        return rawData;
      }),
    );

    await prisma.teachers.createMany({
      data: teacherData.map(
        ({ originalPassword: _originalPassword, ...data }) => data,
      ),
    });

    const createdTeachers = await prisma.teachers.findMany({
      where: {
        email: {
          in: teacherData.map((t) => t.email),
        },
      }, 
    });

    sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "teachers!A:F",
      valueInputOption: "USER_ENTERED",
      resource: {
        values: createdTeachers.map((teacher, index) => [
          teacher.id,
          teacher.name,
          teacher.email,
          teacher.phone,
          teacher.designation,
          teacherData[index].originalPassword,
        ]),
      },
    });

    res.status(201).json({
      success: true,
      data: createdTeachers,
      message: "Teachers added successfully",
    });
  } catch (error) {
    console.error("Error adding teachers:", error.message);
    res.status(500).json({ success: false, error: "Error adding teachers" });
  }
};

export const getTeachers = async (_, res) => {
  try {
    const teachers = await prisma.teachers.findMany();
    teachers.forEach((teacher) => {
      delete teacher.password;
    });
    res.status(200).json({ success: true, data: teachers });
  } catch (error) {
    console.error("Error fetching teachers:", error.message);
    res.status(500).json({ success: false, error: "Error fetching teachers" });
  }
};

export const updateTeacher = async (req, res) => {
  const { id } = req.params;
  const parsed = teacherFormSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: parsed.error.errors[0]?.message || "Invalid teacher data",
      details: parsed.error.flatten(),
    });
  }
  const { name, email, phone, designation, address } = parsed.data;
  console.log(parsed.data);

  try {
    // Fetch previous teacher info to get the old email
    const prevTeacher = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });

    const rawData = {
      name,
      email,
      phone,
      address: address || null,
      designation,
    };

    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: rawData,
    });

    try {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "teachers!A:F",
      });

      const rows = sheetData.data.values || [];
      let rowIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][2] === prevTeacher.email) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `teachers!A${rowIndex}:F${rowIndex}`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [
              [
                id,
                name,
                email,
                phone,
                designation,
                prevTeacher.originalPassword || null,
              ],
            ],
          },
        });
      }
    } catch (sheetError) {
      console.error("Error updating Google Sheet:", sheetError.message);
    }
    const key = "head_msg_cache";
    await redis.del(key);
    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher updated successfully",
    });
  } catch (error) {
    console.error("Error updating teacher:", error.message);
    res.status(500).json({ success: false, error: "Error updating teacher" });
  }
};

export const deleteTeacher = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: { available: false },
    });
    const key = "head_msg_cache";
    await redis.del(key);
    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting teacher:", error.message);
    res.status(500).json({ success: false, error: "Error deleting teacher" });
  }
};

export const getTeacherImageUploadUrlController = async (req, res) => {
  try {
    const { id, key, contentType } = req.body;
    if (!id || !key || !contentType) {
      return res
        .status(400)
        .json({
          success: false,
          error: "id, key, and contentType are required",
        });
    }

    const teacher = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    const r2Key = `teachers/${key}`;
    const uploadUrl = await getUploadUrl(r2Key, contentType);

    res.status(200).json({
      success: true,
      data: { uploadUrl, key: r2Key },
    });
  } catch (error) {
    console.error("Error getting teacher image upload URL:", error.message);
    res.status(500).json({ success: false, error: "Error getting upload URL" });
  }
};

export const saveTeacherImageController = async (req, res) => {
  try {
    const { id } = req.params;
    const { key } = req.body;

    const existingTeacher = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existingTeacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    if (existingTeacher.image) {
      await deleteFromR2(existingTeacher.image);
    }

    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: { image: key || null },
    });

    const cacheKey = "head_msg_cache";
    await redis.del(cacheKey);

    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher image updated successfully",
    });
  } catch (error) {
    console.error("Error saving teacher image:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error saving teacher image" });
  }
};

export const removeTeacherImageController = async (req, res) => {
  try {
    const { id } = req.params;

    const existingTeacher = await prisma.teachers.findUnique({
      where: { id: parseInt(id) },
    });
    if (!existingTeacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }

    if (existingTeacher.image) {
      await deleteFromR2(existingTeacher.image);
    }

    const result = await prisma.teachers.update({
      where: { id: parseInt(id) },
      data: { image: null },
    });

    const cacheKey = "head_msg_cache";
    await redis.del(cacheKey);

    res.status(200).json({
      success: true,
      data: result,
      message: "Teacher image removed successfully",
    });
  } catch (error) {
    console.error("Error removing teacher image:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error removing teacher image" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const teacherId = req.user?.id || req.body.id;
    if (!teacherId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters",
      });
    }
    const teacher = await prisma.teachers.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      return res
        .status(404)
        .json({ success: false, error: "Teacher not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, teacher.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, error: "Current password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.teachers.update({
      where: { id: teacherId },
      data: { password: hashedPassword },
    });

    try {
      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "teachers!A:F",
      });
      const rows = sheetData.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][2] === teacher.email) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex > 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `teachers!F${rowIndex}:F${rowIndex}`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [[newPassword]],
          },
        });
      }
    } catch (sheetError) {
      console.error(
        "Error updating password in Google Sheet:",
        sheetError.message,
      );
    }

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error.message);
    res.status(500).json({ success: false, error: "Error changing password" });
  }
};

export const head_msg_update = async (req, res) => {
  try {
    const { teacherId, message } = req.body;
    if (!teacherId) {
      return res
        .status(400)
        .json({ success: false, error: "Nothing to update" });
    }
    const updateData = {};
    if (teacherId) updateData.head_id = parseInt(teacherId);
    if (message) updateData.head_message = message;
    else updateData.head_message = null;

    await prisma.head_msg.upsert({
      where: { id: 1 },
      create: { id: 1, ...updateData },
      update: updateData,
    });
    console.log(updateData);
    const key = "head_msg_cache";
    await redis.del(key);
    res.status(200).json({ success: true, message: "Updated successfully" });
  } catch (error) {
    console.error("Error updating head info:", error.message);
    res.status(500).json({ success: false, error: "Error updating head info" });
  }
};

export const get_head_msg = async (req, res) => {
  const key = "head_msg_cache";
  const cachedHeadMsg = await redis.get(key);
  if (cachedHeadMsg) {
    return res.status(200).json(JSON.parse(cachedHeadMsg));
  }
  try {
    const headMsg = await prisma.head_msg.findUnique({
      where: { id: 1 },
      include: {
        teacher: { select: { id: true, name: true, image: true } },
      },
    });
    await redis.set(key, JSON.stringify(headMsg), "EX", LONG_TERM_CACHE_TTL);
    res.status(200).json(headMsg);
  } catch (error) {
    console.error("Error updating head info:", error.message);
    res.status(500).json({ success: false, error: "Error updating head info" });
  }
};
