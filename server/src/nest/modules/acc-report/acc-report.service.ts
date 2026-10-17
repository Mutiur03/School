import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AccHeadType, Prisma, PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import type { LedgerQueryDto, ReportQueryDto } from './dto/report-query.dto.js';

type Head = {
  id: number;
  code: string | null;
  name: string;
  type: AccHeadType;
  parent_id: number | null;
};
type Sum = { debit: unknown; credit: unknown } | null | undefined;

const TYPE_ORDER: AccHeadType[] = ['asset', 'liability', 'equity', 'income', 'expense'];
const VOUCHER_PREFIX = { receipt: 'RV', payment: 'PV', contra: 'CV', journal: 'JV' } as const;
const HEAD_SELECT = { id: true, code: true, name: true, type: true, parent_id: true } as const;

/** Trial-balance line for earlier years' results that have not been closed into equity yet. */
const PRIOR_UNCLOSED = 'Prior years (not closed)';

const r2 = (n: number) => Math.round(n * 100) / 100 || 0; // `|| 0` turns -0 into 0
const net = (s: Sum) => Number(s?.debit ?? 0) - Number(s?.credit ?? 0); // debit - credit
const sum = (rows: { amount: number }[]) => r2(rows.reduce((t, r) => t + r.amount, 0));

/** Date range filter on the voucher, only with the bounds that were given. */
const dateRange = (q: ReportQueryDto) => {
  if (q.from && q.to && new Date(q.from) > new Date(q.to)) {
    throw new BadRequestException('From date cannot be after to date');
  }
  return {
    ...(q.from && { gte: new Date(q.from) }),
    ...(q.to && { lte: new Date(q.to) }),
  };
};

@Injectable()
export class AccReportService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /**
   * Net (debit - credit) per head over the range, joined to the school's heads. Zero-net heads
   * dropped. `voucher` adds extra voucher filters (the year-closing rules below).
   */
  private async headNets(
    schoolId: number,
    date: Prisma.DateTimeFilter,
    voucher: Prisma.acc_vouchersWhereInput = {},
  ) {
    const [groups, heads] = await Promise.all([
      this.prisma.acc_voucher_lines.groupBy({
        by: ['head_id'],
        where: { school_id: schoolId, voucher: { date, ...voucher } },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.acc_heads.findMany({ where: { school_id: schoolId }, select: HEAD_SELECT }),
    ]);
    const byId = new Map<number, Head>(heads.map((h) => [h.id, h]));
    return groups
      .map((g) => ({ head: byId.get(g.head_id), net: r2(net(g._sum)) }))
      .filter((x): x is { head: Head; net: number } => !!x.head && x.net !== 0);
  }

  async ledger(schoolId: number, q: LedgerQueryDto) {
    const date = dateRange(q);
    const head = await this.prisma.acc_heads.findFirst({
      where: { id: q.head_id, school_id: schoolId },
      select: { id: true, name: true, type: true },
    });
    if (!head) throw new NotFoundException('Account head not found');

    const where = { school_id: schoolId, head_id: head.id };
    const [before, lines] = await Promise.all([
      q.from
        ? this.prisma.acc_voucher_lines.aggregate({
            where: { ...where, voucher: { date: { lt: new Date(q.from) } } },
            _sum: { debit: true, credit: true },
          })
        : null,
      this.prisma.acc_voucher_lines.findMany({
        where: { ...where, voucher: { date } },
        include: { voucher: { select: { id: true, type: true, date: true, narration: true } } },
        orderBy: [{ voucher: { date: 'asc' } }, { voucher_id: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const opening = net(before?._sum);
    let balance = opening;
    const rows = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      balance += debit - credit;
      return {
        voucher_id: l.voucher.id,
        voucher_no: `${VOUCHER_PREFIX[l.voucher.type]}-${l.voucher.id}`,
        date: l.voucher.date.toISOString().slice(0, 10),
        type: l.voucher.type,
        narration: l.voucher.narration,
        note: l.note,
        debit: r2(debit),
        credit: r2(credit),
        balance: r2(balance),
      };
    });
    return { head, opening: r2(opening), rows, closing: r2(balance) };
  }

  /**
   * Income/expense over from..to; asset, liability and equity heads cumulative up to `to`. A
   * year-closing voucher dated inside from..to is left out (it would zero the very year being
   * shown); earlier years' closings stay in, so Retained Earnings carries their results.
   */
  async trialBalance(schoolId: number, q: ReportQueryDto) {
    const closing: Prisma.acc_vouchersWhereInput = q.from
      ? { NOT: { is_closing: true, date: { gte: new Date(q.from) } } }
      : {};
    const [period, cumulative, before] = await Promise.all([
      this.headNets(schoolId, dateRange(q), closing),
      this.headNets(schoolId, dateRange({ to: q.to }), closing),
      // income/expense before `from` (closing vouchers included, so closed years net to zero)
      q.from ? this.headNets(schoolId, { lt: new Date(q.from) }) : [],
    ]);
    const isPeriod = (t: AccHeadType) => t === 'income' || t === 'expense';
    const nets = [
      ...period.filter((x) => isPeriod(x.head.type)),
      ...cumulative.filter((x) => !isPeriod(x.head.type)),
    ];
    // Results of earlier years that were never closed: they are in the balance-sheet heads but not
    // yet in equity, so show them as their own line and the trial balance still balances.
    const unclosed = r2(before.filter((x) => isPeriod(x.head.type)).reduce((t, x) => t + x.net, 0));
    if (unclosed !== 0) {
      nets.push({
        head: { id: 0, code: null, name: PRIOR_UNCLOSED, type: 'equity', parent_id: null },
        net: unclosed,
      });
    }
    const rows = nets
      .sort(
        (a, b) =>
          TYPE_ORDER.indexOf(a.head.type) - TYPE_ORDER.indexOf(b.head.type) ||
          a.head.name.localeCompare(b.head.name),
      )
      .map(({ head, net }) => ({
        head_id: head.id,
        code: head.code,
        name: head.name,
        type: head.type,
        parent_id: head.parent_id,
        debit: net > 0 ? net : 0,
        credit: net < 0 ? -net : 0,
      }));
    return {
      rows,
      total_debit: sum(rows.map((r) => ({ amount: r.debit }))),
      total_credit: sum(rows.map((r) => ({ amount: r.credit }))),
    };
  }

  async incomeExpense(schoolId: number, q: ReportQueryDto) {
    // year-closing vouchers only move results into equity, so they never count as income/expense
    const nets = await this.headNets(schoolId, dateRange(q), { is_closing: false });
    const income = this.section(nets, 'income', -1);
    const expense = this.section(nets, 'expense', 1);
    const total_income = sum(income);
    const total_expense = sum(expense);
    return { income, expense, total_income, total_expense, net: r2(total_income - total_expense) };
  }

  async balanceSheet(schoolId: number, q: ReportQueryDto) {
    // Cumulative up to `to`; `from` is ignored on purpose.
    const nets = await this.headNets(schoolId, dateRange({ to: q.to }));
    const assets = this.section(nets, 'asset', 1);
    const liabilities = this.section(nets, 'liability', -1);
    const equity = this.section(nets, 'equity', -1);
    const surplus = r2(
      sum(this.section(nets, 'income', -1)) - sum(this.section(nets, 'expense', 1)),
    );
    return {
      assets,
      liabilities,
      equity,
      surplus,
      total_assets: sum(assets),
      total_liabilities_equity: r2(sum(liabilities) + sum(equity) + surplus),
    };
  }

  async costCenter(schoolId: number, q: ReportQueryDto) {
    const date = dateRange(q);
    const [groups, heads, centers] = await Promise.all([
      this.prisma.acc_voucher_lines.groupBy({
        by: ['cost_center_id', 'head_id'],
        where: { school_id: schoolId, cost_center_id: { not: null }, voucher: { date } },
        _sum: { debit: true, credit: true },
      }),
      this.prisma.acc_heads.findMany({
        where: { school_id: schoolId },
        select: { id: true, type: true },
      }),
      this.prisma.acc_cost_centers.findMany({
        where: { school_id: schoolId },
        select: { id: true, name: true },
      }),
    ]);
    const headType = new Map(heads.map((h) => [h.id, h.type]));
    const totals = new Map<number, { income: number; expense: number }>();
    for (const g of groups) {
      const type = headType.get(g.head_id);
      if (g.cost_center_id === null || (type !== 'income' && type !== 'expense')) continue;
      const t = totals.get(g.cost_center_id) ?? { income: 0, expense: 0 };
      if (type === 'income') t.income -= net(g._sum);
      else t.expense += net(g._sum);
      totals.set(g.cost_center_id, t);
    }
    const rows = centers
      .filter((c) => totals.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => {
        const { income, expense } = totals.get(c.id)!;
        return {
          cost_center_id: c.id,
          cost_center_name: c.name,
          income: r2(income),
          expense: r2(expense),
          net: r2(income - expense),
        };
      });
    return { rows };
  }

  /** Heads of one type; sign 1 → debit-credit, -1 → credit-debit. */
  private section(nets: { head: Head; net: number }[], type: AccHeadType, sign: 1 | -1) {
    return nets
      .filter((x) => x.head.type === type)
      .sort((a, b) => a.head.name.localeCompare(b.head.name))
      .map(({ head, net }) => ({
        head_id: head.id,
        name: head.name,
        parent_id: head.parent_id,
        amount: r2(sign * net),
      }));
  }
}
