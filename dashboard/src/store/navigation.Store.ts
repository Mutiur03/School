import { useSyncExternalStore } from 'react';

let dirty = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setDirty(isDirty: boolean) {
  if (dirty === isDirty) return;
  dirty = isDirty;
  emit();
}

function resetDirty() {
  setDirty(false);
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Cross-page unsaved-guard flag (Attendence / StayCheck ↔ Navbar / Sidebar). */
export default function useNavigationStore() {
  const isDirty = useSyncExternalStore(
    subscribe,
    () => dirty,
    () => false,
  );
  return { isDirty, setDirty, resetDirty };
}
