import { prisma } from '@/config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '@/config/r2.js';
import { MarksheetService } from '@/modules/marks/marksheet.service.js';
import { ApiError } from '@/utils/ApiError.js';
import logger from '@/utils/logger.js';

export interface ExamInput {
  exam_name?: string;
  exam_year?: number;
  levels?: number[];
  start_date?: string;
  end_date?: string;
  result_date?: string;
  return_date?: string;
}

export class ExamService {
  static async createExams(exams: ExamInput[]) {
    if (!Array.isArray(exams) || exams.length === 0) {
      throw new ApiError(400, 'Exams must be an array with at least one element');
    }

    for (const exam of exams) {
      exam.exam_name = exam.exam_name?.trim();
      const exists = await prisma.exams.findFirst({
        where: {
          exam_name: exam.exam_name ?? undefined,
          exam_year: exam.exam_year ?? undefined,
        },
      });

      if (exists) {
        throw new ApiError(
          400,
          `Exam "${exam.exam_name}" for year ${exam.exam_year} already exists`,
        );
      }
    }

    await prisma.exams.createMany({
      data: exams.map((exam) => ({
        exam_name: exam.exam_name!.trim(),
        exam_year: exam.exam_year!,
        levels: exam.levels ?? [],
        start_date: exam.start_date!,
        end_date: exam.end_date!,
        result_date: exam.result_date!,
        return_date: exam.return_date,
      })),
    });

    return prisma.exams.findMany({
      where: {
        exam_name: { in: exams.map((e) => e.exam_name).filter(Boolean) as string[] },
        exam_year: { in: exams.map((e) => e.exam_year).filter(Boolean) as number[] },
      },
    });
  }

  static async updateExam(examId: number, data: ExamInput) {
    const updateResult = await prisma.exams.updateMany({
      where: { id: examId },
      data: {
        exam_name: data.exam_name?.trim(),
        exam_year: data.exam_year,
        levels: data.levels,
        start_date: data.start_date,
        end_date: data.end_date,
        result_date: data.result_date,
        return_date: data.return_date,
      },
    });

    if (updateResult.count === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    const updated = await prisma.exams.findFirst({ where: { id: examId } });

    if (updated?.visible) {
      try {
        await MarksheetService.enqueueForExam(updated.id, updated.school_id, updated.exam_name);
      } catch (queueErr) {
        logger.error('Failed to queue marksheet regeneration after exam update', {
          error: queueErr instanceof Error ? queueErr.message : String(queueErr),
        });
      }
    }

    return updated;
  }

  static async getExams() {
    return prisma.exams.findMany();
  }

  static async updateVisibility(examId: number, visible: boolean) {
    const updateResult = await prisma.exams.updateMany({
      where: { id: examId },
      data: { visible },
    });

    if (updateResult.count === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    const result = await prisma.exams.findFirst({ where: { id: examId } });
    let queued = 0;

    if (visible && result) {
      try {
        logger.info(
          `[marksheet] publish: exam ${result.id} "${result.exam_name}" (${result.exam_year}) -> queueing marksheets`,
        );
        const pregen = await MarksheetService.enqueueForExam(
          result.id,
          result.school_id,
          result.exam_name,
        );
        queued = pregen?.queued ?? 0;
        logger.info(`[marksheet] publish: exam ${result.id} queued ${queued} student marksheet(s)`);
      } catch (queueErr) {
        logger.error('Failed to queue marksheet pregeneration', {
          error: queueErr instanceof Error ? queueErr.message : String(queueErr),
        });
      }
    }

    return { exam: result, queued };
  }

  static async deleteExam(examId: number) {
    const existingExam = await prisma.exams.findFirst({ where: { id: examId } });

    if (!existingExam) {
      throw new ApiError(404, 'Exam not found');
    }

    await prisma.exams.deleteMany({ where: { id: examId } });
    return existingExam;
  }

  static async getRoutinePresignedUrl(filename: string, contentType: string) {
    const key = `exam_routines/${Date.now()}-${filename}`;
    const uploadUrl = await getUploadUrl(key, contentType);
    return { uploadUrl, key };
  }

  static async uploadRoutinePdf(examId: number, key: string) {
    const updateResult = await prisma.exams.updateMany({
      where: { id: examId },
      data: {
        routine: key,
        public_id: key,
        download_url: key,
      },
    });

    if (updateResult.count === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    return prisma.exams.findFirst({ where: { id: examId } });
  }

  static async removeRoutinePdf(examId: number) {
    const exam = await prisma.exams.findFirst({ where: { id: examId } });

    if (!exam) {
      throw new ApiError(404, 'Exam not found');
    }

    if (!exam.routine) {
      throw new ApiError(400, 'No routine PDF to remove');
    }

    if (exam.public_id) {
      await deleteFromR2(exam.public_id);
    }

    const updateResult = await prisma.exams.updateMany({
      where: { id: examId },
      data: { routine: null, public_id: null, download_url: null },
    });

    if (updateResult.count === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    return prisma.exams.findFirst({ where: { id: examId } });
  }
}
