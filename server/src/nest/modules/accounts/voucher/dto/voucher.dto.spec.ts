import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateVoucherDto } from './create-voucher.dto.js';
import { ListVouchersQueryDto } from './list-vouchers-query.dto.js';
import { UpdateVoucherDto } from './update-voucher.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true });
const run = (body: unknown, metatype: ArgumentMetadata['metatype']) =>
  pipe.transform(body, { type: 'body', metatype });

const lines = [
  { head_id: 1, debit: 100 },
  { head_id: 2, credit: 100 },
];
const valid = { type: 'payment', date: '2026-03-30', lines };

describe('CreateVoucherDto', () => {
  it.each([
    ['missing lines', { type: 'payment', date: '2026-03-30' }],
    ['one line', { ...valid, lines: [lines[0]] }],
    ['negative amount', { ...valid, lines: [{ head_id: 1, debit: -5 }, lines[1]] }],
    ['bad type', { ...valid, type: 'refund' }],
    ['unknown field', { ...valid, school_id: 2 }],
    ['unknown line field', { ...valid, lines: [{ ...lines[0], school_id: 2 }, lines[1]] }],
    ['3 decimal places', { ...valid, lines: [{ head_id: 1, debit: 1.005 }, lines[1]] }],
    ['date with time', { ...valid, date: '2026-03-30T10:00:00Z' }],
    ['bad date', { ...valid, date: '2026-13-45' }],
    ['string head_id', { ...valid, lines: [{ head_id: '1', debit: 100 }, lines[1]] }],
    ['long reference', { ...valid, reference: 'x'.repeat(101) }],
  ])('rejects %s → 400', async (_name, body) => {
    await expect(run(body, CreateVoucherDto)).rejects.toMatchObject({ status: 400 });
  });

  it('accepts a valid voucher', async () => {
    const body = { ...valid, narration: 'Rent', reference: 'CHQ-1' };
    await expect(run(body, CreateVoucherDto)).resolves.toMatchObject(body);
  });
});

describe('UpdateVoucherDto', () => {
  it('accepts partial body', async () => {
    await expect(run({ narration: 'x' }, UpdateVoucherDto)).resolves.toMatchObject({
      narration: 'x',
    });
  });

  it('still requires 2+ lines when lines given', async () => {
    await expect(run({ lines: [lines[0]] }, UpdateVoucherDto)).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('ListVouchersQueryDto', () => {
  const query = (value: unknown) =>
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }).transform(
      value,
      { type: 'query', metatype: ListVouchersQueryDto },
    );

  it('converts numeric query strings', async () => {
    await expect(query({ head_id: '5', from: '2026-01-01' })).resolves.toMatchObject({
      head_id: 5,
      from: '2026-01-01',
    });
  });

  it.each([[{ head_id: 'abc' }], [{ type: 'x' }], [{ foo: '1' }]])('rejects %j', async (q) => {
    await expect(query(q)).rejects.toMatchObject({ status: 400 });
  });
});
