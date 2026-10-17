import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import {
  PDF_BASE_CSS,
  ddmmyyyy,
  esc,
  htmlToPdf,
  loadSchoolHeader,
  money,
  schoolHeaderHtml,
} from '../../common/school-pdf.js';
import {
  buildRows,
  paisa,
  taka,
  type Charge,
  type Paid,
  type Waiver,
} from '../fee-receipt/fee-calc.js';
import type { CollectionQueryDto, DuesQueryDto } from './dto/fee-report.dto.js';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const shift = (d: Date, days: number) => new Date(d.getTime() + days * 86_400_000);
const num = (v: unknown) => Number(v ?? 0);

@Injectable()
export class FeeReportService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  /** Money collected in a date range, cut by day, fee head, class and cash/bank account. */
  async collection(schoolId: number, q: CollectionQueryDto) {
    if (q.from > q.to) throw new BadRequestException('From date cannot be after to date');
    const date = { gte: day(q.from), lte: day(q.to) };
    const where = { school_id: schoolId, date };
    const [days, classes, accounts, heads, total] = await Promise.all([
      this.prisma.fee_receipts.groupBy({
        by: ['date'],
        where,
        _sum: { total: true },
        _count: true,
        orderBy: { date: 'asc' },
      }),
      this.prisma.fee_receipts.groupBy({
        by: ['class'],
        where,
        _sum: { total: true },
        _count: true,
        orderBy: { class: 'asc' },
      }),
      this.prisma.fee_receipts.groupBy({ by: ['pay_head_id'], where, _sum: { total: true } }),
      this.prisma.fee_receipt_items.groupBy({
        by: ['fee_head_id'],
        where: { school_id: schoolId, receipt: { date } },
        _sum: { amount: true, waiver: true },
        _count: true,
      }),
      this.prisma.fee_receipts.aggregate({ where, _sum: { total: true }, _count: true }),
    ]);
    const [headNames, accountNames] = await Promise.all([
      this.prisma.fee_heads.findMany({
        where: { school_id: schoolId, id: { in: heads.map((h) => h.fee_head_id) } },
        select: { id: true, name: true },
      }),
      this.prisma.acc_heads.findMany({
        where: { school_id: schoolId, id: { in: accounts.map((a) => a.pay_head_id) } },
        select: { id: true, name: true },
      }),
    ]);
    const headName = new Map(headNames.map((h) => [h.id, h.name]));
    const accountName = new Map(accountNames.map((h) => [h.id, h.name]));
    return {
      from: q.from,
      to: q.to,
      total: num(total._sum.total),
      count: total._count,
      by_day: days.map((d) => ({ date: iso(d.date), count: d._count, total: num(d._sum.total) })),
      by_class: classes.map((c) => ({ class: c.class, count: c._count, total: num(c._sum.total) })),
      by_account: accounts.map((a) => ({
        pay_head_id: a.pay_head_id,
        name: accountName.get(a.pay_head_id) ?? '',
        total: num(a._sum.total),
      })),
      by_head: heads
        .map((h) => ({
          fee_head_id: h.fee_head_id,
          name: headName.get(h.fee_head_id) ?? '',
          count: h._count,
          waiver: num(h._sum.waiver),
          total: num(h._sum.amount),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** Students of a class/section who still owe fees, with how much. */
  async dues(schoolId: number, q: DuesQueryDto) {
    const upto = q.upto_month ?? 12;
    const [enrollments, structures] = await Promise.all([
      this.prisma.student_enrollments.findMany({
        where: {
          school_id: schoolId,
          year: q.year,
          class: q.class,
          ...(q.section && { section: q.section }),
        },
        orderBy: [{ section: 'asc' }, { roll: 'asc' }],
        include: { student: { select: { id: true, name: true, login_id: true } } },
      }),
      this.prisma.fee_structures.findMany({
        where: {
          school_id: schoolId,
          year: q.year,
          class: q.class,
          fee_head: { is_active: true },
        },
        include: { fee_head: true },
      }),
    ]);
    const ids = enrollments.map((e) => e.student_id);
    const [waivers, items] = await Promise.all([
      this.prisma.fee_waivers.findMany({
        where: { school_id: schoolId, year: q.year, student_id: { in: ids } },
      }),
      this.prisma.fee_receipt_items.findMany({
        where: { school_id: schoolId, year: q.year, student_id: { in: ids } },
        select: { student_id: true, fee_head_id: true, month: true, amount: true },
      }),
    ]);

    const charges: Charge[] = structures.map((s) => ({
      fee_head_id: s.fee_head_id,
      fee_head: s.fee_head.name,
      frequency: s.fee_head.frequency,
      is_waivable: s.fee_head.is_waivable,
      sort_order: s.fee_head.sort_order,
      amount: Number(s.amount),
    }));
    const waiversOf = new Map<number, Waiver[]>();
    for (const w of waivers) {
      const list = waiversOf.get(w.student_id) ?? [];
      list.push({ fee_head_id: w.fee_head_id, percent: w.percent, value: Number(w.value) });
      waiversOf.set(w.student_id, list);
    }
    const paidOf = new Map<number, Map<string, Paid>>();
    for (const i of items) {
      const m = paidOf.get(i.student_id) ?? new Map<string, Paid>();
      m.set(`${i.fee_head_id}:${i.month}`, { receipt_no: 0, amount: Number(i.amount) });
      paidOf.set(i.student_id, m);
    }

    const rows = enrollments
      .map((e) => {
        const r = buildRows(
          charges,
          waiversOf.get(e.student_id) ?? [],
          paidOf.get(e.student_id) ?? new Map(),
          upto,
        );
        const sum = (pick: (x: (typeof r)[number]) => number) =>
          taka(r.reduce((t, x) => t + paisa(pick(x)), 0));
        return {
          student_id: e.student_id,
          name: e.student.name,
          login_id: Number(e.student.login_id),
          section: e.section,
          roll: e.roll,
          charge: sum((x) => x.charge),
          waiver: sum((x) => x.waiver),
          paid: sum((x) => x.paid_amount),
          due: sum((x) => (x.status === 'due' ? x.payable : 0)),
        };
      })
      .filter((r) => r.due > 0);
    return {
      year: q.year,
      class: q.class,
      section: q.section ?? null,
      upto_month: upto,
      rows,
      total_due: taka(rows.reduce((t, r) => t + paisa(r.due), 0)),
    };
  }

  /** Dashboard numbers for the school's `date`: today, month, year, last 7 days and latest receipts. */
  async summary(schoolId: number, date: string) {
    const d = day(date);
    const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(d.getUTCFullYear(), 11, 31));
    const sum = async (gte: Date, lte: Date) =>
      num(
        (
          await this.prisma.fee_receipts.aggregate({
            where: { school_id: schoolId, date: { gte, lte } },
            _sum: { total: true },
          })
        )._sum.total,
      );
    const [today, month, year, trend, latest] = await Promise.all([
      sum(d, d),
      sum(monthStart, monthEnd),
      sum(yearStart, yearEnd),
      this.prisma.fee_receipts.groupBy({
        by: ['date'],
        where: { school_id: schoolId, date: { gte: shift(d, -6), lte: d } },
        _sum: { total: true },
      }),
      this.prisma.fee_receipts.findMany({
        where: { school_id: schoolId },
        orderBy: [{ date: 'desc' }, { receipt_no: 'desc' }],
        take: 10,
        include: { student: { select: { name: true, login_id: true } } },
      }),
    ]);
    const byDay = new Map(trend.map((t) => [iso(t.date), num(t._sum.total)]));
    return {
      today,
      month,
      year,
      last_7_days: Array.from({ length: 7 }, (_, i) => {
        const key = iso(shift(d, i - 6));
        return { date: key, total: byDay.get(key) ?? 0 };
      }),
      latest: latest.map((r) => ({
        id: r.id,
        receipt_no: r.receipt_no,
        date: iso(r.date),
        total: Number(r.total),
        student: r.student,
        class: r.class,
        section: r.section,
        roll: r.roll,
      })),
    };
  }

  async collectionPdf(schoolId: number, q: CollectionQueryDto) {
    const [r, school] = await Promise.all([
      this.collection(schoolId, q),
      loadSchoolHeader(this.prisma, schoolId),
    ]);
    const table = (title: string, head: string[], rows: string[][]) => `
      <h3>${title}</h3>
      <table><thead><tr>${head.map((h, i) => `<th class="${i ? 'r' : ''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((c, i) => `<td class="${i ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_BASE_CSS}
      h2, h3 { margin: 10pt 0 4pt; } h2 { text-align: center; }</style></head><body>
      ${schoolHeaderHtml(school)}
      <h2>Fee Collection Report</h2>
      <p class="c">${ddmmyyyy(q.from)} to ${ddmmyyyy(q.to)} &nbsp;|&nbsp; ${r.count} receipts &nbsp;|&nbsp; Total ${money(r.total)}</p>
      ${table(
        'By fee head',
        ['Fee head', 'Installments', 'Waiver', 'Collected'],
        r.by_head.map((h) => [esc(h.name), String(h.count), money(h.waiver), money(h.total)]),
      )}
      ${table(
        'By class',
        ['Class', 'Receipts', 'Collected'],
        r.by_class.map((c) => [String(c.class), String(c.count), money(c.total)]),
      )}
      ${table(
        'By account',
        ['Account', 'Collected'],
        r.by_account.map((a) => [esc(a.name), money(a.total)]),
      )}
      ${table(
        'By day',
        ['Date', 'Receipts', 'Collected'],
        r.by_day.map((d) => [ddmmyyyy(d.date), String(d.count), money(d.total)]),
      )}
    </body></html>`;
    return { buffer: await htmlToPdf(html), name: `Fee_Collection_${q.from}_${q.to}` };
  }

  async duesPdf(schoolId: number, q: DuesQueryDto) {
    const [r, school] = await Promise.all([
      this.dues(schoolId, q),
      loadSchoolHeader(this.prisma, schoolId),
    ]);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>${PDF_BASE_CSS}
      h2 { text-align: center; margin: 10pt 0 2pt; }</style></head><body>
      ${schoolHeaderHtml(school)}
      <h2>Fee Due List</h2>
      <p class="c">Class ${r.class}${r.section ? ` / Section ${esc(r.section)}` : ''} &nbsp;|&nbsp; Session ${r.year} &nbsp;|&nbsp; Monthly fees up to month ${r.upto_month}</p>
      <table><thead><tr><th>SL</th><th>Roll</th><th>Section</th><th>Name</th><th>ID</th>
        <th class="r">Charge</th><th class="r">Waiver</th><th class="r">Paid</th><th class="r">Due</th></tr></thead>
      <tbody>${r.rows
        .map(
          (
            x,
            i,
          ) => `<tr><td>${i + 1}</td><td>${x.roll}</td><td>${esc(x.section)}</td><td>${esc(x.name)}</td><td>${x.login_id}</td>
          <td class="r">${money(x.charge)}</td><td class="r">${money(x.waiver)}</td><td class="r">${money(x.paid)}</td><td class="r">${money(x.due)}</td></tr>`,
        )
        .join('')}
      <tr><td colspan="8" class="r"><b>Total due</b></td><td class="r"><b>${money(r.total_due)}</b></td></tr></tbody></table>
    </body></html>`;
    return {
      buffer: await htmlToPdf(html, { landscape: true }),
      name: `Fee_Dues_Class_${r.class}`,
    };
  }
}
