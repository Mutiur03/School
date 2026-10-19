/**
 * Fee page logic: picking installments, integer totals per destination account, the receipt
 * payload (items only), structure and waiver inputs, the picker filter, and the single-flight
 * guard behind Collect.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DueRow } from '@/lib/api/fees';
import { receiptBody, structureBody, waiverBody } from '@/lib/api/fees';
import { fromPaisaInt, toPaisa } from '@/lib/money/money';
import { createSingleFlight } from '@/features/admin/single-flight';
import {
  barHeights,
  collectConfirmMessage,
  collectionSummary,
  dueKey,
  feeYears,
  filterPicker,
  monthLabel,
  receiptInput,
  retainDue,
  sectionsOf,
  structureDirty,
  structureItems,
  toggleAllDue,
  toggleKey,
  waiverInput,
  waiverValueLabel,
} from './model';

const P = fromPaisaInt;
const row = (over: Partial<DueRow>): DueRow => ({
  fee_head_id: 1,
  fee_head: 'Tuition',
  month: 1,
  charge: toPaisa(500),
  waiver: P(0),
  payable: toPaisa(500),
  status: 'due',
  receipt_no: null,
  paid_amount: P(0),
  deposit: null,
  ...over,
});

const rows: DueRow[] = [
  row({ month: 1, status: 'paid', receipt_no: 3 }),
  row({ month: 2, payable: toPaisa(0.1) }),
  row({ month: 3, payable: toPaisa(0.2) }),
  row({ month: 4, status: 'waived', payable: P(0) }),
  row({
    fee_head_id: 2,
    fee_head: 'Admission',
    month: 0,
    payable: toPaisa(1000.05),
    deposit: { id: 9, name: 'Sonali Bank' },
  }),
];

describe('collect fees selection', () => {
  it('toggles and selects all due only', () => {
    let s = toggleKey(new Set(), '1:2');
    assert.deepEqual([...s], ['1:2']);
    s = toggleKey(s, '1:2');
    assert.equal(s.size, 0);
    const all = toggleAllDue(new Set(), rows);
    assert.deepEqual([...all].sort(), ['1:2', '1:3', '2:0']);
    assert.equal(toggleAllDue(all, rows).size, 0);
  });

  it('ignores picks on paid/waived rows and drops them after a reload', () => {
    const c = collectionSummary(rows, new Set(['1:1', '1:4', '1:2']), null);
    assert.deepEqual(c.picked.map(dueKey), ['1:2']);
    const reloaded = rows.map((r) => (r.month === 2 ? { ...r, status: 'paid' as const } : r));
    assert.deepEqual([...retainDue(new Set(['1:2', '1:3']), reloaded)], ['1:3']);
  });

  it('totals in paisa: 0.10 + 0.20 + 1000.05 = 1000.35 exactly', () => {
    const c = collectionSummary(rows, new Set(['1:2', '1:3', '2:0']), { id: 3, name: 'Cash' });
    assert.equal(c.total, 100035);
    assert.equal(c.needsPayHead, true);
    assert.deepEqual(
      c.destinations.map((d) => [d.id, d.name, d.amount]),
      [
        [3, 'Cash', 30],
        [9, 'Sonali Bank', 100005],
      ],
    );
    assert.equal(c.issue, null);
  });

  it('needs a pay head only when a picked fee has no fixed account', () => {
    const fixed = collectionSummary(rows, new Set(['2:0']), null);
    assert.equal(fixed.needsPayHead, false);
    assert.equal(fixed.issue, null);
    const open = collectionSummary(rows, new Set(['1:2']), null);
    assert.equal(open.issue, 'Pick the cash/bank account');
    assert.equal(open.destinations[0]!.name, 'Pick an account');
    assert.equal(
      collectionSummary(rows, new Set(), null).issue,
      'Tick the installments being paid',
    );
  });

  it('receipt payload: items only, pay_head_id only when needed', () => {
    const c = collectionSummary(rows, new Set(['1:2', '2:0']), { id: 3, name: 'Cash' });
    const input = receiptInput({
      studentId: 7,
      year: 2026,
      date: '2026-10-19',
      payHeadId: 3,
      note: ' ',
      collection: c,
    });
    assert.deepEqual(receiptBody(input), {
      student_id: 7,
      year: 2026,
      date: '2026-10-19',
      pay_head_id: 3,
      items: [
        { fee_head_id: 1, month: 2 },
        { fee_head_id: 2, month: 0 },
      ],
    });
    const only = collectionSummary(rows, new Set(['2:0']), { id: 3, name: 'Cash' });
    const body = receiptBody(
      receiptInput({
        studentId: 7,
        year: 2026,
        date: '2026-10-19',
        payHeadId: 3,
        note: 'x',
        collection: only,
      }),
    );
    assert.equal('pay_head_id' in body, false);
    assert.equal(body.note, 'x');
    for (const k of ['amount', 'total', 'payable', 'school_id']) assert.equal(k in body, false);
  });

  it('confirm message names the student, total and destinations', () => {
    const c = collectionSummary(rows, new Set(['1:2', '2:0']), { id: 3, name: 'Cash' });
    const msg = collectConfirmMessage(
      {
        student: { id: 7, name: 'Rahim', login_id: '1', father_name: null },
        enrollment: { year: 2026, class: 6, section: 'A', roll: 3 },
      },
      c,
      '2026-10-19',
    );
    assert.match(
      msg,
      /Collect ৳1,000\.15 from Rahim \(Class 6-A, roll 3\) for 2 installments on 2026-10-19/,
    );
    assert.match(msg, /Cash ৳0\.10, Sonali Bank ৳1,000\.05/);
  });
});

describe('fee structure', () => {
  const heads = [
    { id: 1, name: 'Tuition' },
    { id: 2, name: 'Exam' },
    { id: 3, name: 'Lab' },
    { id: 4, name: 'Sports' },
  ];
  it('blank = not charged; exact paisa; errors per head', () => {
    const r = structureItems(heads, { 1: '1200.5', 2: '', 3: '0', 4: '1.234' });
    assert.deepEqual(r.items, [{ fee_head_id: 1, amount: 120050 }]);
    assert.match(r.errors[3]!, /more than zero/);
    assert.match(r.errors[4]!, /2 decimal/);
    assert.equal(r.errors[2], undefined);
  });
  it('the PUT body carries two-decimal taka', () => {
    const { items } = structureItems(heads, { 1: '0.1', 2: '0.2', 3: '1,23,456.78' });
    assert.deepEqual(structureBody({ year: 2026, cls: 8, items }).items, [
      { fee_head_id: 1, amount: 0.1 },
      { fee_head_id: 2, amount: 0.2 },
      { fee_head_id: 3, amount: 123456.78 },
    ]);
  });
  it('dirty check compares paisa', () => {
    const saved = [{ fee_head_id: 1, amount: P(120050) }];
    assert.equal(structureDirty(saved, [{ fee_head_id: 1, amount: P(120050) }]), false);
    assert.equal(structureDirty(saved, [{ fee_head_id: 1, amount: P(120051) }]), true);
    assert.equal(structureDirty(saved, []), true);
  });
});

describe('waivers', () => {
  it('percent: ≤ 100 with two decimals', () => {
    const r = waiverInput({
      studentId: 7,
      year: 2026,
      feeHeadId: null,
      percent: true,
      value: '12.5',
      note: '',
    });
    assert.ok(r.ok);
    assert.deepEqual(waiverBody(r.input), {
      student_id: 7,
      year: 2026,
      percent: true,
      value: 12.5,
    });
    const over = waiverInput({
      studentId: 7,
      year: 2026,
      feeHeadId: null,
      percent: true,
      value: '101',
      note: '',
    });
    assert.deepEqual(over, { ok: false, error: 'Percent cannot exceed 100' });
  });
  it('fixed amount, head and note', () => {
    const r = waiverInput({
      studentId: 7,
      year: 2026,
      feeHeadId: 2,
      percent: false,
      value: '250.75',
      note: ' orphan ',
    });
    assert.ok(r.ok);
    assert.deepEqual(waiverBody(r.input), {
      student_id: 7,
      year: 2026,
      fee_head_id: 2,
      percent: false,
      value: 250.75,
      note: 'orphan',
    });
  });
  it('rejects missing student / blank / bad amounts', () => {
    assert.deepEqual(
      waiverInput({
        studentId: null,
        year: 2026,
        feeHeadId: null,
        percent: false,
        value: '5',
        note: '',
      }),
      { ok: false, error: 'Pick a student' },
    );
    assert.deepEqual(
      waiverInput({
        studentId: 1,
        year: 2026,
        feeHeadId: null,
        percent: false,
        value: '',
        note: '',
      }),
      { ok: false, error: 'Enter a waiver amount' },
    );
    const r = waiverInput({
      studentId: 1,
      year: 2026,
      feeHeadId: null,
      percent: false,
      value: '0.001',
      note: '',
    });
    assert.ok(!r.ok && /2 decimal/.test(r.error));
  });
  it('labels', () => {
    assert.equal(waiverValueLabel({ percent: true, value: P(1250) }), '12.50%');
    assert.equal(waiverValueLabel({ percent: true, value: P(10000) }), '100%');
    assert.equal(waiverValueLabel({ percent: false, value: P(123450) }), '1,234.50');
  });
});

describe('picker, years, months, bars', () => {
  const list = [
    { id: 1, name: 'Karim', roll: 2, section: 'B', class: 6 },
    { id: 2, name: 'Rahim', roll: 1, section: 'A', class: 6 },
    { id: 3, name: 'Rahima', roll: 12, section: 'A', class: 6 },
  ];
  it('filters by section, name or exact roll', () => {
    assert.deepEqual(sectionsOf(list), ['A', 'B']);
    assert.deepEqual(
      filterPicker(list, '', 'rahim').map((s) => s.id),
      [2, 3],
    );
    assert.deepEqual(
      filterPicker(list, '', '1').map((s) => s.id),
      [2],
    );
    assert.deepEqual(
      filterPicker(list, 'B', '').map((s) => s.id),
      [1],
    );
  });
  it('years and months', () => {
    assert.deepEqual(feeYears(2026), [2027, 2026, 2025, 2024]);
    assert.equal(monthLabel(0), 'One-off');
    assert.equal(monthLabel(12), 'Dec');
  });
  it('bar heights', () => {
    assert.deepEqual(
      barHeights([{ total: P(0) }, { total: P(50) }, { total: P(100) }]),
      [2, 50, 100],
    );
    assert.deepEqual(barHeights([]), []);
  });
});

describe('single flight (double-submit guard)', () => {
  it('a second call while the first is pending does not run', async () => {
    const f = createSingleFlight();
    let calls = 0;
    let release!: () => void;
    const first = f.run(
      () =>
        new Promise<string>((r) => {
          calls++;
          release = () => r('done');
        }),
    );
    const second = await f.run(async () => {
      calls++;
      return 'again';
    });
    assert.equal(second, undefined);
    assert.equal(f.busy, true);
    release();
    assert.equal(await first, 'done');
    assert.equal(calls, 1);
    assert.equal(f.busy, false);
    assert.equal(await f.run(async () => 'next'), 'next');
  });
  it('releases after a failure', async () => {
    const f = createSingleFlight();
    await assert.rejects(
      f.run(async () => {
        throw new Error('409');
      }),
    );
    assert.equal(f.busy, false);
  });
});
