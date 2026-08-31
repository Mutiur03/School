import axios from 'axios';
import React, { useCallback, useDeferredValue, useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Search, UserMinus, RotateCw, User, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import Loading from '@/components/Loading';
import {
  PageHeader,
  SectionCard,
  StatsCard,
  Popup,
  ConfirmationPopup,
  TabNav,
  FilterSelection,
  FilterField,
  filterSelectClassName,
} from '@/components';
import DeleteConfirmation from '@/components/DeleteConfimation';
import ActionButton from '@/components/ActionButton';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  studentFormSchema,
  VALID_GROUPS,
  toExcelString,
  normalizeExcelDate,
  formatDobForDateInput,
  sentenceCaseAddressInput,
  type StudentFormSchemaData,
  RELIGION,
} from '@school/shared-schemas';
import { Input } from '@/components/ui/input';
import ErrorMessage from '@/components/ErrorMessage';
import { getFileUrl } from '@/lib/backend';
import { downloadBlob, openBlobInNewTab } from '@school/common-ui/blob';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Student } from '@/types/students';
import type { Subject } from '@/types/subjects';
import { useStudents } from '@/queries/students.queries';
import { useSubjects } from '@/queries/subject.queries';
import {
  useUpdateFourthSubjectMutation,
  useBulkUpdateFourthSubjectMutation,
} from '@/queries/marks.queries';
import { StudentProfileView } from '@/components/students/StudentProfileView';
import { StudentAttendanceView } from '@/components/students/StudentAttendanceView';

type StudentFormData = StudentFormSchemaData;

const StudentRow = React.memo(
  ({
    student,
    isSelected,
    onToggleSelect,
    onImageUpload,
    onEdit,
    onView,
    onDelete,
    allSubjects,
    onFourthSubjectChange,
    isUpdatingFourthSubject,
    showSeniorColumns,
    readOnly,
  }: {
    student: Student;
    isSelected: boolean;
    onToggleSelect: (studentId: number) => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, student: Student) => void;
    onEdit: (student: Student) => void;
    onView: (student: Student) => void;
    onDelete: (student: Student) => void;
    allSubjects: Subject[];
    onFourthSubjectChange: (studentId: number, subjectId: number | null) => void;
    isUpdatingFourthSubject?: boolean;
    showSeniorColumns?: boolean;
    readOnly?: boolean;
  }) => {
    return (
      <tr
        key={student.id}
        className={`transition-colors ${isSelected ? 'bg-sidebar-accent' : 'hover:bg-muted/50'}`}
        style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 3.5rem' }}
      >
        {!readOnly && (
          <td className="px-2 py-2 text-center text-sm whitespace-nowrap sm:px-4 sm:py-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(student.id)}
              aria-label={`Select ${student.name}`}
              className="h-4 w-4"
            />
          </td>
        )}
        <td className="flex items-center gap-3 px-2 py-2 text-sm font-medium whitespace-nowrap sm:px-4 sm:py-3">
          {student.image ? (
            <img
              src={getFileUrl(student.image)}
              alt="Student"
              className="border-border h-10 w-10 rounded-full border object-cover"
            />
          ) : (
            <div className="bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col">
            <span>{student.name}</span>
            {!student.available && (
              <span className="text-destructive bg-destructive/10 mt-0.5 w-fit rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                Inactive
              </span>
            )}
          </div>
        </td>
        <td className="px-2 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-3">{student.roll}</td>
        <td className="px-2 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-3">{student.class}</td>
        <td className="px-2 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-3">{student.section}</td>
        {showSeniorColumns && (
          <td className="px-2 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-3">
            {student.group || ''}
          </td>
        )}
        {showSeniorColumns && (
          <td className="px-2 py-2 text-sm whitespace-nowrap sm:px-4 sm:py-3">
            {Number(student.class) >= 9 ? (
              readOnly ? (
                <span>
                  {allSubjects.find((s) => s.id === student.fourth_subject_id)?.name || '-'}
                </span>
              ) : (
                <select
                  className="bg-card focus:ring-primary min-w-[120px] rounded border px-2 py-1 text-xs outline-none focus:ring-1"
                  value={student.fourth_subject_id || ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    onFourthSubjectChange(student.id, val);
                  }}
                  disabled={isUpdatingFourthSubject}
                >
                  <option value="">None</option>
                  {allSubjects
                    .filter((s: Subject) => s.subject_type !== 'main')
                    .filter((s: Subject) => s.class === Number(student.class))
                    .filter((s: Subject) => !student.group || !s.group || s.group === student.group)
                    .map((sub: Subject) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                </select>
              )
            ) : (
              <span className="text-muted-foreground opacity-50">-</span>
            )}
          </td>
        )}

        <td className="px-2 py-2 text-right text-sm whitespace-nowrap sm:px-4 sm:py-3">
          <div className="flex flex-wrap justify-end gap-1.5">
            {!readOnly && (
              <>
                <ActionButton action="photo" asLabel htmlFor={`file-upload-${student.id}`} />
                <input
                  type="file"
                  id={`file-upload-${student.id}`}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImageUpload(e, student)}
                />
              </>
            )}
            <ActionButton action="view" onClick={() => onView(student)} />
            {!readOnly && (
              <>
                <ActionButton action="edit" onClick={() => onEdit(student)} />
                <DeleteConfirmation
                  onDelete={() => onDelete(student)}
                  msg={`Are you sure you want to delete ${student.name}?`}
                />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.student === next.student &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.allSubjects === next.allSubjects &&
    prev.isUpdatingFourthSubject === next.isUpdatingFourthSubject &&
    prev.onFourthSubjectChange === next.onFourthSubjectChange &&
    prev.showSeniorColumns === next.showSeniorColumns &&
    prev.readOnly === next.readOnly,
);

const StudentCard = React.memo(
  ({
    student,
    isSelected,
    onToggleSelect,
    onImageUpload,
    onEdit,
    onView,
    onDelete,
    allSubjects,
    onFourthSubjectChange,
    isUpdatingFourthSubject,
    showSeniorColumns,
    readOnly,
  }: {
    student: Student;
    isSelected: boolean;
    onToggleSelect: (studentId: number) => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, student: Student) => void;
    onEdit: (student: Student) => void;
    onView: (student: Student) => void;
    onDelete: (student: Student) => void;
    allSubjects: Subject[];
    onFourthSubjectChange: (studentId: number, subjectId: number | null) => void;
    isUpdatingFourthSubject?: boolean;
    showSeniorColumns?: boolean;
    readOnly?: boolean;
  }) => {
    return (
      <li
        className={`border-border space-y-3 border-b p-4 last:border-b-0 ${isSelected ? 'bg-sidebar-accent' : ''}`}
      >
        <div className="flex items-start gap-3">
          {!readOnly && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(student.id)}
              aria-label={`Select ${student.name}`}
              className="mt-1 h-4 w-4 shrink-0"
            />
          )}
          {student.image ? (
            <img
              src={getFileUrl(student.image)}
              alt=""
              className="border-border h-12 w-12 shrink-0 rounded-full border object-cover"
            />
          ) : (
            <div className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold">
              {student.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-foreground truncate font-medium">{student.name}</p>
              {!student.available && (
                <span className="text-destructive bg-destructive/10 rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs tabular-nums">
              Roll {student.roll} · Class {student.class} · Sec {student.section}
              {showSeniorColumns && student.group ? ` · ${student.group}` : ''}
            </p>
          </div>
        </div>

        {showSeniorColumns && Number(student.class) >= 9 && !readOnly ? (
          <label className="block space-y-1">
            <span className="text-muted-foreground text-xs font-medium">4th Subject</span>
            <select
              className="bg-card focus:ring-primary w-full rounded border px-2 py-2 text-sm outline-none focus:ring-1"
              value={student.fourth_subject_id || ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                onFourthSubjectChange(student.id, val);
              }}
              disabled={isUpdatingFourthSubject}
            >
              <option value="">None</option>
              {allSubjects
                .filter((s: Subject) => s.subject_type !== 'main')
                .filter((s: Subject) => s.class === Number(student.class))
                .filter((s: Subject) => !student.group || !s.group || s.group === student.group)
                .map((sub: Subject) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}

        {showSeniorColumns && Number(student.class) >= 9 && readOnly ? (
          <p className="text-muted-foreground text-xs">
            4th: {allSubjects.find((s) => s.id === student.fourth_subject_id)?.name || '—'}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-1.5">
          {!readOnly && (
            <>
              <ActionButton action="photo" asLabel htmlFor={`file-upload-mobile-${student.id}`} />
              <input
                type="file"
                id={`file-upload-mobile-${student.id}`}
                accept="image/*"
                className="hidden"
                onChange={(e) => onImageUpload(e, student)}
              />
            </>
          )}
          <ActionButton action="view" onClick={() => onView(student)} />
          {!readOnly && (
            <>
              <ActionButton action="edit" onClick={() => onEdit(student)} />
              <DeleteConfirmation
                onDelete={() => onDelete(student)}
                msg={`Are you sure you want to delete ${student.name}?`}
              />
            </>
          )}
        </div>
      </li>
    );
  },
  (prev, next) =>
    prev.isSelected === next.isSelected &&
    prev.student === next.student &&
    prev.onToggleSelect === next.onToggleSelect &&
    prev.allSubjects === next.allSubjects &&
    prev.isUpdatingFourthSubject === next.isUpdatingFourthSubject &&
    prev.onFourthSubjectChange === next.onFourthSubjectChange &&
    prev.showSeniorColumns === next.showSeniorColumns &&
    prev.readOnly === next.readOnly,
);

const defaultFormValues: StudentFormData = {
  name: '',
  father_name: '',
  mother_name: '',
  father_phone: '',
  mother_phone: '',
  roll: '',
  section: '',
  village: '',
  post_office: '',
  upazila: '',
  district: '',
  religion: '',
  dob: '',
  class: '',
  group: '',
  has_stipend: false,
  available: true,
};

const excelRequiredHeaders = [
  'name',
  'father_name',
  'mother_name',
  'father_phone',
  'dob',
  'class',
  'roll',
  'section',
  'religion',
];

const demoExcelColumns = [
  'name',
  'father_name',
  'mother_name',
  'father_phone',
  'mother_phone',
  'village',
  'post_office',
  'upazila',
  'district',
  'dob',
  'class',
  'roll',
  'section',
  'religion',
  'group',
  'has_stipend',
];

function StudentList({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [rollFilter, setRollFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [year, setYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: string;
    student: Student | null;
  }>({
    visible: false,
    type: '',
    student: null,
  });
  const [viewTab, setViewTab] = useState<'profile' | 'attendance'>('profile');
  const [showForm, setShowForm] = useState(false);
  const [isExcelUpload, setIsExcelUpload] = useState(false);
  const [jsonData, setJsonData] = useState<Record<string, unknown>[] | null>(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [excelfile, setexcelfile] = useState<File | null>(null);
  const fileref = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRotateOpen, setBulkRotateOpen] = useState(false);
  const [tcConfirmOpen, setTcConfirmOpen] = useState(false);
  const [bulkFourthClass, setBulkFourthClass] = useState<'9' | '10' | ''>('');
  const [bulkFourthGroup, setBulkFourthGroup] = useState('');
  const [bulkFourthSubjectId, setBulkFourthSubjectId] = useState('');
  const [bulkFourthConfirmOpen, setBulkFourthConfirmOpen] = useState(false);
  const [bulkFourthOpen, setBulkFourthOpen] = useState(false);

  const { data: allSubjectsData = [] } = useSubjects();
  const updateFourthSubjectMutation = useUpdateFourthSubjectMutation();
  const bulkUpdateFourthSubjectMutation = useBulkUpdateFourthSubjectMutation();

  const bulkFourthSubjects = useMemo(() => {
    if (!bulkFourthClass) return [];
    const klass = Number(bulkFourthClass);
    return allSubjectsData
      .filter((s) => s.subject_type !== 'main')
      .filter((s) => s.class === klass)
      .filter((s) => !bulkFourthGroup || !s.group || s.group === bulkFourthGroup);
  }, [allSubjectsData, bulkFourthClass, bulkFourthGroup]);

  const tcMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const response = await axios.post(`/api/students/${studentId}/tc`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Transfer Certificate issued successfully.');
      invalidateStudents();
      closePopup();
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.error || err.message || 'Failed to issue Transfer Certificate';
      toast.error(message);
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const response = await axios.post(`/api/students/${studentId}/reactivate`);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Student reactivated successfully.');
      invalidateStudents();
    },
    onError: (err: any) => {
      const message = err.response?.data?.error || err.message || 'Failed to reactivate student';
      toast.error(message);
    },
  });

  const testimonialMutation = useMutation({
    mutationFn: async (studentId: number) => {
      const response = await axios.post(
        `/api/students/${studentId}/testimonials`,
        {},
        {
          responseType: 'blob',
        },
      );

      const contentType = (response.headers['content-type'] as string) ?? '';

      if (!contentType.includes('application/pdf')) {
        throw new Error('Failed to generate Certificate: Incorrect content type');
      }

      return { blob: response.data as Blob, headers: response.headers };
    },
    onSuccess: ({ blob }) => {
      openBlobInNewTab(blob);
      toast.success('Certificate opened in new tab!');
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Failed to generate Certificate';
      toast.error(message);
    },
  });

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StudentFormData>({
    defaultValues: defaultFormValues,
    resolver: zodResolver(studentFormSchema),
    criteriaMode: 'firstError',
    mode: 'onBlur',
  });

  const watchedClass = Number(watch('class') || '0');

  useEffect(() => {
    if (watchedClass !== 9 && watchedClass !== 10) {
      setValue('group', '');
    }
  }, [watchedClass, setValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const invalidateStudents = () => queryClient.invalidateQueries({ queryKey: ['students', year] });

  const {
    data: studentsResponse,
    isLoading: loading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudents({
    year,
    page,
    limit,
    level: classFilter ? Number(classFilter) : undefined,
    section: sectionFilter || undefined,
    roll: rollFilter ? Number(rollFilter) : undefined,
    search: deferredSearchQuery.trim() ? deferredSearchQuery.trim() : undefined,
  });
  const students = useMemo(() => studentsResponse?.data ?? [], [studentsResponse]);

  const showSeniorColumns = useMemo(() => {
    return students.some((s) => Number(s.class) >= 9);
  }, [students]);
  const meta = studentsResponse?.meta;
  const errorMessage = studentsError
    ? (studentsError as { response?: { status?: number } }).response?.status === 404
      ? 'No students found for the selected year.'
      : 'An error occurred while fetching students.'
    : '';

  useEffect(() => {
    setPage(1);
  }, [year, classFilter, sectionFilter, rollFilter, deferredSearchQuery]);

  // Sequential filter auto-reset logic
  useEffect(() => {
    if (!loading && studentsResponse && meta?.filtered === 0) {
      if (rollFilter) {
        setRollFilter('');
      } else if (sectionFilter) {
        setSectionFilter('');
      } else if (classFilter) {
        setClassFilter('');
      }
    }
  }, [loading, studentsResponse, meta?.filtered, rollFilter, sectionFilter, classFilter]);

  const uploadImageToR2 = async (file: File, studentId: number) => {
    const key = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const response = await axios.post(`/api/students/${studentId}/image/upload-url`, {
      key,
      contentType: file.type,
    });

    const uploadUrl = response.data?.data?.uploadUrl as string | undefined;
    const r2Key = response.data?.data?.key as string | undefined;

    if (!uploadUrl || !r2Key) {
      throw new Error('Failed to get upload URL');
    }

    const putResult = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!putResult.ok) {
      throw new Error('Failed to upload image');
    }

    await axios.put(`/api/students/${studentId}/image`, {
      key: r2Key,
    });
  };

  const imageUploadMutation = useMutation({
    mutationFn: async ({ file, student }: { file: File; student: Student }) => {
      await uploadImageToR2(file, student.id);
    },
    onSuccess: () => invalidateStudents(),
    onError: () => toast.error('Failed to upload image.'),
  });

  const handleIndivisualImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    student: Student,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    imageUploadMutation.mutate({ file, student });
  };

  const handleEdit = (student: Student) => {
    if (isExcelUpload) setIsExcelUpload(false);
    setIsEditing(true);
    setSelectedStudent(student);
    reset({
      name: student.name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      father_phone: student.father_phone || '',
      mother_phone: student.mother_phone || '',
      village: student.village || '',
      post_office: student.post_office || '',
      upazila: student.upazila || '',
      district: student.district || '',
      dob: formatDobForDateInput(student.dob),
      class: student.class.toString(),
      roll: student.roll.toString(),
      section: student.section,
      group: student.group || '',
      religion: student.religion as 'Islam' | 'Hinduism' | 'Christianity' | 'Buddhism' | '',
      has_stipend: Boolean(student.has_stipend),
      available: student.available,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteMutation = useMutation({
    mutationFn: (student: Student) => axios.delete(`/api/students/${student.id}`),
    onSuccess: (_, student) => {
      toast.success('Student deleted successfully.');
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(student.id);
        return next;
      });
      invalidateStudents();
    },
    onError: () => toast.error('Failed to delete student. Please try again.'),
  });

  const handleDelete = (student: Student) => deleteMutation.mutate(student);

  const closePopup = () => {
    setViewTab('profile');
    setPopup({ visible: false, type: '', student: null });
  };

  const handleReactivate = useCallback(
    (student: Student) => {
      reactivateMutation.mutate(student.id);
    },
    [reactivateMutation],
  );

  const sortedUniqueClasses = useMemo(() => {
    return (meta?.availableClasses || []).sort((a, b) => a - b);
  }, [meta?.availableClasses]);

  const sortedUniqueSections = useMemo(() => {
    return (meta?.availableSections || []).sort();
  }, [meta?.availableSections]);

  const sortedUniqueRolls = useMemo(() => {
    return (meta?.availableRolls || []).sort((a, b) => a - b);
  }, [meta?.availableRolls]);

  const visibleStudentIds = useMemo(() => students.map((student) => student.id), [students]);
  const visibleStudentIdSet = useMemo(() => new Set(visibleStudentIds), [visibleStudentIds]);

  const hasSelectedStudents = selectedStudentIds.size > 0;
  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    selectedStudentIds.forEach((id) => {
      if (visibleStudentIdSet.has(id)) count += 1;
    });
    return count;
  }, [selectedStudentIds, visibleStudentIdSet]);

  const allVisibleSelected =
    visibleStudentIds.length > 0 && selectedVisibleCount === visibleStudentIds.length;

  const onToggleSelect = useCallback((studentId: number) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  const onViewStudent = useCallback((student: Student) => {
    setPopup({
      visible: true,
      type: 'view',
      student,
    });
  }, []);

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedStudentIds((prev) => {
        const next = new Set(prev);
        visibleStudentIdSet.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      visibleStudentIdSet.forEach((id) => next.add(id));
      return next;
    });
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: (studentIds: number[]) => axios.delete('/api/students', { data: { studentIds } }),
    onSuccess: (response) => {
      toast.success(response.data?.message || 'Selected students deleted successfully.');
      setSelectedStudentIds(new Set());
      invalidateStudents();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(
        err.response?.data?.error || 'Failed to delete selected students. Please try again.',
      );
    },
  });

  const bulkRotateMutation = useMutation({
    mutationFn: async (studentIds: number[]) => {
      const response = await axios.post(
        '/api/students/password-rotations',
        { studentIds },
        { responseType: 'blob' },
      );
      return response.data;
    },
    onSuccess: (data) => {
      downloadBlob(new Blob([data]), 'rotated_passwords.xlsx');
      toast.success('Passwords rotated successfully. Excel downloaded.');
      setSelectedStudentIds(new Set());
      invalidateStudents();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to rotate passwords. Please try again.');
    },
  });

  const handleBulkDelete = () => {
    if (selectedStudentIds.size === 0) {
      toast.error('Please select at least one student.');
      return;
    }
    setBulkDeleteOpen(true);
  };

  useEffect(() => {
    setSelectedStudentIds((prev) => {
      const existing = new Set(students.map((student) => student.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [students]);

  const formMutation = useMutation({
    mutationFn: async (formValues: StudentFormData) => {
      const parsedForm = studentFormSchema.safeParse(formValues);
      if (!parsedForm.success) {
        console.error('[Student Form Validation Failed]', {
          input: formValues,
          issues: parsedForm.error.issues,
        });
        throw new Error(parsedForm.error.issues[0]?.message || 'Invalid form data');
      }
      const parsedValues = parsedForm.data as StudentFormData;
      const classNumber = Number(parsedValues.class);
      const requiresGroup = classNumber === 9 || classNumber === 10;

      const basicDeatils: Record<string, string | boolean | null> = {
        name: parsedValues.name || '',
        father_name: parsedValues.father_name || '',
        mother_name: parsedValues.mother_name || '',
        father_phone: parsedValues.father_phone || '',
        mother_phone: parsedValues.mother_phone?.trim() ? parsedValues.mother_phone : null,
        village: parsedValues.village || '',
        post_office: parsedValues.post_office || '',
        upazila: parsedValues.upazila || '',
        district: parsedValues.district || '',
        dob: parsedValues.dob || '',
        religion: parsedValues.religion || '',
        available: Boolean(parsedValues.available),
        has_stipend: Boolean(parsedValues.has_stipend),
      };
      const academicDetails: Record<string, string> = {
        roll: parsedValues.roll || '',
        class: parsedValues.class || '',
        section: parsedValues.section || '',
        group: requiresGroup ? parsedValues.group || '' : '',
      };

      if (isEditing && selectedStudent) {
        await axios.put(`/api/students/${selectedStudent.id}`, basicDeatils);
        await axios.patch(`/api/enrollments/${selectedStudent.enrollment_id}`, academicDetails);
        if (image) await uploadImageToR2(image, selectedStudent.id);
        return { message: 'Student updated successfully.' };
      } else {
        const response = await axios.post(
          '/api/students/bulk',
          {
            students: [
              {
                ...basicDeatils,
                roll: parsedValues.roll,
                class: parsedValues.class,
                section: parsedValues.section,
                group: requiresGroup ? parsedValues.group : '',
              },
            ],
          },
          { responseType: 'blob' },
        );

        if (image) await uploadImageToR2(image, response.data.data?.[0]?.id);
        return response.data;
      }
    },
    onSuccess: (data) => {
      if (!isEditing) {
        downloadBlob(new Blob([data]), 'students_credentials.xlsx');
      }
      handleCancel();
      toast.success(
        isEditing
          ? 'Student updated successfully.'
          : 'Student added successfully. Credentials downloaded.',
      );
      invalidateStudents();
    },
    onError: async (err: any) => {
      let errorMessage = 'An error occurred';
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          errorMessage = json.error || json.message || errorMessage;
        } catch (e) {
          errorMessage = text || errorMessage;
        }
      } else {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      }
      toast.error(errorMessage);
    },
  });

  const onSubmit = (formValues: StudentFormData) => formMutation.mutate(formValues);
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setexcelfile(file);
    setFileUploaded(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
      }) as unknown[][];

      const headers = rawData[0]?.map((header) => String(header).toLowerCase().trim());

      const missingHeaders = excelRequiredHeaders.filter((field) => !headers.includes(field));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}`);
        setFileUploaded(false);
        setexcelfile(null);
        setJsonData(null);
        return;
      }

      const formattedData = rawData
        .slice(1)
        .filter((row: unknown[]) => {
          const nameIndex = headers.indexOf('name');
          return row[nameIndex] !== undefined && String(row[nameIndex]).trim() !== '';
        })
        .map((row: unknown[]) => {
          const student: Record<string, unknown> = {};
          headers.forEach((header: string, index: number) => {
            student[header] = row[index];
          });

          return {
            name: toExcelString(student.name),
            father_name: toExcelString(student.father_name),
            mother_name: toExcelString(student.mother_name),
            father_phone: toExcelString(student.father_phone),
            mother_phone: toExcelString(student.mother_phone) || null,
            village: toExcelString(student.village),
            post_office: toExcelString(student.post_office),
            upazila: toExcelString(student.upazila),
            district: toExcelString(student.district),
            dob: normalizeExcelDate(student.dob),
            class: toExcelString(student.class),
            roll: toExcelString(student.roll),
            section: toExcelString(student.section).toUpperCase(),
            religion: toExcelString(student.religion),
            group: toExcelString(student.group),
            has_stipend: toExcelString(student.has_stipend).toLowerCase() === 'yes',
            available: true,
          };
        });

      const validationErrors: string[] = [];
      formattedData.forEach((row, index) => {
        const parsed = studentFormSchema.safeParse(row);

        if (!parsed.success) {
          const issueText = parsed.error.issues
            .map(
              (issue: { path: PropertyKey[]; message: string }) =>
                `${issue.path.join('.') || 'row'}: ${issue.message}`,
            )
            .join(' | ');
          console.error('[Excel Row Validation Failed]', {
            rowNumber: index + 2,
            input: row,
            issues: parsed.error.issues,
          });
          validationErrors.push(`Row ${index + 2}: ${issueText || 'Invalid data'}`);
        }

        const classNum = Number((row.class as string) || 0);
        if ((classNum === 9 || classNum === 10) && !(row.group as string)?.trim()) {
          console.error('[Excel Row Validation Failed]', {
            rowNumber: index + 2,
            input: row,
            issues: [{ path: ['group'], message: 'Group is required for class 9-10' }],
          });
          validationErrors.push(`Row ${index + 2}: Group is required for class 9-10`);
        }
      });

      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
        setJsonData(null);
        setFileUploaded(false);
        setexcelfile(null);
        return;
      }

      setJsonData(formattedData);

      if (formattedData.length > 500) {
        toast.error(
          `Maximum 500 students allowed per upload. Your file has ${formattedData.length}.`,
        );
        setJsonData(null);
        setFileUploaded(false);
        setexcelfile(null);
        return;
      }

      toast.success(`Loaded ${formattedData.length} students successfully.`);
    };
    reader.onerror = () => {
      toast.error('Error reading the file. Please try again.');
    };
  };

  const handleDownloadDemoExcel = () => {
    const demoData = [
      {
        name: 'Rahim Uddin',
        father_name: 'Karim Uddin',
        mother_name: 'Ayesha Begum',
        father_phone: '01712345678',
        mother_phone: '01812345678',
        village: 'Shantinagar',
        post_office: 'Sadar',
        upazila: 'Sadar',
        district: 'Dhaka',
        dob: '15/08/2008',
        class: '8',
        roll: '12',
        section: 'A',
        religion: 'Islam',
        group: '',
        has_stipend: 'No',
      },
      {
        name: 'Nusrat Jahan',
        father_name: 'Mizanur Rahman',
        mother_name: 'Shirin Akter',
        father_phone: '01912345678',
        mother_phone: '01612345678',
        village: 'Uttar Para',
        post_office: 'Town',
        upazila: 'Kotwali',
        district: 'Chattogram',
        dob: '20/01/2007',
        class: '9',
        roll: '5',
        section: 'B',
        religion: 'Islam',
        group: 'Science',
        has_stipend: 'Yes',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(demoData, {
      header: demoExcelColumns,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'student_upload_demo.xlsx');
    toast.success('Demo Excel downloaded.');
  };

  const excelMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>[]) => {
      const response = await axios.post(
        '/api/students/bulk',
        { students: data },
        { responseType: 'blob' },
      );
      return response.data;
    },
    onSuccess: (data) => {
      downloadBlob(new Blob([data]), 'students_credentials.xlsx');

      toast.success('Students uploaded successfully. Credentials downloaded.');
      setJsonData(null);
      setFileUploaded(false);
      setexcelfile(null);
      setIsExcelUpload(false);
      setShowForm(false);
      const excelInput = document.querySelector('input[name="excelFile"]') as HTMLInputElement;
      if (excelInput) excelInput.value = '';
      invalidateStudents();
    },
    onError: async (err: any) => {
      let errorMessage = 'Failed to upload students.';
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || errorMessage;
        } catch (e) {
          errorMessage = text || errorMessage;
        }
      } else {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      }
      toast.error(errorMessage);
    },
  });

  const sendToBackend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jsonData || jsonData.length === 0) {
      toast.error('No data to upload. Please check your Excel file.');
      return;
    }
    const failedRow = jsonData.findIndex((row) => !studentFormSchema.safeParse(row).success);
    if (failedRow !== -1) {
      const failed = studentFormSchema.safeParse(jsonData[failedRow]);
      if (!failed.success) {
        console.error('[Excel Submit Validation Failed]', {
          rowNumber: failedRow + 2,
          input: jsonData[failedRow],
          issues: failed.error.issues,
        });
      }
      toast.error(`Row ${failedRow + 2}: Invalid data. Please fix and upload again.`);
      return;
    }
    excelMutation.mutate(jsonData);
  };
  const handleCancel = () => {
    setFileUploaded(false);
    if (isExcelUpload) setJsonData(null);
    reset(defaultFormValues);
    setSelectedStudent(null);
    if (isExcelUpload && fileref.current) {
      fileref.current.value = '';
    }
    if (isExcelUpload) setexcelfile(null);
    if (isExcelUpload) setFileUploaded(false);
    setImage(null);
    setPreview(null);
    setShowForm(false);
    if (isEditing) setIsEditing(false);
  };

  const removeImageMutation = useMutation({
    mutationFn: (studentId: number) => axios.put(`/api/students/${studentId}/image`, { key: null }),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success('Image removed successfully.');
        setSelectedStudent((prev) => (prev ? { ...prev, image: undefined } : prev));
        // setShowForm(false);
        invalidateStudents();
      } else {
        toast.error(response.data.error || 'Failed to remove image.');
      }
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'An error occurred while removing the image.');
    },
  });

  const removeImage = () => {
    if (!selectedStudent) return;
    setImage(null);
    setPreview(null);
    removeImageMutation.mutate(selectedStudent.id);
  };
  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Student List"
        description={
          readOnly
            ? 'View all student records (read only).'
            : 'Manage student records, add new students or upload via Excel.'
        }
      >
        {!readOnly && !showForm && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkFourthOpen(true)}
              disabled={loading}
            >
              Bulk 4th Subject
            </Button>
            <Button type="button" onClick={() => setShowForm((prev) => !prev)} disabled={loading}>
              {loading ? 'Loading…' : '+ Add Student'}
            </Button>
          </div>
        )}
      </PageHeader>
      {!readOnly && showForm && (
        <SectionCard className="mb-6 overflow-hidden">
          <h2 className="text-foreground mb-6 text-xl font-bold">
            {isEditing ? 'Update Student Info' : 'Add New Student'}
          </h2>
          {!isEditing && (
            <div className="border-border mb-6 flex gap-1 border-b">
              <button
                type="button"
                onClick={() => setIsExcelUpload(false)}
                className={`relative px-3 pb-2 text-sm font-medium transition-colors ${
                  !isExcelUpload
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Form
              </button>
              <button
                type="button"
                onClick={() => setIsExcelUpload(true)}
                className={`relative px-3 pb-2 text-sm font-medium transition-colors ${
                  isExcelUpload
                    ? 'text-primary border-primary border-b-2'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Excel Upload
              </button>
            </div>
          )}
          <div className="space-y-4 sm:space-y-6">
            {!isExcelUpload ? (
              <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
                <div className="border-border bg-muted/40 rounded-lg border p-4">
                  <div className="flex flex-col items-center justify-center">
                    <p className="mb-2 text-sm font-medium">Student Image</p>
                    <label className="border-border flex aspect-7/9 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-white transition-colors hover:border-blue-500 sm:w-32 dark:border-gray-600 dark:bg-gray-700">
                      {preview ? (
                        <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                      ) : isEditing && selectedStudent?.image ? (
                        <img
                          src={getFileUrl(selectedStudent.image)}
                          alt="Student"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-muted-foreground text-center text-xs sm:text-sm">
                          Click to upload
                        </span>
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {isEditing && selectedStudent?.image && (
                      <button
                        onClick={removeImage}
                        type="button"
                        className="text-destructive mt-2 flex items-center justify-center gap-2 text-sm hover:cursor-pointer hover:underline"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                </div>

                <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                  <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                    Personal Information
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Name <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Full Name" {...register('name')} />
                      {errors.name && <ErrorMessage message={errors.name.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Father Name <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Father's Name" {...register('father_name')} />
                      {errors.father_name && <ErrorMessage message={errors.father_name.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Mother Name <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Mother's Name" {...register('mother_name')} />
                      {errors.mother_name && <ErrorMessage message={errors.mother_name.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Date of Birth <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="date"
                        lang="en-GB"
                        placeholder="dd/mm/yyyy"
                        {...register('dob')}
                      />
                      {errors.dob && <ErrorMessage message={errors.dob.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Father Phone <span className="text-destructive">*</span>
                      </label>
                      <Input
                        type="text"
                        placeholder="Father's Phone"
                        maxLength={11}
                        {...register('father_phone')}
                      />
                      {errors.father_phone && (
                        <ErrorMessage message={errors.father_phone.message} />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">Mother Phone</label>
                      <Input
                        type="text"
                        placeholder="Mother's Phone"
                        maxLength={11}
                        {...register('mother_phone')}
                      />
                      {errors.mother_phone && (
                        <ErrorMessage message={errors.mother_phone.message} />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Religion <span className="text-destructive">*</span>
                      </label>
                      <select
                        {...register('religion')}
                        className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                      >
                        <option value="">Select Religion</option>
                        {RELIGION.map((religion: string) => (
                          <option key={religion} value={religion}>
                            {religion}
                          </option>
                        ))}
                      </select>

                      {errors.religion && <ErrorMessage message={errors.religion.message} />}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                  <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                    Academic Information
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Class <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Class" {...register('class')} />
                      {errors.class && <ErrorMessage message={errors.class.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Roll <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Roll" {...register('roll')} />
                      {errors.roll && <ErrorMessage message={errors.roll.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">
                        Section <span className="text-destructive">*</span>
                      </label>
                      <Input type="text" placeholder="Section" {...register('section')} />
                      {errors.section && <ErrorMessage message={errors.section.message} />}
                    </div>
                    {(watchedClass === 9 || watchedClass === 10) && (
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">
                          Group <span className="text-destructive">*</span>
                        </label>
                        <select
                          {...register('group')}
                          disabled={!(watchedClass === 9 || watchedClass === 10)}
                          className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select Group</option>
                          {(VALID_GROUPS as readonly string[]).map((group: string) => (
                            <option key={group} value={group}>
                              {group}
                            </option>
                          ))}
                        </select>
                        {errors.group && <ErrorMessage message={errors.group.message} />}
                      </div>
                    )}
                  </div>
                </fieldset>

                <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                  <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                    Address Information
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">Village</label>
                      <Input type="text" placeholder="Village" {...register('village')} />
                      {errors.village && <ErrorMessage message={errors.village.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">Post Office</label>
                      <Input
                        type="text"
                        placeholder="Post Office"
                        {...register('post_office', {
                          setValueAs: (value) => sentenceCaseAddressInput(String(value ?? '')),
                          onBlur: (e) => {
                            e.target.value = sentenceCaseAddressInput(e.target.value);
                          },
                        })}
                      />
                      {errors.post_office && <ErrorMessage message={errors.post_office.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">Upazila</label>
                      <Input type="text" placeholder="Upazila" {...register('upazila')} />
                      {errors.upazila && <ErrorMessage message={errors.upazila.message} />}
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium">District</label>
                      <Input type="text" placeholder="District" {...register('district')} />
                      {errors.district && <ErrorMessage message={errors.district.message} />}
                    </div>
                  </div>
                </fieldset>

                <div className="border-border bg-muted/40 flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-muted-foreground text-xs">
                    Fields marked with <span className="text-destructive">*</span> are mandatory.
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
                    <label className="flex items-center space-x-2 text-sm font-medium">
                      <input type="checkbox" {...register('has_stipend')} className="h-4 w-4" />
                      <span>Has Stipend</span>
                    </label>
                    {isEditing && (
                      <label className="flex cursor-not-allowed items-center space-x-2 text-sm font-medium opacity-50">
                        <input
                          type="checkbox"
                          {...register('available')}
                          className="h-4 w-4"
                          disabled
                        />
                        <span>Active Student</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="bg-card/95 supports-backdrop-filter:bg-card/70 border-border sticky bottom-0 flex justify-between border-t pt-4 backdrop-blur">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    type="button"
                    disabled={formMutation.isPending}
                    className="min-w-24"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={formMutation.isPending} className="min-w-28">
                    {formMutation.isPending
                      ? isEditing
                        ? 'Updating Student…'
                        : 'Adding Student…'
                      : isEditing
                        ? 'Update'
                        : 'Add Student'}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={sendToBackend} className="space-y-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-medium">Excel File Upload</h3>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadDemoExcel}
                      className="h-8 px-3"
                    >
                      Download Demo Excel
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowFormatInfo(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold transition-colors"
                      title="View Excel format requirements"
                    >
                      i
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    id="excelFile"
                    name="excelFile"
                    accept=".xlsx, .xls"
                    onClick={(e) => {
                      const target = e.target as HTMLInputElement;
                      target.value = '';
                      setFileUploaded(false);
                      setJsonData(null);
                      setexcelfile(null);
                    }}
                    onChange={(e) => {
                      handleFileUpload(e);
                    }}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                    required
                    ref={fileref}
                  />
                  <label
                    htmlFor="excelFile"
                    className="border-border flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-blue-500 dark:border-gray-600"
                  >
                    <div className="bg-primary/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                      {fileUploaded ? (
                        <svg
                          className="text-primary h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="text-primary h-8 w-8"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-muted-foreground font-medium">
                      {fileUploaded ? `File Uploaded: ${excelfile?.name}` : 'Upload Excel File'}
                    </span>
                    {!fileUploaded && (
                      <span className="text-muted-foreground text-sm">
                        .xlsx or .xls files only
                      </span>
                    )}
                  </label>
                </div>
                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={handleCancel}
                    disabled={excelMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!fileUploaded || excelMutation.isPending}>
                    {excelMutation.isPending ? 'Uploading Students…' : 'Upload'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </SectionCard>
      )}
      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatsCard label="Total Students" value={meta?.total ?? 0} loading={loading} />
        <StatsCard
          label="With Stipend"
          value={students.filter((s) => s.has_stipend).length}
          color="emerald"
          loading={loading}
        />
      </div>
      <FilterSelection className="mb-6">
        <FilterField label="Search" wide>
          <div className="relative">
            <Search size={18} className="absolute top-2.5 left-3 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name or phone…"
              className="pl-10"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
            />
          </div>
        </FilterField>
        <FilterField label="Class">
          <select
            className={filterSelectClassName}
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
            }}
          >
            <option value="">All Classes</option>
            {sortedUniqueClasses.map((classNum: number) => (
              <option key={classNum} value={classNum}>
                Class {classNum}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Section">
          <select
            className={filterSelectClassName}
            value={sectionFilter}
            onChange={(e) => {
              setSectionFilter(e.target.value);
            }}
          >
            <option value="">All Sections</option>
            {sortedUniqueSections.map((section: string) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Roll">
          <select
            className={filterSelectClassName}
            value={rollFilter}
            onChange={(e) => setRollFilter(e.target.value)}
          >
            <option value="">All Rolls</option>
            {sortedUniqueRolls.map((roll: number) => (
              <option key={roll} value={roll}>
                {roll}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Year">
          <select
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
            }}
            className={filterSelectClassName}
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={currentYear - 1 + i}>
                {currentYear - 1 + i}
              </option>
            ))}
          </select>
        </FilterField>
      </FilterSelection>
      {!readOnly && (
        <>
          <Popup
            open={bulkFourthOpen}
            onOpenChange={setBulkFourthOpen}
            size="md"
            aria-label="Bulk update 4th subject"
          >
            <div className="space-y-4 p-5">
              <div>
                <h3 className="text-foreground text-lg font-semibold">Bulk Update 4th Subject</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Set or clear the 4th subject for one class + group in {year}. Science, Commerce,
                  and Humanities must be updated separately.
                </p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Class</label>
                  <select
                    className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    value={bulkFourthClass}
                    onChange={(e) => {
                      setBulkFourthClass(e.target.value as '9' | '10' | '');
                      setBulkFourthSubjectId('');
                    }}
                  >
                    <option value="">Select class</option>
                    <option value="9">Class 9</option>
                    <option value="10">Class 10</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Group <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    value={bulkFourthGroup}
                    onChange={(e) => {
                      setBulkFourthGroup(e.target.value);
                      setBulkFourthSubjectId('');
                    }}
                  >
                    <option value="">Select group</option>
                    {VALID_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">4th Subject</label>
                  <select
                    className="bg-card border-border text-foreground focus:ring-primary/30 w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                    value={bulkFourthSubjectId}
                    onChange={(e) => setBulkFourthSubjectId(e.target.value)}
                    disabled={!bulkFourthClass || !bulkFourthGroup}
                  >
                    <option value="">Select subject</option>
                    <option value="__clear__">None (clear)</option>
                    {bulkFourthSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                        {sub.group ? ` (${sub.group})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setBulkFourthOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={
                    !bulkFourthClass ||
                    !bulkFourthGroup ||
                    !bulkFourthSubjectId ||
                    bulkUpdateFourthSubjectMutation.isPending
                  }
                  onClick={() => setBulkFourthConfirmOpen(true)}
                >
                  {bulkUpdateFourthSubjectMutation.isPending ? 'Updating…' : 'Apply to all'}
                </Button>
              </div>
            </div>
          </Popup>
          <ConfirmationPopup
            open={bulkFourthConfirmOpen}
            onOpenChange={setBulkFourthConfirmOpen}
            onConfirm={() => {
              if (!bulkFourthClass || !bulkFourthGroup || !bulkFourthSubjectId) return;
              setBulkFourthConfirmOpen(false);
              setBulkFourthOpen(false);
              bulkUpdateFourthSubjectMutation.mutate({
                class: Number(bulkFourthClass),
                year,
                subjectId: bulkFourthSubjectId === '__clear__' ? null : Number(bulkFourthSubjectId),
                group: bulkFourthGroup,
              });
            }}
            confirmLabel="Apply to all"
            variant="default"
            msg={
              bulkFourthSubjectId === '__clear__'
                ? `Clear 4th subject for all Class ${bulkFourthClass} ${bulkFourthGroup} students (${year})?`
                : `Set 4th subject to "${
                    bulkFourthSubjects.find((s) => s.id === Number(bulkFourthSubjectId))?.name ??
                    'selected'
                  }" for all Class ${bulkFourthClass} ${bulkFourthGroup} students (${year})? This overwrites existing 4th subjects.`
            }
          />
        </>
      )}
      <SectionCard noPadding className="mb-6">
        {!readOnly && hasSelectedStudents && (
          <div className="bg-muted border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground text-sm font-medium">
              {selectedStudentIds.size} student(s) selected
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkRotateOpen(true)}
              disabled={bulkRotateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {bulkRotateMutation.isPending
                ? 'Rotating…'
                : `Rotate ${selectedStudentIds.size} Passwords`}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="w-full sm:w-auto"
            >
              {bulkDeleteMutation.isPending
                ? 'Deleting…'
                : `Delete ${selectedStudentIds.size} Selected`}
            </Button>
            <ConfirmationPopup
              open={bulkDeleteOpen}
              onOpenChange={setBulkDeleteOpen}
              onConfirm={() => {
                setBulkDeleteOpen(false);
                bulkDeleteMutation.mutate(Array.from(selectedStudentIds));
              }}
              confirmLabel="Confirm Delete"
              msg={`This will permanently delete ${selectedStudentIds.size} selected student(s). This action cannot be undone.`}
            />
            <ConfirmationPopup
              open={bulkRotateOpen}
              onOpenChange={setBulkRotateOpen}
              onConfirm={() => {
                setBulkRotateOpen(false);
                bulkRotateMutation.mutate(Array.from(selectedStudentIds));
              }}
              confirmLabel="Rotate Passwords"
              variant="default"
              msg={`This will regenerate new passwords for ${selectedStudentIds.size} selected student(s). An Excel file with new credentials will be downloaded. This action cannot be undone.`}
            />
          </div>
        )}
        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border border-b">
                {!readOnly && (
                  <th className="w-12 px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleSelectAllVisible}
                      aria-label="Select all students"
                      className="h-4 w-4"
                    />
                  </th>
                )}
                {['Student', 'Roll', 'Class', 'Section', 'Group', '4th Subject', 'Actions']
                  .filter(
                    (header) =>
                      (header !== '4th Subject' && header !== 'Group') || showSeniorColumns,
                  )
                  .map((header) => (
                    <th
                      key={header}
                      className={`text-foreground/70 px-4 py-3 text-xs font-semibold tracking-wider uppercase ${header === 'Actions' ? 'text-center' : 'text-center sm:text-left'}`}
                    >
                      {header}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading ? (
                <tr>
                  <td
                    colSpan={(showSeniorColumns ? 8 : 6) - (readOnly ? 1 : 0)}
                    className="py-12 text-center"
                  >
                    <Loading />
                  </td>
                </tr>
              ) : students.length > 0 ? (
                students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    isSelected={selectedStudentIds.has(student.id)}
                    onToggleSelect={onToggleSelect}
                    onImageUpload={handleIndivisualImageUpload}
                    onEdit={handleEdit}
                    onView={onViewStudent}
                    onDelete={handleDelete}
                    allSubjects={allSubjectsData}
                    onFourthSubjectChange={(studentId, subjectId) => {
                      updateFourthSubjectMutation.mutate(
                        {
                          studentId,
                          year,
                          subjectId,
                        },
                        {
                          onSuccess: () => refetchStudents(),
                        },
                      );
                    }}
                    isUpdatingFourthSubject={updateFourthSubjectMutation.isPending}
                    showSeniorColumns={showSeniorColumns}
                    readOnly={readOnly}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={(showSeniorColumns ? 8 : 6) - (readOnly ? 1 : 0)}
                    className="text-muted-foreground px-4 py-12 text-center text-sm dark:text-gray-400"
                  >
                    {errorMessage || 'No students found matching your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden">
          {loading ? (
            <div className="py-12 text-center">
              <Loading />
            </div>
          ) : students.length > 0 ? (
            <ul>
              {students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  isSelected={selectedStudentIds.has(student.id)}
                  onToggleSelect={onToggleSelect}
                  onImageUpload={handleIndivisualImageUpload}
                  onEdit={handleEdit}
                  onView={onViewStudent}
                  onDelete={handleDelete}
                  allSubjects={allSubjectsData}
                  onFourthSubjectChange={(studentId, subjectId) => {
                    updateFourthSubjectMutation.mutate(
                      {
                        studentId,
                        year,
                        subjectId,
                      },
                      {
                        onSuccess: () => refetchStudents(),
                      },
                    );
                  }}
                  isUpdatingFourthSubject={updateFourthSubjectMutation.isPending}
                  showSeniorColumns={showSeniorColumns}
                  readOnly={readOnly}
                />
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm dark:text-gray-400">
              {errorMessage || 'No students found matching your criteria.'}
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-sm">
            Page {meta?.page ?? page} of {meta?.totalPages ?? 0}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows</span>
              <select
                className="bg-card border-border text-foreground focus:ring-primary/30 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[25, 50, 100].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const totalPages = meta?.totalPages ?? 0;
              const currentPage = page;
              const maxVisible = 7;
              if (totalPages <= maxVisible) {
                return Array.from({ length: totalPages }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={i + 1 === currentPage ? 'default' : 'outline'}
                    onClick={() => setPage(i + 1)}
                    disabled={loading}
                  >
                    {i + 1}
                  </Button>
                ));
              }
              const pages: (number | string)[] = [];
              const half = Math.floor(maxVisible / 2);
              let start = Math.max(1, currentPage - half);
              const end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
              }
              if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push('...');
              }
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
              if (end < totalPages) {
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === '...' ? (
                  <span key={idx} className="text-muted-foreground px-2">
                    ...
                  </span>
                ) : (
                  <Button
                    key={idx}
                    type="button"
                    variant={p === currentPage ? 'default' : 'outline'}
                    onClick={() => setPage(p as number)}
                    disabled={loading}
                  >
                    {p}
                  </Button>
                ),
              );
            })()}
          </div>
        </div>
      </SectionCard>
      {popup.visible && popup.student && (
        <Popup
          open
          onOpenChange={(o) => !o && closePopup()}
          size={viewTab === 'attendance' ? 'full' : 'lg'}
          aria-label="Student Details"
        >
          {popup.type === 'view' && (
            <>
              <div className="border-border flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-base font-semibold">Student details</h2>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="px-5 pt-4">
                <TabNav
                  tabs={[
                    {
                      id: 'profile',
                      label: 'Profile',
                      icon: <User className="h-4 w-4" />,
                    },
                    {
                      id: 'attendance',
                      label: 'Attendance',
                      icon: <CalendarDays className="h-4 w-4" />,
                    },
                  ]}
                  activeTab={viewTab}
                  onTabChange={(tabId) =>
                    setViewTab(tabId === 'attendance' ? 'attendance' : 'profile')
                  }
                />
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                {viewTab === 'profile' ? (
                  <StudentProfileView student={popup.student} compact />
                ) : (
                  <StudentAttendanceView studentId={popup.student.id} initialYear={year} embedded />
                )}
              </div>

              <div className="border-border flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="default"
                      disabled={testimonialMutation.isPending}
                      onClick={() => testimonialMutation.mutate(popup.student!.id)}
                    >
                      {testimonialMutation.isPending ? (
                        <span className="flex items-center gap-2">
                          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8z"
                            />
                          </svg>
                          Generating…
                        </span>
                      ) : (
                        'Generate Certificate'
                      )}
                    </Button>

                    {popup.student.available && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-red-200 text-red-600 shadow-sm transition-[color,background-color,border-color] duration-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        disabled={tcMutation.isPending}
                        onClick={() => setTcConfirmOpen(true)}
                      >
                        <UserMinus className="mr-2 h-4 w-4" />
                        Give TC
                      </Button>
                    )}

                    {!popup.student.available && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-amber-200 text-amber-600 shadow-sm transition-[color,background-color,border-color] duration-200 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                        disabled={reactivateMutation.isPending}
                        onClick={() => handleReactivate(popup.student!)}
                      >
                        <RotateCw className="mr-2 h-4 w-4" />
                        Reactivate
                      </Button>
                    )}
                  </div>
                ) : (
                  <div />
                )}

                <Button onClick={closePopup} variant="outline" type="button">
                  Close
                </Button>

                {!readOnly && (
                  <ConfirmationPopup
                    open={tcConfirmOpen}
                    onOpenChange={setTcConfirmOpen}
                    onConfirm={() => {
                      setTcConfirmOpen(false);
                      if (popup.student) tcMutation.mutate(popup.student.id);
                    }}
                    confirmLabel="Confirm Issue TC"
                    variant="destructive"
                    msg={`Are you sure you want to issue a Transfer Certificate (TC) to ${popup.student.name}? This will mark them as inactive and they will no longer appear in active student lists.`}
                  />
                )}
              </div>
            </>
          )}
        </Popup>
      )}

      {showFormatInfo && (
        <Popup open onOpenChange={(o) => !o && setShowFormatInfo(false)} size="2xl">
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">Excel File Format Requirements</h2>
              <button
                onClick={() => setShowFormatInfo(false)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Use one standard format with required columns. Each row is validated before upload.
              </p>

              <div className="bg-muted/40 border-border rounded-sm border p-4">
                <h3 className="mb-2 font-medium">Required Excel Format</h3>
                <p className="text-muted-foreground mb-2 text-sm">
                  Required columns for every upload:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Required Columns:</div>
                  <div></div>

                  <div>• name</div>
                  <div>• father_name</div>

                  <div>• mother_name</div>
                  <div>• father_phone</div>

                  <div>• has_stipend (optional)</div>
                  <div>• village</div>

                  <div>• mother_phone (optional)</div>
                  <div>• post_office</div>
                  <div>• upazila</div>

                  <div>• district</div>
                  <div>• dob</div>

                  <div>• class</div>

                  <div>• roll</div>
                  <div>• section</div>

                  <div>• group</div>
                  <div></div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Important Notes:</h3>
                <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                  <li>
                    <strong>Date Format:</strong> Use DD/MM/YYYY format for date of birth (e.g.,
                    15/08/2005)
                  </li>
                  <li>
                    <strong>Father Phone:</strong> Mandatory and should be 11 digits in Bangladesh
                    format (e.g., 01XXXXXXXXX)
                  </li>
                  <li>
                    <strong>Mother Phone:</strong> Optional and should be 11 digits and start with
                    01 (e.g., 01XXXXXXXXX)
                  </li>
                  <li>
                    <strong>has_stipend:</strong> Use "Yes" or "No"
                  </li>
                  <li>
                    <strong>group:</strong> Required only for classes 9 and 10
                    (Science/Commerce/Humanities)
                  </li>
                  <li>
                    <strong>File Format:</strong> Only .xlsx or .xls files are accepted
                  </li>
                  <li>First row should contain column headers (case-insensitive)</li>
                </ul>
              </div>

              <div className="bg-muted/40 border-border rounded-sm border p-3">
                <p className="text-foreground text-sm">
                  <strong>💡 Tip:</strong> Keep column names exactly as shown above and ensure
                  required fields are filled for every row.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowFormatInfo(false)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-sm px-4 py-2 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
}
export default StudentList;
