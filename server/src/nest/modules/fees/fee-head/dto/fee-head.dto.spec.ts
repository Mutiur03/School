import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateFeeHeadDto } from './create-fee-head.dto.js';
import { UpdateFeeHeadDto } from './update-fee-head.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const valid = { name: 'Tuition', income_head_id: 20 };

describe('CreateFeeHeadDto', () => {
  it.each([
    [{}],
    [{ name: '', income_head_id: 20 }],
    [{ name: 'x'.repeat(101), income_head_id: 20 }],
    [{ ...valid, frequency: 'weekly' }],
    [{ ...valid, sort_order: -1 }],
    [{ ...valid, is_waivable: 'yes' }],
    [{ ...valid, deposit_head_id: 'bank' }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateFeeHeadDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [valid],
    [{ name: 'Tuition' }], // income account omitted → created for the fee
    [{ ...valid, frequency: 'once', is_waivable: false, sort_order: 3, is_active: true }],
    [{ ...valid, deposit_head_id: 30 }],
    [{ ...valid, deposit_head_id: null }],
  ])('accepts %j', async (body) => {
    await expect(run(body, CreateFeeHeadDto)).resolves.toMatchObject(body);
  });
});

describe('UpdateFeeHeadDto', () => {
  it('accepts a partial body', async () => {
    await expect(run({ is_active: false }, UpdateFeeHeadDto)).resolves.toMatchObject({
      is_active: false,
    });
  });

  it('rejects unknown fields', async () => {
    await expect(run({ school_id: 2 }, UpdateFeeHeadDto)).rejects.toMatchObject({ status: 400 });
  });
});
