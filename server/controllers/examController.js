import { prisma } from "../config/prisma.js";
import cloudinary from "../config/cloudinary.js";

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
    res.status(500).json({
      success: false,
      error: error.message || "Error updating exam",
    });
  }
};

export const getExamsController = async (req, res) => {
  try {
    const exams = await prisma.exams.findMany();
    res.status(200).json({ success: true, data: exams });
  } catch (error) {
    console.error("Error fetching exams:", error.message);
    res.status(500).json({ success: false, error: "Error fetching exams" });
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
    console.error("Error updating exam visibility:", error.message);
    res.status(500).json({
      success: false,
      error: "Error updating exam visibility",
    });
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
    console.error("Error deleting exam:", error.message);
    res.status(500).json({
      success: false,
      error: "Error deleting exam",
    });
  }
};

// Exam Routine Controllers

export const addExamRoutineController = async (req, res) => {
  const { exam_id, class: classNum, date, day, subject } = req.body;
  try {
    const routine = await prisma.exam_routines.create({
      data: {
        exam_id,
        class: classNum,
        date,
        day,
        subject,
      },
    });
    res.status(201).json({ success: true, data: routine });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "Error adding exam routine",
    });
  }
};

export const getExamRoutinesController = async (req, res) => {
  const { exam_id, class: classNum } = req.query;
  console.log(
    `Fetching exam routines for exam_id: ${exam_id}, class: ${classNum}`
  );

  try {
    const where = {};
    if (exam_id) where.exam_id = parseInt(exam_id);
    if (classNum) where.class = parseInt(classNum);
    const routines = await prisma.exam_routines.findMany({
      where,
      orderBy: [{ date: "asc" }],
    });
    res.status(200).json({ success: true, data: routines });
  } catch (error) {
    console.error("Error fetching exam routines:", error.message);
    res
      .status(500)
      .json({ success: false, error: "Error fetching exam routines" });
  }
};

export const updateExamRoutineController = async (req, res) => {
  const { routineId } = req.params;
  const { date, day, subject } = req.body;
  try {
    const updated = await prisma.exam_routines.update({
      where: { id: parseInt(routineId) },
      data: { date, day, subject },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error("Error updating exam routine:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Error updating exam routine",
    });
  }
};

export const deleteExamRoutineController = async (req, res) => {
  const { routineId } = req.params;
  try {
    await prisma.exam_routines.delete({
      where: { id: parseInt(routineId) },
    });
    res.status(200).json({ success: true, message: "Routine deleted" });
  } catch (error) {
    console.error("Error deleting exam routine:", error.message);
    res.status(500).json({
      success: false,
      error: error.message || "Error deleting exam routine",
    });
  }
};

// Helper function to upload PDF to Cloudinary (supports memory storage)
async function uploadPDFToCloudinary(file) {
  try {
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "exam_routines",
          resource_type: "raw",
          use_filename: true,
          unique_filename: true,
          filename_override: file.originalname,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(file.buffer);
    });
    const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
    return {
      previewUrl: result.secure_url,
      downloadUrl: `https://res.cloudinary.com/${cloud_name}/raw/upload/fl_attachment/${result.public_id}`,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error.message);
    throw new Error("Cloudinary upload failed");
  }
}

// Controller to handle PDF routine upload
export const uploadExamRoutinePDFController = async (req, res) => {
  try {
    const { examId } = req.params;
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }
    const { previewUrl, public_id, downloadUrl } = await uploadPDFToCloudinary(
      req.file
    );

    const updatedExam = await prisma.exams.update({
      where: { id: parseInt(examId) },
      data: {
        routine: previewUrl,
        public_id: public_id,
        download_url: downloadUrl,
      },
    });

    res.status(200).json({
      success: true,
      data: updatedExam,
      message: "PDF routine uploaded successfully",
      routine_url: previewUrl,
      public_id,
      download_url: downloadUrl,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "PDF upload failed" });
  }
};

// Remove PDF routine from exam and Cloudinary
export const removeExamRoutinePDFController = async (req, res) => {
  try {
    const { examId } = req.params;
    // Find the exam to get the Cloudinary public_id from the routine URL if needed
    const exam = await prisma.exams.findUnique({
      where: { id: parseInt(examId) },
    });
    if (!exam) {
      return res.status(404).json({ error: "Exam not found" });
    }
    if (!exam.routine) {
      return res.status(400).json({ error: "No routine PDF to remove" });
    }

    // Try to extract public_id from the routine URL or use the stored public_id
    let public_id = exam.public_id;
    if (!public_id) {
      try {
        // Cloudinary URLs look like: https://res.cloudinary.com/<cloud>/raw/upload/v<version>/exam_routines/<filename>
        const match = exam.routine.match(
          /\/(?:raw|image)\/upload\/(?:v\d+\/)?(.+)\.(pdf|PDF)$/
        );
        if (match) {
          public_id = match[1];
        }
      } catch (e) {}
    }

    // Remove from Cloudinary if possible
    if (public_id) {
      try {
        cloudinary.uploader.destroy(public_id, { resource_type: "raw" });
      } catch (err) {
        // Log but don't fail the request if Cloudinary deletion fails
        console.error("Error deleting routine from Cloudinary:", err.message);
      }
    }

    // Remove routine, public_id, and download_url fields from exam
    const updatedExam = await prisma.exams.update({
      where: { id: parseInt(examId) },
      data: { routine: null, public_id: null, download_url: null },
    });

    res.status(200).json({
      success: true,
      data: updatedExam,
      message: "PDF routine removed successfully",
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: error.message || "Failed to remove PDF routine" });
  }
};
