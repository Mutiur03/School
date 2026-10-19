/**
 * Minimal stand-in for react-hot-toast (used by every web admin page): `toast.success` /
 * `toast.error` show a small card at the bottom for a few seconds. Plain React context, no
 * global store.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setPdfNoticeSink } from '@/lib/files/pdf-notice';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { CheckCircle2, XCircle } from './icons';
import { Text } from './Text';
import { tw } from '@/theme/tokens';

type Kind = 'success' | 'error';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}
export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);
const DURATION_MS = 3_500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const insets = useSafeAreaInsets();
  const { shadows } = useTheme();

  const push = useCallback((kind: Kind, message: string) => {
    const id = nextId.current++;
    setItems((prev) => [...prev.slice(-2), { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), DURATION_MS);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );
  // The central PDF helper's notices (e.g. no PDF viewer installed) show as toasts.
  useEffect(() => {
    setPdfNoticeSink((m) => push('error', m));
    return () => setPdfNoticeSink(null);
  }, [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 items-center gap-2 px-4"
        style={{ bottom: 24 + insets.bottom }}
      >
        {items.map((t) => (
          <View
            key={t.id}
            testID={`toast-${t.kind}`}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className={cn(
              'border-border bg-popover max-w-md flex-row items-center gap-2 rounded-lg border px-4 py-3',
            )}
            style={{ boxShadow: shadows.popover }}
          >
            <Icon
              icon={t.kind === 'success' ? CheckCircle2 : XCircle}
              size={16}
              rawColor={t.kind === 'success' ? tw.emerald700 : tw.red800}
            />
            <Text size="sm" className="shrink">
              {t.message}
            </Text>
          </View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

const noop: ToastApi = { success: () => {}, error: () => {} };

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop;
}
