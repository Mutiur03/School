import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient, VoucherType } from '@/generated/prisma/client.js';
import { rlsTransaction } from '@/config/prisma.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { CreateVoucherDto, VoucherLineDto } from './dto/create-voucher.dto.js';
import type { ListVouchersQueryDto } from './dto/list-vouchers-query.dto.js';
import type { UpdateVoucherDto } from './dto/update-voucher.dto.js';

// ponytail: id-based voucher no, gaps across tenants; add per-school sequence if auditors need contiguous numbers
const PREFIX: Record<VoucherType, string> = {
  receipt: 'RV',
  payment: 'PV',
  contra: 'CV',
  journal: 'JV',
};

const include = {
  lines: {
    orderBy: { id: 'asc' },
    include: {
      head: { select: { id: true, name: true, type: true } },
      cost_center: { select: { id: true, name: true } },
    },
  },
  fee_receipt: { select: { receipt_no: true } },
} satisfies Prisma.acc_vouchersInclude;

type VoucherRow = Prisma.acc_vouchersGetPayload<{ include: typeof include }>;

// Money compared/summed in integer paisa to avoid float drift.
const paisa = (x: number) => Math.round(x * 100);

const toResponse = (v: VoucherRow) => {
  const lines = v.lines.map((l) => ({
    id: l.id,
    head_id: l.head_id,
    head: l.head,
    cost_center_id: l.cost_center_id,
    cost_center: l.cost_center,
    debit: Number(l.debit),
    credit: Number(l.credit),
    note: l.note,
  }));
  return {
    fee_receipt_no: v.fee_receipt?.receipt_no ?? null,
    is_opening: v.is_opening,
    id: v.id,
    voucher_no: `${PREFIX[v.type]}-${v.id}`,
    type: v.type,
    date: v.date.toISOString().slice(0, 10),
    narration: v.narration,
    reference: v.reference,
    total: lines.reduce((sum, l) => sum + paisa(l.debit), 0) / 100,
    lines,
  };
};

const lineRows = (schoolId: number, lines: VoucherLineDto[]) =>
  lines.map((l) => ({
    school_id: schoolId,
    head_id: l.head_id,
    cost_center_id: l.cost_center_id ?? null,
    debit: l.debit ?? 0,
    credit: l.credit ?? 0,
    note: l.note ?? null,
  }));

@Injectable()
export class VoucherService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async findAll(schoolId: number, q: ListVouchersQueryDto) {
    const lineFilter = {
      ...(q.head_id && { head_id: q.head_id }),
      ...(q.cost_center_id && { cost_center_id: q.cost_center_id }),
    };
    const rows = await this.prisma.acc_vouchers.findMany({
      where: {
        school_id: schoolId,
        ...(q.type && { type: q.type }),
        ...((q.from || q.to) && {
          date: {
            ...(q.from && { gte: new Date(q.from) }),
            ...(q.to && { lte: new Date(q.to) }),
          },
        }),
        ...(Object.keys(lineFilter).length > 0 && { lines: { some: lineFilter } }),
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
      include,
    });
    return rows.map(toResponse);
  }

  async findOne(schoolId: number, id: number) {
    const row = await this.prisma.acc_vouchers.findUniqueOrThrow({
      where: { id, school_id: schoolId },
      include,
    });
    return toResponse(row);
  }

  async create(schoolId: number, dto: CreateVoucherDto) {
    await this.validate(schoolId, dto.type, dto.lines);
    const row = await this.prisma.acc_vouchers.create({
      data: {
        school_id: schoolId,
        type: dto.type,
        date: new Date(dto.date),
        narration: dto.narration ?? null,
        reference: dto.reference ?? null,
        lines: { create: lineRows(schoolId, dto.lines) },
      },
      include,
    });
    return toResponse(row);
  }

  async update(schoolId: number, id: number, dto: UpdateVoucherDto) {
    await this.assertNotFeeVoucher(schoolId, id);
    const { lines, date, ...rest } = dto;
    const where = { id, school_id: schoolId };
    const data = { ...rest, ...(date && { date: new Date(date) }) };

    if (dto.type || lines) {
      // Type and lines must stay consistent: fill in whichever half is missing from the stored voucher.
      const current =
        dto.type && lines
          ? null
          : await this.prisma.acc_vouchers.findUniqueOrThrow({ where, include: { lines: true } });
      await this.validate(
        schoolId,
        dto.type ?? current!.type,
        lines ??
          current!.lines.map((l) => ({
            head_id: l.head_id,
            cost_center_id: l.cost_center_id ?? undefined,
            debit: Number(l.debit),
            credit: Number(l.credit),
          })),
      );
    }

    if (!lines) {
      return toResponse(await this.prisma.acc_vouchers.update({ where, data, include }));
    }
    // Bare prisma.$transaction breaks RLS (see config/prisma.ts); rlsTransaction keeps one connection.
    const row = await rlsTransaction(async (tx) => {
      await tx.acc_voucher_lines.deleteMany({ where: { voucher_id: id, school_id: schoolId } });
      return tx.acc_vouchers.update({
        where,
        data: { ...data, lines: { create: lineRows(schoolId, lines) } },
        include,
      });
    });
    return toResponse(row);
  }

  async remove(schoolId: number, id: number) {
    await this.assertNotFeeVoucher(schoolId, id);
    await this.prisma.acc_vouchers.delete({ where: { id, school_id: schoolId } });
  }

  /** Fee-receipt and opening-balance vouchers are owned by their source: edit/delete it there. */
  private async assertNotFeeVoucher(schoolId: number, id: number) {
    const v = await this.prisma.acc_vouchers.findFirst({
      where: { id, school_id: schoolId },
      select: { is_opening: true, fee_receipt: { select: { receipt_no: true } } },
    });
    if (v?.fee_receipt) {
      throw new BadRequestException(
        `Posted by fee receipt #${v.fee_receipt.receipt_no}. Delete that receipt from Fees > Receipts instead.`,
      );
    }
    if (v?.is_opening) {
      throw new BadRequestException('Opening balances are edited on each account head.');
    }
  }

  private async validate(schoolId: number, type: VoucherType, lines: VoucherLineDto[]) {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const d = paisa(l.debit ?? 0);
      const c = paisa(l.credit ?? 0);
      if (d > 0 === c > 0) {
        throw new BadRequestException('Each line must have either a debit or a credit amount');
      }
      debit += d;
      credit += c;
    }
    if (debit !== credit) {
      throw new BadRequestException('Total debit must equal total credit');
    }
    if (debit <= 0) throw new BadRequestException('Voucher total must be greater than zero');

    // FK checks bypass RLS, so this school_id filter is the real tenant gate for heads/cost centers.
    const headIds = [...new Set(lines.map((l) => l.head_id))];
    const heads = await this.prisma.acc_heads.findMany({
      where: { id: { in: headIds }, school_id: schoolId },
      select: { id: true, is_cash_bank: true },
    });
    if (heads.length !== headIds.length) throw new BadRequestException('Unknown account head');

    const costCenterIds = [
      ...new Set(lines.flatMap((l) => (l.cost_center_id ? [l.cost_center_id] : []))),
    ];
    if (costCenterIds.length) {
      const found = await this.prisma.acc_cost_centers.count({
        where: { id: { in: costCenterIds }, school_id: schoolId },
      });
      if (found !== costCenterIds.length) throw new BadRequestException('Unknown cost center');
    }

    if (type === 'contra' && heads.some((h) => !h.is_cash_bank)) {
      throw new BadRequestException('Contra vouchers may only use cash/bank heads');
    }
    if (type !== 'journal' && !heads.some((h) => h.is_cash_bank)) {
      throw new BadRequestException(`A ${type} voucher needs a cash/bank head`);
    }
  }
}
