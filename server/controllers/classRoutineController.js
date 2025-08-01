import { prisma } from "../config/prisma.js";

// CRUD for class slots
export const getClassSlots = async (req, res) => {
  try {
    const slots = await prisma.class_slot_time.findMany({
      orderBy: { id: "asc" },
    });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch class slots" });
  }
};

export const createClassSlot = async (req, res) => {
  const { start_time, end_time } = req.body;
  const time12hrRegex = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
  if (!start_time || !end_time) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!time12hrRegex.test(start_time) || !time12hrRegex.test(end_time)) {
    return res.status(400).json({
      error: "Time must be in 12-hour format (e.g. 08:00 AM, 01:00 PM)",
    });
  }
  try {
    const slot = await prisma.class_slot_time.create({
      data: { start_time, end_time },
    });
    res.status(201).json(slot);
  } catch (err) {
    res.status(400).json({ error: "Failed to create class slot" });
  }
};

export const updateClassSlot = async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time } = req.body;
  const time12hrRegex = /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/i;
  if (!start_time || !end_time) {
    return res.status(400).json({ error: "All fields are required." });
  }
  if (!time12hrRegex.test(start_time) || !time12hrRegex.test(end_time)) {
    return res.status(400).json({
      error: "Time must be in 12-hour format (e.g. 08:00 AM, 01:00 PM)",
    });
  }
  try {
    const slot = await prisma.class_slot_time.update({
      where: { id: Number(id) },
      data: { start_time, end_time },
    });
    res.json(slot);
  } catch (err) {
    res.status(400).json({ error: "Failed to update class slot" });
  }
};

export const deleteClassSlot = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.class_slot_time.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete class slot" });
  }
};

// Get all routines (optionally filter by class)
export const getRoutines = async (req, res) => {
  const { class: classNum, slot_id } = req.query;
  const where = {};
  if (classNum) where.class = Number(classNum);
  if (slot_id) where.slot_id = Number(slot_id);
  try {
    const routines = await prisma.class_routine.findMany({
      where,
      orderBy: [{ day: "asc" }],
      include: { slot: true },
    });
    res.json(routines);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch routines" });
  }
};

// Add a new routine entry
export const createRoutine = async (req, res) => {
  try {
    const { class: classNum, slot_id, day, subject } = req.body;
    if (!slot_id) return res.status(400).json({ error: "slot_id is required" });
    const routine = await prisma.class_routine.create({
      data: { class: Number(classNum), slot_id: Number(slot_id), day, subject },
    });
    res.status(201).json(routine);
  } catch (err) {
    res.status(400).json({ error: "Failed to create routine" });
  }
};

// Update a routine entry
export const updateRoutine = async (req, res) => {
  const { id } = req.params;
  try {
    const { class: classNum, slot_id, day, subject } = req.body;
    if (!slot_id) return res.status(400).json({ error: "slot_id is required" });
    const routine = await prisma.class_routine.update({
      where: { id: Number(id) },
      data: { class: Number(classNum), slot_id: Number(slot_id), day, subject },
    });
    res.json(routine);
  } catch (err) {
    res.status(400).json({ error: "Failed to update routine" });
  }
};

// Delete a routine entry
export const deleteRoutine = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.class_routine.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: "Failed to delete routine" });
  }
};
