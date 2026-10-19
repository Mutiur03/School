/**
 * Focus chaining for forms: inside `<FormChain>`, every single-line Input gets "Next" on its
 * return key (moving to the next field) and the last one gets "Done" (or "Go" when the chain
 * has `onSubmit`, which then runs). Order is mount order, i.e. the order fields appear. Inputs
 * that set their own `returnKeyType` / `onSubmitEditing` (search, mark cells) keep them.
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
  type RefObject,
} from 'react';
import type { TextInput } from 'react-native';

interface Chain {
  register: (ref: RefObject<TextInput | null>) => () => void;
  next: (ref: RefObject<TextInput | null>) => void;
  isLast: (ref: RefObject<TextInput | null>) => boolean;
  hasSubmit: boolean;
}

/** Stable API (register effects depend on it), and a version that re-renders consumers. */
const ChainContext = createContext<Chain | null>(null);
const ChainVersion = createContext(0);

export function FormChain({ onSubmit, children }: { onSubmit?: () => void; children: ReactNode }) {
  const refs = useRef<RefObject<TextInput | null>[]>([]);
  const submit = useRef(onSubmit);
  submit.current = onSubmit;
  // Bumped when fields come and go, so the (new) last field re-renders with "Done".
  const [version, setVersion] = useState(0);
  const register = useCallback((ref: RefObject<TextInput | null>) => {
    refs.current.push(ref);
    setVersion((v) => v + 1);
    return () => {
      refs.current = refs.current.filter((r) => r !== ref);
      setVersion((v) => v + 1);
    };
  }, []);
  const live = () => refs.current.filter((r) => r.current);
  const next = useCallback((ref: RefObject<TextInput | null>) => {
    const list = live();
    const i = list.indexOf(ref);
    const target = i >= 0 ? list[i + 1] : undefined;
    if (target?.current) target.current.focus();
    else {
      ref.current?.blur();
      submit.current?.();
    }
  }, []);
  const isLast = useCallback((ref: RefObject<TextInput | null>) => {
    const list = live();
    return list.length > 0 && list[list.length - 1] === ref;
  }, []);
  const hasSubmit = !!onSubmit;
  const value = useMemo(
    () => ({ register, next, isLast, hasSubmit }),
    [register, next, isLast, hasSubmit],
  );
  return (
    <ChainContext.Provider value={value}>
      <ChainVersion.Provider value={version}>{children}</ChainVersion.Provider>
    </ChainContext.Provider>
  );
}

/** Used by Input: registers the field and returns its chain behaviour (null outside a chain). */
export function useChainedField(ref: RefObject<TextInput | null>, enabled: boolean) {
  const chain = useContext(ChainContext);
  useContext(ChainVersion); // re-render when fields come and go ("Done" moves to the new last)
  useEffect(() => (chain && enabled ? chain.register(ref) : undefined), [chain, enabled, ref]);
  if (!chain || !enabled) return null;
  return {
    last: () => chain.isLast(ref),
    advance: () => chain.next(ref),
    submitLabel: chain.hasSubmit ? ('go' as const) : ('done' as const),
  };
}
