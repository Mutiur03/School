/**
 * Money is integer paisa end to end: server JSON → paisa, typed text → paisa (no float), integer
 * sums, BD-grouped display, and paisa → a taka number the server's
 * `IsNumber({ maxDecimalPlaces: 2 })` accepts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addPaisa,
  drCr,
  formatMoney,
  formatTaka,
  fromPaisaInt,
  MAX_PAISA,
  moneyText,
  parseMoneyInput,
  parsePercentInput,
  sanitizeMoneyText,
  subPaisa,
  sumPaisa,
  toPaisa,
  toTaka,
  type Paisa,
} from './money';

const P = (n: number) => fromPaisaInt(n);
const decimals = (n: number) => (String(n).split('.')[1] ?? '').length;

describe('toPaisa (server amounts)', () => {
  it('reads JSON numbers the way the server does (Math.round(x * 100))', () => {
    assert.equal(toPaisa(1234.56), 123456);
    assert.equal(toPaisa(0.29), 29); // 0.29 * 100 = 28.999999999999996
    // same as the server's paisa(): 1.005 * 100 = 100.49999…; the DB never holds 3 decimals anyway
    assert.equal(toPaisa(1.005), 100);
    assert.equal(toPaisa(9_999_999_999.99), 999_999_999_999);
    assert.equal(toPaisa(-150.5), -15050);
    assert.equal(toPaisa(0), 0);
    assert.ok(Object.is(toPaisa(-0), 0));
  });
  it('reads Decimal strings digit by digit', () => {
    assert.equal(toPaisa('1234.56'), 123456);
    assert.equal(toPaisa('0.1'), 10);
    assert.equal(toPaisa('-0.05'), -5);
    assert.equal(toPaisa('9999999999.99'), 999_999_999_999);
    assert.equal(toPaisa('12'), 1200);
  });
  it('treats junk as zero', () => {
    for (const v of [null, undefined, '', 'abc', NaN, Infinity, {}, []])
      assert.equal(toPaisa(v), 0);
  });
});

describe('integer sums', () => {
  it('0.1 + 0.2 is exactly 0.30', () => {
    const t = addPaisa(toPaisa(0.1), toPaisa(0.2));
    assert.equal(t, 30);
    assert.equal(formatMoney(t), '0.30');
    assert.equal(toTaka(t), 0.3);
  });
  it('a thousand 0.01 installments are exactly 10.00', () => {
    const rows = Array.from({ length: 1000 }, () => ({ a: toPaisa(0.01) }));
    assert.equal(
      sumPaisa(rows, (r) => r.a),
      1000,
    );
  });
  it('sums 33.33 three times without drift', () => {
    assert.equal(formatMoney(sumPaisa([1, 2, 3], () => toPaisa(33.33))), '99.99');
  });
  it('rejects non-integer paisa', () => {
    assert.throws(() => fromPaisaInt(1.5));
    assert.throws(() => toTaka(0.5 as Paisa));
  });
});

describe('toTaka (request bodies)', () => {
  it('always has at most two decimals and round-trips', () => {
    for (let p = -20_000; p <= 20_000; p += 7) {
      const t = toTaka(P(p));
      assert.ok(decimals(t) <= 2, `${p} → ${t}`);
      assert.equal(toPaisa(t), p);
    }
    for (const p of [999_999_999_999, 123_456_789_01, 100_000_000_001, 1, 99]) {
      const t = toTaka(P(p));
      assert.ok(decimals(t) <= 2, `${p} → ${t}`);
      assert.equal(toPaisa(t), p);
    }
  });
  it('JSON-serialises cleanly', () => {
    assert.equal(JSON.stringify({ amount: toTaka(P(120050)) }), '{"amount":1200.5}');
    assert.equal(JSON.stringify({ amount: toTaka(P(30)) }), '{"amount":0.3}');
  });
});

describe('formatMoney', () => {
  it('uses Bangladeshi grouping with two decimals', () => {
    assert.equal(formatMoney(P(0)), '0.00');
    assert.equal(formatMoney(P(5)), '0.05');
    assert.equal(formatMoney(P(99900)), '999.00');
    assert.equal(formatMoney(P(100000)), '1,000.00');
    assert.equal(formatMoney(P(12345678)), '1,23,456.78');
    assert.equal(formatMoney(P(1234567890)), '1,23,45,678.90');
    assert.equal(formatMoney(MAX_PAISA), '9,99,99,99,999.99');
    assert.equal(formatMoney(P(-12345678)), '-1,23,456.78');
  });
  it('drCr and formatTaka', () => {
    assert.equal(drCr(P(150000)), '1,500.00 Dr');
    assert.equal(drCr(P(-150000)), '1,500.00 Cr');
    assert.equal(drCr(P(0)), '0.00 Dr');
    assert.equal(formatTaka(P(120000)), '৳1,200.00');
  });
  it('moneyText for edit fields', () => {
    assert.equal(moneyText(P(120000)), '1200');
    assert.equal(moneyText(P(120050)), '1200.50');
    assert.equal(moneyText(P(5)), '0.05');
    assert.equal(moneyText(P(0)), '');
    assert.equal(moneyText(P(0), false), '0');
    assert.equal(moneyText(P(-50)), '-0.50');
  });
});

describe('parseMoneyInput (typed amounts, no float)', () => {
  const ok = (s: string, opts?: Parameters<typeof parseMoneyInput>[1]) => {
    const r = parseMoneyInput(s, opts);
    assert.ok(r.ok, `${s}: ${r.ok ? '' : r.error}`);
    return r.paisa;
  };
  const err = (s: string, opts?: Parameters<typeof parseMoneyInput>[1]) => {
    const r = parseMoneyInput(s, opts);
    assert.equal(r.ok, false, s);
    return r.ok ? '' : r.error;
  };
  it('parses exactly', () => {
    assert.equal(ok('1200'), 120000);
    assert.equal(ok('1200.5'), 120050);
    assert.equal(ok('1,200.50'), 120050);
    assert.equal(ok(' 0.29 '), 29);
    assert.equal(ok('.5'), 50);
    assert.equal(ok('12.'), 1200);
    assert.equal(ok('৳1,23,456.78'), 12345678);
    assert.equal(ok('9999999999.99'), 999_999_999_999);
    assert.equal(ok('0001.10'), 110);
  });
  it('matches the server limits', () => {
    assert.match(err('1.234'), /2 decimal/);
    assert.match(err('10000000000'), /too large|exceed/);
    assert.match(err('9999999999.999'), /2 decimal/);
    assert.match(err('-5'), /negative/);
    assert.match(err('0'), /more than zero/);
    assert.match(err('0.00'), /more than zero/);
    assert.match(err('1e3'), /valid/);
    assert.match(err('abc'), /valid/);
    assert.match(err('.'), /valid/);
    assert.match(err('1.2.3'), /valid/);
  });
  it('blank is empty, not an error', () => {
    const r = parseMoneyInput('  ');
    assert.ok(r.ok && r.empty && r.paisa === 0);
  });
  it('negatives and zero only where allowed', () => {
    assert.equal(ok('-150.25', { allowNegative: true }), -15025);
    assert.equal(ok('0', { allowZero: true }), 0);
    assert.match(err('101', { max: P(10000) }), /exceed 100\.00/);
  });
  it('every two-decimal string round-trips', () => {
    for (let p = 1; p < 30_000; p += 13) {
      const s = `${Math.floor(p / 100)}.${String(p % 100).padStart(2, '0')}`;
      assert.equal(ok(s), p, s);
    }
  });
  it('sanitizes keystrokes', () => {
    assert.equal(sanitizeMoneyText('৳1,2a00.5x'), '1,200.5');
    assert.equal(sanitizeMoneyText('-1-2', true), '-12');
    assert.equal(sanitizeMoneyText('-12'), '12');
  });
});

describe('parsePercentInput', () => {
  it('0.01-100 with two decimals, in hundredths', () => {
    const r = parsePercentInput('12.5');
    assert.ok(r.ok && r.paisa === 1250);
    assert.equal(toTaka(r.ok ? r.paisa : P(0)), 12.5);
    const full = parsePercentInput('100%');
    assert.ok(full.ok && full.paisa === 10000);
    const over = parsePercentInput('100.01');
    assert.ok(!over.ok && over.error === 'Percent cannot exceed 100');
    const zero = parsePercentInput('0');
    assert.ok(!zero.ok && /Percent must be more than zero/.test(zero.error));
    const many = parsePercentInput('3.333');
    assert.ok(!many.ok && /2 decimal/.test(many.error));
  });
  it('subtraction stays integer', () => {
    assert.equal(subPaisa(toPaisa(100), toPaisa(99.99)), 1);
  });
});
