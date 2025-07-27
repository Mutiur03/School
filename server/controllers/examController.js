import { prisma } from "../config/prisma.js";

// Helper function to handle database connection errors
const handleDatabaseError = (error, res, operation = "database operation") => {
  console.error(`Error during ${operation}:`, error);

  if (error.name === "PrismaClientInitializationError") {
    return res.status(503).json({
      success: false,
      error: "Database connection failed. Please try again later.",
      details: "Unable to connect to the database server.",
    });
  }

  if (error.code === "P2025") {
    return res.status(404).json({ success: false, error: "Record not found" });
  }

  return res.status(500).json({
    success: false,
    error: `Failed to perform ${operation}. Please try again later.`,
  });
};

export const addExamController = async (req, res) => {
  const { exams } = req.body;

  try {
    if (!Array.isArray(exams) || exams.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Exams must be an array with at least one element.",
      });
    }

    for (let exam of exams) {
      exam.exam_name = exam.exam_name?.trim();
      const exists = await prisma.exams.findFirst({
        where: {
          exam_name: exam.exam_name,
          exam_year: exam.exam_year,
        },
      });
      if (exists) {
        return res.status(400).json({
          success: false,
          error: `Exam "${exam.exam_name}" for year ${exam.exam_year} already exists`,
        });
      }
    }

    const insertedExams = await prisma.exams.createMany({
      data: exams.map((exam) => ({
        exam_name: exam.exam_name || null,
        exam_year: exam.exam_year || null,
        levels: exam.levels || null,
        start_date: exam.start_date || null,
        end_date: exam.end_date || null,
        result_date: exam.result_date || null,
      })),
    });

    const createdExams = await prisma.exams.findMany({
      where: {
        exam_name: { in: exams.map((e) => e.exam_name) },
        exam_year: { in: exams.map((e) => e.exam_year) },
      },
    });

    res.status(201).json({
      success: true,
      data: createdExams,
      message: "Exam added successfully",
    });
  } catch (error) {
    return handleDatabaseError(error, res, "adding exams");
  }
};

export const updateExamController = async (req, res) => {
  const { examId } = req.params;
  const { exam_name, exam_year, levels, start_date, end_date, result_date } =
    req.body;

  try {
    const updated = await prisma.exams.update({
      where: { id: parseInt(examId) },
      data: {
        exam_name: exam_name.trim() || null,
        exam_year: exam_year || null,
        levels: levels || null,
        start_date: start_date || null,
        end_date: end_date || null,
        result_date: result_date || null,
      },
    });

    res.status(200).json({
      success: true,
      data: updated,
      message: "Exam updated successfully",
    });
  } catch (error) {
    return handleDatabaseError(error, res, "updating exam");
  }
};

export const getExamsController = async (req, res) => {
  try {
    const exams = await prisma.exams.findMany();
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    return handleDatabaseError(error, res, "fetching exams");
  }
};

export const updateExamVisibilityController = async (req, res) => {
  const { examId } = req.params;
  const { visible } = req.body;

  try {
    const result = await prisma.exams.update({
      where: { id: parseInt(examId) },
      data: { visible: visible },
    });

    res.status(200).json({
      success: true,
      data: result,
      message: `Exam visibility updated to ${visible}`,
    });
  } catch (error) {
    return handleDatabaseError(error, res, "updating exam visibility");
  }
};

export const deleteExamController = async (req, res) => {
  const { examId } = req.params;

  try {
    const deleted = await prisma.exams.delete({
      where: { id: parseInt(examId) },
    });

    res.status(200).json({
      success: true,
      data: deleted,
      message: "Exam deleted successfully",
    });
  } catch (error) {
    return handleDatabaseError(error, res, "deleting exam");
  }
};
