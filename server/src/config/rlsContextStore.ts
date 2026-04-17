import { AsyncLocalStorage } from "node:async_hooks";

export type RlsRequestContext = {
  schoolId?: number;
  isSuperAdmin: boolean;
  inRlsTransaction?: boolean;
};

const rlsContextStore = new AsyncLocalStorage<RlsRequestContext>();

export const runWithRlsContext = <T>(
  context: RlsRequestContext,
  callback: () => T,
): T => rlsContextStore.run(context, callback);

export const getRlsContext = () => rlsContextStore.getStore();

export const patchRlsContext = (patch: Partial<RlsRequestContext>) => {
  const current = rlsContextStore.getStore();
  if (!current) return;
  Object.assign(current, patch);
};
