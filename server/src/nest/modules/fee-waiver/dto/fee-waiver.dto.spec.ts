import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateFeeWaiverDto } from './create-fee-waiver.dto.js';
import { UpdateFeeWaiverDto } from './update-fee-waiver.dto.js';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const valid = { student_id: 7, year: 2026, value: 100 };

describe('CreateFeeWaiverDto', () => {
  it.each([
    [{}],
    [{ ...valid, value: 0 }],
    [{ ...valid, value: -5 }],
    [{ ...valid, value: 1.234 }],
    [{ ...valid, percent: 'yes' }],
    [{ ...valid, year: 1999 }],
    [{ ...valid, note: 'x'.repeat(256) }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateFeeWaiverDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([[valid], [{ ...valid, fee_head_id: 3, percent: true, value: 25, note: 'orphan' }]])(
    'accepts %j',
    async (body) => {
      await expect(run(body, CreateFeeWaiverDto)).resolves.toMatchObject(body);
    },
  );
});

describe('UpdateFeeWaiverDto', () => {
  it('accepts a partial body', async () => {
    await expect(run({ value: 50 }, UpdateFeeWaiverDto)).resolves.toMatchObject({ value: 50 });
  });

  it('cannot move a waiver to another student', async () => {
    await expect(run({ student_id: 9 }, UpdateFeeWaiverDto)).rejects.toMatchObject({ status: 400 });
  });
});
