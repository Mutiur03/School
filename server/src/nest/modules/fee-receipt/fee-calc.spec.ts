import { amountInWords, buildRows, monthsOf, waiverFor } from './fee-calc.js';

describe('monthsOf', () => {
  it('monthly → 1..12, once → [0]', () => {
    expect(monthsOf('monthly')).toHaveLength(12);
    expect(monthsOf('monthly', 3)).toEqual([1, 2, 3]);
    expect(monthsOf('once')).toEqual([0]);
  });
});

describe('waiverFor', () => {
  const w = (o: object) => ({ fee_head_id: null, percent: false, value: 0, ...o });

  it('is 0 for non-waivable heads', () => {
    expect(waiverFor(500, 1, false, [w({ value: 100 })])).toBe(0);
  });

  it('adds fixed and percent waivers, matching the head or all heads', () => {
    expect(
      waiverFor(1000, 1, true, [
        w({ value: 100 }),
        w({ fee_head_id: 1, percent: true, value: 10 }),
        w({ fee_head_id: 2, value: 999 }),
      ]),
    ).toBe(200);
  });

  it('never exceeds the charge', () => {
    expect(waiverFor(300, 1, true, [w({ value: 250 }), w({ value: 250 })])).toBe(300);
  });

  it('rounds percent to paisa', () => {
    expect(waiverFor(100.01, 1, true, [w({ percent: true, value: 33.33 })])).toBe(33.33);
    expect(waiverFor(0.05, 1, true, [w({ percent: true, value: 50 })])).toBe(0.03);
  });
});

describe('amountInWords', () => {
  it.each([
    [0, 'Zero Taka Only'],
    [1700, 'One Thousand Seven Hundred Taka Only'],
    [125000, 'One Lakh Twenty Five Thousand Taka Only'],
    [10000000, 'One Crore Taka Only'],
    [250.5, 'Two Hundred Fifty Taka and Fifty Paisa Only'],
  ])('%s', (n, words) => expect(amountInWords(n)).toBe(words));
});

describe('buildRows', () => {
  const tuition = {
    fee_head_id: 1,
    fee_head: 'Tuition',
    frequency: 'monthly' as const,
    is_waivable: true,
    sort_order: 1,
    amount: 500,
  };
  const admission = {
    fee_head_id: 2,
    fee_head: 'Admission',
    frequency: 'once' as const,
    is_waivable: false,
    sort_order: 2,
    amount: 2000,
  };

  it('expands monthly heads and marks paid / waived / due', () => {
    const paid = new Map([['1:1', { receipt_no: 9, amount: 400 }]]);
    const waivers = [{ fee_head_id: 1, percent: false, value: 500 }];
    const rows = buildRows([admission, tuition], waivers, paid, 2);
    expect(rows.map((r) => `${r.fee_head}:${r.month}:${r.status}`)).toEqual([
      'Tuition:1:paid',
      'Tuition:2:waived',
      'Admission:0:due',
    ]);
    expect(rows[0]).toMatchObject({ receipt_no: 9, paid_amount: 400 });
  });
});
