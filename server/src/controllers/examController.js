import { prisma } from "../config/prisma.js";
import { getUploadUrl, deleteFromR2 } from "../config/r2.js";
import { MarksheetService } from "../modules/marks/marksheet.service.js";

export const addExamController = async (req, res) => {
  const { exams } = req.body;

  try {
    if (!Array.isArray(exams) || exams.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Exams must be an array with at least one element.",
      });
    }

    for (const exam of exams) {
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

    await prisma.exams.createMany({
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

    return res.status(201).json({
      success: true,
      data: createdExams,
      message: "Exam added successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Error adding exams",
    });
  }
};

export const updateExamController = async (req, res) => {
  const { examId } = req.params;
  const { exam_name, exam_year, levels, start_date, end_date, result_date } =
    req.body;
  const parsedExamId = parseInt(examId);

  try {
    const updateResult = await prisma.exams.updateMany({
      where: { id: parsedExamId },
      data: {
        exam_name: exam_name.trim() || null,
        exam_year: exam_year || null,
        levels: levels || null,
        start_date: start_date || null,
        end_date: end_date || null,
        result_date: result_date || null,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    const updated = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    return res.status(200).json({
      success: true,
      data: updated,
      message: "Exam updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Error updating exam",
    });
  }
};

export const getExamsController = async (_req, res) => {
  try {
    const exams = await prisma.exams.findMany();
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    console.error("Error fetching exams:", error.message);
    return res.status(500).json({
      success: false,
      error: "Error fetching exams",
    });
  }
};

export const updateExamVisibilityController = async (req, res) => {
  const { examId } = req.params;
  const { visible } = req.body;
  const parsedExamId = parseInt(examId);

  try {
    const updateResult = await prisma.exams.updateMany({
      where: { id: parsedExamId },
      data: { visible: visible },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    const result = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    // Publishing a result: warm per-student marksheet cache in the background.
    // Class bundles are generated on first download (hash-verified), not here.
    let pregen;
    if (visible && result) {
      try {
        console.log(
          `[marksheet] publish: exam ${result.id} "${result.exam_name}" (${result.exam_year}) -> queueing marksheets`,
        );
        pregen = await MarksheetService.enqueueForExam(
          result.id,
          result.school_id,
          result.exam_name,
        );
        console.log(
          `[marksheet] publish: exam ${result.id} queued ${pregen?.queued ?? 0} student marksheet(s)`,
        );
      } catch (queueErr) {
        console.error(
          "Failed to queue marksheet pregeneration:",
          queueErr instanceof Error ? queueErr.message : queueErr,
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: result,
      queued: pregen?.queued ?? 0,
      message: `Exam visibility updated to ${visible}`,
    });
  } catch (error) {
    console.error("Error updating exam visibility:", error.message);
    return res.status(500).json({
      success: false,
      error: "Error updating exam visibility",
    });
  }
};

export const deleteExamController = async (req, res) => {
  const { examId } = req.params;
  const parsedExamId = parseInt(examId);

  try {
    const existingExam = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    if (!existingExam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    await prisma.exams.deleteMany({
      where: { id: parsedExamId },
    });

    return res.status(200).json({
      success: true,
      data: existingExam,
      message: "Exam deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting exam:", error.message);
    return res.status(500).json({
      success: false,
      error: "Error deleting exam",
    });
  }
};

export const addExamRoutineController = async (req, res) => {
  const { exam_id, class: classNum, date, day, subject } = req.body;

  try {
    const exam = await prisma.exams.findFirst({
      where: { id: Number(exam_id) },
      select: { id: true },
    });

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    const routine = await prisma.exam_routines.create({
      data: {
        exam_id,
        class: classNum,
        date,
        day,
        subject,
      },
    });

    return res.status(201).json({ success: true, data: routine });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "Error adding exam routine",
    });
  }
};

export const getExamRoutinesController = async (req, res) => {
  const { exam_id, class: classNum } = req.query;

  console.log(
    `Fetching exam routines for exam_id: ${exam_id}, class: ${classNum}`,
  );

  try {
    const where = {};
    if (exam_id) where.exam_id = parseInt(exam_id);
    if (classNum) where.class = parseInt(classNum);

    const routines = await prisma.exam_routines.findMany({
      where,
      orderBy: [{ date: "asc" }],
    });

    return res.status(200).json({ success: true, data: routines });
  } catch (error) {
    console.error("Error fetching exam routines:", error.message);
    return res.status(500).json({
      success: false,
      error: "Error fetching exam routines",
    });
  }
};

export const updateExamRoutineController = async (req, res) => {
  const { routineId } = req.params;
  const { date, day, subject } = req.body;
  const parsedRoutineId = parseInt(routineId);

  try {
    const updateResult = await prisma.exam_routines.updateMany({
      where: { id: parsedRoutineId },
      data: { date, day, subject },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        error: "Exam routine not found",
      });
    }

    const updated = await prisma.exam_routines.findFirst({
      where: { id: parsedRoutineId },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating exam routine:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Error updating exam routine",
    });
  }
};

export const deleteExamRoutineController = async (req, res) => {
  const { routineId } = req.params;
  const parsedRoutineId = parseInt(routineId);

  try {
    const existingRoutine = await prisma.exam_routines.findFirst({
      where: { id: parsedRoutineId },
    });

    if (!existingRoutine) {
      return res.status(404).json({
        success: false,
        error: "Exam routine not found",
      });
    }

    await prisma.exam_routines.deleteMany({
      where: { id: parsedRoutineId },
    });

    return res.status(200).json({
      success: true,
      message: "Routine deleted",
    });
  } catch (error) {
    console.error("Error deleting exam routine:", error.message);
    return res.status(500).json({
      success: false,
      error: error.message || "Error deleting exam routine",
    });
  }
};

/**
 * GET /api/exams/presigned-url?filename=&contentType=
 */
export const getExamRoutinePresignedUrl = async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({ error: "filename and contentType are required" });
    }
    const key = `exam_routines/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return res.status(200).json({ uploadUrl, key });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return res.status(500).json({ error: "Error generating presigned URL" });
  }
};

/**
 * POST /api/exams/uploadRoutinePDF/:examId
 * Body: { key }   (R2 key after browser PUT to presigned URL)
 */
export const uploadExamRoutinePDFController = async (req, res) => {
  const { examId } = req.params;
  const parsedExamId = parseInt(examId);
  const { key } = req.body;

  try {
    if (!key) {
      return res.status(400).json({ error: "key is required" });
    }

    const updateResult = await prisma.exams.updateMany({
      where: { id: parsedExamId },
      data: {
        routine: key,
        public_id: key,
        download_url: key,
      },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const updatedExam = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    return res.status(200).json({
      success: true,
      data: updatedExam,
      message: "PDF routine saved successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to save PDF routine" });
  }
};

export const removeExamRoutinePDFController = async (req, res) => {
  const { examId } = req.params;
  const parsedExamId = parseInt(examId);

  try {
    const exam = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }

    if (!exam.routine) {
      return res.status(400).json({ error: "No routine PDF to remove" });
    }

    await deleteFromR2(exam.public_id);

    const updateResult = await prisma.exams.updateMany({
      where: { id: parsedExamId },
      data: { routine: null, public_id: null, download_url: null },
    });

    if (updateResult.count === 0) {
      return res.status(404).json({ error: "Exam not found" });
    }

    const updatedExam = await prisma.exams.findFirst({
      where: { id: parsedExamId },
    });

    return res.status(200).json({
      success: true,
      data: updatedExam,
      message: "PDF routine removed successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to remove PDF routine" });
  }
};
