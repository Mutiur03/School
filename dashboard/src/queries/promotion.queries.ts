import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export type PromotionPassRule = {
  class: number;
  max_failed: number;
};

export const PROMOTION_PASS_CLASSES = [6, 7, 8, 9, 10] as const;

export const usePromotionPassRules = (year: number) => {
  return useQuery({
    queryKey: ['promotion-pass-rules', year],
    queryFn: async () => {
      const response = await axios.get(`/api/promotions/${year}/pass-rules`);
      return (response.data?.data ?? []) as PromotionPassRule[];
    },
  });
};

export const useSavePromotionPassRules = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      year,
      rules,
    }: {
      year: number;
      rules: PromotionPassRule[];
      silent?: boolean;
    }) => {
      const response = await axios.put(`/api/promotions/${year}/pass-rules`, { rules });
      return response.data?.data as PromotionPassRule[];
    },
    onSuccess: (_data, { year, silent }) => {
      queryClient.invalidateQueries({ queryKey: ['promotion-pass-rules', year] });
      if (!silent) toast.success('Pass rules saved');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Could not save pass rules');
    },
  });
};

export type PromotionYearStats = {
  year: number;
  newYear: number;
  promotion: {
    passed: number;
    failed: number;
    pending: number;
    graduated: number;
    total: number;
  };
  class10: {
    passed: number;
    failed: number;
    pending: number;
    graduated: number;
    total: number;
  };
  promoted: boolean;
  next_year_enrollments: number;
};

export const usePromotionYearStats = (year: number) => {
  return useQuery({
    queryKey: ['promotion-stats', year],
    queryFn: async () => {
      const response = await axios.get(`/api/promotions/${year}/stats`);
      return response.data?.data as PromotionYearStats;
    },
  });
};

export type PromotionPreviewRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  class: number;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  new_class: number;
  new_section: string;
  new_roll: number;
};

export type PromotionPreview = {
  year: number;
  newYear: number;
  students: PromotionPreviewRow[];
  summary: {
    total: number;
    passed_promoted: number;
    failed_retained: number;
    skipped: number;
    section_a: number;
    section_b: number;
    existing_next_year_enrollments: number;
    subjects_will_clone: boolean;
  };
};

export type GraduationPreviewRow = {
  enrollment_id: number;
  student_id: number;
  name: string;
  section: string;
  roll: number;
  group: string | null;
  status: string;
  gpa: number;
  final_merit: number;
  action: 'graduate' | 'retain';
  ssc_batch: string | null;
  new_section: string | null;
  new_roll: number | null;
};

export type GraduationPreview = {
  year: number;
  newYear: number;
  sscBatch: string;
  students: GraduationPreviewRow[];
  summary: {
    total: number;
    graduates: number;
    retained: number;
    skipped: number;
    existing_class10_next_year: number;
  };
};

export type EnrollmentStatus = 'Passed' | 'Failed' | 'Pending';

export const ENROLLMENT_STATUS_OPTIONS: EnrollmentStatus[] = ['Passed', 'Failed', 'Pending'];

export const useOverrideEnrollmentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      year,
      enrollmentId,
      status,
    }: {
      year: number;
      enrollmentId: number;
      status: EnrollmentStatus;
    }) => {
      await axios.patch(`/api/promotions/${year}/results/${enrollmentId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Could not update status');
    },
  });
};

export const useUpdatePromotionStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotions/${year}/results`);
      return response.data?.data as
        | {
            updated?: number;
            passed?: number;
            failed?: number;
            missingYearEnd?: number[];
            missingPrevious?: number[];
          }
        | undefined;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      if (data?.passed != null && data?.failed != null) {
        toast.success(`Pass/fail updated: ${data.passed} passed, ${data.failed} failed`);
      } else {
        toast.success('Pass/fail status generated');
      }
      if (data?.missingYearEnd?.length) {
        toast.error(`Skipped class ${data.missingYearEnd.join(', ')}: no year-end exam`);
      }
      if (data?.missingPrevious?.length) {
        toast.error(
          `Skipped class ${data.missingPrevious.join(', ')}: no exam before the year-end exam`,
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to generate result');
    },
  });
};

export const usePromotionPreview = () => {
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.get(`/api/promotions/${year}/plan`);
      return response.data?.data as PromotionPreview;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Could not build promotion preview');
    },
  });
};

export const useGraduationPreview = () => {
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.get(`/api/graduations/${year}/plan`);
      return response.data?.data as GraduationPreview;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Could not build graduation preview');
    },
  });
};

export const useGraduateClass10 = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/graduations/${year}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      const payload = data?.data as { graduated?: number; retained?: number } | undefined;
      if (payload?.graduated != null) {
        toast.success(
          `Graduation complete: ${payload.graduated} alumni, ${payload.retained ?? 0} retained`,
        );
      } else {
        toast.success('Graduation complete');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to graduate class 10');
    },
  });
};

export const useGeneratePromotionRoll = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (year: number) => {
      const response = await axios.post(`/api/promotions/${year}`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['promotion-stats'] });
      const payload = data?.data as
        { promoted?: number; skipped?: number; newYear?: number } | undefined;
      toast.success(
        payload?.promoted != null
          ? `Promotion complete: ${payload.promoted} students → ${payload.newYear}`
          : 'Promotion completed',
      );
      if (payload?.skipped) toast.error(`${payload.skipped} skipped (status not Passed/Failed)`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to promote students');
    },
  });
};
