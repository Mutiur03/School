import fs from "fs";
import { fixUrl } from "../utils/fixURL.js"; // Add this import
const removeNonNumber = (str) => str.replace(/\D/g, "");
import { prisma } from "../config/prisma.js";

// Add this helper to ensure DB fields are not too long and are normalized
function validateFieldLengths(data) {
  // Set reasonable max lengths according to your DB schema
  const MAX = {
    name: 255,
    email: 255,
    phone: 20,
    designation: 150,
    address: 1000,
  };

  return {
    name: data.name ? String(data.name).slice(0, MAX.name) : null,
    email: data.email ? String(data.email).slice(0, MAX.email) : null,
    phone: data.phone ? String(data.phone).slice(0, MAX.phone) : null,
    designation: data.designation
      ? String(data.designation).slice(0, MAX.designation)
      : null,
    address: data.address ? String(data.address).slice(0, MAX.address) : null,
  };
}

export const addStaff = async (req, res) => {
  try {
    let incoming = req.body.staffs ?? req.body.staff ?? req.body;
    if (!Array.isArray(incoming)) {
      if (incoming && typeof incoming === "object") {
        incoming = [incoming];
      } else {
        return res.status(400).json({
          success: false,
          error: "An array of staffs or a staff object is required",
        });
      }
    }

    const staffs = incoming;
    if (!Array.isArray(staffs) || staffs.length === 0) {
      return res.status(400).json({
        success: false,
        error: "An array of staffs is required",
      });
    }

    const staffData = staffs.map(
      ({ name, email, phone, address, designation }) => {
        const rawData = {
          name: name?.trim() || null,
          email: email?.trim() || null,
          phone: phone ? "0" + removeNonNumber(String(phone)).slice(-10) : null,
          designation: designation?.trim() || null,
          address: address?.trim() || null,
        };
        return validateFieldLengths(rawData);
      }
    );

    // New: check for existing emails before creating
    const emails = staffData.map((s) => s.email).filter(Boolean);
    if (emails.length > 0) {
      const existingEmails = await prisma.staffs.findMany({
        where: { email: { in: emails } },
        select: { email: true },
      });

      if (existingEmails.length > 0) {
        const conflicts = existingEmails.map((e) => e.email);
        return res.status(409).json({
          success: false,
          error: "One or more emails already exist",
          conflicts,
        });
      }
    }

    await prisma.staffs.createMany({
      data: staffData,
      skipDuplicates: true,
    });

    const createdStaffs = emails.length
      ? await prisma.staffs.findMany({ where: { email: { in: emails } } })
      : await prisma.staffs.findMany({
          where: {
            OR: staffData
              .filter((s) => s.phone)
              .map((s) => ({ phone: s.phone })),
          },
        });

    res.status(201).json({
      success: true,
      data: createdStaffs,
      message: "Staffs added successfully",
    });
  } catch (error) {
    console.error("Error adding staffs:", error.message);
    res.status(500).json({ success: false, error: "Error adding staffs" });
  }
};

export const getStaffs = async (_, res) => {
  try {
    const staffs = await prisma.staffs.findMany();
    res.status(200).json({ success: true, data: staffs });
  } catch (error) {
    console.error("Error fetching staffs:", error.message);
    res.status(500).json({ success: false, error: "Error fetching staffs" });
  }
};

export const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, address, designation } = req.body;

  try {
    const prevStaff = await prisma.staffs.findUnique({
      where: { id: parseInt(id) },
    });

    const rawData = { 
      name: name || null,
      email: email || null,
      phone: phone ? "0" + removeNonNumber(String(phone)).slice(-10) : null,
      address: address || null,
      designation: designation?.trim() || null, 
    };

    const validatedData = validateFieldLengths(rawData);

    // New: if an email is provided, ensure no other staff has it
    if (validatedData.email) {
      const conflict = await prisma.staffs.findFirst({
        where: {
          email: validatedData.email,
          NOT: { id: parseInt(id) },
        },
        select: { id: true, email: true },
      });

      if (conflict) {
        return res.status(409).json({
          success: false,
          error: "Email already in use by another staff",
          conflict: { id: conflict.id, email: conflict.email },
        });
      }
    }

    const result = await prisma.staffs.update({
      where: { id: parseInt(id) },
      data: validatedData,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Staff updated successfully",
    });
  } catch (error) {
    console.error("Error updating staff:", error.message);
    res.status(500).json({ success: false, error: "Error updating staff" });
  }
};

export const deleteStaff = async (req, res) => {
  const { id } = req.params;

  try {
    const deleted = await prisma.staffs.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({
      success: true,
      data: deleted,
      message: "Staff deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting staff:", error.message);
    res.status(500).json({ success: false, error: "Error deleting staff" });
  }
};

export const UpdateStaffImage = async (req, res) => {
  try {
    const { id } = req.params;
    const image = req.file;

    if (!image) {
      return res
        .status(400)
        .json({ success: false, error: "Image is required" });
    }

    const exists = await prisma.staffs.findUnique({
      where: { id: parseInt(id) },
    });

    if (exists?.image) {
      const oldImage = exists.image;
      // Only attempt to delete if it's a local filesystem path, not a URL
      const isUrl =
        typeof oldImage === "string" && /^https?:\/\//i.test(oldImage);
      if (!isUrl && fs.existsSync(oldImage)) {
        try {
          fs.unlinkSync(oldImage);
        } catch (err) {
          console.warn("Failed to remove old image file:", err.message);
        }
      }
    }

    const result = await prisma.staffs.update({
      where: { id: parseInt(id) },
      data: { image: fixUrl(image.path) },
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        image: fixUrl(result.image),
      },
      message: "Staff image updated successfully",
    });
  } catch (error) {
    console.error("Error updating staff image:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error updating staff image" });
  }
};
