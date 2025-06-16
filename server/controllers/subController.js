import { prisma } from "../config/prisma.js";

// Helper function to handle database errors
const handleDatabaseError = (error, res) => {
  if (error.name === "PrismaClientInitializationError") {
    return res.status(503).json({
      success: false,
      error: "Database connection failed",
      message:
        "Unable to connect to the database. Please check your connection and try again.",
      code: "DATABASE_CONNECTION_ERROR",
    });
  }

  console.error("Database error:", error);
  return res.status(500).json({
    success: false,
    error: "Database operation failed",
    details: error.message,
  });
};

export const addSubController = async (req, res) => {
  try {
    const current_year = new Date().getFullYear();
    const { subjects } = req.body;

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Subjects data must be an array and cannot be empty",
      });
    }

    // Use for...of instead of forEach for async operations
    for (const subject of subjects) {
      subject.name = subject.name.trim();
      subject.department = subject.department?.trim();
      subject.department === "General" && (subject.department = null);
      subject.department === "general" && (subject.department = null);

      // Convert numeric fields to integers
      subject.class = parseInt(subject.class);
      if (isNaN(subject.class)) {
        return res.status(400).json({
          success: false,
          error: "Class must be a valid number",
        });
      }

      if (subject.full_mark) {
        subject.full_mark = parseInt(subject.full_mark);
        if (isNaN(subject.full_mark)) {
          return res.status(400).json({
            success: false,
            error: "Full mark must be a valid number",
          });
        }
      }

      if (subject.pass_mark) {
        subject.pass_mark = parseInt(subject.pass_mark);
        if (isNaN(subject.pass_mark)) {
          return res.status(400).json({
            success: false,
            error: "Pass mark must be a valid number",
          });
        }
      }

      if (subject.teacher_id) {
        subject.teacher_id = parseInt(subject.teacher_id);
        if (isNaN(subject.teacher_id)) {
          return res.status(400).json({
            success: false,
            error: "Teacher ID must be a valid number",
          });
        }
      }
    }

    const existingSubjects = [];
    for (let subject of subjects) {
      try {
        const result = await prisma.subjects.findFirst({
          where: {
            name: subject.name,
            class: subject.class,
            department: subject.department || null,
            year: current_year,
          },
        });

        if (result) {
          existingSubjects.push(subject.name);
        }
      } catch (error) {
        return handleDatabaseError(error, res);
      }
    }

    if (existingSubjects.length > 0) {
      return res.status(400).json({
        success: false,
        error: `The following subjects already exist: ${existingSubjects.join(
          ", "
        )}`,
      });
    }

    const subjectData = subjects.map((subject) => ({
      name: subject.name || null,
      class: subject.class || null,
      full_mark: subject.full_mark || null,
      pass_mark: subject.pass_mark || null,
      year: subject.year || current_year,
      teacher_id: subject.teacher_id || null,
      department: subject.department || null,
    }));

    try {
      const result = await prisma.subjects.createMany({
        data: subjectData,
      });

      const createdSubjects = await prisma.subjects.findMany({
        where: {
          name: { in: subjects.map((s) => s.name) },
          year: current_year,
        },
      });

      res.status(201).json({
        success: true,
        data: createdSubjects,
        message: "Subjects added successfully",
      });
    } catch (error) {
      return handleDatabaseError(error, res);
    }
  } catch (error) {
    console.error("Error in addSubController:", error);
    res.status(500).json({
      success: false,
      error: "Error adding subject",
      details: error.message,
    });
  }
};

export const getSubsController = async (req, res) => {
  try {
    const subjects = await prisma.subjects.findMany({
      include: {
        teacher: {
          select: {
            name: true,
          },
        },
      },
    });

    const formattedSubjects = subjects.map((subject) => ({
      ...subject,
      teacher_name: subject.teacher?.name || null,
    }));

    res.status(200).json({ success: true, data: formattedSubjects });
  } catch (error) {
    return handleDatabaseError(error, res);
  }
};

export const deleteSubController = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await prisma.subjects.delete({
      where: { id: parseInt(id) },
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Subject not found" });
    }
    return handleDatabaseError(error, res);
  }
};

export const updateSubController = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      class: className,
      full_mark,
      pass_mark,
      year,
      teacher_id,
      department,
    } = req.body;

    const result = await prisma.subjects.update({
      where: { id: parseInt(id) },
      data: {
        name: name || null,
        class: className ? parseInt(className) : null,
        full_mark: full_mark ? parseInt(full_mark) : null,
        pass_mark: pass_mark ? parseInt(pass_mark) : null,
        year: year || new Date().getFullYear(),
        teacher_id: teacher_id ? parseInt(teacher_id) : null,
        department: department || null,
      },
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ success: false, error: "Subject not found" });
    }
    return handleDatabaseError(error, res);
  }
};
