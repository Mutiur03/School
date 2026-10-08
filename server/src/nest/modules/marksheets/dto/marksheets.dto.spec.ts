import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { SectionExamQueryDto } from './marksheet-query.dto.js';

// Same options as the global pipe in bootstrap.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (
  value: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: ArgumentMetadata['type'] = 'body',
) => pipe.transform(value, { type, metatype });
const rejects = (value: unknown, metatype: ArgumentMetadata['metatype'], type?: any) =>
  expect(run(value, metatype, type)).rejects.toMatchObject({ status: 400 });

describe('SectionExamQueryDto (strings from the query string)', () => {
  it.each([
    [{}],
    [{ year: '2026' }],
    [{ year: '2026', exam: '' }],
    [{ year: 'x', exam: 'Annual' }],
    [{ year: '2026', exam: 'Annual', foo: '1' }],
  ])('rejects %j', async (query) => rejects(query, SectionExamQueryDto, 'query'));

  it.each([
    [
      { year: '2026', exam: 'Annual' },
      { year: 2026, exam: 'Annual' },
    ],
    [
      { year: '2026', exam: 'Annual', section: 'A' },
      { year: 2026, exam: 'Annual', section: 'A' },
    ],
  ])('parses %j', async (query, expected) => {
    await expect(run(query, SectionExamQueryDto, 'query')).resolves.toEqual(expected);
  });
});
