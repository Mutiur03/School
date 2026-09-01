import { prisma } from '@/config/prisma.js';
import { getUploadUrl, deleteFromR2 } from '@/config/r2.js';
import { MarksheetService } from '@/modules/marks/marksheet.service.js';
import { ApiError } from '@/utils/ApiError.js';
import { tenantR2Key } from '@/utils/r2Key.util.js';
import logger from '@/utils/logger.js';
import {
  missingYearEndClasses,
  overlappingYearEndName,
  type YearEndExam,
} from './exam-year-end.js';

export interface ExamInput {
  exam_type_id?: number;
  exam_year?: number;
  levels?: number[];
  start_date?: string;
  end_date?: string;
  result_date?: string;
  return_date?: string;
}

export class ExamService {
  static async resolveAssignedType(examTypeId: number) {
    const assigned = await prisma.school_exam_types.findFirst({
      where: { exam_type_id: examTypeId },
      include: { exam_type: true },
    });
    if (!assigned) {
      throw new ApiError(400, 'Exam type is not assigned to this school');
    }
    return assigned.exam_type;
  }

  static async assertYearEndCoverage(year: number, classes: number[]): Promise<YearEndExam[]> {
    const yearEndExams = await prisma.exams.findMany({
      where: { exam_year: year, is_year_end: true },
      select: { id: true, levels: true, exam_name: true },
    });
    const missing = missingYearEndClasses(yearEndExams, classes);
    if (missing.length > 0) {
      throw new ApiError(
        400,
        `No year-end exam for class ${missing.join(', ')} in ${year}. Create and mark a year-end exam first.`,
      );
    }
    return yearEndExams;
  }

  static async assertNoYearEndOverlap(opts: {
    year: number;
    levels: number[];
    excludeExamId?: number;
  }) {
    const others = await prisma.exams.findMany({
      where: {
        exam_year: opts.year,
        is_year_end: true,
        ...(opts.excludeExamId ? { id: { not: opts.excludeExamId } } : {}),
      },
      select: { exam_name: true, levels: true },
    });
    const clash = overlappingYearEndName(opts.levels, others);
    if (clash) {
      throw new ApiError(
        400,
        `Year-end exam "${clash}" already covers one of these classes in ${opts.year}`,
      );
    }
  }

  static async createExams(exams: ExamInput[]) {
    if (!Array.isArray(exams) || exams.length === 0) {
      throw new ApiError(400, 'Exams must be an array with at least one element');
    }

    const prepared = [];
    for (const exam of exams) {
      if (!exam.exam_type_id || !exam.exam_year) {
        throw new ApiError(400, 'exam_type_id and exam_year are required');
      }
      const type = await ExamService.resolveAssignedType(exam.exam_type_id);
      const levels = exam.levels ?? [];
      const exists = await prisma.exams.findFirst({
        where: { exam_type_id: type.id, exam_year: exam.exam_year },
      });
      if (exists) {
        throw new ApiError(400, `Exam "${type.name}" for year ${exam.exam_year} already exists`);
      }
      if (type.is_year_end) {
        await ExamService.assertNoYearEndOverlap({ year: exam.exam_year, levels });
      }
      prepared.push({
        exam_type_id: type.id,
        exam_name: type.name,
        is_year_end: type.is_year_end,
        exam_year: exam.exam_year,
        levels,
        start_date: exam.start_date!,
        end_date: exam.end_date!,
        result_date: exam.result_date!,
        return_date: exam.return_date,
      });
    }

    await prisma.exams.createMany({ data: prepared });

    return prisma.exams.findMany({
      where: {
        exam_type_id: { in: prepared.map((e) => e.exam_type_id) },
        exam_year: { in: prepared.map((e) => e.exam_year) },
      },
    });
  }

  static async updateExam(examId: number, data: ExamInput) {
    const existing = await prisma.exams.findFirst({ where: { id: examId } });
    if (!existing) {
      throw new ApiError(404, 'Exam not found');
    }

    const typeId = data.exam_type_id ?? existing.exam_type_id;
    const type = await ExamService.resolveAssignedType(typeId);
    const year = data.exam_year ?? existing.exam_year;
    const levels = data.levels ?? existing.levels;

    const clash = await prisma.exams.findFirst({
      where: { exam_type_id: type.id, exam_year: year, id: { not: examId } },
    });
    if (clash) {
      throw new ApiError(400, `Exam "${type.name}" for year ${year} already exists`);
    }

    if (type.is_year_end) {
      await ExamService.assertNoYearEndOverlap({
        year,
        levels,
        excludeExamId: examId,
      });
    }

    const updateResult = await prisma.exams.updateMany({
      where: { id: examId },
      data: {
        exam_type_id: type.id,
        exam_name: type.name,
        is_year_end: type.is_year_end,
        exam_year: year,
        levels,
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
    const key = tenantR2Key(`exam_routines/${Date.now()}-${filename}`);
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
