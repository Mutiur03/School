import { prisma } from "../config/prisma.js";

export const addHolidayController = async (req, res) => {
  try {
    const { title, start_date, end_date, description, is_optional } = req.body;

    // Input validation
    if (!title || !start_date || !end_date) {
      return res.status(400).json({
        error:
          "Missing required fields: title, start_date, and end_date are required",
      });
    }

    // Validate date format
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({
        error: "Invalid date format",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        error: "Start date cannot be after end date",
      });
    }

    const result = await prisma.holidays.create({
      data: {
        title,
        start_date: startDate.toISOString().split("T")[0], // Convert to YYYY-MM-DD string
        end_date: endDate.toISOString().split("T")[0], // Convert to YYYY-MM-DD string
        description: description || null,
        is_optional: Boolean(is_optional),
      },
    });

    res.status(201).json(result);
  } catch (error) {
    console.error("Error creating holiday:", error);

    // Handle Prisma specific errors
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "A holiday with this information already exists",
      });
    }

    res.status(500).json({
      error: "Failed to create holiday",
      details: error.message,
    });
  }
};

export const getHolidaysController = async (req, res) => {
  try {
    const result = await prisma.holidays.findMany({
      orderBy: {
        start_date: "asc",
      },
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteHolidayController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.holidays.delete({
      where: {
        id: parseInt(id),
      },
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateHolidayController = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, start_date, end_date, description, is_optional } = req.body;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid holiday ID" });
    }

    // Build update data object only with provided fields
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (start_date !== undefined) {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "Invalid start_date format" });
      }
      updateData.start_date = startDate.toISOString().split("T")[0];
    }
    if (end_date !== undefined) {
      const endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid end_date format" });
      }
      updateData.end_date = endDate.toISOString().split("T")[0];
    }
    if (description !== undefined) updateData.description = description;
    if (is_optional !== undefined)
      updateData.is_optional = Boolean(is_optional);

    const result = await prisma.holidays.update({
      where: {
        id: parseInt(id),
      },
      data: updateData,
    });
    res.json(result);
  } catch (error) {
    console.error("Error updating holiday:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Holiday not found" });
    }

    res.status(500).json({
      error: "Failed to update holiday",
      details: error.message,
    });
  }
};
