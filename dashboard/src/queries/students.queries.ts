import type { Student } from '@/types/students';
import type { StudentAttendanceResponse } from '@/types/attendance';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';

export type StudentProfile = Student & {
  enrollments?: Array<{
    id: number;
    class: number;
    section: string;
    roll: number;
    year: number;
    group?: string | null;
  }>;
};

export type StudentsListMeta = {
  total: number;
  filtered: number;
  page: number;
  limit: number;
  totalPages: number;
  availableClasses?: number[];
  availableSections?: string[];
  availableRolls?: number[];
};

export type StudentsListResponse = {
  data: Student[];
  meta: StudentsListMeta;
};

export const useStudents = (params: {
  year: number;
  page: number;
  limit: number;
  level?: number;
  section?: string;
  religion?: string;
  roll?: number;
  search?: string;
}) => {
  const { year, page, limit, level, section, religion, roll, search } = params;

  return useQuery<StudentsListResponse>({
    queryKey: ['students', year, { page, limit, level, section, religion, roll, search }],
    queryFn: async () => {
      const response = await axios.get(`/api/students`, {
        params: { year, page, limit, level, section, religion, roll, search },
      });

      const payload = response.data?.data as StudentsListResponse | undefined;
      const list = (payload?.data || []).filter(
        (student: Student) => student.class >= 1 && student.class <= 10,
      ) as Student[];

      const meta: StudentsListMeta = {
        total: payload?.meta?.total ?? 0,
        filtered: payload?.meta?.filtered ?? 0,
        page: payload?.meta?.page ?? page,
        limit: payload?.meta?.limit ?? limit,
        totalPages: payload?.meta?.totalPages ?? 0,
        availableClasses: payload?.meta?.availableClasses,
        availableSections: payload?.meta?.availableSections,
        availableRolls: payload?.meta?.availableRolls,
      };

      return { data: list, meta } satisfies StudentsListResponse;
    },
    placeholderData: keepPreviousData,
  });
};

export const useStudentProfile = (year?: number) => {
  return useQuery<StudentProfile>({
    queryKey: ['student-profile', year],
    queryFn: async () => {
      const response = await axios.get('/api/students/me', {
        params: year ? { year } : undefined,
      });
      return response.data?.data as StudentProfile;
    },
  });
};

export const useStudentAttendance = (params: {
  studentId?: number;
  month?: number;
  year: number;
  enabled?: boolean;
}) => {
  const { studentId, month, year, enabled = true } = params;

  return useQuery<StudentAttendanceResponse>({
    queryKey: ['student-attendance', studentId ?? 'me', month, year],
    queryFn: async () => {
      const url = studentId
        ? `/api/students/${studentId}/attendance`
        : '/api/students/me/attendance';
      const response = await axios.get(url, {
        params: { month, year },
      });
      return response.data?.data as StudentAttendanceResponse;
    },
    enabled: enabled && !!year,
    placeholderData: keepPreviousData,
  });
};
