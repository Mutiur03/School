import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

export type CertificateStatus = 'pending' | 'approved';

export interface CertificateRecord {
  id: string;
  status: CertificateStatus;
  data: Record<string, string | number>;
  created_at: string;
  updated_at: string;
  edits: number;
}

export interface CertificateRevision {
  id: number;
  created_at: string;
  changes: { field: string; from: string | number | null; to: string | number | null }[];
}

export type CertificateSortKey = 'name' | 'exam' | 'year' | 'mobile' | 'updated' | 'edits';

export interface CertificateListParams {
  page: number;
  limit: number;
  sort?: CertificateSortKey;
  order?: 'asc' | 'desc';
  name?: string;
  mobile?: string;
  exam?: string[];
  year?: string[];
  edits?: 'edited' | 'never';
  status?: CertificateStatus;
}

export interface CertificateList {
  items: CertificateRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    totalAll: number;
    editedCount: number;
    pendingCount: number;
    exams: string[];
    years: number[];
  };
}

export const useCertificates = ({ exam, year, ...params }: CertificateListParams) =>
  useQuery<CertificateList>({
    queryKey: ['certificates', 'list', { exam, year, ...params }],
    // Keep showing the previous page while the next one loads.
    placeholderData: keepPreviousData,
    queryFn: async () =>
      (
        await axios.get('/api/admin/certificates', {
          params: {
            ...params,
            exam: exam?.join(',') || undefined,
            year: year?.join(',') || undefined,
          },
        })
      ).data.data,
  });

export const useCertificateHistory = (id: string | null) =>
  useQuery<CertificateRevision[]>({
    queryKey: ['certificates', id, 'revisions'],
    enabled: !!id,
    queryFn: async () => (await axios.get(`/api/admin/certificates/${id}/revisions`)).data.data,
  });

/** Approve locks the record; pending unlocks it so the student can edit again. */
export const useUpdateCertificateStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CertificateStatus }) => {
      await axios.patch(`/api/admin/certificates/${id}/status`, { status });
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success(status === 'approved' ? 'Certificate approved' : 'Unlocked for editing');
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      toast.error(error.response?.data?.message || 'Failed to update status'),
  });
};

export const useDeleteCertificate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await axios.delete(`/api/admin/certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificates'] });
      toast.success('Certificate deleted');
    },
    onError: (error: AxiosError<{ message?: string }>) =>
      toast.error(error.response?.data?.message || 'Error deleting certificate'),
  });
};
