import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateAccHeadDto } from './create-acc-head.dto.js';
import { UpdateAccHeadDto } from './update-acc-head.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const valid = { name: 'Cash', type: 'asset' };

describe('CreateAccHeadDto', () => {
  it.each([
    [{}],
    [{ name: 'Cash' }],
    [{ type: 'asset' }],
    [{ ...valid, name: '' }],
    [{ ...valid, name: 'x'.repeat(151) }],
    [{ ...valid, type: 'revenue' }],
    [{ ...valid, code: 'x'.repeat(21) }],
    [{ ...valid, parent_id: '1' }],
    [{ ...valid, parent_id: 1.5 }],
    [{ ...valid, is_cash_bank: 'yes' }],
    [{ ...valid, bank_name: 'x'.repeat(151) }],
    [{ ...valid, account_no: 'x'.repeat(51) }],
    [{ ...valid, is_active: 1 }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateAccHeadDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [valid],
    [
      {
        ...valid,
        code: '1001',
        parent_id: 3,
        is_cash_bank: true,
        bank_name: 'Sonali Bank',
        account_no: '0123456789',
        is_active: false,
      },
    ],
  ])('accepts %j', async (body) => {
    await expect(run(body, CreateAccHeadDto)).resolves.toMatchObject(body);
  });
});

describe('UpdateAccHeadDto', () => {
  it('accepts partial body', async () => {
    await expect(run({ name: 'New' }, UpdateAccHeadDto)).resolves.toMatchObject({ name: 'New' });
  });

  it.each([[{ school_id: 2 }], [{ type: 'revenue' }]])('rejects %j → 400', async (body) => {
    await expect(run(body, UpdateAccHeadDto)).rejects.toMatchObject({ status: 400 });
  });
});
