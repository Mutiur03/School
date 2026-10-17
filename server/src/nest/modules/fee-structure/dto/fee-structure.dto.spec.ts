import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CopyStructureDto, SetStructureDto, StructureQueryDto } from './fee-structure.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (
  body: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: 'body' | 'query' = 'body',
) => pipe.transform(body, { type, metatype });

const valid = { year: 2026, class: 8, items: [{ fee_head_id: 1, amount: 500 }] };

describe('SetStructureDto', () => {
  it.each([
    [{}],
    [{ ...valid, class: 0 }],
    [{ ...valid, class: 13 }],
    [{ ...valid, year: 1999 }],
    [{ ...valid, items: [{ fee_head_id: 1, amount: 0 }] }],
    [{ ...valid, items: [{ fee_head_id: 1, amount: 10.123 }] }],
    [{ ...valid, items: [{ fee_head_id: 1 }] }],
    [{ ...valid, items: 'x' }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, SetStructureDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([[valid], [{ ...valid, items: [] }]])('accepts %j', async (body) => {
    await expect(run(body, SetStructureDto)).resolves.toMatchObject(body);
  });
});

describe('StructureQueryDto', () => {
  it('needs year; class optional', async () => {
    await expect(run({}, StructureQueryDto, 'query')).rejects.toMatchObject({ status: 400 });
    await expect(
      run({ year: '2026', class: '8' }, StructureQueryDto, 'query'),
    ).resolves.toMatchObject({
      year: 2026,
      class: 8,
    });
  });
});

describe('CopyStructureDto', () => {
  it('needs both years', async () => {
    await expect(run({ from_year: 2026 }, CopyStructureDto)).rejects.toMatchObject({ status: 400 });
    await expect(run({ from_year: 2026, to_year: 2027 }, CopyStructureDto)).resolves.toBeDefined();
  });
});
