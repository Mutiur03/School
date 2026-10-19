/** Shared, tenant-scoped queries for the fee and accounts pages. */
import { useQuery } from '@tanstack/react-query';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

export function useFinanceKey() {
  const { resolution } = useTenant();
  return (...parts: unknown[]) => privateQueryKey(resolution.tenantKey, ...parts);
}

export function useAccHeads() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  return useQuery({
    queryKey: key('acc-heads'),
    queryFn: () => accounts.heads(),
    staleTime: 60_000,
  });
}

export function useCostCenters() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  return useQuery({
    queryKey: key('cost-centers'),
    queryFn: () => accounts.costCenters(),
    staleTime: 60_000,
  });
}

export function useAccYears() {
  const { accounts } = useApi();
  const key = useFinanceKey();
  return useQuery({
    queryKey: key('acc-years'),
    queryFn: () => accounts.years(),
    staleTime: 30_000,
  });
}

export function useFeeHeads() {
  const { fees } = useApi();
  const key = useFinanceKey();
  return useQuery({ queryKey: key('fee-heads'), queryFn: () => fees.heads(), staleTime: 60_000 });
}

/**
 * Everything a fee or voucher write can change: receipts, statements, reports and the books.
 * Invalidating broadly keeps every page honest after money moves.
 */
export const MONEY_KEYS = [
  ['fee-statement'],
  ['fee-receipts'],
  ['fee-summary'],
  ['fee-collection'],
  ['fee-dues'],
  ['vouchers'],
  ['acc-years'],
  ['acc-report'],
  ['acc-heads'],
] as const;
