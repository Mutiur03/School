/**
 * The web admin pages' mutation pattern (useMutation + invalidateQueries + toast) with
 * tenant-scoped query keys: success invalidates `invalidate` under this school's private keys.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { mutationErrorMessage } from './errors';

export function useAdminMutation<TVars, TResult = void>({
  mutationFn,
  invalidate,
  success,
  failure,
  onSuccess,
}: {
  mutationFn: (vars: TVars) => Promise<TResult>;
  /** Query key parts after the private prefix, e.g. [['teachers'], ['dashboard']]. */
  invalidate: readonly (readonly unknown[])[];
  success: string | ((result: TResult) => string | null);
  failure: string;
  onSuccess?: (result: TResult, vars: TVars) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const { resolution } = useTenant();
  return useMutation({
    mutationFn,
    onSuccess: (result, vars) => {
      for (const parts of invalidate) {
        void queryClient.invalidateQueries({
          queryKey: privateQueryKey(resolution.tenantKey, ...parts),
        });
      }
      const msg = typeof success === 'function' ? success(result) : success;
      if (msg) toast.success(msg);
      onSuccess?.(result, vars);
    },
    onError: (error) => toast.error(mutationErrorMessage(error, failure)),
  });
}
