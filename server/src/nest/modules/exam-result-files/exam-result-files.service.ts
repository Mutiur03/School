import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExamResultFileData } from '@school/shared-schemas';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { getDownloadUrl, getUploadUrl } from '@/config/r2.js';
import { deleteFromR2IfPresent } from '@/utils/r2Key.util.js';
import { PRISMA } from '../../common/prisma.module.js';

/** Admin-uploaded result PDFs (one per exam + class); the public result search serves them. */
@Injectable()
export class ExamResultFilesService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getPresignedUploadUrl(schoolId: number, filename: string, contentType: string) {
    const key = `${schoolId}/result-pdfs/${Date.now()}-${filename}`;
    return { uploadUrl: await getUploadUrl(key, contentType), key };
  }

  async findAll(schoolId: number, examId: number) {
    const files = await this.prisma.exam_result_files.findMany({
      where: { school_id: schoolId, exam_id: examId },
      select: { class: true, file_name: true, r2_key: true, created_at: true },
      orderBy: { class: 'asc' },
    });
    return Promise.all(
      files.map(async ({ r2_key, ...file }) => ({
        ...file,
        download_url: await getDownloadUrl(r2_key),
      })),
    );
  }

  /** Create or replace the PDF for (exam, class); the old R2 object is removed on replace. */
  async upsert(schoolId: number, examId: number, cls: number, dto: ExamResultFileData) {
    if (!dto.key.startsWith(`${schoolId}/`)) {
      throw new ForbiddenException('Invalid storage key for this school');
    }
    const exam = await this.prisma.exams.findFirst({
      where: { id: examId, school_id: schoolId },
      select: { levels: true },
    });
    if (!exam) throw new NotFoundException('Exam not found');
    if (!exam.levels.includes(cls)) throw new BadRequestException('Class is not part of this exam');

    const where = { exam_id_class_school: { exam_id: examId, class: cls, school_id: schoolId } };
    const old = await this.prisma.exam_result_files.findUnique({ where, select: { r2_key: true } });
    const row = await this.prisma.exam_result_files.upsert({
      where,
      create: {
        school_id: schoolId,
        exam_id: examId,
        class: cls,
        r2_key: dto.key,
        file_name: dto.fileName,
      },
      update: { r2_key: dto.key, file_name: dto.fileName },
      select: { class: true, file_name: true, created_at: true },
    });
    if (old && old.r2_key !== dto.key) await deleteFromR2IfPresent(old.r2_key);
    return row;
  }

  async remove(schoolId: number, examId: number, cls: number) {
    const row = await this.prisma.exam_result_files.findFirst({
      where: { school_id: schoolId, exam_id: examId, class: cls },
      select: { id: true, r2_key: true },
    });
    if (!row) throw new NotFoundException('Result file not found');
    await this.prisma.exam_result_files.deleteMany({ where: { id: row.id, school_id: schoolId } });
    await deleteFromR2IfPresent(row.r2_key);
  }
}
