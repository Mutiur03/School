/**
 * Money in the app is integer paisa (1 taka = 100 paisa), the same unit the server does its
 * math in (server/src/nest/modules/fees/fee-receipt/fee-calc.ts: `paisa = Math.round(x * 100)`).
 * The database stores Decimal(12, 2) taka and the JSON carries taka numbers with at most two
 * decimals, so:
 * - every amount is converted to paisa where a response is parsed (`toPaisa`),
 * - totals, differences and splits are integer additions (`sumPaisa`, `addPaisa`),
 * - typed amounts are parsed from the text digit by digit, never through a float
 *   (`parseMoneyInput`),
 * - request bodies get taka back with `toTaka`, which always serialises to ≤ 2 decimals.
 */

declare const PAISA: unique symbol;
/** Integer paisa. Only the helpers below create it, so taka and paisa can't be mixed by mistake. */
export type Paisa = number & { readonly [PAISA]: true };

export const ZERO = 0 as Paisa;

/** Decimal(12, 2) ceiling the server validates against (9,999,999,999.99). */
export const MAX_PAISA = 999_999_999_999 as Paisa;

const asPaisa = (n: number): Paisa => (Object.is(n, -0) ? 0 : n) as Paisa;

const DECIMAL = /^(-)?(\d+)(?:\.(\d{0,2}))?$/;

/**
 * A server amount (taka as a JSON number or a Decimal string) in paisa. Strings are read digit by
 * digit; numbers use the server's own rounding (`Math.round(x * 100)`). Anything else is 0.
 */
export function toPaisa(v: unknown): Paisa {
  if (typeof v === 'string') {
    const m = DECIMAL.exec(v.trim());
    if (m) {
      const p = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
      return asPaisa(m[1] ? -p : p);
    }
    const n = Number(v);
    return Number.isFinite(n) && v.trim() !== '' ? asPaisa(Math.round(n * 100)) : ZERO;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return asPaisa(Math.round(v * 100));
  return ZERO;
}

/** Taka for a request body. Integer paisa / 100 always prints with at most two decimals. */
export function toTaka(p: Paisa): number {
  if (!Number.isSafeInteger(p)) throw new RangeError('Amount must be whole paisa');
  return p / 100 || 0;
}

export const fromPaisaInt = (n: number): Paisa => {
  if (!Number.isSafeInteger(n)) throw new RangeError('Amount must be whole paisa');
  return asPaisa(n);
};

export const addPaisa = (...xs: Paisa[]): Paisa => asPaisa(xs.reduce<number>((t, x) => t + x, 0));
export const subPaisa = (a: Paisa, b: Paisa): Paisa => asPaisa(a - b);
export const negPaisa = (a: Paisa): Paisa => asPaisa(-a);
export const absPaisa = (a: Paisa): Paisa => asPaisa(Math.abs(a));
export const maxPaisa = (a: Paisa, b: Paisa): Paisa => (a > b ? a : b);

export function sumPaisa<T>(rows: readonly T[], pick: (row: T) => Paisa): Paisa {
  let t = 0;
  for (const r of rows) t += pick(r);
  return asPaisa(t);
}

/** "1,23,456.78": Bangladeshi grouping (last three digits, then pairs), always two decimals. */
export function formatMoney(p: Paisa): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const whole = String(Math.floor(abs / 100));
  const frac = String(abs % 100).padStart(2, '0');
  let grouped = whole;
  if (whole.length > 3) {
    const head = whole.slice(0, -3);
    grouped = `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${whole.slice(-3)}`;
  }
  return `${neg ? '-' : ''}${grouped}.${frac}`;
}

/** "৳1,200.00". */
export const formatTaka = (p: Paisa) => `৳${formatMoney(p)}`;

/** Ledger balance: positive = Dr, negative = Cr ("1,200.00 Dr"). */
export const drCr = (p: Paisa) => `${formatMoney(absPaisa(p))} ${p >= 0 ? 'Dr' : 'Cr'}`;

/** Text in an amount field from a stored value ('' for zero when `blankZero`). */
export function moneyText(p: Paisa, blankZero = true): string {
  if (p === 0 && blankZero) return '';
  const neg = p < 0;
  const abs = Math.abs(p);
  const frac = abs % 100;
  return `${neg ? '-' : ''}${Math.floor(abs / 100)}${frac ? `.${String(frac).padStart(2, '0')}` : ''}`;
}

export type MoneyParse =
  { ok: true; paisa: Paisa; empty: boolean } | { ok: false; error: string; empty: boolean };

/**
 * A typed amount → paisa, exactly: "1,200.5" → 120050. Commas and spaces are ignored. More than
 * two decimals, a sign where it isn't allowed, or values over the Decimal(12, 2) limit are
 * errors (the server would reject them).
 */
export function parseMoneyInput(
  text: string,
  opts: { allowNegative?: boolean; allowZero?: boolean; max?: Paisa } = {},
): MoneyParse {
  const t = text.replace(/[,\s]/g, '').replace(/^৳/, '');
  if (t === '') return { ok: true, paisa: ZERO, empty: true };
  if (/^-?\d*\.\d{3,}$/.test(t))
    return { ok: false, error: 'Use at most 2 decimal places', empty: false };
  const m = /^(-)?(\d*)(?:\.(\d{0,2}))?$/.exec(t);
  if (!m || (m[2] === '' && (m[3] ?? '') === ''))
    return { ok: false, error: 'Enter a valid amount', empty: false };
  if (m[1] && !opts.allowNegative)
    return { ok: false, error: 'Amount cannot be negative', empty: false };
  const whole = m[2] || '0';
  if (whole.replace(/^0+/, '').length > 10)
    return { ok: false, error: 'Amount is too large', empty: false };
  const p = Number(whole) * 100 + Number((m[3] ?? '').padEnd(2, '0'));
  const max = opts.max ?? MAX_PAISA;
  if (p > max)
    return {
      ok: false,
      error: `Amount cannot exceed ${formatMoney(max)}`,
      empty: false,
    };
  if (p === 0 && !opts.allowZero)
    return { ok: false, error: 'Amount must be more than zero', empty: false };
  return { ok: true, paisa: asPaisa(m[1] ? -p : p), empty: false };
}

/** Text typed into an amount field, keeping only what an amount can contain. */
export const sanitizeMoneyText = (text: string, allowNegative = false) => {
  const cleaned = text.replace(allowNegative ? /[^\d.,-]/g : /[^\d.,]/g, '');
  return allowNegative ? cleaned.replace(/(?!^)-/g, '') : cleaned;
};

/**
 * A waiver percentage, exactly, in hundredths of a percent ("12.5" → 1250), 0.01-100 with at
 * most two decimals (the server's `IsNumber({ maxDecimalPlaces: 2 })` + "cannot exceed 100").
 * `toTaka` turns it back into the number to send.
 */
export function parsePercentInput(text: string): MoneyParse {
  const r = parseMoneyInput(text.replace(/%$/, ''), { max: fromPaisaInt(10_000) });
  if (!r.ok && r.error.startsWith('Amount cannot exceed'))
    return { ok: false, error: 'Percent cannot exceed 100', empty: false };
  if (!r.ok) return { ...r, error: r.error.replace('Amount', 'Percent') };
  return r;
}
