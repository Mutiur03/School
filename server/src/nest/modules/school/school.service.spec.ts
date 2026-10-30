import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';

type Fn = (args?: any) => Promise<any>;
const model = () => ({
  create: jest.fn<Fn>(),
  createMany: jest.fn<Fn>(),
  findMany: jest.fn<Fn>(),
  findUnique: jest.fn<Fn>(),
  findUniqueOrThrow: jest.fn<Fn>(),
  update: jest.fn<Fn>(),
});
const db = {
  school: model(),
  admin: model(),
  sms_settings: model(),
  school_subscriptions: model(),
  exam_types: model(),
  school_exam_types: model(),
  students: model(),
};
const cache = {
  get: jest.fn<Fn>(),
  set: jest.fn<Fn>(),
  del: jest.fn<Fn>(),
};
const rlsTransaction = jest.fn((fn: (tx: unknown) => unknown) => fn(db));
jest.unstable_mockModule('@/config/prisma.js', () => ({ prisma: db, rlsTransaction }));
jest.unstable_mockModule('@/config/redis.js', () => ({ redis: cache }));
const { SchoolService } = await import('./school.service.js');

const rows = (buf: Buffer) => {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return {
    name: wb.SheetNames[0],
    rows: XLSX.utils.sheet_to_json<any>(wb.Sheets[wb.SheetNames[0]]),
  };
};

beforeEach(() => {
  for (const m of Object.values(db)) for (const f of Object.values(m)) f.mockReset();
  for (const f of Object.values(cache)) f.mockReset();
  cache.get.mockResolvedValue(null);
  cache.set.mockResolvedValue('OK');
  cache.del.mockResolvedValue(1);
  rlsTransaction.mockClear();
});

describe('SchoolService.createSchool', () => {
  const input = (trialEndsAt: Date) => ({
    name: 'New',
    subdomain: 'new',
    initialAdmin: { username: 'boss', password: 'secret12' },
    trialEndsAt,
  });

  it('rejects a trial end that is not in the future', async () => {
    await expect(
      SchoolService.createSchool(input(new Date(Date.now() - 1000))),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(rlsTransaction).not.toHaveBeenCalled();
  });

  it('creates school, hashed admin, sms settings, a trial and the default exam types in one transaction', async () => {
    const trialEndsAt = new Date(Date.now() + 86_400_000);
    db.school.create.mockResolvedValue({ id: 42 });
    db.exam_types.findMany.mockResolvedValue([{ id: 1 }, { id: 3 }]);
    db.school.findUniqueOrThrow.mockResolvedValue({ id: 42, subscription: { status: 'trialing' } });

    const out = await SchoolService.createSchool(input(trialEndsAt));

    expect(out).toEqual({ id: 42, subscription: { status: 'trialing' } });
    expect(rlsTransaction).toHaveBeenCalledTimes(1);
    // initialAdmin / trialEndsAt never reach the School row
    expect(db.school.create).toHaveBeenCalledWith({ data: { name: 'New', subdomain: 'new' } });
    const admin = db.admin.create.mock.calls[0][0].data;
    expect(admin).toMatchObject({ username: 'boss', role: 'admin', school_id: 42 });
    expect(admin.password).not.toBe('secret12');
    expect(await bcrypt.compare('secret12', admin.password)).toBe(true);
    expect(db.sms_settings.create.mock.calls[0][0].data.school_id).toBe(42);
    expect(db.school_subscriptions.create.mock.calls[0][0].data).toMatchObject({
      school_id: 42,
      status: 'trialing',
      trial_ends_at: trialEndsAt,
    });
    expect(db.exam_types.findMany).toHaveBeenCalledWith({
      where: { assign_to_new_schools: true },
      select: { id: true },
    });
    expect(db.school_exam_types.createMany).toHaveBeenCalledWith({
      data: [
        { school_id: 42, exam_type_id: 1 },
        { school_id: 42, exam_type_id: 3 },
      ],
      skipDuplicates: true,
    });
  });

  it('skips exam-type assignment when there are no defaults', async () => {
    db.school.create.mockResolvedValue({ id: 7 });
    db.exam_types.findMany.mockResolvedValue([]);
    db.school.findUniqueOrThrow.mockResolvedValue({ id: 7 });
    await SchoolService.createSchool(input(new Date(Date.now() + 86_400_000)));
    expect(db.school_exam_types.createMany).not.toHaveBeenCalled();
  });
});

describe('SchoolService info cache', () => {
  it('serves a cached profile without touching the DB', async () => {
    cache.get.mockResolvedValue(JSON.stringify({ id: 5, name: 'Cached' }));
    expect(await SchoolService.getSchoolInfo(5)).toEqual({ id: 5, name: 'Cached' });
    expect(cache.get).toHaveBeenCalledWith('school:info:5');
    expect(db.school.findUnique).not.toHaveBeenCalled();
  });

  it('loads the public projection and caches it for 5 minutes', async () => {
    db.school.findUnique.mockResolvedValue({ id: 5, name: 'Fresh' });
    expect(await SchoolService.getSchoolInfo(5)).toEqual({ id: 5, name: 'Fresh' });
    const select = db.school.findUnique.mock.calls[0][0].select;
    expect(select).toMatchObject({ id: true, name: true, subdomain: true });
    expect(select).not.toHaveProperty('subscription');
    expect(cache.set).toHaveBeenCalledWith('school:info:5', '{"id":5,"name":"Fresh"}', 'EX', 300);
  });

  it('does not cache a missing school, and falls back to the DB if Redis is down', async () => {
    cache.get.mockRejectedValue(new Error('down'));
    db.school.findUnique.mockResolvedValue(null);
    expect(await SchoolService.getSchoolInfo(9)).toBeNull();
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('getCurrentSchoolInfo returns null without a school id', async () => {
    expect(await SchoolService.getCurrentSchoolInfo({})).toBeNull();
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('updateSchool drops the cached profile', async () => {
    db.school.update.mockResolvedValue({ id: 5 });
    await SchoolService.updateSchool(5, { name: 'X' });
    expect(db.school.update).toHaveBeenCalledWith({ where: { id: 5 }, data: { name: 'X' } });
    expect(cache.del).toHaveBeenCalledWith('school:info:5');
  });
});

describe('SchoolService.rotateStudentPasswords', () => {
  it('404s for an unknown school or a school without students', async () => {
    db.school.findUnique.mockResolvedValue(null);
    await expect(SchoolService.rotateStudentPasswords(1)).rejects.toMatchObject({
      statusCode: 404,
    });
    db.school.findUnique.mockResolvedValue({ id: 1 });
    db.students.findMany.mockResolvedValue([]);
    await expect(SchoolService.rotateStudentPasswords(1)).rejects.toMatchObject({
      statusCode: 404,
      message: 'No students found for this school',
    });
  });

  it('stores bcrypt hashes, bumps tokenVersion and returns the plain passwords as xlsx', async () => {
    db.school.findUnique.mockResolvedValue({ id: 1 });
    db.students.findMany.mockResolvedValue([
      { id: 10, login_id: 260001n, name: 'A', batch: '2026', religion: 'x' },
      { id: 11, login_id: 260002n, name: 'B', batch: '2026', religion: 'y' },
    ]);
    db.students.update.mockResolvedValue({});
    const out = rows(await SchoolService.rotateStudentPasswords(1));

    expect(db.students.findMany.mock.calls[0][0].where).toEqual({ school_id: 1 });
    expect(out.name).toBe('Rotated Passwords');
    expect(out.rows.map((r) => r['Login ID'])).toEqual(['260001', '260002']);
    expect(Object.keys(out.rows[0])).toEqual(['Login ID', 'Name', 'Batch', 'New Password']);
    for (const [i, call] of db.students.update.mock.calls.entries()) {
      const { where, data } = call[0];
      expect(where).toEqual({ id: [10, 11][i] });
      expect(data.tokenVersion).toEqual({ increment: 1 });
      const pw = String(out.rows[i]['New Password']);
      expect(pw).toHaveLength(8);
      expect(await bcrypt.compare(pw, data.password)).toBe(true);
    }
    expect(out.rows[0]['New Password']).not.toBe(out.rows[1]['New Password']);
  });
});

describe('SchoolService.exportStudentsExcel', () => {
  it('404s for an unknown school', async () => {
    db.school.findUnique.mockResolvedValue(null);
    await expect(SchoolService.exportStudentsExcel(1)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('maps the latest enrollment and blanks missing fields', async () => {
    db.school.findUnique.mockResolvedValue({ id: 1 });
    db.students.findMany.mockResolvedValue([
      {
        login_id: 260001n,
        name: 'A',
        batch: '2026',
        religion: 'Islam',
        available: true,
        father_name: 'F',
        enrollments: [{ class: 6, section: 'A', roll: 3 }],
      },
      {
        login_id: 260002n,
        name: 'B',
        batch: '2026',
        religion: 'Hindu',
        available: false,
        enrollments: [],
      },
    ]);
    const out = rows(await SchoolService.exportStudentsExcel(1));
    const q = db.students.findMany.mock.calls[0][0];
    expect(q.where).toEqual({ school_id: 1 });
    expect(q.include.enrollments).toEqual({ orderBy: { year: 'desc' }, take: 1 });
    expect(out.name).toBe('Students');
    expect(out.rows[0]).toMatchObject({
      'Login ID': '260001',
      Class: 6,
      Section: 'A',
      Roll: 3,
      'Father Name': 'F',
      Available: 'Yes',
    });
    expect(out.rows[1]).toMatchObject({ 'Login ID': '260002', Available: 'No' });
    expect(out.rows[1].Class ?? '').toBe('');
    expect(out.rows[0]).not.toHaveProperty('password');
  });
});
