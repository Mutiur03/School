import { prisma } from "../config/prisma.js";
import fs from "fs";
import { getUploadUrl, deleteFromR2 } from "../config/r2.js";
import path from "path";

export const createOrUpdateClass6Reg = async (req, res) => {
  try {
    const {
      a_sec_roll,
      b_sec_roll,
      class6_year,
      reg_open,
      instruction_for_a,
      instruction_for_b,
      attachment_instruction,
      notice_key,
    } = req.body;

    let updateData = {
      a_sec_roll: a_sec_roll || null,
      b_sec_roll: b_sec_roll || null,
      class6_year: class6_year ? parseInt(class6_year) : null,
      reg_open: reg_open === "true" || reg_open === true,
      instruction_for_a:
        instruction_for_a || "Please follow the instructions carefully",
      instruction_for_b:
        instruction_for_b || "Please follow the instructions carefully",
      attachment_instruction:
        attachment_instruction || "Please attach all required documents",
    };
    if (notice_key) {
      const existingRecord = await prisma.class6_reg.findFirst();
      if (
        existingRecord &&
        existingRecord.notice &&
        existingRecord.notice !== notice_key
      ) {
        await deleteFromR2(existingRecord.notice);
      }
      updateData.notice = notice_key;
    }

    const class6Reg = await prisma.class6_reg.upsert({
      where: { id: 1 },
      update: updateData,
      create: {
        id: 1,
        ...updateData,
      },
    });

    res.status(200).json({
      success: true,
      message: "Class Six Registration updated successfully",
      data: class6Reg,
    });
  } catch (error) {
    console.error("Controller error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating Class Six Registration",
      error: error.message,
    });
  }
};

export const getClass6Reg = async (req, res) => {
  try {
    const class6Reg = await prisma.class6_reg.findFirst();

    if (!class6Reg) {
      return res.status(404).json({
        success: false,
        message: "Class Six Registration settings not found",
      });
    }

    res.status(200).json({
      success: true,
      data: class6Reg,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Class Six Registration",
      error: error.message,
    });
  }
};

export const deleteClass6RegNotice = async (req, res) => {
  try {
    const class6Reg = await prisma.class6_reg.findFirst();

    if (!class6Reg || !class6Reg.notice) {
      return res.status(404).json({
        success: false,
        message: "No notice found to delete",
      });
    }

    await deleteFromR2(class6Reg.notice);

    await prisma.class6_reg.update({
      where: { id: class6Reg.id },
      data: { notice: null },
    });

    res.status(200).json({
      success: true,
      message: "Notice deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting notice",
      error: error.message,
    });
  }
};

export const getClass6NoticeUploadUrl = async (req, res) => {
  try {
    const { filename, filetype } = req.body;
    if (!filename || !filetype) {
      return res.status(400).json({
        success: false,
        message: "Filename and filetype are required",
      });
    }

    const ext = path.extname(filename);
    const key = `notices/registrations/notice-${Date.now()}${ext}`;
    const url = await getUploadUrl(key, filetype);

    res.json({ success: true, url, key });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to generate upload URL" });
  }
};
