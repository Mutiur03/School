import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateHolidayDto } from './create-holiday.dto.js';
import { UpdateHolidayDto } from './update-holiday.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const valid = { title: 'Eid', start_date: '2026-03-30', end_date: '2026-04-01' };

describe('CreateHolidayDto', () => {
  it.each([
    [{}],
    [{ title: 'x' }],
    [{ title: 'x', start_date: '2026-01-01' }],
    [{ start_date: '2026-01-01', end_date: '2026-01-02' }],
    [{ ...valid, start_date: 'not-a-date' }],
    [{ ...valid, is_optional: 'yes' }],
    [{ ...valid, role: 'admin' }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateHolidayDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [valid],
    [{ ...valid, description: 'desc' }],
  ])('accepts %j → 200', async (body) => {
    await expect(run(body, CreateHolidayDto)).resolves.toMatchObject(body);
  });

  it('accepts is_optional true', async () => {
    await expect(run({ ...valid, is_optional: true }, CreateHolidayDto)).resolves.toMatchObject({
      ...valid,
      is_optional: true,
    });
  });
});

describe('UpdateHolidayDto', () => {
  it('accepts partial body', async () => {
    await expect(run({ title: 'New' }, UpdateHolidayDto)).resolves.toMatchObject({ title: 'New' });
  });

  it('rejects unknown fields', async () => {
    await expect(run({ school_id: 2 }, UpdateHolidayDto)).rejects.toMatchObject({ status: 400 });
  });
});
