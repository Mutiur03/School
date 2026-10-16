import { jest } from '@jest/globals';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@/generated/prisma/client.js';
import type { PrismaClient } from '@/generated/prisma/client.js';
import type { CertificatePdfService } from './certificate-pdf.service.js';
import { CertificateService } from './certificate.service.js';
import type { CreateCertificateDto } from './dto/create-certificate.dto.js';

type Fn = (args: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant, no Chrome.
const create = jest.fn<Fn>();
const findMany = jest.fn<Fn>();
const findUniqueOrThrow = jest.fn<Fn>();
const update = jest.fn<Fn>();
const count = jest.fn<Fn>();
const createRevision = jest.fn<Fn>();
const findManyRevisions = jest.fn<Fn>();
const transaction = jest.fn<Fn>();
const generate = jest.fn<Fn>();
const prisma = {
  certificates: { create, findMany, findUniqueOrThrow, update, count },
  certificate_revisions: {
    create: createRevision,
    findMany: findManyRevisions,
  },
  $transaction: transaction,
} as unknown as PrismaClient;
const service = new CertificateService(prisma, { generate } as unknown as CertificatePdfService);

const ID = '4f1c6c7e-0a55-4a58-9d3e-1f0d9b6f2a11';
const board: CreateCertificateDto = {
  exam: 'SSC',
  passing_year: 2020,
  student_name_bn: 'রহিম উদ্দিন',
  student_name_en: 'Md. Rahim Uddin',
  father_name_bn: 'করিম উদ্দিন',
  father_name_en: 'Md. Karim Uddin',
  mother_name_bn: 'রহিমা বেগম',
  mother_name_en: 'Mst. Rahima Begum',
  address_district: 'Kishoreganj',
  address_upazila: 'Karimganj',
  address_post_office: 'Karimganj',
  address_post_office_bn: 'করিমগঞ্জ',
  address_post_code: '2310',
  address_village_road: 'Rahimpur',
  address_village_road_bn: 'রহিমপুর',
  mobile: '01712345678',
  birth_reg_no: '19901234567890123',
  dob: '2005-03-14',
  roll: '123456',
  registration_no: '1234567890',
  gpa: '4.75',
};
/** `board` as it comes back from Postgres: real DATE and DECIMAL, nulls for empty optionals. */
const rowOf = (d: CreateCertificateDto) => ({
  ...d,
  dob: new Date(d.dob),
  gender: d.gender ?? null,
  roll: d.roll ?? null,
  registration_no: d.registration_no ?? null,
  gpa: d.gpa ? new Prisma.Decimal(d.gpa) : null,
});
/** Expected column values the service writes for a form. */
const columnsOf = (d: CreateCertificateDto) => ({
  ...d,
  dob: new Date(d.dob),
  gender: null,
  roll: d.roll ?? null,
  registration_no: d.registration_no ?? null,
  gpa: d.gpa ?? null,
});

afterEach(() => jest.resetAllMocks());

describe('CertificateService.create', () => {
  it('writes one real column per field with school_id and pending status', async () => {
    create.mockResolvedValue({ id: ID, status: 'pending', ...rowOf(board) });
    const out = await service.create(1, board);
    expect(create).toHaveBeenCalledWith({
      data: { school_id: 1, status: 'pending', ...columnsOf(board) },
      select: expect.objectContaining({ id: true, status: true, student_name_en: true, gpa: true }),
    });
    expect(out).toEqual({ id: ID, status: 'pending', data: board });
  });

  it.each([
    ['future year', { passing_year: new Date().getFullYear() + 1 }],
    ['JSC outside JSC era', { exam: 'JSC', passing_year: 2022 }],
    ['bad DOB', { dob: 'nope' }],
    ['short roll', { roll: '123' }],
    ['missing registration', { registration_no: undefined }],
    ['GPA over 5', { gpa: '5.50' }],
    ['missing GPA', { gpa: undefined }],
    ['short birth reg', { birth_reg_no: '123' }],
  ])('rejects %s → 400', async (_name, patch) => {
    await expect(service.create(1, { ...board, ...patch })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('stores null roll/registration/GPA for a class 6 record', async () => {
    create.mockResolvedValue({
      id: ID,
      status: 'pending',
      ...rowOf({ ...board, exam: '6', roll: undefined }),
    });
    await service.create(1, { ...board, exam: '6' });
    expect(create.mock.calls[0][0].data).toMatchObject({
      exam: '6',
      roll: null,
      registration_no: null,
      gpa: null,
    });
  });

  it('bubbles Prisma P2002 so the filter returns 409', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.create(1, board)).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('CertificateService.findAll', () => {
  it('filters by school_id + batch + mobile + class + birth reg and maps rows back to the form', async () => {
    findMany.mockResolvedValue([{ id: ID, status: 'pending', ...rowOf(board) }]);
    const out = await service.findAll(1, {
      passing_year: '2020',
      mobile: '01712345678',
      exam: 'SSC',
      birth_reg_no: '19901234567890123',
    });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        school_id: 1,
        passing_year: 2020,
        mobile: '01712345678',
        exam: 'SSC',
        birth_reg_no: '19901234567890123',
      },
      select: expect.objectContaining({ id: true, status: true, mobile: true }),
      orderBy: { updated_at: 'desc' },
    });
    expect(out).toEqual([{ id: ID, status: 'pending', data: board }]);
  });

  it('maps a legacy row without birth reg (NULL) to an empty string', async () => {
    findMany.mockResolvedValue([
      { id: ID, status: 'approved', ...rowOf(board), birth_reg_no: null },
    ]);
    const [row] = await service.findAll(1, {
      passing_year: '2020',
      mobile: '01712345678',
      exam: 'SSC',
      birth_reg_no: '19901234567890123',
    });
    expect(row.data.birth_reg_no).toBe('');
  });
});

describe('CertificateService.findAllForAdmin', () => {
  it('defaults: page 1, limit 50, newest update first, scoped by school_id', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    const out = await service.findAllForAdmin(1, {});
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: { school_id: 1 },
      orderBy: [{ updated_at: 'desc' }, { id: 'asc' }],
      skip: 0,
      take: 50,
    });
    expect(out.meta).toMatchObject({ total: 0, page: 1, limit: 50, totalPages: 0 });
  });

  it('turns filters, sort and page into one Prisma query on real columns', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(130);
    const out = await service.findAllForAdmin(1, {
      page: '3',
      limit: '25',
      sort: 'edits',
      order: 'desc',
      name: ' rahim ',
      mobile: '0171',
      exam: 'SSC,JSC',
      year: '2020,2021',
      edits: 'never',
    });
    expect(findMany.mock.calls[0][0]).toMatchObject({
      where: {
        school_id: 1,
        student_name_en: { contains: 'rahim', mode: 'insensitive' },
        mobile: { contains: '0171' },
        exam: { in: ['SSC', 'JSC'] },
        passing_year: { in: [2020, 2021] },
        revisions: { none: {} },
      },
      orderBy: [{ revisions: { _count: 'desc' } }, { id: 'asc' }],
      skip: 50,
      take: 25,
    });
    expect(out.meta.totalPages).toBe(6);
  });

  it('caps limit at 200', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
    await service.findAllForAdmin(1, { limit: '999' });
    expect(findMany.mock.calls[0][0]).toMatchObject({ take: 200 });
  });

  it('maps rows to { id, status, edits, data } with the audit columns', async () => {
    findMany.mockResolvedValue([
      {
        id: ID,
        status: 'approved',
        ...rowOf(board),
        created_at: 'c',
        updated_at: 'u',
        _count: { revisions: 2 },
      },
    ]);
    count.mockResolvedValue(1);
    const out = await service.findAllForAdmin(1, {});
    expect(out.items[0]).toEqual({
      id: ID,
      status: 'approved',
      created_at: 'c',
      updated_at: 'u',
      edits: 2,
      data: board,
    });
  });
});

describe('CertificateService.update', () => {
  it('copies the current row into a revision, then applies the merged edit', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending', ...rowOf(board) });
    createRevision.mockReturnValue('rev' as never);
    update.mockReturnValue('upd' as never);
    const edited = { ...board, mobile: '01812345678', gpa: '5.00' };
    transaction.mockResolvedValue(['rev', { id: ID, status: 'pending', ...rowOf(edited) }]);

    const out = await service.update(1, ID, { mobile: '01812345678', gpa: '5.00' });

    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: ID, school_id: 1 },
      select: expect.objectContaining({ status: true, student_name_en: true }),
    });
    expect(createRevision).toHaveBeenCalledWith({
      data: {
        school_id: 1,
        certificate_id: ID,
        ...rowOf(board),
      },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: ID, school_id: 1 },
      data: columnsOf(edited),
      select: expect.objectContaining({ id: true, status: true }),
    });
    expect(transaction).toHaveBeenCalledWith(['rev', 'upd']);
    expect(out).toEqual({ id: ID, status: 'pending', data: edited });
  });

  it('does nothing when the saved data is identical (no revision, no write)', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending', ...rowOf(board) });
    const out = await service.update(1, ID, { ...board });
    expect(transaction).not.toHaveBeenCalled();
    expect(createRevision).not.toHaveBeenCalled();
    expect(out).toEqual({ id: ID, status: 'pending', data: board });
  });

  it('rejects edits when approved', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'approved', ...rowOf(board) });
    await expect(service.update(1, ID, { mobile: '01812345678' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('re-validates the merged result and writes nothing on failure', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending', ...rowOf(board) });
    await expect(service.update(1, ID, { gpa: '9.00' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('bubbles P2025 for another tenant or unknown id', async () => {
    findUniqueOrThrow.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('nope', { code: 'P2025', clientVersion: 'x' }),
    );
    await expect(service.update(2, ID, {})).rejects.toMatchObject({ code: 'P2025' });
  });
});

describe('CertificateService.updateStatus', () => {
  it('public may confirm pending → approved', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending' });
    update.mockResolvedValue({ id: ID, status: 'approved', ...rowOf(board) });
    const out = await service.updateStatus(1, ID, 'approved');
    expect(update).toHaveBeenCalledWith({
      where: { id: ID, school_id: 1 },
      data: { status: 'approved' },
      select: expect.objectContaining({ id: true, status: true }),
    });
    expect(out).toEqual({ id: ID, status: 'approved', data: board });
  });

  it('public may not unlock approved → pending', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'approved' });
    await expect(service.updateStatus(1, ID, 'pending')).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it('admin may unlock approved → pending', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'approved' });
    update.mockResolvedValue({ id: ID, status: 'pending', ...rowOf(board) });
    const out = await service.updateStatus(1, ID, 'pending', { asAdmin: true });
    expect(out.status).toBe('pending');
  });
});

describe('CertificateService.history', () => {
  it('diffs each revision against the next version, the last one against current', async () => {
    const v2 = { ...board, gpa: '5.00' };
    const v3 = { ...v2, student_name_en: 'Md. Rahim' };
    findUniqueOrThrow.mockResolvedValue(rowOf(v3));
    findManyRevisions.mockResolvedValue([
      { id: 1, created_at: 'a', ...rowOf(board) },
      { id: 2, created_at: 'b', ...rowOf(v2) },
    ]);
    const out = await service.history(1, ID);
    expect(findManyRevisions).toHaveBeenCalledWith({
      where: { certificate_id: ID, school_id: 1 },
      select: expect.objectContaining({ id: true }),
      orderBy: { id: 'asc' },
    });
    expect(out.map((r) => r.changes)).toEqual([
      [{ field: 'gpa', from: '4.75', to: '5.00' }],
      [{ field: 'student_name_en', from: 'Md. Rahim Uddin', to: 'Md. Rahim' }],
    ]);
  });
});

describe('CertificateService.remove', () => {
  const del = jest.fn<Fn>();
  const remover = new CertificateService(
    { certificates: { delete: del } } as unknown as PrismaClient,
    { generate } as unknown as CertificatePdfService,
  );

  it('deletes by id scoped to school_id', async () => {
    del.mockResolvedValue({});
    await remover.remove(1, ID);
    expect(del).toHaveBeenCalledWith({ where: { id: ID, school_id: 1 } });
  });

  it('bubbles P2025 for another tenant or unknown id (→ 404)', async () => {
    del.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('nope', { code: 'P2025', clientVersion: 'x' }),
    );
    await expect(remover.remove(2, ID)).rejects.toMatchObject({ code: 'P2025' });
  });
});

describe('CertificateService.generatePdf', () => {
  it('scopes the read by school_id and renders with the derived kind', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'approved', ...rowOf(board) });
    generate.mockResolvedValue(Buffer.from('pdf'));
    const out = await service.generatePdf(1, ID);
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: ID, school_id: 1 },
      select: expect.objectContaining({ status: true, student_name_en: true }),
    });
    expect(generate).toHaveBeenCalledWith(1, { ...board, kind: 'board' }, false, false);
    expect(out.name).toBe('Md_Rahim_Uddin');
  });

  it('refuses the public PDF while pending', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending', ...rowOf(board) });
    await expect(service.generatePdf(1, ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(generate).not.toHaveBeenCalled();
  });

  it('lets admins render a pending certificate stamped, with address when asked', async () => {
    findUniqueOrThrow.mockResolvedValue({ status: 'pending', ...rowOf(board) });
    generate.mockResolvedValue(Buffer.from('pdf'));
    await service.generatePdf(1, ID, { withAddress: true, asAdmin: true });
    expect(generate).toHaveBeenCalledWith(1, { ...board, kind: 'board' }, true, true);
  });
});
