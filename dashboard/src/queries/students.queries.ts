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
  stipendCount?: number;
  page: number;
  limit: number;
  totalPages: number;
  availableClasses?: number[];
  availableSections?: string[];
  availableRolls?: number[];
  /** Subjects assigned as a 4th subject in this year. */
  availableFourthSubjects?: { id: number; name: string }[];
};

export type StudentsListResponse = {
  data: Student[];
  meta: StudentsListMeta;
};

export type StudentSortKey = 'name' | 'roll' | 'class' | 'section' | 'group' | 'fourth';

export type StudentListParams = {
  year: number;
  page: number;
  limit: number;
  level?: number;
  section?: string;
  /** Multi-select; override `level`/`section` on the server. */
  levels?: number[];
  sections?: string[];
  groups?: string[];
  /** Subject ids as strings, plus 'none' for no 4th subject. */
  fourthSubjects?: string[];
  sort?: StudentSortKey;
  order?: 'asc' | 'desc';
  religion?: string;
  roll?: number;
  search?: string;
  /** 'name' limits search to student name (default also matches parent phones). */
  searchBy?: 'name';
  group?: string;
};

/** Query-string form of the list params (arrays as comma lists, empties dropped). */
export const toStudentListQuery = (p: StudentListParams) => ({
  year: p.year,
  page: p.page,
  limit: p.limit,
  ...(p.level != null && !Number.isNaN(p.level) ? { level: p.level } : {}),
  ...(p.section ? { section: p.section } : {}),
  ...(p.levels?.length ? { levels: p.levels.join(',') } : {}),
  ...(p.sections?.length ? { sections: p.sections.join(',') } : {}),
  ...(p.groups?.length ? { groups: p.groups.join(',') } : {}),
  ...(p.fourthSubjects?.length ? { fourthSubjects: p.fourthSubjects.join(',') } : {}),
  ...(p.sort ? { sort: p.sort, order: p.order ?? 'asc' } : {}),
  ...(p.religion ? { religion: p.religion } : {}),
  ...(p.roll != null && !Number.isNaN(p.roll) ? { roll: p.roll } : {}),
  ...(p.search ? { search: p.search, ...(p.searchBy ? { searchBy: p.searchBy } : {}) } : {}),
  ...(p.group ? { group: p.group } : {}),
});

export const useStudents = (
  params: StudentListParams,
  options?: { enabled?: boolean; keepPreviousPage?: boolean },
) => {
  const { year, page, limit } = params;

  return useQuery<StudentsListResponse>({
    queryKey: ['students', year, toStudentListQuery(params)],
    queryFn: async () => {
      const response = await axios.get(`/api/students`, {
        params: toStudentListQuery(params),
      });

      const payload = response.data?.data as StudentsListResponse | undefined;
      const list = (payload?.data || []).filter(
        (student: Student) => student.class >= 1 && student.class <= 10,
      ) as Student[];

      const meta: StudentsListMeta = {
        total: payload?.meta?.total ?? 0,
        filtered: payload?.meta?.filtered ?? 0,
        stipendCount: payload?.meta?.stipendCount,
        page: payload?.meta?.page ?? page,
        limit: payload?.meta?.limit ?? limit,
        totalPages: payload?.meta?.totalPages ?? 0,
        availableClasses: payload?.meta?.availableClasses,
        availableSections: payload?.meta?.availableSections,
        availableRolls: payload?.meta?.availableRolls,
        availableFourthSubjects: payload?.meta?.availableFourthSubjects,
      };

      return { data: list, meta } satisfies StudentsListResponse;
    },
    enabled: options?.enabled ?? true,
    placeholderData: options?.keepPreviousPage ? keepPreviousData : undefined,
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
