import { jest } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';

type Fn = (args?: any) => Promise<any>;

// Fake Prisma injected through the constructor: no DB, no tenant.
const t = {
  fee_receipts: {
    findFirstOrThrow: jest.fn<Fn>(),
    findMany: jest.fn<Fn>(),
    aggregate: jest.fn<Fn>(),
    create: jest.fn<Fn>(),
    delete: jest.fn<Fn>(),
  },
  acc_vouchers: { create: jest.fn<Fn>(), delete: jest.fn<Fn>() },
  acc_heads: { count: jest.fn<Fn>() },
  acc_years: { findFirst: jest.fn<Fn>() },
  fee_heads: { findMany: jest.fn<Fn>() },
};
const prisma = t as unknown as PrismaClient;

// ESM: mock before importing the service. rlsTransaction just hands the fake client to the callback.
jest.unstable_mockModule('@/config/prisma.js', () => ({
  prisma,
  rlsTransaction: (fn: (tx: unknown) => unknown) => fn(prisma),
}));
const { FeeReceiptService } = await import('./fee-receipt.service.js');
const statement = jest.fn<Fn>();
const service = new FeeReceiptService(prisma, { statement } as any);

const row = (o: object) => ({
  fee_head_id: 1,
  fee_head: 'Tuition',
  month: 1,
  charge: 500,
  waiver: 100,
  payable: 400,
  status: 'due',
  receipt_no: null,
  paid_amount: 0,
  deposit: null,
  ...o,
});
const stmt = (rows: object[]) => ({
  student: { id: 7, name: 'Rafi', login_id: 1001 },
  enrollment: { year: 2026, class: 8, section: 'A', roll: 3 },
  rows,
  totals: { waiver: 0, paid: 0, due: 0 },
});
const dto = {
  student_id: 7,
  year: 2026,
  date: '2026-03-05',
  pay_head_id: 10,
  items: [{ fee_head_id: 1, month: 1 }],
};
const bankA = { id: 11, name: 'Bank A' };

const stored = {
  id: 55,
  receipt_no: 12,
  date: new Date('2026-03-05'),
  year: 2026,
  class: 8,
  section: 'A',
  roll: 3,
  total: 400,
  note: null,
  student: { id: 7, name: 'Rafi', login_id: 1001, father_name: null },
  voucher_id: 90,
  items: [
    {
      fee_head_id: 1,
      fee_head: { id: 1, name: 'Tuition' },
      deposit_head: { id: 10, name: 'Cash' },
      month: 1,
      charge: 500,
      waiver: 100,
      amount: 400,
    },
  ],
};

beforeEach(() => {
  statement.mockResolvedValue(stmt([row({})]));
  t.acc_heads.count.mockResolvedValue(1);
  t.fee_heads.findMany.mockResolvedValue([{ id: 1, income_head_id: 20 }]);
  t.fee_receipts.aggregate.mockResolvedValue({ _max: { receipt_no: 11 } });
  t.acc_vouchers.create.mockResolvedValue({ id: 90 });
  t.fee_receipts.create.mockResolvedValue({ id: 55 });
  t.fee_receipts.findFirstOrThrow.mockResolvedValue(stored);
});
afterEach(() => jest.resetAllMocks());

const voucherLines = () => t.acc_vouchers.create.mock.calls[0][0].data.lines.create;

describe('FeeReceiptService.create', () => {
  it('recomputes amounts from the statement and posts Dr cash / Cr income', async () => {
    const res = await service.create(1, 3, dto);

    expect(statement).toHaveBeenCalledWith(1, 7, 2026);
    expect(t.acc_vouchers.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        school_id: 1,
        type: 'receipt',
        reference: 'FR-12',
        created_by: 3,
        lines: {
          create: [
            { school_id: 1, head_id: 10, debit: 400, note: 'Fee receipt #12' },
            { school_id: 1, head_id: 20, credit: 400, note: 'Fee receipt #12' },
          ],
        },
      }),
    });
    expect(t.fee_receipts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        school_id: 1,
        receipt_no: 12,
        class: 8,
        section: 'A',
        roll: 3,
        total: 400,
        voucher_id: 90,
        items: {
          create: [
            expect.objectContaining({
              fee_head_id: 1,
              month: 1,
              charge: 500,
              waiver: 100,
              amount: 400,
              deposit_head_id: 10,
            }),
          ],
        },
      }),
    });
    expect(res).toMatchObject({
      id: 55,
      receipt_no: 12,
      voucher_no: 'RV-90',
      total: 400,
      accounts: [{ id: 10, name: 'Cash', amount: 400 }],
    });
  });

  it('first receipt of a school gets number 1', async () => {
    t.fee_receipts.aggregate.mockResolvedValue({ _max: { receipt_no: null } });
    await service.create(1, undefined, dto);
    expect(t.fee_receipts.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ receipt_no: 1, created_by: null }),
    });
  });

  it('groups credits by income head', async () => {
    statement.mockResolvedValue(
      stmt([
        row({}),
        row({ month: 2 }),
        row({ fee_head_id: 2, fee_head: 'Exam', month: 0, payable: 250 }),
      ]),
    );
    t.fee_heads.findMany.mockResolvedValue([
      { id: 1, income_head_id: 20 },
      { id: 2, income_head_id: 21 },
    ]);
    await service.create(1, 3, {
      ...dto,
      items: [
        { fee_head_id: 1, month: 1 },
        { fee_head_id: 1, month: 2 },
        { fee_head_id: 2, month: 0 },
      ],
    });
    expect(voucherLines()).toEqual([
      expect.objectContaining({ head_id: 10, debit: 1050 }),
      expect.objectContaining({ head_id: 20, credit: 800 }),
      expect.objectContaining({ head_id: 21, credit: 250 }),
    ]);
  });

  describe('deposit accounts', () => {
    const tuitionAtBankA = row({ deposit: bankA });
    const examAtCash = row({ fee_head_id: 2, fee_head: 'Exam', month: 0, payable: 250 });
    const mixedItems = [
      { fee_head_id: 1, month: 1 },
      { fee_head_id: 2, month: 0 },
    ];
    beforeEach(() => {
      t.fee_heads.findMany.mockResolvedValue([
        { id: 1, income_head_id: 20 },
        { id: 2, income_head_id: 21 },
      ]);
    });

    it('a fee with a fixed deposit account goes there; the rest use the account picked at collection', async () => {
      statement.mockResolvedValue(stmt([tuitionAtBankA, examAtCash]));
      t.acc_heads.count.mockResolvedValue(2);

      await service.create(1, 3, { ...dto, items: mixedItems });

      expect(t.acc_heads.count).toHaveBeenCalledWith({
        where: { id: { in: [11, 10] }, school_id: 1, is_cash_bank: true, is_active: true },
      });
      // one debit per deposit account, one credit per income account; both sides balance
      expect(voucherLines()).toEqual([
        expect.objectContaining({ head_id: 11, debit: 400 }),
        expect.objectContaining({ head_id: 10, debit: 250 }),
        expect.objectContaining({ head_id: 20, credit: 400 }),
        expect.objectContaining({ head_id: 21, credit: 250 }),
      ]);
      const items = t.fee_receipts.create.mock.calls[0][0].data.items.create;
      expect(items.map((i: any) => [i.fee_head_id, i.deposit_head_id])).toEqual([
        [1, 11],
        [2, 10],
      ]);
    });

    it('needs no pay_head_id when every fee has its own deposit account', async () => {
      statement.mockResolvedValue(
        stmt([tuitionAtBankA, { ...examAtCash, deposit: { id: 12, name: 'Bank B' } }]),
      );
      t.acc_heads.count.mockResolvedValue(2);
      const { pay_head_id: _unused, ...withoutPayHead } = dto;

      await service.create(1, 3, { ...withoutPayHead, items: mixedItems });

      expect(
        voucherLines()
          .filter((l: any) => l.debit)
          .map((l: any) => l.head_id),
      ).toEqual([11, 12]);
    });

    it('a fixed account wins over the account picked at collection', async () => {
      statement.mockResolvedValue(stmt([tuitionAtBankA]));
      await service.create(1, 3, dto); // dto.pay_head_id = 10
      expect(voucherLines()[0]).toMatchObject({ head_id: 11, debit: 400 });
    });

    it('asks for an account when a fee has no fixed one and none was picked', async () => {
      statement.mockResolvedValue(stmt([tuitionAtBankA, examAtCash]));
      const { pay_head_id: _unused, ...withoutPayHead } = dto;
      await expect(service.create(1, 3, { ...withoutPayHead, items: mixedItems })).rejects.toThrow(
        'Pick the cash/bank account for Exam',
      );
      expect(t.acc_vouchers.create).not.toHaveBeenCalled();
    });

    it('rejects when any deposit account is not an active cash/bank account of this school', async () => {
      statement.mockResolvedValue(stmt([tuitionAtBankA, examAtCash]));
      t.acc_heads.count.mockResolvedValue(1); // 2 distinct accounts, only 1 valid
      await expect(service.create(1, 3, { ...dto, items: mixedItems })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(t.acc_vouchers.create).not.toHaveBeenCalled();
    });
  });

  it.each([
    [
      'duplicate installment',
      [
        { fee_head_id: 1, month: 1 },
        { fee_head_id: 1, month: 1 },
      ],
      'Duplicate',
    ],
    ['unknown fee', [{ fee_head_id: 9, month: 1 }], 'not charged'],
  ])('rejects %s', async (_n, items, message) => {
    await expect(service.create(1, 3, { ...dto, items })).rejects.toThrow(message);
    expect(t.acc_vouchers.create).not.toHaveBeenCalled();
  });

  it.each([
    ['paid', 'already paid'],
    ['waived', 'fully waived'],
  ])('rejects a %s installment', async (status, message) => {
    statement.mockResolvedValue(stmt([row({ status })]));
    await expect(service.create(1, 3, dto)).rejects.toThrow(message);
  });

  it('rejects a pay head that is not an active cash/bank account of this school', async () => {
    t.acc_heads.count.mockResolvedValue(0);
    await expect(service.create(1, 3, dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(t.acc_heads.count).toHaveBeenCalledWith({
      where: { id: { in: [10] }, school_id: 1, is_cash_bank: true, is_active: true },
    });
  });

  it('unique-index race (P2002) bubbles up for the global filter', async () => {
    t.fee_receipts.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(service.create(1, 3, dto)).rejects.toMatchObject({ code: 'P2002' });
  });
});

describe('FeeReceiptService reads and delete', () => {
  it('findOne scopes by id and school_id and sums money per account', async () => {
    t.fee_receipts.findFirstOrThrow.mockResolvedValue({
      ...stored,
      items: [
        ...stored.items,
        { ...stored.items[0], month: 2, amount: 400 },
        { ...stored.items[0], deposit_head: { id: 11, name: 'Bank A' }, month: 3, amount: 100 },
      ],
    });
    const res = await service.findOne(1, 55);
    expect(t.fee_receipts.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 55, school_id: 1 } }),
    );
    expect(res.items[0]).toMatchObject({ fee_head: 'Tuition', amount: 400 });
    expect(res.accounts).toEqual([
      { id: 10, name: 'Cash', amount: 800 },
      { id: 11, name: 'Bank A', amount: 100 },
    ]);
    expect(res.date).toBe('2026-03-05');
  });

  it('findAll filters by school and date range', async () => {
    t.fee_receipts.findMany.mockResolvedValue([]);
    await service.findAll(1, { from: '2026-03-01', to: '2026-03-31', class: 8 });
    expect(t.fee_receipts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          school_id: 1,
          class: 8,
          date: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') },
        },
        take: 500,
      }),
    );
  });

  it('findAll lists the accounts each receipt used', async () => {
    t.fee_receipts.findMany.mockResolvedValue([
      {
        ...stored,
        items: [
          { amount: 400, deposit_head: { id: 10, name: 'Cash' } },
          { amount: 100, deposit_head: { id: 11, name: 'Bank A' } },
        ],
      },
    ]);
    const [r] = await service.findAll(1, {});
    expect(r.accounts.map((a) => a.name)).toEqual(['Cash', 'Bank A']);
    expect(r).not.toHaveProperty('items');
  });

  it('remove deletes the receipt first, then its voucher, both scoped to the school', async () => {
    t.fee_receipts.findFirstOrThrow.mockResolvedValue({ voucher_id: 90 });
    const order: string[] = [];
    t.fee_receipts.delete.mockImplementation(async () => void order.push('receipt'));
    t.acc_vouchers.delete.mockImplementation(async () => void order.push('voucher'));
    await service.remove(1, 55);
    expect(order).toEqual(['receipt', 'voucher']);
    expect(t.fee_receipts.delete).toHaveBeenCalledWith({ where: { id: 55, school_id: 1 } });
    expect(t.acc_vouchers.delete).toHaveBeenCalledWith({ where: { id: 90, school_id: 1 } });
  });

  it('remove in a closed year → 400, nothing deleted', async () => {
    t.fee_receipts.findFirstOrThrow.mockResolvedValue({
      voucher_id: 90,
      date: new Date('2026-03-05'),
    });
    t.acc_years.findFirst.mockResolvedValue({ year: 2026 });
    await expect(service.remove(1, 55)).rejects.toThrow('Year 2026 is closed');
    expect(t.fee_receipts.delete).not.toHaveBeenCalled();
    expect(t.acc_vouchers.delete).not.toHaveBeenCalled();
  });

  it('create dated in a closed year → 400 before any work', async () => {
    t.acc_years.findFirst.mockResolvedValue({ year: 2026 });
    await expect(service.create(1, 5, dto)).rejects.toThrow('Year 2026 is closed');
    expect(t.fee_receipts.create).not.toHaveBeenCalled();
    expect(t.acc_vouchers.create).not.toHaveBeenCalled();
  });

  it('remove of a missing receipt bubbles P2025 and deletes nothing', async () => {
    t.fee_receipts.findFirstOrThrow.mockRejectedValue(
      Object.assign(new Error('x'), { code: 'P2025' }),
    );
    await expect(service.remove(1, 99)).rejects.toMatchObject({ code: 'P2025' });
    expect(t.acc_vouchers.delete).not.toHaveBeenCalled();
  });
});
