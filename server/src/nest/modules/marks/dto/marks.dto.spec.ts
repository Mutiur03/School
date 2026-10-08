import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { BulkUpdateFourthSubjectDto, UpdateFourthSubjectDto } from './fourth-subject.dto.js';
import { ExamQueryDto, YearQueryDto } from '../../../common/query.dto.js';
import { ClassMarksQueryDto, RosterQueryDto } from './marks-query.dto.js';
import { SaveMarksDto } from './save-marks.dto.js';

// Same options as the global pipe in bootstrap.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (
  value: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: ArgumentMetadata['type'] = 'body',
) => pipe.transform(value, { type, metatype });
const rejects = (value: unknown, metatype: ArgumentMetadata['metatype'], type?: any) =>
  expect(run(value, metatype, type)).rejects.toMatchObject({ status: 400 });

const mark = { subjectId: 3, cq_marks: 40, mcq_marks: null, marks: 70 };
const save = {
  students: [{ studentId: 1, subjectMarks: [mark] }],
  examName: 'Half Yearly',
  year: 2026,
};

describe('SaveMarksDto', () => {
  it.each([
    [{}],
    [{ ...save, students: 'x' }],
    [{ ...save, examName: '' }],
    [{ ...save, year: 'abc' }],
    [{ ...save, students: [{ subjectMarks: [mark] }] }],
    [{ ...save, students: [{ studentId: 1, subjectMarks: [{ ...mark, subjectId: undefined }] }] }],
    [{ ...save, students: [{ studentId: 1, subjectMarks: [{ ...mark, cq_marks: -1 }] }] }],
    [{ ...save, students: [{ studentId: 1, subjectMarks: [{ ...mark, marks: 1.5 }] }] }],
    [{ ...save, students: [{ studentId: 1, subjectMarks: [{ ...mark, school_id: 2 }] }] }],
    [{ ...save, school_id: 2 }],
  ])('rejects %j → 400', async (body) => rejects(body, SaveMarksDto));

  it('accepts nulls/omitted parts and a string year', async () => {
    const out = await run({ ...save, year: '2026' }, SaveMarksDto);
    expect(out).toMatchObject({ ...save, year: 2026 });
  });
});

describe('fourth subject DTOs', () => {
  it.each([
    [{}],
    [{ year: 2026, subjectId: 'x' }],
    [{ year: 2026, subjectId: 0 }],
    [{ year: 2026, studentId: 1 }],
  ])('UpdateFourthSubjectDto rejects %j', async (body) => rejects(body, UpdateFourthSubjectDto));

  it.each([[{ year: 2026, subjectId: 5 }], [{ year: 2026, subjectId: null }], [{ year: 2026 }]])(
    'UpdateFourthSubjectDto accepts %j',
    async (body) => expect(run(body, UpdateFourthSubjectDto)).resolves.toEqual(body),
  );

  const bulk = { class: 9, year: 2026, group: 'Science', subjectId: null };
  it.each([
    [{ ...bulk, class: 8 }],
    [{ ...bulk, group: 'Arts' }],
    [{ ...bulk, group: undefined }],
    [{ ...bulk, year: 1999 }],
    [{ ...bulk, subjectId: 'x' }],
  ])('BulkUpdateFourthSubjectDto rejects %j', async (body) =>
    rejects(body, BulkUpdateFourthSubjectDto),
  );

  it('BulkUpdateFourthSubjectDto accepts class 10 + subject', async () => {
    const body = { ...bulk, class: 10, subjectId: 4 };
    await expect(run(body, BulkUpdateFourthSubjectDto)).resolves.toEqual(body);
  });
});

describe('marks query DTOs (strings from the query string)', () => {
  it.each([
    [{}, YearQueryDto],
    [{ year: 'x' }, YearQueryDto],
    [{ year: '2026' }, ExamQueryDto],
    [{ year: '2026', exam: '' }, ExamQueryDto],
    [{ year: '2026', exam: 'Annual' }, ClassMarksQueryDto],
    [{ year: '2026', class: '' }, RosterQueryDto],
    [{ year: '2026', class: '6', foo: '1' }, RosterQueryDto],
  ])('rejects %j', async (query, metatype) => rejects(query, metatype, 'query'));

  it.each([
    [{ year: '2026', class: '6' }, RosterQueryDto, { year: 2026, class: 6 }],
    [
      { year: '2026', class: '6', section: 'A' },
      RosterQueryDto,
      { year: 2026, class: 6, section: 'A' },
    ],
    [
      { year: '2026', class: '9', exam: 'Annual' },
      ClassMarksQueryDto,
      { year: 2026, class: 9, exam: 'Annual' },
    ],
  ])('parses %j', async (query, metatype, expected) => {
    await expect(run(query, metatype, 'query')).resolves.toEqual(expected);
  });
});
