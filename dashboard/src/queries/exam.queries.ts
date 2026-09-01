import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export interface Exam {
  id: number;
  exam_name: string;
  exam_year: number;
  levels: number[];
  visible: boolean;
  start_date: string;
  end_date: string;
  result_date: string;
  return_date?: string | null;
  exam_type_id?: number;
  is_year_end?: boolean;
  routine?: string | null;
  download_url?: string | null;
}

export interface ExamTypeUsage {
  school_id: number;
  school_name: string;
  exam_year: number;
  exam_name: string;
  levels: number[];
}

export interface ExamType {
  id: number;
  name: string;
  is_year_end: boolean;
  sort_order: number;
  assign_to_new_schools?: boolean;
  school_ids?: number[];
  exam_count?: number;
  used_by?: ExamTypeUsage[];
}

export interface ExamWritePayload {
  exam_type_id: number;
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
  return_date?: string;
}

function apiMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { message?: string; error?: string } } };
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

export const useExams = () => {
  return useQuery<Exam[]>({
    queryKey: ['exams'],
    queryFn: async () => {
      const response = await axios.get('/api/exams/getExams');
      return response.data?.data || [];
    },
  });
};

export const useAssignedExamTypes = () => {
  return useQuery<ExamType[]>({
    queryKey: ['exam-types', 'assigned'],
    queryFn: async () => {
      const response = await axios.get('/api/exam-types/assigned');
      return response.data?.data || [];
    },
  });
};

export const useCreateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ExamWritePayload) => {
      const response = await axios.post('/api/exams/addExam', { exams: [payload] });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Exam created');
    },
    onError: (error) => {
      toast.error(apiMessage(error, 'Could not create exam'));
    },
  });
};

export const useUpdateExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: ExamWritePayload }) => {
      const response = await axios.put(`/api/exams/updateExam/${id}`, payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Exam updated');
    },
    onError: (error) => {
      toast.error(apiMessage(error, 'Could not update exam'));
    },
  });
};

export const useDeleteExam = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await axios.delete(`/api/exams/deleteExam/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      toast.success('Exam deleted');
    },
    onError: (error) => {
      toast.error(apiMessage(error, 'Could not delete exam'));
    },
  });
};

export const useToggleExamVisibility = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visible }: { id: number; visible: boolean }) => {
      const response = await axios.put<{ success: boolean; queued?: number }>(
        `/api/exams/updateVisibility/${id}`,
        { visible },
      );
      if (!response.data.success) {
        throw new Error('Visibility update failed');
      }
      return response.data;
    },
    onSuccess: (data, { visible, id }) => {
      queryClient.invalidateQueries({ queryKey: ['exams'] });
      queryClient.invalidateQueries({ queryKey: ['marksheet-gen-status', id] });
      if (visible) {
        const queued = data.queued ?? 0;
        toast.success(
          queued > 0
            ? `Results published — generating ${queued} marksheet${queued === 1 ? '' : 's'}…`
            : 'Results published',
        );
      } else {
        toast.success('Results hidden');
      }
    },
    onError: (error) => {
      toast.error(apiMessage(error, 'Could not update publish state'));
    },
  });
};
