import { prisma } from "../config/prisma.js";

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

    for (const subject of subjects) {
      subject.name = subject.name.trim();
      subject.department = subject.department?.trim();
      subject.department === "General" && (subject.department = null);
      subject.department === "general" && (subject.department = null);

      const numericFields = [
        "class",
        "full_mark",
        "pass_mark",
        "teacher_id",
        "cq_mark",
        "mcq_mark",
        "practical_mark",
        "cq_pass_mark",
        "mcq_pass_mark",
        "practical_pass_mark",
      ];

      for (const field of numericFields) {
        if (
          subject[field] !== undefined &&
          subject[field] !== null &&
          subject[field] !== ""
        ) {
          subject[field] = parseInt(subject[field]);
          if (isNaN(subject[field])) {
            return res.status(400).json({
              success: false,
              error: `${field.replace("_", " ")} must be a valid number`,
            });
          }
        } else {
          if (field.includes("mark") || field === "class") {
            subject[field] =
              field === "class" && !subject[field] ? subject[field] : 0;
          } else {
            subject[field] = null;
          }
        }
      }

      const fullMarkSum =
        (subject.cq_mark || 0) +
        (subject.mcq_mark || 0) +
        (subject.practical_mark || 0);
      if (fullMarkSum > 0) {
        subject.full_mark = fullMarkSum;
      }

      const passMarkSum =
        (subject.cq_pass_mark || 0) +
        (subject.mcq_pass_mark || 0) +
        (subject.practical_pass_mark || 0);
      if (passMarkSum > 0) {
        subject.pass_mark = passMarkSum;
      }

      if (!subject.class) {
        return res.status(400).json({
          success: false,
          error: "Class is required",
        });
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
      full_mark: subject.full_mark || 0,
      pass_mark: subject.pass_mark || 0,
      cq_mark: subject.cq_mark || 0,
      mcq_mark: subject.mcq_mark || 0,
      practical_mark: subject.practical_mark || 0,
      cq_pass_mark: subject.cq_pass_mark || 0,
      mcq_pass_mark: subject.mcq_pass_mark || 0,
      practical_pass_mark: subject.practical_pass_mark || 0,
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
      return res
        .status(404)
        .json({ success: false, error: "Subject not found" });
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
      cq_mark,
      mcq_mark,
      practical_mark,
      cq_pass_mark,
      mcq_pass_mark,
      practical_pass_mark,
      year,
      teacher_id,
      department,
    } = req.body;

    const parseNumeric = (value, isMarkField = false) => {
      if (value === undefined || value === null || value === "") {
        return isMarkField ? 0 : null;
      }
      const parsed = parseInt(value);
      return isNaN(parsed) ? (isMarkField ? 0 : null) : parsed;
    };

    const cqMarkVal = parseNumeric(cq_mark, true);
    const mcqMarkVal = parseNumeric(mcq_mark, true);
    const practicalMarkVal = parseNumeric(practical_mark, true);
    const cqPassMarkVal = parseNumeric(cq_pass_mark, true);
    const mcqPassMarkVal = parseNumeric(mcq_pass_mark, true);
    const practicalPassMarkVal = parseNumeric(practical_pass_mark, true);

    let fullMark = parseNumeric(full_mark, true);
    let passMark = parseNumeric(pass_mark, true);

    const fullMarkSum = cqMarkVal + mcqMarkVal + practicalMarkVal;
    if (fullMarkSum > 0) {
      fullMark = fullMarkSum;
    }
    const passMarkSum = cqPassMarkVal + mcqPassMarkVal + practicalPassMarkVal;
    if (passMarkSum > 0) {
      passMark = passMarkSum;
    }

    const result = await prisma.subjects.update({
      where: { id: parseInt(id) },
      data: {
        name: name || null,
        class: parseNumeric(className),
        full_mark: fullMark,
        pass_mark: passMark,
        cq_mark: cqMarkVal,
        mcq_mark: mcqMarkVal,
        practical_mark: practicalMarkVal,
        cq_pass_mark: cqPassMarkVal,
        mcq_pass_mark: mcqPassMarkVal,
        practical_pass_mark: practicalPassMarkVal,
        year: year || new Date().getFullYear(),
        teacher_id: parseNumeric(teacher_id),
        department: department || null,
      },
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, error: "Subject not found" });
    }
    return handleDatabaseError(error, res);
  }
};
