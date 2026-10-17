import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { assertYearOpen } from '../../common/period-lock.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateFeeReceiptDto, ListReceiptsQueryDto } from './dto/fee-receipt.dto.js';
import { FeeDueService } from './fee-due.service.js';
import { paisa, taka } from './fee-calc.js';

const MONTHS = [
  'One-off',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const include = {
  student: { select: { id: true, name: true, login_id: true, father_name: true } },
  items: {
    orderBy: [{ fee_head_id: 'asc' }, { month: 'asc' }],
    include: {
      fee_head: { select: { id: true, name: true } },
      deposit_head: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.fee_receiptsInclude;

/** Cash/bank accounts a receipt's money went into, with the amount each received. */
const accountsOf = (items: { amount: unknown; deposit_head: { id: number; name: string } }[]) => {
  const byId = new Map<number, { id: number; name: string; amount: number }>();
  for (const i of items) {
    const cur = byId.get(i.deposit_head.id) ?? { ...i.deposit_head, amount: 0 };
    cur.amount = taka(paisa(cur.amount) + paisa(Number(i.amount)));
    byId.set(cur.id, cur);
  }
  return [...byId.values()];
};

type ReceiptRow = Awaited<ReturnType<FeeReceiptService['load']>>;

const toResponse = (r: ReceiptRow) => ({
  id: r.id,
  receipt_no: r.receipt_no,
  date: r.date.toISOString().slice(0, 10),
  year: r.year,
  class: r.class,
  section: r.section,
  roll: r.roll,
  total: Number(r.total),
  note: r.note,
  student: r.student,
  accounts: accountsOf(r.items),
  voucher_id: r.voucher_id,
  voucher_no: `RV-${r.voucher_id}`,
  items: r.items.map((i) => ({
    fee_head_id: i.fee_head_id,
    fee_head: i.fee_head.name,
    month: i.month,
    charge: Number(i.charge),
    waiver: Number(i.waiver),
    amount: Number(i.amount),
  })),
});
export type ReceiptView = ReturnType<typeof toResponse>;

@Injectable()
export class FeeReceiptService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly dues: FeeDueService,
  ) {}

  private load(schoolId: number, id: number) {
    return this.prisma.fee_receipts.findFirstOrThrow({
      where: { id, school_id: schoolId },
      include,
    });
  }

  async findAll(schoolId: number, q: ListReceiptsQueryDto) {
    const rows = await this.prisma.fee_receipts.findMany({
      where: {
        school_id: schoolId,
        ...(q.class && { class: q.class }),
        ...(q.section && { section: q.section }),
        ...(q.student_id && { student_id: q.student_id }),
        ...(q.receipt_no && { receipt_no: q.receipt_no }),
        ...((q.from || q.to) && {
          date: {
            ...(q.from && { gte: new Date(q.from) }),
            ...(q.to && { lte: new Date(q.to) }),
          },
        }),
      },
      orderBy: [{ date: 'desc' }, { receipt_no: 'desc' }],
      take: 500,
      include: {
        student: include.student,
        items: { select: { amount: true, deposit_head: { select: { id: true, name: true } } } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      receipt_no: r.receipt_no,
      date: r.date.toISOString().slice(0, 10),
      year: r.year,
      class: r.class,
      section: r.section,
      roll: r.roll,
      total: Number(r.total),
      student: r.student,
      accounts: accountsOf(r.items),
      voucher_no: `RV-${r.voucher_id}`,
    }));
  }

  async findOne(schoolId: number, id: number) {
    return toResponse(await this.load(schoolId, id));
  }

  /**
   * Collects the chosen installments. Charge and waiver are recomputed server-side from the fee
   * structure; the client only says which installments to pay. Each installment goes to its fee head's
   * fixed deposit account, or to `pay_head_id` when the fee head has none. Posts one receipt voucher:
   * Dr each deposit account, Cr each fee head's income account.
   */
  async create(schoolId: number, userId: number | undefined, dto: CreateFeeReceiptDto) {
    await assertYearOpen(this.prisma, schoolId, dto.date);
    const keys = dto.items.map((i) => `${i.fee_head_id}:${i.month}`);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Duplicate installment');

    const statement = await this.dues.statement(schoolId, dto.student_id, dto.year);
    const picked = dto.items.map((i) => {
      const row = statement.rows.find(
        (r) => r.fee_head_id === i.fee_head_id && r.month === i.month,
      );
      if (!row) throw new BadRequestException('Fee is not charged to this student');
      const label = `${row.fee_head} (${MONTHS[row.month]})`;
      if (row.status === 'paid') throw new BadRequestException(`${label} is already paid`);
      if (row.status === 'waived') throw new BadRequestException(`${label} is fully waived`);
      return row;
    });

    // Where each installment's money goes: the fee head's own account, else the one picked at collection.
    const depositOf = new Map<string, number>();
    for (const p of picked) {
      const deposit = p.deposit?.id ?? dto.pay_head_id;
      if (deposit === undefined) {
        throw new BadRequestException(
          `Pick the cash/bank account for ${p.fee_head} (it has no fixed deposit account)`,
        );
      }
      depositOf.set(`${p.fee_head_id}:${p.month}`, deposit);
    }
    const depositIds = [...new Set(depositOf.values())];

    // FK checks bypass RLS, so these school_id filters are the real tenant gate.
    const [validDeposits, feeHeads] = await Promise.all([
      this.prisma.acc_heads.count({
        where: { id: { in: depositIds }, school_id: schoolId, is_cash_bank: true, is_active: true },
      }),
      this.prisma.fee_heads.findMany({
        where: { id: { in: picked.map((p) => p.fee_head_id) }, school_id: schoolId },
        select: { id: true, income_head_id: true },
      }),
    ]);
    if (validDeposits !== depositIds.length) {
      throw new BadRequestException('Deposit accounts must be active cash/bank accounts');
    }
    const incomeOf = new Map(feeHeads.map((h) => [h.id, h.income_head_id]));

    const debits = new Map<number, number>();
    const credits = new Map<number, number>();
    let total = 0;
    for (const p of picked) {
      const deposit = depositOf.get(`${p.fee_head_id}:${p.month}`)!;
      const incomeHead = incomeOf.get(p.fee_head_id)!;
      debits.set(deposit, (debits.get(deposit) ?? 0) + paisa(p.payable));
      credits.set(incomeHead, (credits.get(incomeHead) ?? 0) + paisa(p.payable));
      total += paisa(p.payable);
    }

    const { student, enrollment } = statement;
    // ponytail: max+1 receipt no; a concurrent create hits the unique index (→ 409), and deleting
    // the latest receipt frees its number. Add a per-school counter row if auditors need gap-free numbers.
    const id = await rlsTransaction(async (tx) => {
      const last = await tx.fee_receipts.aggregate({
        where: { school_id: schoolId },
        _max: { receipt_no: true },
      });
      const receiptNo = (last._max.receipt_no ?? 0) + 1;
      const voucher = await tx.acc_vouchers.create({
        data: {
          school_id: schoolId,
          type: 'receipt',
          date: new Date(dto.date),
          narration: `Fee receipt #${receiptNo} - ${student.name} (Class ${enrollment.class}, Roll ${enrollment.roll})`,
          reference: `FR-${receiptNo}`,
          created_by: userId ?? null,
          lines: {
            create: [
              ...[...debits].map(([head_id, p]) => ({
                school_id: schoolId,
                head_id,
                debit: taka(p),
                note: `Fee receipt #${receiptNo}`,
              })),
              ...[...credits].map(([head_id, p]) => ({
                school_id: schoolId,
                head_id,
                credit: taka(p),
                note: `Fee receipt #${receiptNo}`,
              })),
            ],
          },
        },
      });
      const receipt = await tx.fee_receipts.create({
        data: {
          school_id: schoolId,
          receipt_no: receiptNo,
          student_id: student.id,
          year: dto.year,
          class: enrollment.class,
          section: enrollment.section,
          roll: enrollment.roll,
          date: new Date(dto.date),
          total: taka(total),
          voucher_id: voucher.id,
          note: dto.note ?? null,
          created_by: userId ?? null,
          items: {
            create: picked.map((p) => ({
              school_id: schoolId,
              student_id: student.id,
              year: dto.year,
              fee_head_id: p.fee_head_id,
              month: p.month,
              charge: p.charge,
              waiver: p.waiver,
              amount: p.payable,
              deposit_head_id: depositOf.get(`${p.fee_head_id}:${p.month}`)!,
            })),
          },
        },
      });
      return receipt.id;
    });
    return this.findOne(schoolId, id);
  }

  /** Deletes the receipt and its voucher together, so the ledger never keeps an orphan entry. */
  async remove(schoolId: number, id: number) {
    await rlsTransaction(async (tx) => {
      const { voucher_id, date } = await tx.fee_receipts.findFirstOrThrow({
        where: { id, school_id: schoolId },
        select: { voucher_id: true, date: true },
      });
      await assertYearOpen(tx, schoolId, date);
      await tx.fee_receipts.delete({ where: { id, school_id: schoolId } });
      await tx.acc_vouchers.delete({ where: { id: voucher_id, school_id: schoolId } });
    });
  }
}
