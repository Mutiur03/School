import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';

export type SchoolCodeRole = 'admin' | 'teacher' | 'student';

/** GET/POST/DELETE /api/school-codes (Nest, admin only, current school). */
export interface SchoolCode {
  id: number;
  code: string;
  role_hint: SchoolCodeRole | null;
  created_by: number | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  status: 'active' | 'revoked' | 'expired';
}

const errorMessage = (error: AxiosError<{ error?: string; message?: string }>, fallback: string) =>
  error.response?.data?.error || error.response?.data?.message || fallback;

export const useSchoolCodes = () =>
  useQuery<SchoolCode[]>({
    queryKey: ['school-codes'],
    queryFn: async () => (await axios.get('/api/school-codes')).data.data,
  });

export const useCreateSchoolCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { role_hint?: SchoolCodeRole }) =>
      (await axios.post('/api/school-codes', body)).data.data as SchoolCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-codes'] });
      toast.success('School code created');
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      toast.error(errorMessage(error, 'Error creating school code'));
    },
  });
};

export const useRevokeSchoolCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/school-codes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school-codes'] });
      toast.success('School code revoked');
    },
    onError: (error: AxiosError<{ error?: string; message?: string }>) => {
      toast.error(errorMessage(error, 'Error revoking school code'));
    },
  });
};
