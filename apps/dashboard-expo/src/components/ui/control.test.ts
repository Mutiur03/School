import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { lightColors as c } from '../../theme/tokens';
import {
  CONTROL_BORDER,
  CONTROL_HEIGHT,
  MULTILINE_LINE_HEIGHT,
  TOUCH_CONTROL_HEIGHT,
  inputKindProps,
  isPadKeyboard,
  kindForKeyboard,
  markEntryComplete,
  multilineMinHeight,
  controlBorderColor,
  controlCaretProps,
  controlClassName,
  controlFrameStyle,
  controlRing,
  controlTextStyle,
  webNoOutline,
} from './control-spec';

test('desktop heights keep web parity; touch is 40/48/52 and multiline grows', () => {
  assert.deepEqual(CONTROL_HEIGHT, { sm: 32, md: 40, lg: 44 });
  assert.deepEqual(TOUCH_CONTROL_HEIGHT, { sm: 40, md: 48, lg: 52 });
  assert.equal(controlFrameStyle(c, {}).height, 40);
  assert.equal(controlFrameStyle(c, { size: 'sm' }).height, 32);
  assert.equal(controlFrameStyle(c, { touch: true }).height, 48);
  assert.equal(controlFrameStyle(c, { touch: true, size: 'lg' }).height, 52);
  assert.equal('height' in controlFrameStyle(c, { multiline: true }), false);
});

test('touch text is 16px (no iOS zoom), desktop 14px', () => {
  assert.equal(controlTextStyle({ touch: true }, 'ios').fontSize, 16);
  assert.equal(controlTextStyle({ touch: true }, 'web').fontSize, 16);
  assert.equal(controlTextStyle({}, 'web').fontSize, 14);
  assert.equal(controlTextStyle({ touch: true }, 'android').paddingHorizontal, 16);
});

test('border: resting slate-300, focus ring colour, error wins over focus', () => {
  assert.equal(controlBorderColor(c, {}), CONTROL_BORDER);
  assert.equal(controlBorderColor(c, { focused: true }), c.ring);
  assert.equal(controlBorderColor(c, { invalid: true }), c.destructive);
  assert.equal(controlBorderColor(c, { invalid: true, focused: true }), c.destructive);
  assert.equal(controlBorderColor(c, { focused: true, readOnly: true }), CONTROL_BORDER);
  assert.notEqual(controlBorderColor(c, { disabled: true }), CONTROL_BORDER);
});

test('desktop ring only while focused and editable; red ring when invalid', () => {
  assert.equal(controlRing(c, {}), undefined);
  assert.equal(controlRing(c, { invalid: true }), undefined);
  assert.match(controlRing(c, { focused: true }) ?? '', /^0 0 0 3px /);
  assert.notEqual(
    controlRing(c, { focused: true, invalid: true }),
    controlRing(c, { focused: true }),
  );
  assert.equal(controlRing(c, { focused: true, readOnly: true }), undefined);
  assert.equal(controlRing(c, { focused: true, disabled: true }), undefined);
});

test('touch focus is one 2px border: no halo, no shadow, content does not shift', () => {
  for (const s of [{ focused: true }, { focused: true, invalid: true }]) {
    const t = { ...s, touch: true };
    assert.equal(controlRing(c, t), undefined);
    const f = controlFrameStyle(c, t) as Record<string, unknown>;
    assert.equal('boxShadow' in f, false);
    assert.equal(f.borderWidth, 2);
  }
  assert.equal(controlFrameStyle(c, { touch: true, focused: true }).borderColor, c.ring);
  assert.equal(
    controlFrameStyle(c, { touch: true, focused: true, invalid: true }).borderColor,
    c.destructive,
  );
  assert.equal(controlFrameStyle(c, { touch: true }).borderWidth, 1);
  assert.equal(controlFrameStyle(c, { touch: true, focused: true, readOnly: true }).borderWidth, 1);
  assert.equal(controlFrameStyle(c, { focused: true }).borderWidth, 1);
  // border + padding stays constant, so text and caret don't move on focus.
  for (const os of ['android', 'ios', 'web']) {
    for (const extra of [{}, { multiline: true }]) {
      const rest = controlTextStyle({ touch: true, ...extra }, os);
      const foc = controlTextStyle({ touch: true, focused: true, ...extra }, os);
      assert.equal((foc.paddingHorizontal as number) + 2, (rest.paddingHorizontal as number) + 1);
    }
  }
});

test('read-only and disabled look different', () => {
  assert.match(controlClassName({}), /\brounded-lg\b/);
  assert.match(controlClassName({ size: 'sm' }), /\brounded-md\b/);
  assert.match(controlClassName({ touch: true }), /\brounded-xl\b/);
  assert.match(controlClassName({}), /\bbg-white\b/);
  const ro = controlClassName({ readOnly: true });
  const dis = controlClassName({ disabled: true });
  assert.match(ro, /\bbg-gray-50\b/);
  assert.doesNotMatch(ro, /opacity/);
  assert.match(dis, /\bbg-gray-100\b/);
  assert.match(dis, /\bopacity-60\b/);
  assert.notEqual(
    controlTextStyle({ disabled: true }, 'ios').color,
    controlTextStyle({ readOnly: true }, 'ios').color,
  );
});

test('Android: no font padding, centred, 24px line so Bangla is not clipped', () => {
  const a = controlTextStyle({ touch: true }, 'android');
  assert.equal(a.includeFontPadding, false);
  assert.equal(a.textAlignVertical, 'center');
  assert.equal(a.paddingVertical, 0);
  assert.equal(a.lineHeight, 24);
  const i = controlTextStyle({ touch: true }, 'ios');
  assert.equal(i.lineHeight, undefined);
  assert.equal(i.includeFontPadding, undefined);
  assert.equal(controlTextStyle({}, 'web').lineHeight, 20);
});

test('multiline text is top-aligned; 22px line on desktop, 24px on touch', () => {
  const s = controlTextStyle({ multiline: true }, 'web');
  assert.equal(s.textAlignVertical, 'top');
  assert.equal(s.lineHeight, MULTILINE_LINE_HEIGHT);
  assert.equal(controlTextStyle({ multiline: true, touch: true }, 'android').lineHeight, 24);
  assert.equal(multilineMinHeight({ touch: true }, 4), 4 * 24 + 26);
});

test('caret / selection use the ring colour; Android also sets the handles', () => {
  const a = controlCaretProps(c, 'android') as Record<string, string>;
  assert.equal(a.cursorColor, c.ring);
  assert.equal(a.selectionHandleColor, c.ring);
  assert.ok(controlCaretProps(c, 'ios').selectionColor);
  assert.equal(webNoOutline('android'), null);
  assert.deepEqual(webNoOutline('web'), { outlineStyle: 'none', outlineWidth: 0 });
});

test('field kinds set keyboard, autofill, capitalisation and autocorrect together', () => {
  const email = inputKindProps('email', 'ios');
  assert.equal(email.keyboardType, 'email-address');
  assert.equal(email.textContentType, 'emailAddress');
  assert.equal(email.autoCapitalize, 'none');
  assert.equal(email.autoCorrect, false);
  assert.equal(inputKindProps('phone', 'android').keyboardType, 'phone-pad');
  assert.equal(inputKindProps('phone', 'android').autoComplete, 'tel');
  assert.equal(inputKindProps('number', 'ios').keyboardType, 'number-pad');
  const pw = inputKindProps('password', 'ios');
  assert.equal(pw.secureTextEntry, true);
  assert.equal(pw.textContentType, 'password');
  assert.equal(inputKindProps('new-password', 'ios').autoComplete, 'new-password');
  assert.equal(inputKindProps('code', 'ios').autoCapitalize, 'characters');
  assert.equal(inputKindProps('otp', 'ios').textContentType, 'oneTimeCode');
  assert.equal(inputKindProps('search', 'ios').keyboardType, 'web-search');
  assert.equal(inputKindProps('search', 'android').returnKeyType, 'search');
  assert.deepEqual(inputKindProps(undefined, 'ios'), {});
  assert.equal(kindForKeyboard('email-address'), 'email');
  assert.equal(kindForKeyboard('number-pad'), 'number');
  assert.equal(kindForKeyboard('default'), undefined);
  assert.equal(isPadKeyboard('number-pad'), true);
  assert.equal(isPadKeyboard('default'), false);
});

test('marks: jump to the next cell once no further digit fits under max', () => {
  assert.equal(markEntryComplete('1', 100), false);
  assert.equal(markEntryComplete('10', 100), false);
  assert.equal(markEntryComplete('100', 100), true);
  assert.equal(markEntryComplete('45', 100), true);
  assert.equal(markEntryComplete('7', 70), false);
  assert.equal(markEntryComplete('8', 70), true);
  assert.equal(markEntryComplete('', 70), false);
  assert.equal(markEntryComplete('5', 5), true);
  // Over max: stay put so the red error can be fixed.
  assert.equal(markEntryComplete('55', 50), false);
  assert.equal(markEntryComplete('150', 100), false);
});

// ---- Source guards: every text field goes through the primitive. ----
const ROOT = join(__dirname, '..', '..', '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx$/.test(n) ? [p] : [];
  });
}
const SOURCES = [...files(join(ROOT, 'src')), ...files(join(ROOT, 'app'))].map((p) => ({
  path: relative(ROOT, p),
  text: readFileSync(p, 'utf8'),
}));

test('no raw <TextInput outside the Input primitive', () => {
  const offenders = SOURCES.filter(
    (f) =>
      f.path !== join('src', 'components', 'ui', 'Input.tsx') &&
      /(?:^|[\s({])<TextInput[\s/>]/m.test(f.text.replace(/<TextInput \|/g, '')),
  ).map((f) => f.path);
  assert.deepEqual(offenders, []);
});

test('no caller fights the primitive with height / radius / border-colour / align overrides', () => {
  const bad: string[] = [];
  for (const f of SOURCES.filter((x) => !x.path.startsWith(join('src', 'components', 'ui')))) {
    const re = /<(?:Input|Textarea|SearchInput|PasswordInput|MoneyInput)\b[\s\S]*?\/>/g;
    for (const m of f.text.matchAll(re)) {
      const tag = m[0];
      const cls = /className=(?:"([^"]*)"|\{([^}]*)\})/.exec(tag);
      const v = (cls ? (cls[1] ?? cls[2]) : '') ?? '';
      if (/\b(?:h-\d|h-\[|min-h-|rounded-|border-(?:destructive|red|input)|py-\d)/.test(v))
        bad.push(`${f.path}: ${v.trim()}`);
      if (/textAlignVertical|minHeight/.test(tag)) bad.push(`${f.path}: style override`);
    }
  }
  assert.deepEqual(bad, []);
});
