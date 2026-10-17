/** Pure fee math shared by receipts, dues and reports. Money is handled in integer paisa. */
export type Frequency = 'monthly' | 'once';
export type Waiver = { fee_head_id: number | null; percent: boolean; value: number };

export const paisa = (x: number) => Math.round(x * 100);
export const taka = (p: number) => p / 100;

/** Valid `month` values of an installment: 1-12 for monthly heads, 0 for one-off heads. */
export const monthsOf = (frequency: Frequency, upto = 12) =>
  frequency === 'monthly' ? Array.from({ length: upto }, (_, i) => i + 1) : [0];

/** Total concession on one installment: head-specific and all-head waivers add up, capped at the charge. */
export function waiverFor(charge: number, headId: number, waivable: boolean, waivers: Waiver[]) {
  if (!waivable) return 0;
  const chargeP = paisa(charge);
  const total = waivers
    .filter((w) => w.fee_head_id === null || w.fee_head_id === headId)
    .reduce((t, w) => t + (w.percent ? (chargeP * w.value) / 100 : paisa(w.value)), 0);
  return taka(Math.min(Math.round(total), chargeP));
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const below100 = (n: number) =>
  n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]} ${ONES[n % 10]}`.trim();
const below1000 = (n: number) =>
  [n >= 100 && `${ONES[Math.floor(n / 100)]} Hundred`, n % 100 && below100(n % 100)]
    .filter(Boolean)
    .join(' ');

/** "One Thousand Seven Hundred Taka Only", with the lakh/crore grouping used in Bangladesh. */
export function amountInWords(amount: number) {
  const p = paisa(amount);
  const fraction = p % 100;
  let rest = Math.floor(p / 100);
  const parts: string[] = [];
  for (const [size, label] of [
    [10_000_000, 'Crore'],
    [100_000, 'Lakh'],
    [1000, 'Thousand'],
  ] as const) {
    const n = Math.floor(rest / size);
    if (n) parts.push(`${below1000(n)} ${label}`);
    rest %= size;
  }
  if (rest) parts.push(below1000(rest));
  const words = parts.join(' ') || 'Zero';
  return `${words} Taka${fraction ? ` and ${below100(fraction)} Paisa` : ''} Only`;
}

export type Charge = {
  fee_head_id: number;
  fee_head: string;
  frequency: Frequency;
  is_waivable: boolean;
  sort_order: number;
  amount: number;
};
export type Paid = { receipt_no: number; amount: number };
export type DueRow = {
  fee_head_id: number;
  fee_head: string;
  month: number;
  charge: number;
  waiver: number;
  payable: number;
  status: 'paid' | 'due' | 'waived';
  receipt_no: number | null;
  paid_amount: number;
};

/** One row per fee head x month for a student. `paid` is keyed by `${fee_head_id}:${month}`. */
export function buildRows(
  charges: Charge[],
  waivers: Waiver[],
  paid: Map<string, Paid>,
  upto = 12,
): DueRow[] {
  return [...charges]
    .sort((a, b) => a.sort_order - b.sort_order || a.fee_head.localeCompare(b.fee_head))
    .flatMap((c) =>
      monthsOf(c.frequency, upto).map((month): DueRow => {
        const waiver = waiverFor(c.amount, c.fee_head_id, c.is_waivable, waivers);
        const payable = taka(paisa(c.amount) - paisa(waiver));
        const hit = paid.get(`${c.fee_head_id}:${month}`);
        return {
          fee_head_id: c.fee_head_id,
          fee_head: c.fee_head,
          month,
          charge: c.amount,
          waiver,
          payable,
          status: hit ? 'paid' : payable === 0 ? 'waived' : 'due',
          receipt_no: hit?.receipt_no ?? null,
          paid_amount: hit?.amount ?? 0,
        };
      }),
    );
}
