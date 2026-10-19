/**
 * One spec for every text-input-like control (Input, Textarea, SearchInput, PasswordInput,
 * Select, MultiSelect, DateInput, mark cells), in two densities:
 *
 * **Desktop web** (`touch: false`, web at ≥ sm) keeps parity with the web dashboard's shadcn
 * Input: 32/40/44px, `rounded-lg`, 14px text, px-3. Three deliberate changes: one height per
 * size (the web mixes 36/38/40px fields on a row); a visible focus state (ring border plus a soft
 * 3px ring, since the web's `border-transparent` loses the edge on white); and a slate-300 resting
 * border so fields still read on bright screens.
 *
 * **Touch** (`touch: true`, used on iOS/Android and on narrow web) is designed for phones rather
 * than copied from the web: 40/48/52px fields (48 is the Material/HIG minimum target), 16px text
 * (iOS Safari zooms into anything smaller), `rounded-xl` (the card radius), 16px side padding
 * and a 24px line.
 *
 * States: on desktop web, focus is a ring-coloured border plus a soft 3px ring (the web
 * dashboard's shadcn focus style). On touch (phones, native and narrow web) focus is ONE clean
 * 2px ring-coloured border and nothing else: no box-shadow halo (Android draws a spread shadow as
 * a grey band around the field, which read as a heavy double outline), no elevation, no Android
 * underline. The wider border grows inward, and the text padding gives back the extra 1px so
 * the text and caret never move. Invalid is a red border (red ring while focused on desktop) plus
 * an alert icon and message; error wins over focus. Read-only
 * is a gray-50 field with normal-contrast text and a lock icon (it can be selected and copied).
 * Disabled is gray-100 with a gray-200 border, muted text and 60% opacity.
 *
 * Android centring: `includeFontPadding: false` plus `textAlignVertical: 'center'` and no vertical
 * padding. On its own that would clip Bangla (Outfit has no Bangla glyphs, so the taller system
 * fallback font is used under Outfit's tighter metrics). An explicit 24px lineHeight (1.5× of
 * 16px) gives the line box room for matras, conjuncts and descenders. iOS single-line fields get
 * no lineHeight: UITextField sizes the line itself, and a forced one shifts the baseline down.
 */
import type { TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { cn } from '@/lib/utils';
import { tw, withAlpha, type ThemeColors } from '@/theme/tokens';

export type ControlSize = 'sm' | 'md' | 'lg';
export type ControlOS = 'web' | 'ios' | 'android' | (string & {});

export const CONTROL_HEIGHT: Record<ControlSize, number> = { sm: 32, md: 40, lg: 44 };
export const TOUCH_CONTROL_HEIGHT: Record<ControlSize, number> = { sm: 40, md: 48, lg: 52 };
/** Resting border: slate-300. */
export const CONTROL_BORDER = '#cbd5e1';
export const CONTROL_PLACEHOLDER = tw.gray400;
export const CONTROL_TEXT = tw.gray900;
export const CONTROL_DISABLED_TEXT = '#6a7282'; // gray-500
export const MULTILINE_LINE_HEIGHT = 22;
export const TOUCH_LINE_HEIGHT = 24;
export const CONTROL_PAD_X: Record<ControlSize, number> = { sm: 8, md: 12, lg: 12 };
export const TOUCH_PAD_X: Record<ControlSize, number> = { sm: 12, md: 16, lg: 16 };
export const CONTROL_ICON_SLOT = 36;
export const TOUCH_ICON_SLOT = 44;

export interface ControlState {
  size?: ControlSize;
  touch?: boolean;
  focused?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  multiline?: boolean;
}

export const controlHeight = (s: ControlState) =>
  (s.touch ? TOUCH_CONTROL_HEIGHT : CONTROL_HEIGHT)[s.size ?? 'md'];
export const controlFontSize = (s: ControlState) => (s.touch ? 16 : 14);
export const controlIconSlot = (s: ControlState) => (s.touch ? TOUCH_ICON_SLOT : CONTROL_ICON_SLOT);
export const controlPadX = (s: ControlState) =>
  (s.touch ? TOUCH_PAD_X : CONTROL_PAD_X)[s.size ?? 'md'];

/** Frame classes: radius, background, opacity. Border colour and ring come from controlFrameStyle. */
export function controlClassName(s: ControlState): string {
  const size = s.size ?? 'md';
  return cn(
    'border',
    s.touch
      ? size === 'sm'
        ? 'rounded-lg'
        : 'rounded-xl'
      : size === 'sm'
        ? 'rounded-md'
        : 'rounded-lg',
    s.disabled ? 'bg-gray-100' : s.readOnly ? 'bg-gray-50' : 'bg-white',
    s.disabled && 'opacity-60',
  );
}

export function controlBorderColor(colors: ThemeColors, s: ControlState): string {
  if (s.invalid) return colors.destructive;
  if (s.disabled) return tw.gray200;
  if (s.focused && !s.readOnly) return colors.ring;
  return CONTROL_BORDER;
}

const editableFocus = (s: ControlState) => !!s.focused && !s.readOnly && !s.disabled;

/** Resting border width; touch focus thickens it (see the header). */
export const CONTROL_BORDER_WIDTH = 1;
export const TOUCH_FOCUS_BORDER_WIDTH = 2;

export function controlBorderWidth(s: ControlState): number {
  return s.touch && editableFocus(s) ? TOUCH_FOCUS_BORDER_WIDTH : CONTROL_BORDER_WIDTH;
}

/** Extra border beyond the resting 1px; subtract it from side padding so content doesn't shift. */
export const controlBorderInset = (s: ControlState) => controlBorderWidth(s) - CONTROL_BORDER_WIDTH;

/**
 * Soft ring (box-shadow), desktop web only: ring/15 on focus, destructive/20 when invalid, 3px.
 * Touch never gets one (a single border is the whole focus state).
 */
export function controlRing(colors: ThemeColors, s: ControlState): string | undefined {
  if (s.touch || !editableFocus(s)) return undefined;
  return `0 0 0 3px ${withAlpha(s.invalid ? colors.destructive : colors.ring, s.invalid ? 0.2 : 0.15)}`;
}

/** Frame style shared by every control (border colour and width, ring, height). */
export function controlFrameStyle(colors: ThemeColors, s: ControlState) {
  const ring = controlRing(colors, s);
  return {
    borderColor: controlBorderColor(colors, s),
    borderWidth: controlBorderWidth(s),
    ...(ring ? { boxShadow: ring } : null),
    ...(s.multiline ? null : { height: controlHeight(s) }),
  };
}

/** Text style of a TextInput inside a control (see the centring note above). */
export function controlTextStyle(s: ControlState, os: ControlOS): TextStyle {
  const fontSize = controlFontSize(s);
  const base: TextStyle = {
    fontSize,
    color: s.disabled ? CONTROL_DISABLED_TEXT : CONTROL_TEXT,
    paddingHorizontal: controlPadX(s) - controlBorderInset(s),
    ...(os === 'android' ? { includeFontPadding: false } : null),
  };
  const line = s.touch ? TOUCH_LINE_HEIGHT : MULTILINE_LINE_HEIGHT;
  if (s.multiline) {
    return {
      ...base,
      lineHeight: line,
      paddingTop: (s.touch ? 12 : 8) - controlBorderInset(s),
      paddingBottom: (s.touch ? 12 : 8) - controlBorderInset(s),
      textAlignVertical: 'top',
    };
  }
  return {
    ...base,
    paddingVertical: 0,
    textAlignVertical: 'center',
    // Android: room for Bangla once font padding is off. Web: a line box that centres in <input>.
    // iOS: none (UITextField centres itself; a forced lineHeight drops the baseline).
    ...(os === 'android'
      ? { lineHeight: TOUCH_LINE_HEIGHT }
      : os === 'web'
        ? { lineHeight: s.touch ? TOUCH_LINE_HEIGHT : 20 }
        : null),
  };
}

/** Multiline min height for `rows` visible lines. */
export const multilineMinHeight = (s: ControlState, rows: number) =>
  rows * (s.touch ? TOUCH_LINE_HEIGHT : MULTILINE_LINE_HEIGHT) + (s.touch ? 26 : 18);

/** Caret / selection colours (Android needs cursorColor + selectionHandleColor separately). */
export function controlCaretProps(colors: ThemeColors, os: ControlOS) {
  return os === 'android'
    ? {
        cursorColor: colors.ring,
        selectionHandleColor: colors.ring,
        selectionColor: withAlpha(colors.ring, 0.25),
      }
    : { selectionColor: os === 'ios' ? colors.ring : withAlpha(colors.ring, 0.25) };
}

/** Web only: no browser focus outline (the ring replaces it). */
export function webNoOutline(os: ControlOS) {
  return os === 'web'
    ? ({ outlineStyle: 'none', outlineWidth: 0 } as unknown as ViewStyle & TextStyle)
    : null;
}

/**
 * What a field holds, which sets the keyboard, autofill, capitalisation and autocorrect together.
 * Explicit props passed to Input still win.
 */
export type InputKind =
  | 'text'
  | 'name'
  | 'email'
  | 'username'
  | 'phone'
  | 'number'
  | 'decimal'
  | 'password'
  | 'new-password'
  | 'code'
  | 'otp'
  | 'search'
  | 'url';

type KeyboardProps = Pick<
  TextInputProps,
  | 'keyboardType'
  | 'inputMode'
  | 'autoComplete'
  | 'textContentType'
  | 'autoCapitalize'
  | 'autoCorrect'
  | 'spellCheck'
  | 'secureTextEntry'
  | 'returnKeyType'
>;

const NO_CORRECT = { autoCorrect: false, spellCheck: false } as const;

export function inputKindProps(kind: InputKind | undefined, os: ControlOS): KeyboardProps {
  switch (kind) {
    case 'name':
      return {
        autoCapitalize: 'words',
        autoComplete: 'name',
        textContentType: 'name',
        ...NO_CORRECT,
      };
    case 'email':
      return {
        keyboardType: 'email-address',
        inputMode: 'email',
        autoComplete: 'email',
        textContentType: 'emailAddress',
        autoCapitalize: 'none',
        ...NO_CORRECT,
      };
    case 'username':
      return {
        autoComplete: 'username',
        textContentType: 'username',
        autoCapitalize: 'none',
        ...NO_CORRECT,
      };
    case 'phone':
      return {
        keyboardType: 'phone-pad',
        inputMode: 'tel',
        autoComplete: 'tel',
        textContentType: 'telephoneNumber',
        ...NO_CORRECT,
      };
    case 'number':
      return {
        keyboardType: 'number-pad',
        inputMode: 'numeric',
        autoComplete: 'off',
        ...NO_CORRECT,
      };
    case 'decimal':
      return {
        keyboardType: 'decimal-pad',
        inputMode: 'decimal',
        autoComplete: 'off',
        ...NO_CORRECT,
      };
    case 'password':
      return {
        autoComplete: 'current-password',
        textContentType: 'password',
        autoCapitalize: 'none',
        secureTextEntry: true,
        ...NO_CORRECT,
      };
    case 'new-password':
      return {
        autoComplete: 'new-password',
        textContentType: 'newPassword',
        autoCapitalize: 'none',
        secureTextEntry: true,
        ...NO_CORRECT,
      };
    case 'code':
      return {
        autoCapitalize: 'characters',
        autoComplete: 'off',
        textContentType: 'none',
        keyboardType: os === 'android' ? 'visible-password' : 'default',
        ...NO_CORRECT,
      };
    case 'otp':
      return {
        keyboardType: 'number-pad',
        inputMode: 'numeric',
        autoComplete: 'one-time-code',
        textContentType: 'oneTimeCode',
        ...NO_CORRECT,
      };
    case 'search':
      return {
        keyboardType: os === 'ios' ? 'web-search' : 'default',
        inputMode: 'search',
        returnKeyType: 'search',
        autoCapitalize: 'none',
        ...NO_CORRECT,
      };
    case 'url':
      return {
        keyboardType: 'url',
        inputMode: 'url',
        autoComplete: 'url',
        textContentType: 'URL',
        autoCapitalize: 'none',
        ...NO_CORRECT,
      };
    default:
      return {};
  }
}

/** Keyboards without a return key on iOS (they get a Next/Done bar above the keyboard). */
export const isPadKeyboard = (k: TextInputProps['keyboardType']) =>
  k === 'number-pad' || k === 'decimal-pad' || k === 'phone-pad' || k === 'numeric';

/** The kind a bare `keyboardType` implies, so existing fields get matching autofill/autocorrect. */
export function kindForKeyboard(k: TextInputProps['keyboardType']): InputKind | undefined {
  switch (k) {
    case 'email-address':
      return 'email';
    case 'phone-pad':
      return 'phone';
    case 'number-pad':
    case 'numeric':
      return 'number';
    case 'decimal-pad':
      return 'decimal';
    case 'url':
      return 'url';
    default:
      return undefined;
  }
}

/**
 * Mark entry on phones: true once no further digit can be typed without passing `max`
 * (max 100: "45" and "100" are complete, "1" and "10" are not; "150" is invalid and stays),
 * so focus can jump to the next cell.
 */
export function markEntryComplete(text: string, max: number): boolean {
  if (!/^\d+$/.test(text)) return false;
  const n = Number(text);
  // Over the limit: stay in the cell so the error can be fixed.
  return n <= max && n * 10 > max;
}
