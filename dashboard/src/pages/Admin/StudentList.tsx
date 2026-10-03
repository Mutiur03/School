import axios from 'axios';
import React, { useCallback, useDeferredValue, useEffect, useRef, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  ImageUp,
  Info,
  KeyRound,
  Layers,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  Upload,
  User,
  UserMinus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { readAdminXlsxWorkbook } from '@/utils/safeXlsxRead';
import {
  SectionCard,
  Popup,
  ConfirmationPopup,
  TabNav,
  StatusBadge,
  TablePagination,
  filterSelectClassName,
} from '@/components';
import ActionButton from '@/components/ActionButton';
import { useForm, type UseFormRegister } from 'react-hook-form';
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
import { cn } from '@/lib/utils';
import { downloadBlob, openBlobInNewTab } from '@school/common-ui/blob';
import { notifyBulkStudentUpload, readBulkStudentCounts } from '@/lib/bulkStudentUploadFeedback';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Student } from '@/types/students';
import type { Subject } from '@/types/subjects';
import { useStudents, toStudentListQuery, type StudentSortKey } from '@/queries/students.queries';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { useSubjects } from '@/queries/subject.queries';
import {
  useUpdateFourthSubjectMutation,
  useBulkUpdateFourthSubjectMutation,
} from '@/queries/marks.queries';
import { StudentProfileView } from '@/components/students/StudentProfileView';
import { StudentAttendanceView } from '@/components/students/StudentAttendanceView';

type StudentFormData = StudentFormSchemaData;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const fourthSubjectOptions = (allSubjects: Subject[], student: Student) =>
  allSubjects.filter(
    (s) =>
      s.subject_type !== 'main' &&
      s.class === Number(student.class) &&
      (!student.group || !s.group || s.group === student.group),
  );

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

const DialogHeader = ({
  id,
  title,
  onClose,
}: {
  id?: string;
  title: string;
  onClose: () => void;
}) => (
  <div className="border-border flex items-center justify-between border-b px-5 py-4">
    <h2 id={id} className="text-base font-semibold">
      {title}
    </h2>
    <CloseButton onClick={onClose} />
  </div>
);

// Student photos are 7:9 passport crops; keep that ratio so heads aren't cut off.
const StudentAvatar = ({ student }: { student: Student }) => {
  const size = 'h-9 w-7';
  return student.image ? (
    <img
      src={getFileUrl(student.image)}
      alt=""
      loading="lazy"
      className={`border-border ${size} shrink-0 rounded border object-cover object-top`}
    />
  ) : (
    <div
      className={`bg-muted text-muted-foreground ${size} flex shrink-0 items-center justify-center rounded text-xs font-semibold`}
    >
      {student.name.charAt(0).toUpperCase()}
    </div>
  );
};

// Styled selects (Chromium base-select) wrap long values. A <button><selectedcontent>
// child lets CSS (index.css) truncate with "…". Added via DOM: React doesn't know
// <selectedcontent> and warns about <button> inside <select>. Other browsers ignore it.
const truncateSelectedValue = (el: HTMLSelectElement | null) => {
  if (!el || el.querySelector(':scope > button')) return;
  const button = document.createElement('button');
  button.append(document.createElement('selectedcontent'));
  el.prepend(button);
};

type FourthSubjectFieldProps = {
  student: Student;
  allSubjects: Subject[];
  readOnly?: boolean;
  disabled?: boolean;
  onChange: (studentId: number, subjectId: number | null) => void;
  className?: string;
};

const FourthSubjectField = ({
  student,
  allSubjects,
  readOnly,
  disabled,
  onChange,
  className,
}: FourthSubjectFieldProps) => {
  if (Number(student.class) < 9) return <span className="text-muted-foreground">—</span>;
  if (readOnly) {
    return <span>{allSubjects.find((s) => s.id === student.fourth_subject_id)?.name || '—'}</span>;
  }
  return (
    <select
      ref={truncateSelectedValue}
      aria-label={`4th subject for ${student.name}`}
      title={allSubjects.find((s) => s.id === student.fourth_subject_id)?.name}
      className={cn(filterSelectClassName, 'h-8 text-xs', className)}
      value={student.fourth_subject_id || ''}
      disabled={disabled}
      onChange={(e) => onChange(student.id, e.target.value ? Number(e.target.value) : null)}
    >
      <option value="">None</option>
      {fourthSubjectOptions(allSubjects, student).map((sub) => (
        <option key={sub.id} value={sub.id}>
          {sub.name}
        </option>
      ))}
    </select>
  );
};

// Checkbox + Student columns stay pinned while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky z-[1] bg-inherit';
const stickyEdge = 'max-xl:shadow-[1px_0_0_var(--border)]';

type StudentItemProps = {
  student: Student;
  isSelected: boolean;
  onToggleSelect: (studentId: number) => void;
  onPhoto: (student: Student) => void;
  onEdit: (student: Student) => void;
  onView: (student: Student) => void;
  onDelete: (student: Student) => void;
  allSubjects: Subject[];
  onFourthSubjectChange: (studentId: number, subjectId: number | null) => void;
  isUpdatingFourthSubject?: boolean;
  showSeniorColumns?: boolean;
  readOnly?: boolean;
};

const sameItemProps = (prev: StudentItemProps, next: StudentItemProps) =>
  prev.isSelected === next.isSelected &&
  prev.student === next.student &&
  prev.onToggleSelect === next.onToggleSelect &&
  prev.allSubjects === next.allSubjects &&
  prev.isUpdatingFourthSubject === next.isUpdatingFourthSubject &&
  prev.onFourthSubjectChange === next.onFourthSubjectChange &&
  prev.showSeniorColumns === next.showSeniorColumns &&
  prev.readOnly === next.readOnly;

const RowActions = ({
  student,
  onView,
  onEdit,
  onPhoto,
  onDelete,
  readOnly,
}: Pick<
  StudentItemProps,
  'student' | 'onView' | 'onEdit' | 'onPhoto' | 'onDelete' | 'readOnly'
>) =>
  readOnly ? (
    <ActionButton action="view" iconOnly onClick={() => onView(student)} />
  ) : (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton action="edit" iconOnly onClick={() => onEdit(student)} />
      {/* modal={false}: menu items open dialogs; a modal menu would leave pointer-events locked */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <ActionButton iconOnly label="More actions" icon={<MoreHorizontal size={16} />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate normal-case tracking-normal">
            {student.name}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onView(student)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onPhoto(student)}>
            <ImageUp /> Upload photo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(student)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

const StudentRow = React.memo((props: StudentItemProps) => {
  const {
    student,
    isSelected,
    onToggleSelect,
    onView,
    allSubjects,
    onFourthSubjectChange,
    isUpdatingFourthSubject,
    showSeniorColumns,
    readOnly,
  } = props;
  return (
    // Row colours are opaque (color-mix) so the pinned cells, which inherit them,
    // hide the columns scrolling underneath on narrow screens.
    <tr
      className={`transition-colors ${
        isSelected
          ? 'bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]'
          : 'bg-card hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]'
      }`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 3.25rem' }}
    >
      {!readOnly && (
        <td className={cn(stickyCell, 'left-0 w-10 px-3 py-2')}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(student.id)}
            aria-label={`Select ${student.name}`}
            className="h-4 w-4 align-middle"
          />
        </td>
      )}
      <td
        className={cn(stickyCell, stickyEdge, readOnly ? 'left-0' : 'left-10', 'px-3 py-2 sm:px-4')}
      >
        <div className="flex max-w-[11rem] items-center gap-3 sm:max-w-none">
          <StudentAvatar student={student} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onView(student)}
                className="focus-visible:ring-ring truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
              >
                {student.name}
              </button>
              {!student.available && <StatusBadge status="inactive" className="shrink-0" />}
            </div>
            {student.father_name && (
              <p className="text-muted-foreground truncate text-xs">{student.father_name}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-sm tabular-nums">{student.roll}</td>
      <td className="px-4 py-2 text-sm tabular-nums">{student.class}</td>
      <td className="px-4 py-2 text-sm">{student.section}</td>
      {showSeniorColumns && (
        <td className="px-4 py-2 text-sm">
          {student.group || <span className="text-muted-foreground">—</span>}
        </td>
      )}
      {showSeniorColumns && (
        <td className="px-4 py-2 text-sm">
          <FourthSubjectField
            student={student}
            allSubjects={allSubjects}
            readOnly={readOnly}
            disabled={isUpdatingFourthSubject}
            onChange={onFourthSubjectChange}
          />
        </td>
      )}
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <RowActions {...props} />
      </td>
    </tr>
  );
}, sameItemProps);

const FormSection = ({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={className}>
    <h3 className="text-muted-foreground mb-3 text-xs font-semibold uppercase tracking-wider">
      {title}
    </h3>
    {children}
  </section>
);

const Field = ({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
    {error && <ErrorMessage message={error} />}
  </div>
);

const demoRows: Record<string, string>[] = [
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

function addressTextFieldProps(
  name: 'village' | 'post_office' | 'upazila' | 'district',
  register: UseFormRegister<StudentFormData>,
) {
  return {
    ...register(name, {
      setValueAs: (value) => sentenceCaseAddressInput(String(value ?? '')),
      onBlur: (e) => {
        e.target.value = sentenceCaseAddressInput(e.target.value);
      },
    }),
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      e.currentTarget.value = sentenceCaseAddressInput(e.currentTarget.value, false);
    },
  };
}

function StudentList({ readOnly = false }: { readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<number>>(() => new Set());
  const [allMatchingSelected, setAllMatchingSelected] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const [sectionFilters, setSectionFilters] = useState<string[]>([]);
  const [groupFilters, setGroupFilters] = useState<string[]>([]);
  const [fourthFilters, setFourthFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: StudentSortKey; order: SortOrder } | null>(null);
  const [rollFilter, setRollFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [year, setYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredRollFilter = useDeferredValue(rollFilter);
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

  const listParams = {
    year,
    levels: classFilters.map(Number),
    sections: sectionFilters,
    groups: groupFilters,
    // Each option value is the comma-joined ids for one subject name (class 9 and 10 rows).
    fourthSubjects: fourthFilters.flatMap((v) => v.split(',')),
    sort: sort?.key,
    order: sort?.order,
    roll: deferredRollFilter ? Number(deferredRollFilter) : undefined,
    search: deferredSearchQuery.trim() || undefined,
    searchBy: 'name' as const,
  };

  const {
    data: studentsResponse,
    isLoading: loading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudents({ ...listParams, page, limit }, { keepPreviousPage: true });
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
    setAllMatchingSelected(false);
  }, [
    year,
    classFilters,
    sectionFilters,
    groupFilters,
    fourthFilters,
    sort,
    deferredRollFilter,
    deferredSearchQuery,
  ]);

  // Section options depend on the picked classes, so a class change drops section picks.
  const onClassFiltersChange = (values: string[]) => {
    setClassFilters(values);
    setSectionFilters([]);
  };

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
    setIsExcelUpload(false);
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
    setAllMatchingSelected(false);
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
    if (allVisibleSelected || allMatchingSelected) {
      setAllMatchingSelected(false);
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
    mutationFn: async () =>
      axios.delete('/api/students', { data: { studentIds: await getBulkIds() } }),
    onSuccess: (response) => {
      toast.success(response.data?.message || 'Selected students deleted successfully.');
      clearSelection();
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
    mutationFn: async () => {
      const response = await axios.post(
        '/api/students/password-rotations',
        { studentIds: await getBulkIds() },
        { responseType: 'blob' },
      );
      return response.data;
    },
    onSuccess: (data) => {
      downloadBlob(new Blob([data]), 'rotated_passwords.xlsx');
      toast.success('Passwords rotated successfully. Excel downloaded.');
      clearSelection();
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
    setAllMatchingSelected(false);
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

        const { created, requested } = readBulkStudentCounts(response.headers);
        return { blob: response.data as Blob, created, requested };
      }
    },
    onSuccess: (data) => {
      if (isEditing) {
        handleCancel();
        toast.success('Student updated successfully.');
        invalidateStudents();
        return;
      }

      const result = data as {
        blob: Blob;
        created: number;
        requested: number;
      };
      if (result.created > 0) {
        downloadBlob(result.blob, 'students_credentials.xlsx');
      }
      notifyBulkStudentUpload(result.created, result.requested);
      handleCancel();
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
      if (!(arrayBuffer instanceof ArrayBuffer)) return;
      try {
        const { sheet } = readAdminXlsxWorkbook(arrayBuffer);

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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to read spreadsheet');
        setFileUploaded(false);
        setexcelfile(null);
        setJsonData(null);
      }
    };
    reader.onerror = () => {
      toast.error('Error reading the file. Please try again.');
    };
  };

  const handleDownloadDemoExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(demoRows, {
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
      const counts = readBulkStudentCounts(response.headers);
      return { blob: response.data as Blob, ...counts };
    },
    onSuccess: ({ blob, created, requested }) => {
      if (created > 0) {
        downloadBlob(blob, 'students_credentials.xlsx');
      }
      notifyBulkStudentUpload(created, requested);
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

  // ponytail: pages through the list API at its 200-row cap; add an ids-only endpoint if a school passes a few thousand students.
  const fetchAllMatchingIds = async () => {
    const ids: number[] = [];
    for (let p = 1; ; p++) {
      const res = await axios.get('/api/students', {
        params: toStudentListQuery({ ...listParams, page: p, limit: 200 }),
      });
      const payload = res.data?.data as { data?: Student[]; meta?: { totalPages?: number } };
      ids.push(...(payload?.data ?? []).map((s) => s.id));
      if (p >= (payload?.meta?.totalPages ?? 0)) return ids;
    }
  };

  const getBulkIds = () =>
    allMatchingSelected ? fetchAllMatchingIds() : Promise.resolve(Array.from(selectedStudentIds));

  const clearSelection = () => {
    setSelectedStudentIds(new Set());
    setAllMatchingSelected(false);
  };

  const filtersActive = Boolean(
    searchQuery ||
    classFilters.length ||
    sectionFilters.length ||
    groupFilters.length ||
    fourthFilters.length ||
    rollFilter,
  );
  const clearFilters = () => {
    setSearchQuery('');
    setClassFilters([]);
    setSectionFilters([]);
    setGroupFilters([]);
    setFourthFilters([]);
    setRollFilter('');
  };

  const openForm = (excel: boolean) => {
    reset(defaultFormValues);
    setIsEditing(false);
    setSelectedStudent(null);
    setIsExcelUpload(excel);
    setShowForm(true);
  };

  const onPhoto = useCallback((student: Student) => {
    photoTargetRef.current = student;
    photoInputRef.current?.click();
  }, []);

  const onFourthSubjectChange = useCallback(
    (studentId: number, subjectId: number | null) => {
      updateFourthSubjectMutation.mutate(
        { studentId, year, subjectId },
        { onSuccess: () => refetchStudents() },
      );
    },
    [updateFourthSubjectMutation, year, refetchStudents],
  );
  const updatingFourthSubjectId = updateFourthSubjectMutation.isPending
    ? updateFourthSubjectMutation.variables?.studentId
    : null;

  const selectedCount = allMatchingSelected ? (meta?.filtered ?? 0) : selectedStudentIds.size;
  const filteredCount = meta?.filtered ?? 0;

  const columns: { label: string; className?: string }[] = [
    { label: 'Student' },
    { label: 'Roll', className: 'w-24' },
    { label: 'Class', className: 'w-32' },
    { label: 'Section', className: 'w-32' },
    ...(showSeniorColumns
      ? [
          { label: 'Group', className: 'w-28' },
          { label: '4th subject', className: 'w-44' },
        ]
      : []),
    { label: 'Actions', className: 'w-px' },
  ];
  const colSpan = columns.length + (readOnly ? 0 : 1);

  const itemProps = (student: Student): StudentItemProps => ({
    student,
    isSelected: allMatchingSelected || selectedStudentIds.has(student.id),
    onToggleSelect,
    onPhoto,
    onEdit: handleEdit,
    onView: onViewStudent,
    onDelete: setDeleteTarget,
    allSubjects: allSubjectsData,
    onFourthSubjectChange,
    isUpdatingFourthSubject: updatingFourthSubjectId === student.id,
    showSeniorColumns,
    readOnly,
  });

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {errorMessage ? (
        <>
          <p>{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetchStudents()}>
            <RotateCw /> Retry
          </Button>
        </>
      ) : (
        <>
          <p>No students match these filters.</p>
          {filtersActive && (
            <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          )}
        </>
      )}
    </div>
  );

  const summary = meta
    ? [
        `${filtersActive ? `${filteredCount.toLocaleString()} of ` : ''}${plural(meta.total, 'student')}`,
        meta.stipendCount != null ? `${meta.stipendCount.toLocaleString()} on stipend` : null,
        readOnly ? 'read only' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ' ';

  const isSeniorClass = watchedClass === 9 || watchedClass === 10;

  // Only subjects students actually have as 4th subject, one entry per name.
  const fourthIdsByName = new Map<string, number[]>();
  for (const s of meta?.availableFourthSubjects ?? []) {
    fourthIdsByName.set(s.name, [...(fourthIdsByName.get(s.name) ?? []), s.id]);
  }
  const fourthSubjectFilterOptions = Array.from(fourthIdsByName, ([name, ids]) => ({
    value: ids.join(','),
    label: name,
  }));

  const sortKeyByLabel: Record<string, StudentSortKey> = {
    Student: 'name',
    Roll: 'roll',
    Class: 'class',
    Section: 'section',
    Group: 'group',
    '4th subject': 'fourth',
  };
  const sortProps = (key: StudentSortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });
  // Desktop column headers: label opens a Sort + Filter menu.
  const columnHeaders: Record<string, React.ReactNode> = {
    Student: (
      <ColumnHeaderMenu
        label="Student"
        {...sortProps('name')}
        filterInput={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Student name…',
        }}
      />
    ),
    Roll: (
      <ColumnHeaderMenu
        label="Roll"
        {...sortProps('roll')}
        filterInput={{
          value: rollFilter,
          onChange: setRollFilter,
          placeholder: 'Roll number',
          type: 'number',
        }}
      />
    ),
    Class: (
      <ColumnHeaderMenu
        label="Class"
        {...sortProps('class')}
        options={sortedUniqueClasses.map((c) => ({ value: String(c), label: `Class ${c}` }))}
        selected={classFilters}
        onSelectedChange={onClassFiltersChange}
      />
    ),
    Section: (
      <ColumnHeaderMenu
        label="Section"
        {...sortProps('section')}
        options={sortedUniqueSections.map((s) => ({ value: s, label: `Section ${s}` }))}
        selected={sectionFilters}
        onSelectedChange={setSectionFilters}
      />
    ),
    Group: (
      <ColumnHeaderMenu
        label="Group"
        {...sortProps('group')}
        options={VALID_GROUPS.map((g) => ({ value: g, label: g }))}
        selected={groupFilters}
        onSelectedChange={setGroupFilters}
      />
    ),
    '4th subject': (
      <ColumnHeaderMenu
        label="4th subject"
        {...sortProps('fourth')}
        options={[{ value: 'none', label: 'None' }, ...fourthSubjectFilterOptions]}
        selected={fourthFilters}
        onSelectedChange={setFourthFilters}
        align="end"
      />
    ),
    Actions: filtersActive ? (
      <ActionButton iconOnly label="Clear filters" icon={<X size={16} />} onClick={clearFilters} />
    ) : (
      <span className="sr-only">Actions</span>
    ),
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Student List</h1>
            <select
              aria-label="Session year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium')}
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  Session {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline">
                  More <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Import</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => openForm(true)}>
                  <FileSpreadsheet /> Upload from Excel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleDownloadDemoExcel}>
                  <Download /> Download Excel template
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowFormatInfo(true)}>
                  <Info /> Excel format guide
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Class 9–10</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setBulkFourthOpen(true)}>
                  <Layers /> Bulk 4th subject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" onClick={() => openForm(false)}>
              <Plus /> Add student
            </Button>
          </div>
        )}
      </header>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways.
            ponytail: header only sticks at xl+, where the table fits without horizontal scroll. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {!readOnly && (
                  <th className={cn(stickyCell, 'left-0 w-10 px-3 py-2.5')}>
                    <input
                      type="checkbox"
                      checked={allMatchingSelected || allVisibleSelected}
                      onChange={handleSelectAllVisible}
                      aria-label="Select all students on this page"
                      className="h-4 w-4 align-middle"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.label}
                    aria-sort={
                      sort && sortKeyByLabel[col.label] === sort.key
                        ? sort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.label === 'Student' &&
                        cn(stickyCell, stickyEdge, readOnly ? 'left-0' : 'left-10', 'px-3 sm:px-4'),
                      col.label === 'Actions' && 'px-3 text-right',
                      col.className,
                    )}
                  >
                    {columnHeaders[col.label] ?? col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={colSpan} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : students.length > 0 ? (
                students.map((student) => <StudentRow key={student.id} {...itemProps(student)} />)
              ) : (
                <tr>
                  <td colSpan={colSpan}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={meta?.totalPages ?? 0}
          limit={limit}
          loading={loading}
          totalFiltered={meta ? filteredCount : undefined}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </SectionCard>

      {!readOnly && hasSelectedStudents && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CloseButton onClick={clearSelection} />
            <p className="text-sm font-medium tabular-nums">
              {plural(selectedCount, 'student')} selected
            </p>
          </div>
          {allVisibleSelected && !allMatchingSelected && filteredCount > students.length && (
            <button
              type="button"
              onClick={() => setAllMatchingSelected(true)}
              className="text-primary text-sm font-medium hover:underline"
            >
              Select all {filteredCount.toLocaleString()} matching
            </button>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setBulkRotateOpen(true)}
              disabled={bulkRotateMutation.isPending}
            >
              {bulkRotateMutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
              Rotate passwords
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Delete
            </Button>
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          {/* One hidden input serves every row's "Upload photo" menu item. */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (photoTargetRef.current) handleIndivisualImageUpload(e, photoTargetRef.current);
              e.target.value = '';
            }}
          />
          <ConfirmationPopup
            open={deleteTarget !== null}
            onOpenChange={(o) => !o && setDeleteTarget(null)}
            onConfirm={() => {
              if (deleteTarget) handleDelete(deleteTarget);
              setDeleteTarget(null);
            }}
            confirmLabel="Delete student"
            msg={`Delete ${deleteTarget?.name ?? 'this student'}? This cannot be undone.`}
          />
          <ConfirmationPopup
            open={bulkDeleteOpen}
            onOpenChange={setBulkDeleteOpen}
            onConfirm={() => {
              setBulkDeleteOpen(false);
              bulkDeleteMutation.mutate();
            }}
            confirmLabel="Delete students"
            msg={`This will permanently delete ${plural(selectedCount, 'student')}. This cannot be undone.`}
          />
          <ConfirmationPopup
            open={bulkRotateOpen}
            onOpenChange={setBulkRotateOpen}
            onConfirm={() => {
              setBulkRotateOpen(false);
              bulkRotateMutation.mutate();
            }}
            confirmLabel="Rotate passwords"
            variant="default"
            msg={`This will generate new passwords for ${plural(selectedCount, 'student')} and download an Excel file with the new credentials. Old passwords stop working.`}
          />

          <Popup
            open={bulkFourthOpen}
            onOpenChange={setBulkFourthOpen}
            size="md"
            aria-labelledby="bulk-fourth-title"
          >
            <DialogHeader
              id="bulk-fourth-title"
              title="Bulk update 4th subject"
              onClose={() => setBulkFourthOpen(false)}
            />
            <div className="space-y-4 px-5 py-4">
              <p className="text-muted-foreground text-sm">
                Applies to every student in one class and group for session {year}.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Class" required>
                  <select
                    className={filterSelectClassName}
                    value={bulkFourthClass}
                    onChange={(e) => {
                      setBulkFourthClass(e.target.value as '9' | '10' | '');
                      setBulkFourthSubjectId('');
                    }}
                  >
                    <option value="">Select</option>
                    <option value="9">Class 9</option>
                    <option value="10">Class 10</option>
                  </select>
                </Field>
                <Field label="Group" required>
                  <select
                    className={filterSelectClassName}
                    value={bulkFourthGroup}
                    onChange={(e) => {
                      setBulkFourthGroup(e.target.value);
                      setBulkFourthSubjectId('');
                    }}
                  >
                    <option value="">Select</option>
                    {VALID_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="4th subject" required>
                <select
                  className={filterSelectClassName}
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
              </Field>
            </div>
            <div className="border-border flex justify-end gap-2 border-t px-5 py-3">
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

          <Popup
            open={showForm}
            onOpenChange={(o) => !o && handleCancel()}
            size="2xl"
            aria-labelledby="student-form-title"
          >
            <DialogHeader
              id="student-form-title"
              title={isEditing ? 'Edit student' : 'Add students'}
              onClose={handleCancel}
            />
            {!isEditing && (
              <div className="px-5 pt-3">
                <TabNav
                  tabs={[
                    { id: 'form', label: 'Single student', icon: <User className="h-4 w-4" /> },
                    {
                      id: 'excel',
                      label: 'Excel upload',
                      icon: <FileSpreadsheet className="h-4 w-4" />,
                    },
                  ]}
                  activeTab={isExcelUpload ? 'excel' : 'form'}
                  onTabChange={(id) => setIsExcelUpload(id === 'excel')}
                />
              </div>
            )}
            <div className="px-5 pt-4">
              {!isExcelUpload ? (
                <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-[7rem_1fr]">
                    <div className="flex flex-col items-center gap-2 sm:items-start">
                      <label className="border-border bg-muted/40 hover:border-ring aspect-7/9 flex w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors sm:w-28">
                        {preview ? (
                          <img src={preview} alt="Preview" className="h-full w-full object-cover" />
                        ) : isEditing && selectedStudent?.image ? (
                          <img
                            src={getFileUrl(selectedStudent.image)}
                            alt="Student"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
                            <ImageUp className="h-5 w-5" />
                            Photo
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
                          className="text-destructive text-xs hover:underline"
                        >
                          Remove photo
                        </button>
                      )}
                    </div>

                    <FormSection title="Personal">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Name" required error={errors.name?.message}>
                          <Input type="text" placeholder="Full name" {...register('name')} />
                        </Field>
                        <Field label="Date of birth" required error={errors.dob?.message}>
                          <Input type="date" lang="en-GB" {...register('dob')} />
                        </Field>
                        <Field label="Father's name" required error={errors.father_name?.message}>
                          <Input type="text" {...register('father_name')} />
                        </Field>
                        <Field label="Father's phone" required error={errors.father_phone?.message}>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            placeholder="01XXXXXXXXX"
                            maxLength={11}
                            {...register('father_phone')}
                          />
                        </Field>
                        <Field label="Mother's name" required error={errors.mother_name?.message}>
                          <Input type="text" {...register('mother_name')} />
                        </Field>
                        <Field label="Mother's phone" error={errors.mother_phone?.message}>
                          <Input
                            type="tel"
                            inputMode="numeric"
                            placeholder="01XXXXXXXXX"
                            maxLength={11}
                            {...register('mother_phone')}
                          />
                        </Field>
                        <Field label="Religion" required error={errors.religion?.message}>
                          <select {...register('religion')} className={filterSelectClassName}>
                            <option value="">Select</option>
                            {RELIGION.map((religion: string) => (
                              <option key={religion} value={religion}>
                                {religion}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </FormSection>
                  </div>

                  <FormSection title="Academic">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Field label="Class" required error={errors.class?.message}>
                        <select {...register('class')} className={filterSelectClassName}>
                          <option value="">Select</option>
                          {[6, 7, 8, 9, 10].map((c) => (
                            <option key={c} value={c}>
                              Class {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Section" required error={errors.section?.message}>
                        <Input
                          type="text"
                          list="student-section-options"
                          placeholder="A"
                          {...register('section', {
                            setValueAs: (v) => String(v ?? '').toUpperCase(),
                          })}
                        />
                        <datalist id="student-section-options">
                          {(meta?.availableSections ?? []).map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </Field>
                      <Field label="Roll" required error={errors.roll?.message}>
                        <Input type="text" inputMode="numeric" {...register('roll')} />
                      </Field>
                      {isSeniorClass && (
                        <Field label="Group" required error={errors.group?.message}>
                          <select {...register('group')} className={filterSelectClassName}>
                            <option value="">Select</option>
                            {(VALID_GROUPS as readonly string[]).map((group: string) => (
                              <option key={group} value={group}>
                                {group}
                              </option>
                            ))}
                          </select>
                        </Field>
                      )}
                    </div>
                  </FormSection>

                  <FormSection title="Address">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Village" error={errors.village?.message}>
                        <Input type="text" {...addressTextFieldProps('village', register)} />
                      </Field>
                      <Field label="Post office" error={errors.post_office?.message}>
                        <Input type="text" {...addressTextFieldProps('post_office', register)} />
                      </Field>
                      <Field label="Upazila" error={errors.upazila?.message}>
                        <Input type="text" {...addressTextFieldProps('upazila', register)} />
                      </Field>
                      <Field label="District" error={errors.district?.message}>
                        <Input type="text" {...addressTextFieldProps('district', register)} />
                      </Field>
                    </div>
                  </FormSection>

                  <label className="flex w-fit items-center gap-2 text-sm font-medium">
                    <input type="checkbox" {...register('has_stipend')} className="h-4 w-4" />
                    Receives stipend
                  </label>

                  <div className="bg-card border-border sticky bottom-0 -mx-5 flex items-center justify-between gap-3 border-t px-5 py-3">
                    <p className="text-muted-foreground text-xs">
                      <span className="text-destructive">*</span> required
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        type="button"
                        disabled={formMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={formMutation.isPending}>
                        {formMutation.isPending && <Loader2 className="animate-spin" />}
                        {isEditing ? 'Save changes' : 'Add student'}
                      </Button>
                    </div>
                  </div>
                </form>
              ) : (
                <form onSubmit={sendToBackend} className="space-y-4 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-muted-foreground text-sm">Up to 500 students per file.</p>
                    <div className="flex gap-4 text-sm">
                      <button
                        type="button"
                        onClick={handleDownloadDemoExcel}
                        className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <Download className="h-4 w-4" /> Template
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowFormatInfo(true)}
                        className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <Info className="h-4 w-4" /> Format guide
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
                      onChange={handleFileUpload}
                      className="absolute h-full w-full cursor-pointer opacity-0"
                      required
                      ref={fileref}
                    />
                    <label
                      htmlFor="excelFile"
                      className="border-border hover:border-ring flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors"
                    >
                      {fileUploaded ? (
                        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                      ) : (
                        <Upload className="text-muted-foreground h-8 w-8" />
                      )}
                      <span className="text-sm font-medium">
                        {fileUploaded ? excelfile?.name : 'Choose an Excel file'}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {jsonData
                          ? `${plural(jsonData.length, 'student')} ready to upload`
                          : '.xlsx or .xls'}
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleCancel}
                      disabled={excelMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!jsonData || excelMutation.isPending}>
                      {excelMutation.isPending && <Loader2 className="animate-spin" />}
                      {jsonData ? `Upload ${plural(jsonData.length, 'student')}` : 'Upload'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Popup>
        </>
      )}

      {popup.visible && popup.student && (
        <Popup
          open
          onOpenChange={(o) => !o && closePopup()}
          size="2xl"
          aria-labelledby="student-details-title"
        >
          <DialogHeader id="student-details-title" title="Student details" onClose={closePopup} />
          <div className="px-5 pt-3">
            <TabNav
              tabs={[
                { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
                {
                  id: 'attendance',
                  label: 'Attendance',
                  icon: <CalendarDays className="h-4 w-4" />,
                },
              ]}
              activeTab={viewTab}
              onTabChange={(tabId) => setViewTab(tabId === 'attendance' ? 'attendance' : 'profile')}
            />
          </div>
          <div className="h-[60vh] overflow-y-auto px-5 py-4">
            {viewTab === 'profile' ? (
              <StudentProfileView student={popup.student} compact />
            ) : (
              <StudentAttendanceView studentId={popup.student.id} initialYear={year} embedded />
            )}
          </div>
          {!readOnly && (
            <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const student = popup.student!;
                  closePopup();
                  handleEdit(student);
                }}
              >
                <Pencil /> Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={testimonialMutation.isPending}
                onClick={() => testimonialMutation.mutate(popup.student!.id)}
              >
                {testimonialMutation.isPending && <Loader2 className="animate-spin" />}
                Generate certificate
              </Button>
              <div className="ml-auto">
                {popup.student.available ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={tcMutation.isPending}
                    onClick={() => setTcConfirmOpen(true)}
                  >
                    <UserMinus /> Give TC
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={reactivateMutation.isPending}
                    onClick={() => handleReactivate(popup.student!)}
                  >
                    <RotateCw /> Reactivate
                  </Button>
                )}
              </div>
              <ConfirmationPopup
                open={tcConfirmOpen}
                onOpenChange={setTcConfirmOpen}
                onConfirm={() => {
                  setTcConfirmOpen(false);
                  if (popup.student) tcMutation.mutate(popup.student.id);
                }}
                confirmLabel="Issue TC"
                variant="destructive"
                msg={`Issue a Transfer Certificate to ${popup.student.name}? They will be marked inactive and removed from active student lists.`}
              />
            </div>
          )}
        </Popup>
      )}

      <Popup
        open={showFormatInfo}
        onOpenChange={setShowFormatInfo}
        size="2xl"
        aria-labelledby="excel-format-title"
      >
        <DialogHeader
          id="excel-format-title"
          title="Excel format"
          onClose={() => setShowFormatInfo(false)}
        />
        <div className="space-y-4 px-5 py-4">
          <p className="text-muted-foreground text-sm">
            First row must hold these column names (case doesn't matter). Each row is checked before
            upload.
          </p>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-semibold">Column</th>
                  <th className="px-3 py-2 font-semibold">Required</th>
                  <th className="px-3 py-2 font-semibold">Example</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {demoExcelColumns.map((col) => (
                  <tr key={col}>
                    <td className="px-3 py-1.5 font-mono text-xs">{col}</td>
                    <td className="px-3 py-1.5">
                      {excelRequiredHeaders.includes(col) ? (
                        'Yes'
                      ) : col === 'group' ? (
                        'Class 9–10'
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-1.5">
                      {demoRows[1][col] || demoRows[0][col]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
            <li>dob uses DD/MM/YYYY.</li>
            <li>Phone numbers are 11 digits starting with 01.</li>
            <li>has_stipend is Yes or No.</li>
            <li>group is Science, Commerce or Humanities.</li>
          </ul>
        </div>
        <div className="border-border flex justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="outline" onClick={handleDownloadDemoExcel}>
            <Download /> Download template
          </Button>
          <Button type="button" onClick={() => setShowFormatInfo(false)}>
            Got it
          </Button>
        </div>
      </Popup>
    </div>
  );
}
export default StudentList;
