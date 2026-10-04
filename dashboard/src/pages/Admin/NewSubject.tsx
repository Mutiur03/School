import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { readAdminXlsxWorkbook } from '@/utils/safeXlsxRead';
import {
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SectionCard,
  Popup,
  ConfirmationPopup,
  TablePagination,
  filterSelectClassName,
} from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu } from '@/components/ColumnHeaderMenu';
import { cn } from '@/lib/utils';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  subjectFormSchema,
  type SubjectFormSchemaData,
  VALID_GROUPS,
} from '@school/shared-schemas';
import ErrorMessage from '@/components/ErrorMessage';
import {
  useSubjects,
  useAddSubjects,
  useUpdateSubject,
  useDeleteSubject,
  useCloneSubjects,
} from '@/queries/subject.queries';
import type { Subject } from '@/types/subjects';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

const CLASSES = [6, 7, 8, 9, 10];

/** Columns the Excel import rejects the file without. */
const MANDATORY_COLUMNS = ['name', 'class', 'full_mark', 'year', 'assessment_type', 'priority'];

const TYPE_OPTIONS = [
  { value: 'main', label: 'Main (group)' },
  { value: 'paper', label: 'Paper (part)' },
  { value: 'single', label: 'Single subject' },
];

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const dash = <span className="text-muted-foreground">—</span>;

// Pinned Subject column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const pickerClass = cn(filterSelectClassName, 'h-8 w-auto font-medium');

const noWheel = (e: React.WheelEvent<HTMLInputElement>) => (e.target as HTMLInputElement).blur();

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

const TypeLabel = ({ type }: { type: Subject['subject_type'] }) =>
  type === 'main' ? (
    <span className="text-primary text-xs font-bold uppercase tracking-wider">Main</span>
  ) : type === 'paper' ? (
    <span className="text-muted-foreground text-xs uppercase tracking-wider">Paper</span>
  ) : (
    <span className="text-muted-foreground text-xs capitalize italic">Single</span>
  );

const CasBadge = () => (
  <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight text-blue-600 dark:text-blue-400">
    CAS
  </span>
);

// --- Create / edit form ---

const SubjectForm = ({
  register,
  handleSubmit,
  errors,
  isSubmitting,
  subjects,
  onCancel,
  onChange,
  setValue,
  control,
}: {
  register: any;
  handleSubmit: any;
  errors: any;
  isSubmitting: boolean;
  subjects: Subject[];
  onCancel: () => void;
  onChange: (e: any) => void;
  setValue: any;
  control: any;
}) => {
  const formData = useWatch({ control });
  const subjectType = formData.subject_type;
  const classNum = Number(formData.class);
  const assessmentType = formData.assessment_type;
  const markingScheme = formData.marking_scheme;
  const required = markingScheme === 'BREAKDOWN' && <span className="text-destructive">*</span>;

  // Cross-field validation for breakdown marks
  const validateBreakdown = () => {
    if (markingScheme !== 'BREAKDOWN') return true;
    if (subjectType === 'main') return true;

    const cq = Number(formData.cq_mark) || 0;
    const mcq = Number(formData.mcq_mark) || 0;
    const prac = Number(formData.practical_mark) || 0;

    return cq > 0 || mcq > 0 || prac > 0 || 'At least one mark (CQ/MCQ/Prac) is required';
  };

  const totalBreakdown =
    (Number(formData.cq_mark) || 0) +
    (Number(formData.mcq_mark) || 0) +
    (Number(formData.practical_mark) || 0);
  const totalPassBreakdown =
    (Number(formData.cq_pass_mark) || 0) +
    (Number(formData.mcq_pass_mark) || 0) +
    (Number(formData.practical_pass_mark) || 0);

  const breakdownLabel = 'text-muted-foreground flex items-center gap-1 text-xs uppercase';

  return (
    <form onSubmit={handleSubmit}>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject Name <span className="text-destructive">*</span>
            </label>
            <Input type="text" {...register('name')} placeholder="e.g. Mathematics" />
            <ErrorMessage message={errors.name?.message} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Class (6-10) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              {...register('class')}
              placeholder="e.g. 9"
              min={6}
              max={10}
              onChange={(e) => {
                onChange(e);
                register('class').onChange(e);
              }}
              onWheel={noWheel}
            />
            <ErrorMessage message={errors.class?.message} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Full Mark <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              {...register('full_mark')}
              placeholder={subjectType === 'main' ? 'Auto-calculated' : 'e.g. 100'}
              disabled={subjectType === 'main'}
              onWheel={noWheel}
              className={subjectType === 'main' ? 'bg-muted cursor-not-allowed' : ''}
            />
            <ErrorMessage message={errors.full_mark?.message} />
            {subjectType === 'main' && (
              <p className="text-muted-foreground text-xs">Calculated from its papers</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Pass Mark {assessmentType === 'exam' && <span className="text-destructive">*</span>}
            </label>
            <Input
              type="number"
              {...register('pass_mark')}
              placeholder={assessmentType === 'continuous' ? 'Optional for CAS' : 'e.g. 33'}
              onWheel={noWheel}
            />
            <ErrorMessage message={errors.pass_mark?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Subject Type <span className="text-destructive">*</span>
            </label>
            <select
              {...register('subject_type')}
              onChange={(e) => {
                onChange(e);
                register('subject_type').onChange(e);
              }}
              className={filterSelectClassName}
            >
              <option value="single">Single Subject</option>
              <option value="main">Main Subject (Group)</option>
              <option value="paper">Paper (Child Subject)</option>
            </select>
            <ErrorMessage message={errors.subject_type?.message} />
          </div>
          {subjectType === 'paper' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Parent Subject <span className="text-destructive">*</span>
              </label>
              <select {...register('parent_id')} className={filterSelectClassName}>
                <option value="">Select Parent Subject</option>
                {subjects
                  .filter((s) => s.subject_type === 'main' && s.class === classNum)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (Class {s.class})
                    </option>
                  ))}
              </select>
              <ErrorMessage message={errors.parent_id?.message} />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Priority (Sort Order)</label>
            <Input type="number" {...register('priority')} placeholder="e.g. 10" />
            <ErrorMessage message={errors.priority?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Assessment Type</label>
            <div className="flex h-9 items-center gap-4 px-1">
              <label className="pointer-coarse:py-2 flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="exam"
                  {...register('assessment_type')}
                  checked={assessmentType === 'exam'}
                  onChange={(e) => {
                    onChange(e);
                    register('assessment_type').onChange(e);
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">Exam Based</span>
              </label>
              <label className="pointer-coarse:py-2 flex cursor-pointer items-center gap-2">
                <input
                  type="radio"
                  value="continuous"
                  {...register('assessment_type')}
                  checked={assessmentType === 'continuous'}
                  onChange={(e) => {
                    onChange(e);
                    register('assessment_type').onChange(e);
                  }}
                  className="accent-primary"
                />
                <span className="text-sm">Continuous</span>
              </label>
            </div>
            <ErrorMessage message={errors.assessment_type?.message} />
          </div>

          {subjectType !== 'main' && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Marking Entry Scheme <span className="text-destructive">*</span>
              </label>
              <select
                {...register('marking_scheme' as any)}
                className={filterSelectClassName}
                value={markingScheme}
                onChange={(e) => {
                  setValue('marking_scheme' as any, e.target.value as any);
                }}
              >
                <option value="TOTAL">Total Marks Only</option>
                <option value="BREAKDOWN">Breakdown (CQ, MCQ, Practical)</option>
              </select>
              <ErrorMessage message={errors.marking_scheme?.message} />
            </div>
          )}
        </div>

        <fieldset
          className={cn(
            'rounded-lg border p-4 transition-colors',
            markingScheme === 'BREAKDOWN' ? 'border-primary/30 bg-primary/5' : 'border-border',
          )}
        >
          <legend className="flex items-center gap-2 px-2 text-sm font-semibold">
            {markingScheme === 'BREAKDOWN'
              ? 'Mandatory Marks Breakdown'
              : 'Optional Marks Breakdown'}
            {markingScheme === 'BREAKDOWN' && <span className="text-destructive font-bold">*</span>}
          </legend>

          {markingScheme === 'BREAKDOWN' &&
            totalBreakdown > 0 &&
            Number(formData.full_mark) > 0 &&
            totalBreakdown !== Number(formData.full_mark) && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message={`Sum of breakdown marks (${totalBreakdown}) must equal Full Mark (${formData.full_mark}).`}
                />
              </div>
            )}

          {markingScheme === 'BREAKDOWN' &&
            totalPassBreakdown > 0 &&
            Number(formData.pass_mark) > 0 &&
            totalPassBreakdown !== Number(formData.pass_mark) && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message={`Sum of pass marks (${totalPassBreakdown}) must equal Pass Mark (${formData.pass_mark}).`}
                />
              </div>
            )}

          {(errors.cq_mark || errors.mcq_mark || errors.practical_mark) &&
            markingScheme === 'BREAKDOWN' && (
              <div className="mb-4">
                <ErrorMessage
                  variant="block"
                  message="At least one breakdown mark (CQ, MCQ, or Practical) must be provided for this scheme."
                />
              </div>
            )}

          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={breakdownLabel}>CQ Mark {required}</label>
              <Input
                type="number"
                {...register('cq_mark', { validate: validateBreakdown })}
                onWheel={noWheel}
              />
              <ErrorMessage message={errors.cq_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className={breakdownLabel}>MCQ Mark {required}</label>
              <Input
                type="number"
                {...register('mcq_mark', { validate: validateBreakdown })}
                onWheel={noWheel}
              />
              <ErrorMessage message={errors.mcq_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className={breakdownLabel}>Practical Mark {required}</label>
              <Input
                type="number"
                {...register('practical_mark', { validate: validateBreakdown })}
                onWheel={noWheel}
              />
              <ErrorMessage message={errors.practical_mark?.message} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={breakdownLabel}>CQ Pass {required}</label>
              <Input type="number" {...register('cq_pass_mark')} onWheel={noWheel} />
              <ErrorMessage message={errors.cq_pass_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className={breakdownLabel}>MCQ Pass {required}</label>
              <Input type="number" {...register('mcq_pass_mark')} onWheel={noWheel} />
              <ErrorMessage message={errors.mcq_pass_mark?.message} />
            </div>
            <div className="space-y-1.5">
              <label className={breakdownLabel}>Practical Pass {required}</label>
              <Input type="number" {...register('practical_pass_mark')} onWheel={noWheel} />
              <ErrorMessage message={errors.practical_pass_mark?.message} />
            </div>
          </div>
        </fieldset>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Group</label>
            <select
              {...register('group')}
              disabled={classNum < 9}
              className={filterSelectClassName}
            >
              <option value="">
                {classNum >= 9 ? 'General (Common for all)' : 'Not Required for Class 6-8'}
              </option>
              {VALID_GROUPS.map((grp) => (
                <option key={grp} value={grp}>
                  {grp}
                </option>
              ))}
            </select>
            <ErrorMessage message={errors.group?.message} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Year</label>
            <Input type="number" {...register('year')} readOnly className="bg-muted" />
            <ErrorMessage message={errors.year?.message} />
          </div>
        </div>
      </div>

      <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting && <Loader2 className="animate-spin" />}
          {formData.id ? 'Save changes' : 'Create subject'}
        </Button>
      </div>
    </form>
  );
};

// --- Excel upload ---

const ExcelUploadForm = ({
  onSubmitFile,
  onDownloadDemo,
  onShowFormatInfo,
  fileUploaded,
  isSubmitting,
  excelFileRef,
  onFileUpload,
  onCancel,
}: {
  onSubmitFile: (e: FormEvent) => void;
  onDownloadDemo: () => void;
  onShowFormatInfo: () => void;
  fileUploaded: boolean;
  isSubmitting: boolean;
  excelFileRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onCancel: () => void;
}) => (
  <form onSubmit={onSubmitFile}>
    <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Required columns: {MANDATORY_COLUMNS.join(', ')}
        </p>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={onDownloadDemo}>
            <Download /> Template
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onShowFormatInfo}>
            <Info /> Format guide
          </Button>
        </div>
      </div>
      {/* The transparent file input covers the drop zone, so dropping a file works natively. */}
      <div className="relative">
        <input
          type="file"
          id="excelFile"
          accept=".xlsx, .xls"
          ref={excelFileRef}
          onChange={onFileUpload}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          required
        />
        <label
          htmlFor="excelFile"
          className="border-border hover:bg-muted/50 peer-focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center transition-colors peer-focus-visible:ring-2"
        >
          {fileUploaded ? (
            <FileSpreadsheet size={20} className="text-primary" />
          ) : (
            <Upload size={20} className="text-muted-foreground" />
          )}
          <span className="text-sm font-medium">
            {fileUploaded ? 'File ready to upload' : 'Upload Excel file'}
          </span>
          <span className="text-muted-foreground text-xs">
            Click or drop a .xlsx / .xls file here
          </span>
        </label>
      </div>
    </div>
    <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" disabled={!fileUploaded || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        {isSubmitting ? 'Uploading…' : 'Upload subjects'}
      </Button>
    </div>
  </form>
);

const NewSubject: React.FC = () => {
  const { confirm, dialog } = useConfirmDialog();
  const { data: subjects = [], isLoading: isLoadingSubjects, isError } = useSubjects();
  const addSubjectsMutation = useAddSubjects();
  const updateSubjectMutation = useUpdateSubject();
  const deleteSubjectMutation = useDeleteSubject();
  const cloneSubjectsMutation = useCloneSubjects();

  const currentYear = new Date().getFullYear();
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterClass, setFilterClass] = useState<number | 'all'>('all');
  const [filterGroup, setFilterGroup] = useState<string | 'all'>('all');
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const {
    register,
    handleSubmit: handleSub,
    reset,
    watch,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormSchemaData & { marking_scheme?: string }>({
    resolver: zodResolver(subjectFormSchema) as any,
    defaultValues: {
      id: null,
      name: '',
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      group: '',
      year: filterYear,
      subject_type: 'single',
      parent_id: null as any,
      assessment_type: 'exam',
      marking_scheme: 'TOTAL',
      priority: 0,
    },
  });

  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'form' | 'file'>('form');
  const editingId = watch('id');

  const resetFormData = useCallback((): void => {
    reset({
      id: null,
      name: '',
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      group: '',
      year: filterYear,
      subject_type: 'single',
      parent_id: null as any,
      assessment_type: 'exam',
      marking_scheme: 'TOTAL',
      priority: 0,
    });
  }, [reset, filterYear]);
  const [jsonData, setJsonData] = useState<Subject[] | null>(null);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showFormatInfo, setShowFormatInfo] = useState<boolean>(false);

  const excelFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('year', filterYear);
  }, [filterYear, setValue]);

  const isBusy =
    addSubjectsMutation.isPending ||
    updateSubjectMutation.isPending ||
    deleteSubjectMutation.isPending;

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
      const { name, value } = e.target;

      if (name === 'class') {
        const classNum = Number(value);
        if (classNum > 0 && classNum < 9) {
          setValue('class', classNum as any);
          setValue('group', '');
          return;
        }
      }

      if (name === 'assessment_type') {
        const val = value as 'exam' | 'continuous';
        setValue('assessment_type', val);
        return;
      }

      const numericFields = [
        'class',
        'full_mark',
        'pass_mark',
        'cq_mark',
        'mcq_mark',
        'practical_mark',
        'cq_pass_mark',
        'mcq_pass_mark',
        'practical_pass_mark',
        'year',
        'priority',
        'parent_id',
      ];
      if (numericFields.includes(name)) {
        setValue(name as any, value === '' ? null : Number(value));
      } else {
        setValue(name as any, value);
      }
    },
    [setValue],
  );

  const handleMethodChange = useCallback(
    (method: 'form' | 'file'): void => {
      setUploadMethod(method);
      if (method === 'form') {
        resetFormData();
      }
    },
    [resetFormData],
  );

  const onSubmit = useCallback(
    async (data: any): Promise<void> => {
      if (uploadMethod === 'form') {
        // Client-side check for breakdown marks
        const isBreakdownScheme = data.marking_scheme === 'BREAKDOWN';
        const isNotMain = data.subject_type !== 'main';

        if (isBreakdownScheme && isNotMain) {
          const cq = Number(data.cq_mark) || 0;
          const mcq = Number(data.mcq_mark) || 0;
          const prac = Number(data.practical_mark) || 0;

          if (cq <= 0 && mcq <= 0 && prac <= 0) {
            setError('cq_mark', { type: 'manual', message: 'CQ Mark required if MCQ/Prac are 0' });
            setError('mcq_mark', { type: 'manual', message: 'MCQ Mark required if CQ/Prac are 0' });
            setError('practical_mark', {
              type: 'manual',
              message: 'Practical Mark required if CQ/MCQ are 0',
            });
            toast.error(
              'At least one breakdown mark (CQ, MCQ, or Practical) MUST be greater than zero for BREAKDOWN subjects.',
            );
            return;
          }
        }

        try {
          if (data.id) {
            const originalSubject = subjects.find((s) => s.id === data.id);
            await updateSubjectMutation.mutateAsync({
              id: data.id,
              data,
              old_parent_id: originalSubject?.parent_id,
            });
          } else {
            await addSubjectsMutation.mutateAsync([data]);
          }
          resetFormData();
          setShowForm(false);
        } catch (error: any) {
          console.error('Submit error:', error);
          const serverErrors = error.response?.data?.errors;
          if (Array.isArray(serverErrors) && serverErrors.length > 0) {
            serverErrors.forEach((err: any) => {
              if (err.path && err.path.length > 0) {
                const fieldName = err.path[err.path.length - 1];
                // Map server error to form field
                setError(fieldName as any, { type: 'server', message: err.message });
              }
            });
          }
        }
      }
    },
    [uploadMethod, subjects, updateSubjectMutation, addSubjectsMutation, resetFormData, setError],
  );

  const onError = useCallback((errors: any) => {
    console.error('Form validation errors:', errors);
    toast.error('Please fix the validation errors in the form.');
  }, []);

  // Excel upload pipeline: parse, normalise, validate every row, then hold for submit.
  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => {
      const file = event.target.files?.[0];
      if (!file) return;
      setFileUploaded(true);
      const reader = new FileReader();
      reader.readAsArrayBuffer(file);
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result;
        if (!(arrayBuffer instanceof ArrayBuffer)) return;
        try {
          const { sheet } = readAdminXlsxWorkbook(arrayBuffer);
          const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
          const sheetHeaders = (rawData[0] || []) as string[];
          const missingColumns = MANDATORY_COLUMNS.filter((col) => !sheetHeaders.includes(col));
          if (missingColumns.length > 0) {
            toast.error(`Excel file is missing required columns: ${missingColumns.join(', ')}`);
            setFileUploaded(false);
            return;
          }
          const data = XLSX.utils.sheet_to_json(sheet) as any[];
          const errors: string[] = [];
          const normalizedRows = data.map((row) => {
            // More robust key matching for 'group' and other optional columns
            const findKeyByValue = (searchVal: string) =>
              Object.keys(row).find(
                (k) => String(k).trim().toLowerCase() === searchVal.toLowerCase(),
              );

            const groupKey = findKeyByValue('group');
            const groupRaw = groupKey ? String(row[groupKey as keyof typeof row] || '').trim() : '';

            const subjectGroupKey = findKeyByValue('subject_group');
            const subjectGroupRaw = subjectGroupKey
              ? String(row[subjectGroupKey as keyof typeof row] || '').trim()
              : null;

            const group = groupRaw
              ? groupRaw.charAt(0).toUpperCase() + groupRaw.slice(1).toLowerCase()
              : '';
            return {
              ...row,
              name: String(row.name || '').trim(),
              class: Number(row.class),
              full_mark: Number(row.full_mark),
              pass_mark:
                row.assessment_type?.toLowerCase() === 'continuous' ? null : Number(row.pass_mark),
              group: group === 'General' ? '' : group,
              year: Number(row.year) || new Date().getFullYear(),
              assessment_type: String(row.assessment_type || 'exam').toLowerCase(),
              subject_group: subjectGroupRaw,
              priority: Number(row.priority) || 0,
              cq_mark: Number(row.cq_mark) || 0,
              mcq_mark: Number(row.mcq_mark) || 0,
              practical_mark: Number(row.practical_mark) || 0,
              cq_pass_mark: Number(row.cq_pass_mark) || 0,
              mcq_pass_mark: Number(row.mcq_pass_mark) || 0,
              practical_pass_mark: Number(row.practical_pass_mark) || 0,
              marking_scheme: row.marking_scheme
                ? String(row.marking_scheme).toUpperCase()
                : 'TOTAL',
            };
          });
          const seen = new Set();
          normalizedRows.forEach((row, index) => {
            const rowNum = index + 2;
            const key = `${row.name}|${row.class}|${row.group}|${row.year}`;
            if (!row.name) errors.push(`Row ${rowNum}: Subject name required.`);
            if (!row.class || isNaN(row.class) || row.class < 6 || row.class > 10)
              errors.push(`Row ${rowNum}: Class must be 6-10.`);
            if (!row.full_mark || isNaN(row.full_mark) || row.full_mark <= 0)
              errors.push(`Row ${rowNum}: Full mark required.`);
            if (
              row.assessment_type === 'exam' &&
              (row.pass_mark === null || isNaN(row.pass_mark) || row.pass_mark < 0)
            )
              errors.push(`Row ${rowNum}: Pass mark required for exam.`);
            if (!row.year || isNaN(row.year) || row.year < 2000)
              errors.push(`Row ${rowNum}: Invalid year.`);
            if (!['exam', 'continuous'].includes(row.assessment_type))
              errors.push(`Row ${rowNum}: Invalid assessment type.`);
            if (row.priority < 0) errors.push(`Row ${rowNum}: Priority must be non-negative.`);
            if (
              row.marking_scheme === 'BREAKDOWN' &&
              (Number(row.cq_mark) || 0) === 0 &&
              (Number(row.mcq_mark) || 0) === 0 &&
              (Number(row.practical_mark) || 0) === 0
            ) {
              errors.push(
                `Row ${rowNum}: BREAKDOWN scheme requires at least one mark type (CQ, MCQ, or Practical).`,
              );
            }

            // Sum validation for breakdown marks
            const totalBreakdown =
              (Number(row.cq_mark) || 0) +
              (Number(row.mcq_mark) || 0) +
              (Number(row.practical_mark) || 0);
            if (totalBreakdown > 0 && row.full_mark !== totalBreakdown) {
              errors.push(
                `Row ${rowNum}: Full mark (${row.full_mark}) must equal sum of CQ, MCQ, and Practical (${totalBreakdown}).`,
              );
            }

            // Sum validation for pass marks
            const totalPassBreakdown =
              (Number(row.cq_pass_mark) || 0) +
              (Number(row.mcq_pass_mark) || 0) +
              (Number(row.practical_pass_mark) || 0);
            if (totalPassBreakdown > 0 && row.pass_mark !== totalPassBreakdown) {
              errors.push(
                `Row ${rowNum}: Pass mark (${row.pass_mark}) must equal sum of breakdown pass marks (${totalPassBreakdown}).`,
              );
            }

            if (row.pass_mark > row.full_mark) {
              errors.push(
                `Row ${rowNum}: Pass mark (${row.pass_mark}) cannot exceed full mark (${row.full_mark}).`,
              );
            }

            if (!['TOTAL', 'BREAKDOWN'].includes(row.marking_scheme))
              errors.push(`Row ${rowNum}: Invalid marking scheme (must be TOTAL or BREAKDOWN).`);
            if (seen.has(key)) errors.push(`Row ${rowNum}: Duplicate subject in file.`);
            seen.add(key);
            const isDuplicateInDB = subjects.some(
              (s) =>
                s.name === row.name &&
                s.class === row.class &&
                (s.group || '') === row.group &&
                s.year === row.year,
            );
            if (isDuplicateInDB) errors.push(`Row ${rowNum}: Subject already exists in database.`);
          });
          if (errors.length > 0) {
            errors.slice(0, 5).forEach((err) => toast.error(err, { duration: 4000 }));
            if (errors.length > 5)
              toast.error(`...and ${errors.length - 5} more rows have errors.`);
            setFileUploaded(false);
            setJsonData(null);
            if (excelFileRef.current) excelFileRef.current.value = '';
            return;
          }
          const subjectsToUpload: any[] = normalizedRows.map((row) => {
            // Let the backend handle auto-grouping via subject_group.
            // subject_type is 'single' when parent_id is null so validation passes;
            // the backend promotes it to 'paper' if a subject_group matches.
            return {
              ...row,
              subject_type: row.subject_type || 'single',
              parent_id: row.parent_id || null,
            };
          });
          subjectsToUpload.forEach((s) => {
            if (s.assessment_type === 'continuous') s.pass_mark = null;
          });
          setJsonData(subjectsToUpload);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to read spreadsheet');
          setFileUploaded(false);
          setJsonData(null);
          if (excelFileRef.current) excelFileRef.current.value = '';
        }
      };
      reader.onerror = () => {
        toast.error('Error reading the file. Please try again.');
        setFileUploaded(false);
      };
    },
    [subjects],
  );

  const handleDownloadDemoExcel = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/subject_upload_demo.xlsx';
    link.download = 'demo_subjects.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Demo Excel downloaded.');
  }, []);

  const onSubmitFile = useCallback(
    async (e: FormEvent): Promise<void> => {
      e.preventDefault();
      if (!jsonData || jsonData.length === 0) {
        toast.error('No data to upload. Please check your Excel file.');
        return;
      }
      try {
        await addSubjectsMutation.mutateAsync(jsonData);
        setFileUploaded(false);
        setJsonData(null);
        if (excelFileRef.current) {
          excelFileRef.current.value = '';
        }
        setShowForm(false);
      } catch (err: any) {
        // Error toast is raised by the mutation's onError
        console.error('Upload error:', err);
      }
    },
    [jsonData, addSubjectsMutation],
  );

  const deleteSubject = async (subject: Subject): Promise<void> => {
    try {
      await deleteSubjectMutation.mutateAsync(subject.id);
      setSelectedSubject((s) => (s?.id === subject.id ? null : s));
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const editSubject = (subject: Subject): void => {
    reset({
      id: subject.id,
      name: subject.name,
      class: subject.class as any,
      full_mark: subject.full_mark as any,
      pass_mark: subject.pass_mark as any,
      cq_mark: (subject.cq_mark || 0) as any,
      mcq_mark: (subject.mcq_mark || 0) as any,
      practical_mark: (subject.practical_mark || 0) as any,
      cq_pass_mark: (subject.cq_pass_mark || 0) as any,
      mcq_pass_mark: (subject.mcq_pass_mark || 0) as any,
      practical_pass_mark: (subject.practical_pass_mark || 0) as any,
      group: subject.group || '',
      year: subject.year,
      subject_type: subject.subject_type,
      parent_id: (subject.parent_id || null) as any,
      assessment_type: subject.assessment_type,
      marking_scheme: subject.marking_scheme || 'TOTAL',
      priority: subject.priority as any,
    });
    setSelectedSubject(null);
    setUploadMethod('form');
    setShowForm(true);
  };

  const openCreate = () => {
    resetFormData();
    setUploadMethod('form');
    setShowForm(true);
  };

  const openUpload = () => {
    resetFormData();
    setUploadMethod('file');
    setShowForm(true);
  };

  const handleCancel = useCallback(() => {
    resetFormData();
    setUploadMethod('form');
    setFileUploaded(false);
    setJsonData(null);
    if (excelFileRef.current) {
      excelFileRef.current.value = '';
    }
    setShowForm(false);
  }, [resetFormData]);

  const yearSubjects = useMemo(
    () => subjects.filter((s) => s.year === filterYear),
    [subjects, filterYear],
  );
  const mainCount = yearSubjects.filter((s) => s.subject_type === 'main').length;
  const paperCount = yearSubjects.filter((s) => s.subject_type === 'paper').length;
  const subjectNames = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);

  const filtersActive =
    filterClass !== 'all' ||
    filterGroup !== 'all' ||
    filterTypes.length > 0 ||
    Boolean(searchTerm.trim());

  const filteredSubjects = useMemo(() => {
    let baseFilter = yearSubjects;

    if (filterClass !== 'all') {
      baseFilter = baseFilter.filter((s) => s.class === filterClass);
    }
    if (filterGroup !== 'all') {
      baseFilter = baseFilter.filter((s) => (s.group || '') === filterGroup);
    }
    if (filterTypes.length > 0) {
      baseFilter = baseFilter.filter((s) => filterTypes.includes(s.subject_type));
    }
    if (debouncedSearchTerm) {
      const term = debouncedSearchTerm.toLowerCase();
      baseFilter = baseFilter.filter((s) => s.name.toLowerCase().includes(term));
    }

    // Class → priority → main/single/paper → name; papers follow their main subject.
    const sorted = [...baseFilter].sort((a, b) => {
      if (a.class !== b.class) return a.class - b.class;
      if (a.priority !== b.priority) return a.priority - b.priority;
      const typeOrder = { main: 0, single: 1, paper: 2 };
      const aTypeOrder = typeOrder[a.subject_type as keyof typeof typeOrder] ?? 2;
      const bTypeOrder = typeOrder[b.subject_type as keyof typeof typeOrder] ?? 2;
      if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;
      return a.name.localeCompare(b.name);
    });

    const result: Subject[] = [];
    const processedIds = new Set<number>();

    sorted.forEach((subject) => {
      if (subject.subject_type === 'main' || subject.subject_type === 'single') {
        result.push(subject);
        processedIds.add(subject.id);

        if (subject.subject_type === 'main') {
          const childPapers = sorted
            .filter((p) => p.subject_type === 'paper' && p.parent_id === subject.id)
            .sort((a, b) => {
              if (a.priority !== b.priority) return a.priority - b.priority;
              return a.name.localeCompare(b.name);
            });
          result.push(...childPapers);
          childPapers.forEach((p) => processedIds.add(p.id));
        }
      }
    });

    sorted.forEach((subject) => {
      if (!processedIds.has(subject.id)) {
        result.push(subject);
      }
    });

    return result;
  }, [yearSubjects, filterClass, filterGroup, filterTypes, debouncedSearchTerm]);

  const totalPages = Math.ceil(filteredSubjects.length / limit);
  const pageRows = filteredSubjects.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [filterYear, filterClass, filterGroup, filterTypes, debouncedSearchTerm, limit]);

  const clearFilters = () => {
    setFilterClass('all');
    setFilterGroup('all');
    setFilterTypes([]);
    setSearchTerm('');
  };

  const handleClone = useCallback(async () => {
    const fromYear = filterYear - 1;
    const toYear = filterYear;

    const ok = await confirm({
      title: 'Clone subjects?',
      msg: `Clone all subjects from ${fromYear} to ${toYear}? This will only work if ${toYear} has no subjects yet.`,
      confirmLabel: 'Clone Subjects',
      variant: 'default',
    });
    if (!ok) return;

    try {
      await cloneSubjectsMutation.mutateAsync({ fromYear, toYear });
    } catch (error) {
      console.error('Clone error:', error);
    }
  }, [filterYear, cloneSubjectsMutation, confirm]);

  const canClone = !isLoadingSubjects && !isBusy && yearSubjects.length === 0;

  const summary = isLoadingSubjects
    ? ' '
    : [
        `${plural(yearSubjects.length, 'subject')} in ${filterYear}`,
        `${mainCount.toLocaleString()} main`,
        plural(paperCount, 'paper'),
        ...(filtersActive ? [`${filteredSubjects.length.toLocaleString()} shown`] : []),
      ].join(' · ');

  const columns: { label: string; className?: string; header: React.ReactNode }[] = [
    {
      label: 'Subject',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Subject"
          filterInput={{ value: searchTerm, onChange: setSearchTerm, placeholder: 'Name…' }}
        />
      ),
    },
    {
      label: 'Type',
      className: 'w-32',
      header: (
        <ColumnHeaderMenu
          label="Type"
          options={TYPE_OPTIONS}
          selected={filterTypes}
          onSelectedChange={setFilterTypes}
        />
      ),
    },
    { label: 'Class', className: 'w-32', header: 'Class' },
    { label: 'Full mark', className: 'w-24 text-right', header: 'Full mark' },
    { label: 'Pass mark', className: 'w-24 text-right', header: 'Pass mark' },
    { label: 'Order', className: 'w-20 text-right', header: 'Order' },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      header: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={clearFilters}
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  const rowActions = (subject: Subject) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton
        action="view"
        iconOnly
        className="pointer-coarse:h-11 pointer-coarse:w-11"
        onClick={() => setSelectedSubject(subject)}
      />
      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <ActionButton
            iconOnly
            label="More actions"
            icon={<MoreHorizontal size={16} />}
            className="pointer-coarse:h-11 pointer-coarse:w-11"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate normal-case tracking-normal">
            {subject.name}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setSelectedSubject(subject)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => editSubject(subject)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(subject)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <p>Couldn't load subjects. Try again in a moment.</p>
      ) : filtersActive ? (
        <>
          <p>No subjects match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <>
          <p>No subjects for {filterYear} yet.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClone}
              disabled={!canClone}
            >
              <Copy /> Clone from {filterYear - 1}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={openCreate}>
              <Plus /> Add subject
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const detail = selectedSubject;
  const breakdownParts = detail
    ? [
        { label: 'CQ', mark: detail.cq_mark, pass: detail.cq_pass_mark },
        { label: 'MCQ', mark: detail.mcq_mark, pass: detail.mcq_pass_mark },
        { label: 'Practical', mark: detail.practical_mark, pass: detail.practical_pass_mark },
      ]
    : [];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="mr-1 text-2xl font-bold">Subjects</h1>
            <select
              aria-label="Session year"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className={cn(pickerClass, 'tabular-nums')}
            >
              {[currentYear + 1, currentYear, currentYear - 1].map((y) => (
                <option key={y} value={y}>
                  Session {y}
                </option>
              ))}
            </select>
            <select
              aria-label="Class"
              value={filterClass}
              onChange={(e) =>
                setFilterClass(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className={pickerClass}
            >
              <option value="all">All classes</option>
              {CLASSES.map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
            <select
              aria-label="Group"
              value={filterGroup}
              disabled={filterClass !== 'all' && filterClass < 9}
              onChange={(e) => setFilterGroup(e.target.value)}
              className={pickerClass}
            >
              <option value="all">All groups</option>
              <option value="">General</option>
              {VALID_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                More <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel>Session {filterYear}</DropdownMenuLabel>
              <DropdownMenuItem onSelect={handleClone} disabled={!canClone}>
                <Copy />
                <span className="flex flex-col">
                  {cloneSubjectsMutation.isPending ? 'Cloning…' : `Clone from ${filterYear - 1}`}
                  {yearSubjects.length > 0 && (
                    <span className="text-muted-foreground text-xs">Year already has subjects</span>
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Import</DropdownMenuLabel>
              <DropdownMenuItem onSelect={openUpload}>
                <FileSpreadsheet /> Upload from Excel
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleDownloadDemoExcel}>
                <Download /> Download Excel template
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setShowFormatInfo(true)}>
                <Info /> Excel format guide
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" onClick={openCreate} disabled={isBusy}>
            <Plus /> Add subject
          </Button>
        </div>
      </header>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoadingSubjects ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length > 0 ? (
                pageRows.map((subject) => (
                  // Opaque row colours so the pinned Subject cell hides what scrolls under it.
                  <tr
                    key={subject.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                      <div className="flex max-w-[16rem] items-center gap-2 sm:max-w-md">
                        {subject.subject_type === 'paper' && (
                          <span
                            aria-hidden
                            className="border-border ml-2 h-4 w-4 shrink-0 -translate-y-1 rounded-bl-md border-b-2 border-l-2"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedSubject(subject)}
                          className="focus-visible:ring-ring pointer-coarse:py-2 block min-w-0 truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                        >
                          {subject.name}
                        </button>
                        {subject.assessment_type === 'continuous' && <CasBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <TypeLabel type={subject.subject_type} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm">
                      <p>Class {subject.class}</p>
                      {subject.group && (
                        <p className="text-primary text-[10px] font-bold uppercase tracking-wider">
                          {subject.group}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium tabular-nums">
                      {subject.full_mark ?? dash}
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                      {subject.pass_mark ?? dash}
                    </td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {subject.priority ?? dash}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {rowActions(subject)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          limit={limit}
          totalFiltered={filteredSubjects.length}
          limitOptions={[50, 100, 200]}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteSubject(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete subject"
        msg={
          deleteTarget
            ? `Permanently delete "${deleteTarget.name}" for class ${deleteTarget.class}? This action cannot be undone.`
            : undefined
        }
      />

      {/* Create / edit / Excel upload */}
      <Popup
        open={showForm}
        onOpenChange={(o) =>
          !o && !isSubmitting && !addSubjectsMutation.isPending && handleCancel()
        }
        size="2xl"
        aria-labelledby="subject-form-title"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 id="subject-form-title" className="text-base font-semibold">
            {editingId ? 'Edit subject' : 'New subject'}
          </h2>
          <CloseButton onClick={handleCancel} />
        </div>
        {!editingId && (
          <div className="border-border flex gap-1 border-b px-5" role="tablist">
            {(
              [
                ['form', 'Form'],
                ['file', 'Excel upload'],
              ] as const
            ).map(([method, label]) => (
              <button
                key={method}
                type="button"
                role="tab"
                aria-selected={uploadMethod === method}
                onClick={() => handleMethodChange(method)}
                className={cn(
                  'pointer-coarse:py-3 -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  uploadMethod === method
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground hover:text-foreground border-transparent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {uploadMethod === 'form' ? (
          <SubjectForm
            register={register}
            handleSubmit={handleSub(onSubmit as any, onError)}
            errors={errors}
            isSubmitting={isSubmitting}
            subjects={subjects}
            onCancel={handleCancel}
            onChange={handleChange}
            setValue={setValue}
            control={control}
          />
        ) : (
          <ExcelUploadForm
            onSubmitFile={onSubmitFile}
            onDownloadDemo={handleDownloadDemoExcel}
            onShowFormatInfo={() => setShowFormatInfo(true)}
            fileUploaded={fileUploaded}
            isSubmitting={isSubmitting || addSubjectsMutation.isPending}
            excelFileRef={excelFileRef}
            onFileUpload={handleFileUpload}
            onCancel={handleCancel}
          />
        )}
      </Popup>

      {/* Details */}
      {detail && (
        <Popup
          open
          onOpenChange={(o) => !o && setSelectedSubject(null)}
          size="md"
          aria-labelledby="subject-details-title"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="subject-details-title" className="text-base font-semibold">
              Subject details
            </h2>
            <CloseButton onClick={() => setSelectedSubject(null)} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold leading-tight">
                {detail.name}
                {detail.assessment_type === 'continuous' && <CasBadge />}
              </p>
              <p className="text-muted-foreground mt-1 text-sm tabular-nums">
                Class {detail.class} · {detail.group || 'General'} · Session {detail.year}
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Type</dt>
                <dd className="mt-0.5">
                  <TypeLabel type={detail.subject_type} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Parent subject</dt>
                <dd className="mt-0.5">
                  {detail.parent_id ? (subjectNames.get(detail.parent_id) ?? dash) : dash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Full mark</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums">
                  {detail.full_mark ?? dash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Pass mark</dt>
                <dd className="mt-0.5 text-xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {detail.pass_mark ?? dash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Assessment</dt>
                <dd className="mt-0.5">
                  {detail.assessment_type === 'continuous' ? 'Continuous' : 'Exam based'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Marking scheme</dt>
                <dd className="mt-0.5">
                  {detail.marking_scheme === 'BREAKDOWN'
                    ? 'Breakdown'
                    : detail.marking_scheme === 'TOTAL'
                      ? 'Total only'
                      : dash}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium">Order</dt>
                <dd className="mt-0.5 tabular-nums">
                  {detail.priority ?? dash}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-2 text-sm font-semibold">Marks distribution</h3>
              <table className="border-border w-full overflow-hidden rounded-lg border text-sm">
                <thead>
                  <tr className="bg-muted text-foreground/70 text-xs">
                    <th className="px-3 py-1.5 text-left font-semibold">Part</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Mark</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Pass</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y tabular-nums">
                  {breakdownParts.map((p) => (
                    <tr key={p.label}>
                      <td className="px-3 py-1.5">{p.label}</td>
                      <td className="px-3 py-1.5 text-right">{p.mark ?? dash}</td>
                      <td className="px-3 py-1.5 text-right">{p.pass ?? dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(detail)}
            >
              <Trash2 /> Delete
            </Button>
            <Button type="button" className="ml-auto" onClick={() => editSubject(detail)}>
              <Pencil /> Edit subject
            </Button>
          </div>
        </Popup>
      )}

      {/* Excel format guide */}
      <Popup
        open={showFormatInfo}
        onOpenChange={setShowFormatInfo}
        size="lg"
        aria-labelledby="subject-format-title"
      >
        <div className="border-border flex items-center justify-between border-b px-5 py-4">
          <h2 id="subject-format-title" className="text-base font-semibold">
            Excel format guide
          </h2>
          <CloseButton onClick={() => setShowFormatInfo(false)} />
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
          <div className="space-y-2">
            <p className="font-medium">Required columns</p>
            <div className="flex flex-wrap gap-1.5">
              {MANDATORY_COLUMNS.map((col) => (
                <code
                  key={col}
                  className="bg-muted border-border rounded border px-2 py-0.5 font-mono text-xs"
                >
                  {col}
                </code>
              ))}
            </div>
            <p className="font-medium">Optional columns</p>
            <div className="flex flex-wrap gap-1.5">
              {['pass_mark', 'group', 'subject_group', 'marking_scheme'].map((col) => (
                <code
                  key={col}
                  className="bg-primary/5 border-primary/20 text-primary rounded border px-2 py-0.5 font-mono text-xs"
                >
                  {col}
                </code>
              ))}
            </div>
          </div>

          <dl className="space-y-2">
            {[
              ['name', 'The full title of the subject (e.g. Mathematics, Physics).'],
              ['class', 'Only numeric values between 6 and 10 are accepted.'],
              ['full_mark', 'Total assignable marks for the subject.'],
              ['pass_mark', 'Minimum marks required to pass (required for exam subjects).'],
              ['group', 'Optional. Science/Humanities/Commerce (common for all if empty).'],
              ['year', `Four-digit academic year (e.g. ${currentYear}).`],
              ['assessment_type', 'exam or continuous.'],
              ['priority', 'Sort order; 0 or higher.'],
              ['marking_scheme', 'Optional. TOTAL or BREAKDOWN. Defaults to TOTAL.'],
            ].map(([col, text]) => (
              <div key={col} className="flex gap-2">
                <dt className="w-32 shrink-0 font-mono text-xs leading-5">{col}</dt>
                <dd className="text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>

          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" />
            <p className="text-xs font-medium text-yellow-700 dark:text-yellow-400">
              Optional fields like <code>cq_mark</code>, <code>mcq_mark</code> and{' '}
              <code>practical_mark</code> (and their pass marks) can also be added as columns for
              automatic breakdown.
            </p>
          </div>
        </div>

        <div className="border-border flex items-center justify-end border-t px-5 py-3">
          <Button type="button" onClick={() => setShowFormatInfo(false)}>
            Understood
          </Button>
        </div>
      </Popup>
    </div>
  );
};

export default NewSubject;
