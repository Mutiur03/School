import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  REGISTRATION_NO,
  isValidDateOfBirth,
  parseDateOfBirth,
  testimonialExamOptions,
  testimonialRequiresRollRegistration,
  toIsoDateString,
  type TestimonialData,
} from '@school/shared-schemas';
import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import { CertificatePdfService } from './certificate-pdf.service.js';
import type { CreateCertificateDto } from './dto/create-certificate.dto.js';
import type { FindCertificateDto } from './dto/find-certificate.dto.js';
import type { ListCertificateDto } from './dto/list-certificate.dto.js';
import type { UpdateCertificateDto } from './dto/update-certificate.dto.js';

const kindOf = (exam: string) => (exam === 'SSC' || exam === 'JSC' ? 'board' : 'class');
const bad = (message: string): never => {
  throw new BadRequestException(message);
};

/** Trims strings, drops empty optionals, normalises DOB to YYYY-MM-DD, enforces exam/roll/GPA/DOB rules. */
function clean(input: CreateCertificateDto): CreateCertificateDto {
  const d = Object.fromEntries(
    Object.entries(input).flatMap(([k, v]) => {
      const value = typeof v === 'string' ? v.trim() : v;
      return value === '' || value === undefined ? [] : [[k, value]];
    }),
  ) as unknown as CreateCertificateDto;
  const kind = kindOf(d.exam);
  if (d.passing_year > new Date().getFullYear()) bad('Passing year cannot be in the future');
  if (!testimonialExamOptions(kind, d.passing_year).includes(d.exam)) {
    bad(`Not available for passing year ${d.passing_year}`);
  }
  if (!isValidDateOfBirth(d.dob)) bad('Enter a valid date of birth');
  d.dob = toIsoDateString(parseDateOfBirth(d.dob)!);
  if (testimonialRequiresRollRegistration(d.exam, d.passing_year)) {
    if (!d.roll || !/^\d{6}$/.test(d.roll)) bad('Roll number must be 6 digits');
    if (!d.registration_no || !REGISTRATION_NO.test(d.registration_no)) {
      bad('Registration number must be 10 digits');
    }
  } else {
    delete d.roll;
    delete d.registration_no;
  }
  if (kind === 'board') {
    const gpa = Number(d.gpa);
    if (!d.gpa || !/^\d(\.\d{1,2})?$/.test(d.gpa) || gpa < 1 || gpa > 5) {
      bad('GPA must be 1.00 – 5.00');
    }
  } else {
    delete d.gpa;
  }
  return d;
}

/** The form fields, one real column each (same on certificates and certificate_revisions). */
const FIELDS = {
  exam: true,
  passing_year: true,
  student_name_bn: true,
  student_name_en: true,
  father_name_bn: true,
  father_name_en: true,
  mother_name_bn: true,
  mother_name_en: true,
  address_district: true,
  address_upazila: true,
  address_post_office: true,
  address_post_office_bn: true,
  address_post_code: true,
  address_village_road: true,
  address_village_road_bn: true,
  mobile: true,
  dob: true,
  gender: true,
  roll: true,
  registration_no: true,
  gpa: true,
} as const;
type Row = Prisma.certificatesGetPayload<{ select: typeof FIELDS }>;

/** Validated form → column values. */
const toRow = (d: CreateCertificateDto) => ({
  exam: d.exam,
  passing_year: d.passing_year,
  student_name_bn: d.student_name_bn,
  student_name_en: d.student_name_en,
  father_name_bn: d.father_name_bn,
  father_name_en: d.father_name_en,
  mother_name_bn: d.mother_name_bn,
  mother_name_en: d.mother_name_en,
  address_district: d.address_district,
  address_upazila: d.address_upazila,
  address_post_office: d.address_post_office,
  address_post_office_bn: d.address_post_office_bn,
  address_post_code: d.address_post_code,
  address_village_road: d.address_village_road,
  address_village_road_bn: d.address_village_road_bn,
  mobile: d.mobile,
  dob: new Date(d.dob),
  gender: d.gender ?? null,
  roll: d.roll ?? null,
  registration_no: d.registration_no ?? null,
  gpa: d.gpa ?? null,
});

/** Column values → the form shape the API, PDF and diff work with (empty optionals omitted). */
const toData = ({
  dob,
  gender,
  roll,
  registration_no,
  gpa,
  ...rest
}: Row): CreateCertificateDto => ({
  ...rest,
  dob: dob.toISOString().slice(0, 10),
  ...(gender && { gender: gender as CreateCertificateDto['gender'] }),
  ...(roll && { roll }),
  ...(registration_no && { registration_no }),
  ...(gpa && { gpa: gpa.toFixed(2) }),
});

/** Node reports IPv4 clients as "::ffff:1.2.3.4"; store the plain address. */
const plainIp = (ip?: string) => ip?.replace(/^::ffff:/, '');

/** Fields whose value differs between two versions. */
function diff(before: CreateCertificateDto, after: CreateCertificateDto) {
  const a = before as unknown as Record<string, unknown>;
  const b = after as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((field) => a[field] !== b[field])
    .map((field) => ({ field, from: a[field] ?? null, to: b[field] ?? null }));
}

@Injectable()
export class CertificateService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly pdf: CertificatePdfService,
  ) {}

  async create(schoolId: number, dto: CreateCertificateDto, ip?: string) {
    const data = clean(dto);
    const { id, ...saved } = await this.prisma.certificates.create({
      data: { school_id: schoolId, created_ip: plainIp(ip), ...toRow(data) },
      select: { id: true, ...FIELDS },
    });
    return { id, data: toData(saved) };
  }

  /** Public lookup: the year + mobile + DOB triple is the proof of ownership. */
  async findAll(schoolId: number, q: FindCertificateDto) {
    const rows = await this.prisma.certificates.findMany({
      where: {
        school_id: schoolId,
        passing_year: Number(q.passing_year),
        mobile: q.mobile,
        dob: new Date(q.dob),
      },
      select: { id: true, ...FIELDS },
      orderBy: { updated_at: 'desc' },
    });
    return rows.map(({ id, ...row }) => ({ id, data: toData(row) }));
  }

  /** Copies the current row into certificate_revisions (with the editor's IP), then applies the edit. */
  async update(schoolId: number, id: string, dto: UpdateCertificateDto, ip?: string) {
    const current = await this.prisma.certificates.findUniqueOrThrow({
      where: { id, school_id: schoolId },
      select: FIELDS,
    });
    const data = clean({ ...toData(current), ...dto });
    // Re-saving identical data is not an edit: no revision, nothing written.
    if (!diff(toData(current), data).length) return { id, data };
    const [, { id: savedId, ...saved }] = await this.prisma.$transaction([
      this.prisma.certificate_revisions.create({
        data: {
          school_id: schoolId,
          certificate_id: id,
          ...current,
          ip: plainIp(ip),
        },
      }),
      this.prisma.certificates.update({
        where: { id, school_id: schoolId },
        data: toRow(data),
        select: { id: true, ...FIELDS },
      }),
    ]);
    return { id: savedId, data: toData(saved) };
  }

  /** Admin: one filtered, sorted page of certificates plus the totals the list header needs. */
  async findAllForAdmin(schoolId: number, q: ListCertificateDto) {
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    const page = Math.max(Number(q.page) || 1, 1);
    const dir = q.order ?? (q.sort ? 'asc' : 'desc');
    const sortBy = {
      name: { student_name_en: dir },
      exam: { exam: dir },
      year: { passing_year: dir },
      mobile: { mobile: dir },
      updated: { updated_at: dir },
      edits: { revisions: { _count: dir } },
    }[q.sort ?? 'updated'];
    const where = {
      school_id: schoolId,
      ...(q.name && {
        student_name_en: { contains: q.name.trim(), mode: 'insensitive' as const },
      }),
      ...(q.mobile && { mobile: { contains: q.mobile } }),
      ...(q.exam && { exam: { in: q.exam.split(',') } }),
      ...(q.year && { passing_year: { in: q.year.split(',').map(Number) } }),
      ...(q.edits && { revisions: q.edits === 'edited' ? { some: {} } : { none: {} } }),
    };
    const [rows, total, totalAll, editedCount, exams, years] = await Promise.all([
      this.prisma.certificates.findMany({
        where,
        select: {
          id: true,
          ...FIELDS,
          created_at: true,
          updated_at: true,
          created_ip: true,
          _count: { select: { revisions: true } },
        },
        orderBy: [sortBy, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.certificates.count({ where }),
      this.prisma.certificates.count({ where: { school_id: schoolId } }),
      this.prisma.certificates.count({
        where: { school_id: schoolId, revisions: { some: {} } },
      }),
      this.prisma.certificates.findMany({
        where: { school_id: schoolId },
        distinct: ['exam'],
        select: { exam: true },
      }),
      this.prisma.certificates.findMany({
        where: { school_id: schoolId },
        distinct: ['passing_year'],
        select: { passing_year: true },
        orderBy: { passing_year: 'desc' },
      }),
    ]);
    return {
      items: rows.map(({ id, created_at, updated_at, created_ip, _count, ...row }) => ({
        id,
        created_at,
        updated_at,
        created_ip,
        edits: _count.revisions,
        data: toData(row),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        totalAll,
        editedCount,
        exams: exams.map((e) => e.exam),
        years: years.map((y) => y.passing_year),
      },
    };
  }

  /** Admin: each edit as a field-level diff (before → after), oldest first. */
  async history(schoolId: number, id: string) {
    const [current, revisions] = await Promise.all([
      this.prisma.certificates.findUniqueOrThrow({
        where: { id, school_id: schoolId },
        select: FIELDS,
      }),
      this.prisma.certificate_revisions.findMany({
        where: { certificate_id: id, school_id: schoolId },
        select: { id: true, ip: true, created_at: true, ...FIELDS },
        orderBy: { id: 'asc' },
      }),
    ]);
    // Revision i holds the data before edit i, so edit i = revision i → revision i+1 (or current).
    const versions = [
      ...revisions.map(({ id: _id, ip: _ip, created_at: _at, ...row }) => row),
      current,
    ];
    return revisions.map(({ id, ip, created_at }, i) => ({
      id,
      ip,
      created_at,
      changes: diff(toData(versions[i]), toData(versions[i + 1])),
    }));
  }

  /** Admin: deletes the certificate; its revisions go with it (ON DELETE CASCADE). */
  async remove(schoolId: number, id: string) {
    await this.prisma.certificates.delete({ where: { id, school_id: schoolId } });
  }

  async generatePdf(schoolId: number, id: string, withAddress = false) {
    const row = await this.prisma.certificates.findUniqueOrThrow({
      where: { id, school_id: schoolId },
      select: FIELDS,
    });
    const data = toData(row);
    const buffer = await this.pdf.generate(
      schoolId,
      { ...data, kind: kindOf(data.exam) } as TestimonialData,
      withAddress,
    );
    return { buffer, name: data.student_name_en.replace(/[^A-Za-z0-9]+/g, '_') };
  }
}
