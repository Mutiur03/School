import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import type { AccHeadFormData, CostCenterFormData, VoucherFormData } from '@school/shared-schemas';
import type { AccHead, CostCenter, Voucher, VoucherFilters } from '@/types/accounts';

type Params = Record<string, string | number | undefined | null>;

/** Drop empty filters so the API sees only what the user set. */
const clean = (p: Params) =>
  Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null));

const get = async <T>(url: string, params?: Params) =>
  (await axios.get(url, { params: params && clean(params) })).data.data as T;

/** Shared mutation wiring: invalidate keys, toast success / API error. */
const useAccMutation = <V>(
  fn: (vars: V) => Promise<unknown>,
  keys: string[],
  success: string,
  failure: string,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(success);
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      toast.error(error.response?.data?.error || error.response?.data?.message || failure);
    },
  });
};

// ---- Account heads ----
export const useAccHeads = () =>
  useQuery<AccHead[]>({ queryKey: ['acc-heads'], queryFn: () => get('/api/acc-heads') });

export const useCreateAccHead = () =>
  useAccMutation(
    (data: AccHeadFormData) => axios.post('/api/acc-heads', data),
    ['acc-heads'],
    'Account head added',
    'Error adding account head',
  );

export const useUpdateAccHead = () =>
  useAccMutation(
    ({ id, data }: { id: number; data: Partial<AccHeadFormData> }) =>
      axios.patch(`/api/acc-heads/${id}`, data),
    ['acc-heads', 'acc-reports'],
    'Account head updated',
    'Error updating account head',
  );

export const useDeleteAccHead = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/acc-heads/${id}`),
    ['acc-heads'],
    'Account head deleted',
    'Error deleting account head',
  );

// ---- Cost centers ----
export const useCostCenters = () =>
  useQuery<CostCenter[]>({ queryKey: ['cost-centers'], queryFn: () => get('/api/cost-centers') });

export const useCreateCostCenter = () =>
  useAccMutation(
    (data: CostCenterFormData) => axios.post('/api/cost-centers', data),
    ['cost-centers'],
    'Cost center added',
    'Error adding cost center',
  );

export const useUpdateCostCenter = () =>
  useAccMutation(
    ({ id, data }: { id: number; data: Partial<CostCenterFormData> }) =>
      axios.patch(`/api/cost-centers/${id}`, data),
    ['cost-centers', 'acc-reports'],
    'Cost center updated',
    'Error updating cost center',
  );

export const useDeleteCostCenter = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/cost-centers/${id}`),
    ['cost-centers'],
    'Cost center deleted',
    'Error deleting cost center',
  );

// ---- Vouchers ----
export const useVouchers = (filters: VoucherFilters) =>
  useQuery<Voucher[]>({
    queryKey: ['vouchers', filters],
    queryFn: () => get('/api/vouchers', { ...filters }),
  });

export const useCreateVoucher = () =>
  useAccMutation(
    (data: VoucherFormData) => axios.post('/api/vouchers', data),
    ['vouchers', 'acc-reports'],
    'Voucher saved',
    'Error saving voucher',
  );

export const useUpdateVoucher = () =>
  useAccMutation(
    ({ id, data }: { id: number; data: Partial<VoucherFormData> }) =>
      axios.patch(`/api/vouchers/${id}`, data),
    ['vouchers', 'acc-reports'],
    'Voucher updated',
    'Error updating voucher',
  );

export const useDeleteVoucher = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/vouchers/${id}`),
    ['vouchers', 'acc-reports'],
    'Voucher deleted',
    'Error deleting voucher',
  );

// ---- Reports ----
export type AccReportName =
  'ledger' | 'trial-balance' | 'income-expense' | 'balance-sheet' | 'cost-center';

export const useAccReport = <T>(name: AccReportName, params: Params, enabled = true) =>
  useQuery<T>({
    queryKey: ['acc-reports', name, params],
    queryFn: () => get(`/api/acc-reports/${name}`, params),
    enabled,
  });
