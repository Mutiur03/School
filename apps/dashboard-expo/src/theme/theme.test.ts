import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cn } from '../lib/utils';
import { darkColors, hexToRgbChannels, lightColors, type ThemeColors } from './tokens';

const css = readFileSync(new URL('../../global.css', import.meta.url), 'utf8');

/** Variables in one block of global.css, e.g. `:root { ... }`. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} block missing`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const kebab = (k: string) =>
  k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/(\D)(\d)/, '$1-$2');
const NOT_CSS_VARS = new Set<keyof ThemeColors>(['heading', 'seriesAbsent', 'seriesRanAway']);

test('hexToRgbChannels converts #rrggbb and rejects anything else', () => {
  assert.equal(hexToRgbChannels('#0f172a'), '15 23 42');
  assert.equal(hexToRgbChannels('#FFFFFF'), '255 255 255');
  assert.equal(hexToRgbChannels('red'), null);
  assert.equal(hexToRgbChannels('#fff'), null);
});

test('global.css :root matches lightColors in tokens.ts', () => {
  const vars = block(':root');
  for (const [key, hex] of Object.entries(lightColors) as [keyof ThemeColors, string][]) {
    if (NOT_CSS_VARS.has(key)) continue;
    assert.equal(vars[kebab(key)], hexToRgbChannels(hex), `--${kebab(key)}`);
  }
});

test('global.css .dark defines every variable (border pre-blended, see comment)', () => {
  const vars = block('.dark:root');
  for (const [key, value] of Object.entries(darkColors) as [keyof ThemeColors, string][]) {
    if (NOT_CSS_VARS.has(key)) continue;
    const name = kebab(key);
    assert.ok(vars[name], `--${name} missing`);
    const channels = hexToRgbChannels(value);
    if (channels) assert.equal(vars[name], channels, `--${name}`);
  }
});

test('cn merges conflicting Tailwind classes like the dashboard helper', () => {
  assert.equal(
    cn('px-3 text-sm text-foreground', 'pl-9 text-foreground/70'),
    'px-3 text-sm pl-9 text-foreground/70',
  );
  assert.equal(cn('font-normal', false, 'font-semibold'), 'font-semibold');
  assert.equal(cn('text-sm', 'text-lg sm:text-xl'), 'text-lg sm:text-xl');
});
