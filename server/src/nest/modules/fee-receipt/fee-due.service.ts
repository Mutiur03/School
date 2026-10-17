import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { PrismaClient } from '@/generated/prisma/client.js';
import { PRISMA } from '../../common/prisma.module.js';
import { buildRows, paisa, taka, type Charge, type Paid } from './fee-calc.js';

/** What one student owes and has paid in one session year. */
@Injectable()
export class FeeDueService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async statement(schoolId: number, studentId: number, year: number) {
    const enrollment = await this.prisma.student_enrollments.findFirst({
      where: { school_id: schoolId, student_id: studentId, year },
      orderBy: { class: 'desc' },
      include: {
        student: { select: { id: true, name: true, login_id: true, father_name: true } },
      },
    });
    if (!enrollment) throw new NotFoundException('Student is not enrolled in this year');

    const [structures, waivers, items] = await Promise.all([
      this.prisma.fee_structures.findMany({
        where: {
          school_id: schoolId,
          year,
          class: enrollment.class,
          fee_head: { is_active: true },
        },
        include: { fee_head: true },
      }),
      this.prisma.fee_waivers.findMany({
        where: { school_id: schoolId, student_id: studentId, year },
      }),
      this.prisma.fee_receipt_items.findMany({
        where: { school_id: schoolId, student_id: studentId, year },
        include: { receipt: { select: { receipt_no: true } } },
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
    const paid = new Map<string, Paid>(
      items.map((i) => [
        `${i.fee_head_id}:${i.month}`,
        { receipt_no: i.receipt.receipt_no, amount: Number(i.amount) },
      ]),
    );
    const rows = buildRows(
      charges,
      waivers.map((w) => ({
        fee_head_id: w.fee_head_id,
        percent: w.percent,
        value: Number(w.value),
      })),
      paid,
    );
    const sum = (pick: (r: (typeof rows)[number]) => number) =>
      taka(rows.reduce((t, r) => t + paisa(pick(r)), 0));
    return {
      student: enrollment.student,
      enrollment: {
        year,
        class: enrollment.class,
        section: enrollment.section,
        roll: enrollment.roll,
      },
      rows,
      totals: {
        waiver: sum((r) => r.waiver),
        paid: sum((r) => r.paid_amount),
        due: sum((r) => (r.status === 'due' ? r.payable : 0)),
      },
    };
  }
}
