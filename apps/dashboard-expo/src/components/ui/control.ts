/**
 * Platform-bound form-control spec (see control-spec.ts for the spec itself and its rationale).
 * The spec lives in a react-native-free module so it can be unit tested under plain node.
 */
import { Platform } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { ThemeColors } from '@/theme/tokens';
import {
  controlCaretProps as caretFor,
  controlTextStyle as textFor,
  inputKindProps as kindFor,
  webNoOutline,
  type ControlState,
  type InputKind,
} from './control-spec';

export * from './control-spec';

export const controlTextStyle = (s: ControlState) => textFor(s, Platform.OS);
export const controlCaretProps = (colors: ThemeColors) => caretFor(colors, Platform.OS);
export const inputKindProps = (kind: InputKind | undefined) => kindFor(kind, Platform.OS);
/** Web only: no browser focus outline (the ring replaces it). */
export const WEB_NO_OUTLINE = webNoOutline(Platform.OS);

/** Touch density: always on iOS/Android, and on web below the `sm` breakpoint (phones). */
export function useControlTouch(): boolean {
  const bp = useBreakpoint();
  return Platform.OS !== 'web' || bp === 'mobile';
}
