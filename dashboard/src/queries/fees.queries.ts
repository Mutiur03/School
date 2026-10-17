import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { openBlobInNewTab, openPdfLoadingTab } from '@school/common-ui/blob';
import { get, useAccMutation, type Params } from '@/queries/accounts.queries';
import type {
  FeeCollectionReport,
  FeeDuesReport,
  FeeHead,
  FeeHeadInput,
  FeeReceiptInput,
  FeeReceiptListItem,
  FeeStatement,
  FeeStructureRow,
  FeeSummary,
  FeeWaiver,
  FeeWaiverInput,
} from '@/types/fees';

// A receipt posts a voucher, so ledger reports and vouchers refresh with it.
const LEDGER = ['vouchers', 'acc-reports'];

// ---- Fee heads ----
export const useFeeHeads = () =>
  useQuery<FeeHead[]>({ queryKey: ['fee-heads'], queryFn: () => get('/api/fee-heads') });

export const useCreateFeeHead = () =>
  useAccMutation(
    (data: FeeHeadInput) => axios.post('/api/fee-heads', data),
    ['fee-heads'],
    'Fee head added',
    'Error adding fee head',
  );

export const useUpdateFeeHead = () =>
  useAccMutation(
    ({ id, data }: { id: number; data: Partial<FeeHeadInput> }) =>
      axios.patch(`/api/fee-heads/${id}`, data),
    ['fee-heads', 'fee-statement'],
    'Fee head updated',
    'Error updating fee head',
  );

export const useDeleteFeeHead = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/fee-heads/${id}`),
    ['fee-heads'],
    'Fee head deleted',
    'Error deleting fee head',
  );

// ---- Fee structure ----
export const useFeeStructure = (year: number, cls?: number) =>
  useQuery<FeeStructureRow[]>({
    queryKey: ['fee-structures', year, cls],
    queryFn: () => get('/api/fee-structures', { year, class: cls }),
  });

export const useSetFeeStructure = () =>
  useAccMutation(
    (data: { year: number; class: number; items: { fee_head_id: number; amount: number }[] }) =>
      axios.put('/api/fee-structures', data),
    ['fee-structures', 'fee-statement', 'fee-reports'],
    'Fees saved',
    'Error saving fees',
  );

export const useCopyFeeStructure = () =>
  useAccMutation(
    (data: { from_year: number; to_year: number }) => axios.post('/api/fee-structures', data),
    ['fee-structures'],
    'Fees copied',
    'Error copying fees',
  );

// ---- Waivers ----
export const useFeeWaivers = (params: Params) =>
  useQuery<FeeWaiver[]>({
    queryKey: ['fee-waivers', params],
    queryFn: () => get('/api/fee-waivers', params),
  });

export const useCreateFeeWaiver = () =>
  useAccMutation(
    (data: FeeWaiverInput) => axios.post('/api/fee-waivers', data),
    ['fee-waivers', 'fee-statement', 'fee-reports'],
    'Waiver added',
    'Error adding waiver',
  );

export const useDeleteFeeWaiver = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/fee-waivers/${id}`),
    ['fee-waivers', 'fee-statement', 'fee-reports'],
    'Waiver removed',
    'Error removing waiver',
  );

// ---- Receipts ----
export const useFeeStatement = (studentId?: number, year?: number) =>
  useQuery<FeeStatement>({
    queryKey: ['fee-statement', studentId, year],
    queryFn: () => get('/api/fee-receipts/statement', { student_id: studentId, year }),
    enabled: !!studentId && !!year,
    retry: false,
  });

export const useFeeReceipts = (params: Params) =>
  useQuery<FeeReceiptListItem[]>({
    queryKey: ['fee-receipts', params],
    queryFn: () => get('/api/fee-receipts', params),
  });

export const useCreateFeeReceipt = () =>
  useAccMutation(
    (data: FeeReceiptInput) =>
      axios.post('/api/fee-receipts', data).then((r) => r.data.data as { id: number }),
    ['fee-receipts', 'fee-statement', 'fee-reports', ...LEDGER],
    'Fees collected',
    'Error collecting fees',
  );

export const useDeleteFeeReceipt = () =>
  useAccMutation(
    (id: number) => axios.delete(`/api/fee-receipts/${id}`),
    ['fee-receipts', 'fee-statement', 'fee-reports', ...LEDGER],
    'Receipt deleted',
    'Error deleting receipt',
  );

// ---- Reports ----
export const useFeeSummary = (date: string) =>
  useQuery<FeeSummary>({
    queryKey: ['fee-reports', 'summary', date],
    queryFn: () => get('/api/fee-reports/summary', { date }),
  });

export const useFeeCollectionReport = (from: string, to: string) =>
  useQuery<FeeCollectionReport>({
    queryKey: ['fee-reports', 'collection', from, to],
    queryFn: () => get('/api/fee-reports/collection', { from, to }),
    enabled: !!from && !!to && from <= to,
  });

export const useFeeDuesReport = (params: Params, enabled: boolean) =>
  useQuery<FeeDuesReport>({
    queryKey: ['fee-reports', 'dues', params],
    queryFn: () => get('/api/fee-reports/dues', params),
    enabled,
  });

/** Fetches a PDF with the session cookie and opens it in a new tab. */
export async function openFeePdf(url: string, params?: Params) {
  const tab = openPdfLoadingTab('Generating PDF…');
  try {
    const res = await axios.get(url, { params, responseType: 'blob' });
    openBlobInNewTab(new Blob([res.data], { type: 'application/pdf' }), tab ?? undefined);
  } catch {
    tab?.close();
    toast.error('Failed to open PDF');
  }
}
