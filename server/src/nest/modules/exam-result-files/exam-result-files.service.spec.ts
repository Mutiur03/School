import { jest } from '@jest/globals';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { ExamResultFilesService } from './exam-result-files.service.js';

const make = () => {
  const db = {
    exams: { findFirst: jest.fn<(...args: any[]) => Promise<any>>() },
    exam_result_files: {
      findMany: jest.fn<(...args: any[]) => Promise<any>>(),
      findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
      findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
      upsert: jest.fn<(...args: any[]) => Promise<any>>(),
      deleteMany: jest.fn<(...args: any[]) => Promise<any>>(),
    },
  };
  return { db, svc: new ExamResultFilesService(db as unknown as PrismaClient) };
};

describe('ExamResultFilesService', () => {
  it('findAll scopes by school and exam', async () => {
    const { db, svc } = make();
    db.exam_result_files.findMany.mockResolvedValue([]);
    await svc.findAll(7, 3);
    expect(db.exam_result_files.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 7, exam_id: 3 } }),
    );
  });

  it('upsert rejects a key outside the tenant prefix', async () => {
    const { svc } = make();
    await expect(
      svc.upsert(7, 3, 6, { key: '8/result-pdfs/a.pdf', fileName: 'a.pdf' }),
    ).rejects.toThrow('Invalid storage key');
  });

  it('upsert rejects a class not in the exam', async () => {
    const { db, svc } = make();
    db.exams.findFirst.mockResolvedValue({ levels: [6, 7] });
    await expect(
      svc.upsert(7, 3, 9, { key: '7/result-pdfs/a.pdf', fileName: 'a.pdf' }),
    ).rejects.toThrow('Class is not part of this exam');
  });

  it('upsert writes school_id explicitly', async () => {
    const { db, svc } = make();
    db.exams.findFirst.mockResolvedValue({ levels: [6] });
    db.exam_result_files.findUnique.mockResolvedValue(null);
    db.exam_result_files.upsert.mockResolvedValue({});
    await svc.upsert(7, 3, 6, { key: '7/result-pdfs/a.pdf', fileName: 'a.pdf' });
    expect(db.exam_result_files.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { exam_id_class_school: { exam_id: 3, class: 6, school_id: 7 } },
        create: {
          school_id: 7,
          exam_id: 3,
          class: 6,
          r2_key: '7/result-pdfs/a.pdf',
          file_name: 'a.pdf',
        },
      }),
    );
  });

  it('remove 404s when nothing matches the tenant', async () => {
    const { db, svc } = make();
    db.exam_result_files.findFirst.mockResolvedValue(null);
    await expect(svc.remove(7, 3, 6)).rejects.toThrow('Result file not found');
    expect(db.exam_result_files.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { school_id: 7, exam_id: 3, class: 6 } }),
    );
  });
});
