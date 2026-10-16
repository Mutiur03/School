import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import {
  PublicExamsQueryDto,
  PublicResultQueryDto,
  PublicResultVerifyDto,
} from './public-result.dto.js';

// Same options as the global pipe in bootstrap.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (
  value: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: ArgumentMetadata['type'] = 'body',
) => pipe.transform(value, { type, metatype });
const rejects = (value: unknown, metatype: ArgumentMetadata['metatype'], type?: any) =>
  expect(run(value, metatype, type)).rejects.toMatchObject({ status: 400 });

describe('public result DTOs', () => {
  it.each([
    [{ year: '26', class: '6' }, PublicExamsQueryDto],
    [{ year: '2026', class: '11' }, PublicExamsQueryDto],
    [{ year: '1999', class: '6' }, PublicExamsQueryDto],
    [{ year: '2026', exam: '  ' }, PublicResultQueryDto],
    [{ exam: 'Annual' }, PublicResultQueryDto],
  ])('rejects query %j', async (query, metatype) => rejects(query, metatype, 'query'));

  it('parses exams + result queries', async () => {
    await expect(run({ year: '2026', class: '6' }, PublicExamsQueryDto, 'query')).resolves.toEqual({
      year: 2026,
      class: 6,
    });
    await expect(
      run({ year: '2026', exam: ' Annual ' }, PublicResultQueryDto, 'query'),
    ).resolves.toEqual({ year: 2026, exam: 'Annual' });
  });

  const verify = { year: 2026, class: 6, section: 'a', roll: 12, phone: '01712345678' };
  it.each([
    [{ ...verify, year: undefined }],
    [{ ...verify, class: 0 }],
    [{ ...verify, section: 'AB' }],
    [{ ...verify, roll: '' }],
    [{ ...verify, phone: '0171234567' }],
    [{ ...verify, token: 'x' }],
  ])('PublicResultVerifyDto rejects %j', async (body) => rejects(body, PublicResultVerifyDto));

  it('normalizes the verify body and accepts session/mobile aliases', async () => {
    const expected = { year: 2026, class: 6, section: 'A', roll: 12, phone: '01712345678' };
    await expect(run(verify, PublicResultVerifyDto)).resolves.toEqual(expected);
    await expect(
      run(
        { session: '2026', class: '6', section: ' a ', roll: '12', mobile: '01712345678' },
        PublicResultVerifyDto,
      ),
    ).resolves.toMatchObject(expected);
  });
});
