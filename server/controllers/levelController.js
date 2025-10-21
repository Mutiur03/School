import { prisma } from "../config/prisma.js";

export const addLevelController = async (req, res) => {
  try {
    const { class_name, section, year, teacher_id } = req.body;
    await prisma.levels.create({
      data: {
        class_name: parseInt(class_name),
        section,
        year,
        teacher_id: parseInt(teacher_id),
      },
    });

    res.status(201).json({ message: "Level added successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while adding the level" });
  }
};

export const getLevelsController = async (req, res) => {
  try {
    const result = await prisma.levels.findMany({
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ class_name: "asc" }, { section: "asc" }],
    });

    const formattedData = result.map((level) => ({
      id: level.id,
      class_name: level.class_name,
      section: level.section,
      year: level.year,
      teacher_name: level.teacher.name,
      teacher_id: level.teacher.id,
    }));

    res.status(200).json({ data: formattedData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred while fetching levels" });
  }
};

export const updateLevelController = async (req, res) => {
  try {
    const { class_name, section, year, teacher_id } = req.body;
    const { id } = req.params;

    await prisma.levels.update({
      where: { id: parseInt(id) },
      data: {
        class_name: parseInt(class_name),
        section,
        year,
        teacher_id: parseInt(teacher_id),
      },
    });

    res.status(200).json({ message: "Level updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while updating the level" });
  }
};

export const deleteLevelController = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.levels.delete({
      where: { id: parseInt(id) },
    });

    res.status(200).json({ message: "Level deleted successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the level" });
  }
};
