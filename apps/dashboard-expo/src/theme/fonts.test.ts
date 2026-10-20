import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { BANGLA_FONT, latinWithBangla, scriptRuns } from './fonts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

test('Bangla face is SolaimanLipi, same as dashboard MixedFont (not Kalpurush)', () => {
  assert.equal(BANGLA_FONT, 'SolaimanLipi');
});

test('web stacks SolaimanLipi after Outfit so missing Bangla glyphs fall through', () => {
  assert.equal(latinWithBangla('Outfit_400Regular', 'web'), 'Outfit_400Regular, SolaimanLipi');
  assert.equal(latinWithBangla('Outfit_400Regular', 'android'), 'Outfit_400Regular');
  assert.equal(latinWithBangla('Outfit_400Regular', 'ios'), 'Outfit_400Regular');
});

test('scriptRuns splits mixed Latin and Bangla the way dashboard unicode-range does', () => {
  assert.deepEqual(scriptRuns('Fees'), [{ bangla: false, text: 'Fees' }]);
  assert.deepEqual(scriptRuns('ফি'), [{ bangla: true, text: 'ফি' }]);
  assert.deepEqual(scriptRuns('Class ৬'), [
    { bangla: false, text: 'Class ' },
    { bangla: true, text: '৬' },
  ]);
});

test('SolaimanLipi ttf is bundled (same face as dashboard/public/fonts/SolaimanLipi.woff2)', () => {
  assert.equal(existsSync(join(root, 'assets/fonts/SolaimanLipi.ttf')), true);
});

// Not from @expo-google-fonts: its export path contains node_modules, which Pages never uploads.
test('Outfit weights are bundled from assets/fonts', () => {
  for (const w of ['400Regular', '500Medium', '600SemiBold', '700Bold'])
    assert.equal(existsSync(join(root, `assets/fonts/Outfit_${w}.ttf`)), true, w);
});
