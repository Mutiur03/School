import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CollectionQueryDto, DuesQueryDto, SummaryQueryDto } from './fee-report.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'query', metatype });

describe('CollectionQueryDto', () => {
  it.each([[{}], [{ from: '2026-03-01' }], [{ from: '1/3/2026', to: '2026-03-02' }]])(
    'rejects %j',
    async (q) => {
      await expect(run(q, CollectionQueryDto)).rejects.toMatchObject({ status: 400 });
    },
  );

  it('accepts a range', async () => {
    await expect(
      run({ from: '2026-03-01', to: '2026-03-31' }, CollectionQueryDto),
    ).resolves.toMatchObject({ from: '2026-03-01' });
  });
});

describe('DuesQueryDto', () => {
  it.each([
    [{}],
    [{ year: '2026' }],
    [{ year: '2026', class: '8', upto_month: '13' }],
    [{ year: '2026', class: '8', section: 'AB' }],
  ])('rejects %j', async (q) => {
    await expect(run(q, DuesQueryDto)).rejects.toMatchObject({ status: 400 });
  });

  it('coerces numbers', async () => {
    await expect(
      run({ year: '2026', class: '8', upto_month: '3', section: 'A' }, DuesQueryDto),
    ).resolves.toMatchObject({
      year: 2026,
      class: 8,
      upto_month: 3,
      section: 'A',
    });
  });
});

describe('SummaryQueryDto', () => {
  it('needs a YYYY-MM-DD date', async () => {
    await expect(run({}, SummaryQueryDto)).rejects.toMatchObject({ status: 400 });
    await expect(run({ date: '2026-03-05' }, SummaryQueryDto)).resolves.toMatchObject({
      date: '2026-03-05',
    });
  });
});
