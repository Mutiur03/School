import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { CreateFeeReceiptDto, ListReceiptsQueryDto, StatementQueryDto } from './fee-receipt.dto.js';

// Same options as the global pipe in bootstrap.ts. Over HTTP the guard runs first, so test the pipe directly.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const run = (
  body: unknown,
  metatype: ArgumentMetadata['metatype'],
  type: 'body' | 'query' = 'body',
) => pipe.transform(body, { type, metatype });

const valid = {
  student_id: 7,
  year: 2026,
  date: '2026-03-05',
  pay_head_id: 10,
  items: [{ fee_head_id: 1, month: 3 }],
};

describe('CreateFeeReceiptDto', () => {
  it.each([
    [{}],
    [{ ...valid, items: [] }],
    [{ ...valid, items: [{ fee_head_id: 1, month: 13 }] }],
    [{ ...valid, items: [{ fee_head_id: 1, month: -1 }] }],
    [{ ...valid, items: [{ fee_head_id: 1 }] }],
    [{ ...valid, date: '05/03/2026' }],
    [{ ...valid, year: 1999 }],
    [{ ...valid, note: 'x'.repeat(256) }],
    [{ ...valid, total: 1 }], // client may not send amounts
    [{ ...valid, items: [{ fee_head_id: 1, month: 1, amount: 5 }] }],
    [{ ...valid, school_id: 2 }],
  ])('rejects %j → 400', async (body) => {
    await expect(run(body, CreateFeeReceiptDto)).rejects.toMatchObject({ status: 400 });
  });

  it.each([[valid], [{ ...valid, note: 'cash', items: [{ fee_head_id: 1, month: 0 }] }]])(
    'accepts %j',
    async (body) => {
      await expect(run(body, CreateFeeReceiptDto)).resolves.toMatchObject(body);
    },
  );
});

describe('ListReceiptsQueryDto', () => {
  it('coerces numeric query strings', async () => {
    await expect(
      run({ class: '8', receipt_no: '12' }, ListReceiptsQueryDto, 'query'),
    ).resolves.toMatchObject({
      class: 8,
      receipt_no: 12,
    });
  });

  it('rejects a non-date from', async () => {
    await expect(run({ from: 'x' }, ListReceiptsQueryDto, 'query')).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('StatementQueryDto', () => {
  it('needs student_id and year', async () => {
    await expect(run({ student_id: '7' }, StatementQueryDto, 'query')).rejects.toMatchObject({
      status: 400,
    });
    await expect(
      run({ student_id: '7', year: '2026' }, StatementQueryDto, 'query'),
    ).resolves.toMatchObject({
      student_id: 7,
      year: 2026,
    });
  });
});
