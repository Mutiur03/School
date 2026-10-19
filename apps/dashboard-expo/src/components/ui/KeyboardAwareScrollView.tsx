/**
 * The scroll container for screens with fields (PageLayout, AuthLayout, Dialog). On iOS/Android:
 *  - adds a spacer the height of the part of the keyboard that covers the scroll view, so the
 *    last field and the submit button can scroll above the keyboard (also with Android
 *    edge-to-edge, where the window no longer resizes);
 *  - scrolls the focused field into view when the keyboard opens and when focus moves to
 *    another field (Next);
 *  - taps on empty space dismiss the keyboard (`keyboardShouldPersistTaps="handled"`), and so
 *    does dragging the content (interactive on iOS).
 * On web it is a plain ScrollView.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import {
  Keyboard,
  Platform,
  TextInput,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView as RNScrollView,
} from 'react-native';
import type { ScrollView } from './ScrollView';

const native = Platform.OS !== 'web';
/** Gap kept between the focused field and the top of the keyboard. */
const REVEAL_MARGIN = 88;

const RevealContext = createContext<(() => void) | null>(null);
/** Input calls this on focus so a field reached by "Next" scrolls into view too. */
export const useRevealFocusedField = () => useContext(RevealContext);

type Props = ComponentProps<typeof ScrollView> & {
  /** `shrink` for content-sized parents (dialogs, sheets); default fills the parent. */
  frame?: 'fill' | 'shrink';
};

export function KeyboardAwareScrollView({
  children,
  onScroll,
  frame: mode = 'fill',
  ...props
}: Props) {
  const scroll = useRef<RNScrollView | null>(null);
  const frame = useRef<View | null>(null);
  const offset = useRef(0);
  const kbTop = useRef<number | null>(null);
  const [cover, setCover] = useState(0);

  const reveal = useCallback(() => {
    if (!native || kbTop.current == null) return;
    const input = TextInput.State.currentlyFocusedInput() as unknown as View | null;
    if (!input || !frame.current) return;
    frame.current.measureInWindow((_fx, fy) => {
      input.measureInWindow((_x, y, _w, h) => {
        const visibleBottom = (kbTop.current ?? Infinity) - REVEAL_MARGIN;
        const delta = y + h > visibleBottom ? y + h - visibleBottom : y < fy + 8 ? y - fy - 16 : 0;
        if (delta)
          scroll.current?.scrollTo({ y: Math.max(0, offset.current + delta), animated: true });
      });
    });
  }, []);

  useEffect(() => {
    if (!native) return;
    const show = (e: KeyboardEvent) => {
      kbTop.current = e.endCoordinates.screenY;
      frame.current?.measureInWindow((_x, y, _w, h) => {
        setCover(Math.max(0, y + h - e.endCoordinates.screenY));
        setTimeout(reveal, Platform.OS === 'ios' ? 0 : 60);
      });
    };
    const hide = () => {
      kbTop.current = null;
      setCover(0);
    };
    const subs = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', show),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [reveal]);

  const onFocusReveal = useMemo(() => () => setTimeout(reveal, 80), [reveal]);

  return (
    <RevealContext.Provider value={native ? onFocusReveal : null}>
      <View
        ref={frame}
        collapsable={false}
        style={mode === 'fill' ? { flex: 1 } : { flexShrink: 1, minHeight: 0 }}
      >
        <RNScrollView
          ref={scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          scrollEventThrottle={32}
          {...(props as ComponentProps<typeof RNScrollView>)}
          onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
            offset.current = e.nativeEvent.contentOffset.y;
            onScroll?.(e);
          }}
        >
          {children}
          {cover ? <View style={{ height: cover }} /> : null}
        </RNScrollView>
      </View>
    </RevealContext.Provider>
  );
}
