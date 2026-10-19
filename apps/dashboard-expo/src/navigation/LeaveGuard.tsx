/**
 * Leave guard for the dashboard shell: `useLeaveGuard(active, …)` in a screen with unsaved work,
 * `useGuardedNavigate()` in the sidebar / tab bar / menus. While a guard is active those links,
 * signing out, Android's back button and (native) any stack pop such as the iOS back swipe
 * (`beforeRemove`) ask first ("Leave without saving?"). On web the browser's Back / Forward
 * buttons ask too (web-back-guard.ts undoes the move before the router sees it, then replays it
 * on "Leave"). Reload and closing the tab are covered separately by the screen's `beforeunload`
 * handler on web.
 */
import { useNavigation, useRouter } from 'expo-router';
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
import { BackHandler, Platform } from 'react-native';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { createLeaveGuardStore, type LeaveGuard, type LeaveGuardStore } from './leave-guard-model';
import type { NavHref } from './nav-items';
import { browserBackGuardWindow, installWebBackGuard } from './web-back-guard';

interface Ctx {
  store: LeaveGuardStore;
  attempt: (go: () => void) => void;
}

const LeaveGuardContext = createContext<Ctx | null>(null);

export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<LeaveGuardStore | null>(null);
  storeRef.current ??= createLeaveGuardStore();
  const store = storeRef.current;
  const [ask, setAsk] = useState<{ guard: LeaveGuard; proceed: () => void } | null>(null);
  const attempt = useCallback(
    (go: () => void) => store.attempt(go, (guard, proceed) => setAsk({ guard, proceed })),
    [store],
  );
  // Stable, so screens' guard effects don't re-run (and re-arm) when the dialog opens / closes.
  const value = useMemo(() => ({ store, attempt }), [store, attempt]);
  return (
    <LeaveGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={ask !== null}
        title={ask?.guard.title ?? ''}
        message={ask?.guard.message ?? ''}
        confirmLabel="Leave without saving"
        onClose={() => setAsk(null)}
        onConfirm={() => {
          const a = ask;
          setAsk(null);
          a?.proceed();
        }}
      />
    </LeaveGuardContext.Provider>
  );
}

/** Ask before leaving while `active`. */
export function useLeaveGuard(active: boolean, guard: LeaveGuard) {
  const ctx = useContext(LeaveGuardContext);
  const router = useRouter();
  const navigation = useNavigation();
  const { title, message } = guard;
  useEffect(() => {
    if (!ctx || !active) return;
    const g = { title, message };
    const remove = ctx.store.set(g);
    const unsubRemove =
      Platform.OS !== 'web'
        ? navigation.addListener('beforeRemove', (e) => {
            if (ctx.store.current() !== g) return;
            e.preventDefault();
            ctx.attempt(() => navigation.dispatch(e.data.action));
          })
        : null;
    const back =
      Platform.OS === 'android'
        ? BackHandler.addEventListener('hardwareBackPress', () => {
            if (ctx.store.current() !== g) return false;
            ctx.attempt(() => (router.canGoBack() ? router.back() : BackHandler.exitApp()));
            return true;
          })
        : null;
    const webWin = Platform.OS === 'web' ? browserBackGuardWindow() : null;
    const uninstallWeb = webWin
      ? installWebBackGuard(webWin, {
          isActive: () => ctx.store.current() === g,
          ask: (leave) => ctx.attempt(leave),
        })
      : null;
    return () => {
      remove();
      back?.remove();
      unsubRemove?.();
      uninstallWeb?.();
    };
  }, [ctx, active, title, message, router, navigation]);
}

/** Run `go` now, or after the user agrees to drop unsaved work. */
export function useGuardedAction() {
  const ctx = useContext(LeaveGuardContext);
  return useCallback((go: () => void) => (ctx ? ctx.attempt(go) : go()), [ctx]);
}

export function useGuardedNavigate() {
  const router = useRouter();
  const guarded = useGuardedAction();
  return useCallback(
    (href: NavHref | string) => guarded(() => router.navigate(href as NavHref)),
    [guarded, router],
  );
}
