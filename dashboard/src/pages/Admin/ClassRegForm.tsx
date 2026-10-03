import React, { useState, useEffect, useMemo, useDeferredValue, useRef } from 'react';
import axios, { isAxiosError } from 'axios';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import { withUploadedKey, withoutField } from '@/lib/r2UploadPayload';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Settings,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  TabNav,
  StatusBadge,
  SectionCard,
  Popup,
  ConfirmationPopup,
  TablePagination,
  filterSelectClassName,
} from '@/components';
import type { TabItem } from '@/components';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { cn, formatDateWithTime } from '@/lib/utils';
import type {
  Class6RegistrationRecord,
  Class6RegistrationSettingsData,
  Class8RegistrationRecord,
  Class8RegistrationSettingsData,
  JuniorScholarshipRegistrationRecord,
  JuniorScholarshipRegistrationSettingsData,
  Class9RegistrationRecord,
  Class9RegistrationSettingsData,
} from '@school/shared-schemas';
import {
  class6RegistrationSettingsSchema,
  class8RegistrationSettingsSchema,
  juniorScholarshipRegistrationSettingsSchema,
  class9RegistrationSettingsSchema,
} from '@school/shared-schemas';
import { useRegistrationSettingsYear } from '@/hooks/useRegistrationSettingsYear';
import {
  RegistrationSettingsYearHeader,
  RegistrationSettingsYearStatus,
} from '@/components/RegistrationSettingsYearControls';

type Variant = 6 | 8 | 9 | 'jse';

type Registration = Partial<Class6RegistrationRecord> &
  Partial<Class8RegistrationRecord> &
  Partial<JuniorScholarshipRegistrationRecord> &
  Partial<Class9RegistrationRecord> & {
    id: string;
    birth_date: string;
    created_at: string;
    status: string;
    student_name_en: string;
    photo?: string | null;
  };

type SettingsData =
  | Class6RegistrationSettingsData
  | Class8RegistrationSettingsData
  | JuniorScholarshipRegistrationSettingsData
  | Class9RegistrationSettingsData;

type SortKey = 'name' | 'section' | 'roll' | 'status' | 'date';

const SCHEMAS = {
  6: class6RegistrationSettingsSchema,
  8: class8RegistrationSettingsSchema,
  9: class9RegistrationSettingsSchema,
  jse: juniorScholarshipRegistrationSettingsSchema,
} as const;

const CONFIG = {
  6: {
    apiBase: '/api/reg/class-6',
    qSettings: 'class6RegSettings',
    qRegs: 'class6Registrations',
    settingsYearField: 'class6_year',
    listYearParam: 'class6_year',
    recordYearKey: 'class6_year',
    preview: '/preview/class6/',
    exportPrefix: 'Class6_',
    pdfPrefix: 'Class6_Registration_',
    title: 'Class 6 Registration',
    yearLabel: 'Academic year',
    settingsCardDesc: 'Settings are saved separately for each academic year.',
    yearHeaderId: 'class6-settings-year',
    yearHeaderStatusId: 'class6-settings-year-status',
    loadingLabel: 'Loading selected year settings…',
    createHint: (year: string) =>
      `No settings for ${year} yet. Fill in the fields and create them.`,
    classmatesEnrollmentLabel: 'Automatically uses names from the Class 6 enrollment list.',
  },
  8: {
    apiBase: '/api/reg/class-8',
    qSettings: 'class8RegSettings',
    qRegs: 'class8Registrations',
    settingsYearField: 'class8_year',
    listYearParam: 'class8_year',
    recordYearKey: 'class8_year',
    preview: '/preview/class8/',
    exportPrefix: 'Class8_',
    pdfPrefix: 'Class8_Registration_',
    title: 'Class 8 Registration',
    yearLabel: 'Academic year',
    settingsCardDesc: 'Settings are saved separately for each academic year.',
    yearHeaderId: 'class8-settings-year',
    yearHeaderStatusId: 'class8-settings-year-status',
    loadingLabel: 'Loading selected year settings…',
    createHint: (year: string) =>
      `No settings for ${year} yet. Fill in the fields and create them.`,
    classmatesEnrollmentLabel: 'Automatically uses names from the Class 8 enrollment list.',
  },
  jse: {
    apiBase: '/api/reg/junior-scholarship',
    qSettings: 'juniorScholarshipRegSettings',
    qRegs: 'juniorScholarshipRegistrations',
    settingsYearField: 'jse_year',
    listYearParam: 'jse_year',
    recordYearKey: 'jse_year',
    preview: '/preview/junior-scholarship/',
    exportPrefix: 'JuniorScholarship_',
    pdfPrefix: 'JuniorScholarship_',
    title: 'Junior Scholarship Exam',
    yearLabel: 'Exam year',
    settingsCardDesc: 'Settings are saved separately for each exam year.',
    yearHeaderId: 'jse-settings-year',
    yearHeaderStatusId: 'jse-settings-year-status',
    loadingLabel: 'Loading selected year settings…',
    createHint: (year: string) =>
      `No settings for ${year} yet. Fill in the fields and create them.`,
    classmatesEnrollmentLabel: 'Automatically uses names from the Class 8 enrollment list.',
  },
  9: {
    apiBase: '/api/reg/class-9',
    qSettings: 'class9RegSettings',
    qRegs: 'class9Registrations',
    settingsYearField: 'ssc_year',
    listYearParam: 'ssc_year',
    recordYearKey: 'ssc_batch',
    preview: '/preview/class9/',
    exportPrefix: 'Class_9_',
    pdfPrefix: 'Class9_Registration_',
    title: 'Class 9 Registration',
    yearLabel: 'SSC batch',
    settingsCardDesc: 'Settings are saved separately for each SSC batch.',
    yearHeaderId: 'class9-settings-year',
    yearHeaderStatusId: 'class9-settings-year-status',
    loadingLabel: 'Loading selected batch settings…',
    createHint: (year: string) =>
      `No settings for SSC ${year} yet. Fill in the fields and create them.`,
    classmatesEnrollmentLabel: 'Automatically uses names from the Class 10 enrollment list.',
  },
} as const;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Joins the non-empty parts with ", "; null when nothing is left. */
const join = (...parts: unknown[]) => parts.filter(Boolean).join(', ') || null;

const address = (reg: Registration, prefix: 'present' | 'permanent' | 'guardian') => {
  const get = (key: string) => (reg as Record<string, unknown>)[`${prefix}_${key}`];
  const post = [get('post_office'), get('post_code')].filter(Boolean).join('-');
  return join(get('village_road'), post, get('upazila'), get('district'));
};

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

// Registration photos are passport crops; keep the portrait ratio so heads aren't cut off.
const RegPhoto = ({ reg, className }: { reg: Registration; className: string }) =>
  reg.photo ? (
    <img
      src={getFileUrl(reg.photo)}
      alt=""
      loading="lazy"
      className={cn('border-border shrink-0 rounded border object-cover object-top', className)}
    />
  ) : (
    <div
      className={cn(
        'bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded text-xs font-semibold',
        className,
      )}
    >
      {reg.student_name_en.charAt(0).toUpperCase()}
    </div>
  );

type DetailRow = [label: string, value: React.ReactNode];

const DetailSection = ({ title, rows }: { title: string; rows: DetailRow[] }) => (
  <section>
    <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
      {title}
    </h3>
    <dl className="border-border divide-border divide-y rounded-lg border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="min-w-0 break-words">
            {value ?? <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
  </section>
);

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

const FormSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
      {title}
    </h3>
    {children}
  </section>
);

// Pinned Student column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

/** Pulls the server's `message` out of a failed blob download. */
const blobErrorMessage = async (error: unknown, fallback: string) => {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      return JSON.parse(await error.response.data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

type ClassRegFormProps = { variant: Variant };

const ClassRegForm = ({ variant }: ClassRegFormProps) => {
  const cfg = CONFIG[variant];
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'settings' ? 'settings' : 'registrations';
  const handleTabChange = (id: string) => setSearchParams({ tab: id }, { replace: true });

  const currentYear = new Date().getFullYear().toString();
  const [selectedNotice, setSelectedNotice] = useState<File | null>(null);
  const noticeInputRef = useRef<HTMLInputElement>(null);
  const pickNotice = (file: File | null | undefined) => {
    if (file && file.type !== 'application/pdf') {
      toast.error('Notice must be a PDF');
      return;
    }
    setSelectedNotice(file ?? null);
    // Clear the input so picking the same file again still fires onChange.
    if (noticeInputRef.current) noticeInputRef.current.value = '';
  };

  // ---- Registrations list state ----
  const [filterYear, setFilterYear] = useState<string | null>(null); // null = latest settings year
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sectionFilters, setSectionFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [detailReg, setDetailReg] = useState<Registration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const [pdfDownloadingId, setPdfDownloadingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsData>({
    resolver: zodResolver(SCHEMAS[variant]),
    defaultValues: {
      a_sec_roll: '',
      b_sec_roll: '',
      [cfg.settingsYearField]: currentYear,
      reg_open: false,
      instruction_for_a: '',
      instruction_for_b: '',
      attachment_instruction: '',
      notice_key: null,
      classmates: '',
      classmates_source: 'default',
    } as SettingsData,
  });

  const settingsForm = watch();
  const settingsYearValue = (settingsForm as Record<string, string | undefined>)[
    cfg.settingsYearField
  ];
  const {
    normalizedSettingsYear,
    settingsYearIsValid,
    latestSettingsData,
    latestSettingsLoading,
    settingsData,
    settingsLoading,
    settingsFetching,
    settingsExist,
    defaultSettingsYear,
    settingsYearOptions,
    onSettingsYearChange,
    onUseLatestSettingsYear,
    settingsYear,
    settingsYearTouched,
  } = useRegistrationSettingsYear({
    queryKey: cfg.qSettings,
    apiPath: cfg.apiBase,
    yearParam: cfg.settingsYearField,
    yearField: cfg.settingsYearField,
    extraYearValues: [settingsYearValue, filterYear ?? undefined],
  });
  const latestRegistrationYear = latestSettingsData
    ? String((latestSettingsData as Record<string, unknown>)[cfg.settingsYearField] ?? '')
    : latestSettingsLoading
      ? ''
      : currentYear;
  const year = filterYear ?? latestRegistrationYear;

  useEffect(() => {
    if (settingsData) {
      reset({
        ...(settingsData as SettingsData),
        [cfg.settingsYearField]: String(
          (settingsData as Record<string, unknown>)[cfg.settingsYearField] ??
            normalizedSettingsYear,
        ),
        notice_key: settingsData.notice ?? null,
      });
    }
  }, [settingsData, normalizedSettingsYear, reset, cfg.settingsYearField]);

  // Only two statuses and two sections exist: one ticked = filter, none or both = all.
  const statusParam = statusFilters.length === 1 ? statusFilters[0] : 'all';
  const sectionParam = sectionFilters.length === 1 ? sectionFilters[0] : '';
  const listParams = {
    [cfg.listYearParam]: year,
    status: statusParam,
    section: sectionParam,
    search: deferredSearch || undefined,
    sort: sort?.key,
    order: sort?.order,
  };
  const filterKey = JSON.stringify(listParams);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const {
    data: registrationsResponse,
    isFetching,
    error: registrationsError,
  } = useQuery({
    queryKey: [cfg.qRegs, { page, limit, ...listParams }],
    queryFn: async () => {
      const res = await axios.get(`${cfg.apiBase}/form`, {
        params: { page, limit, ...listParams },
      });
      return res.data.success ? res.data.data : null;
    },
    enabled: !latestSettingsLoading && Boolean(year),
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const registrations: Registration[] = registrationsResponse?.data ?? [];
  const meta = registrationsResponse?.meta as
    { total: number; pending: number; approved: number; totalPages: number } | undefined;
  const loading = latestSettingsLoading || !year || (!registrationsResponse && isFetching);
  const filtersActive =
    Boolean(search.trim()) || statusFilters.length > 0 || sectionFilters.length > 0;

  const clearFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setSectionFilters([]);
  };

  const settingsMutation = useMutation({
    mutationFn: async (updatedSettings: SettingsData) => {
      let uploadedNoticeKey: string | undefined;

      if (selectedNotice) {
        const { data: urlData } = await axios.post(`${cfg.apiBase}/upload-url`, {
          filename: selectedNotice.name,
          filetype: selectedNotice.type,
        });

        if (urlData.success) {
          await putFileToPresignedUrl(urlData.data.uploadUrl, selectedNotice, selectedNotice.type);
          uploadedNoticeKey = urlData.data.key;
        }
      }

      const basePayload = {
        ...withoutField(updatedSettings, 'notice_key'),
        [cfg.settingsYearField]:
          (updatedSettings as Record<string, string>)[cfg.settingsYearField] ||
          normalizedSettingsYear,
        reg_open:
          typeof updatedSettings.reg_open === 'boolean'
            ? updatedSettings.reg_open.toString()
            : updatedSettings.reg_open,
      };

      const payload = withUploadedKey(basePayload, 'notice_key', uploadedNoticeKey);

      const res = await axios.post(cfg.apiBase, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success(settingsExist ? 'Settings saved' : 'Settings created');
      queryClient.invalidateQueries({ queryKey: [cfg.qSettings] });
      setSelectedNotice(null);
      if (noticeInputRef.current) noticeInputRef.current.value = '';
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await axios.put(`${cfg.apiBase}/form/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, { id, status }) => {
      toast.success(status === 'approved' ? 'Registration approved' : 'Marked as pending');
      setDetailReg((r) => (r?.id === id ? { ...r, status } : r));
      queryClient.invalidateQueries({ queryKey: [cfg.qRegs] });
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.delete(`${cfg.apiBase}/form/${id}`);
      return res.data;
    },
    onSuccess: (_, id) => {
      toast.success('Registration deleted');
      setDetailReg((r) => (r?.id === id ? null : r));
      queryClient.invalidateQueries({ queryKey: [cfg.qRegs] });
    },
    onError: () => {
      toast.error('Failed to delete registration');
    },
  });

  const setStatus = (reg: Registration, status: 'approved' | 'pending') =>
    statusMutation.mutate({ id: reg.id, status });

  const previewPdf = (reg: Registration) =>
    window.open(`${cfg.preview}${reg.id}`, '_blank', 'noopener,noreferrer');

  const downloadPdf = async (reg: Registration) => {
    if (pdfDownloadingId) return;
    setPdfDownloadingId(reg.id);
    try {
      const response = await axios.get(`${cfg.apiBase}/form/${reg.id}/pdf`, {
        responseType: 'blob',
      });
      downloadBlob(
        new Blob([response.data], { type: 'application/pdf' }),
        `${cfg.pdfPrefix}${reg.student_name_en.replace(/\s+/g, '_')}.pdf`,
      );
    } catch (error) {
      toast.error(await blobErrorMessage(error, 'Failed to download PDF'));
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const handleExport = async (type: 'sheet' | 'photos') => {
    const endpoint = type === 'sheet' ? 'export' : 'export-photos';
    const label = type === 'sheet' ? 'Excel sheet' : 'Photos';
    try {
      toast.loading(`Preparing ${label.toLowerCase()}…`, { id: 'export' });
      const res = await axios.get(`${cfg.apiBase}/form/${endpoint}`, {
        params: { status: statusParam, section: sectionParam, [cfg.listYearParam]: year },
        responseType: 'blob',
      });
      downloadBlob(
        new Blob([res.data]),
        `${cfg.exportPrefix}${type}_${year}${sectionParam ? `_${sectionParam}` : ''}.${
          type === 'sheet' ? 'xlsx' : 'zip'
        }`,
      );
      toast.success(`${label} exported`, { id: 'export' });
    } catch (error) {
      toast.error(await blobErrorMessage(error, `Failed to export ${label.toLowerCase()}`), {
        id: 'export',
      });
    }
  };

  const yearOptions = useMemo(() => {
    const latest = Number(latestRegistrationYear || currentYear);
    const years = Array.from({ length: 6 }, (_, i) => latest - i);
    const selected = Number(year);
    if (year && !Number.isNaN(selected) && !years.includes(selected)) {
      years.push(selected);
      years.sort((a, b) => b - a);
    }
    return years;
  }, [latestRegistrationYear, currentYear, year]);

  const tabs: TabItem[] = [
    {
      id: 'registrations',
      label: 'Registrations',
      icon: <Users size={16} />,
      href: `${location.pathname}?tab=registrations`,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} />,
      href: `${location.pathname}?tab=settings`,
    },
  ];

  const summary = meta
    ? [
        plural(meta.pending + meta.approved, 'registration'),
        meta.pending ? `${meta.pending.toLocaleString()} pending` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ' ';

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });

  const columns: {
    label: string;
    sortKey?: SortKey;
    className?: string;
    header: React.ReactNode;
  }[] = [
    {
      label: 'Student',
      sortKey: 'name',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Student"
          {...sortProps('name')}
          filterInput={{
            value: search,
            onChange: setSearch,
            placeholder: 'Name, roll, birth reg…',
          }}
        />
      ),
    },
    {
      label: 'Section',
      sortKey: 'section',
      className: 'w-28',
      header: (
        <ColumnHeaderMenu
          label="Section"
          {...sortProps('section')}
          options={['A', 'B'].map((s) => ({ value: s, label: `Section ${s}` }))}
          selected={sectionFilters}
          onSelectedChange={setSectionFilters}
        />
      ),
    },
    {
      label: 'Roll',
      sortKey: 'roll',
      className: 'w-24',
      header: <ColumnHeaderMenu label="Roll" {...sortProps('roll')} />,
    },
    {
      label: 'Status',
      sortKey: 'status',
      className: 'w-32',
      header: (
        <ColumnHeaderMenu
          label="Status"
          {...sortProps('status')}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
          ]}
          selected={statusFilters}
          onSelectedChange={setStatusFilters}
        />
      ),
    },
    {
      label: 'Submitted',
      sortKey: 'date',
      className: 'w-44',
      header: <ColumnHeaderMenu label="Submitted" {...sortProps('date')} />,
    },
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

  const rowActions = (reg: Registration) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton action="view" iconOnly onClick={() => setDetailReg(reg)} />
      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <ActionButton iconOnly label="More actions" icon={<MoreHorizontal size={16} />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate normal-case tracking-normal">
            {reg.student_name_en}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDetailReg(reg)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => previewPdf(reg)}>
            <FileText /> Preview PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadPdf(reg)}>
            <Download /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {reg.status === 'pending' ? (
            <DropdownMenuItem onSelect={() => setStatus(reg, 'approved')}>
              <CheckCircle2 /> Approve
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setStatus(reg, 'pending')}>
              <Clock /> Mark as pending
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(reg)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {registrationsError ? (
        <p>Couldn't load registrations. Try again in a moment.</p>
      ) : filtersActive ? (
        <>
          <p>No registrations match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <p>No registrations for {variant === 9 ? `SSC ${year}` : year} yet.</p>
      )}
    </div>
  );

  const detailRows = (reg: Registration) => {
    const personal: DetailRow[] = [
      ['Name (Bangla)', reg.student_name_bn],
      ...(variant === 9 ? [['Nickname', reg.student_nick_name_bn] as DetailRow] : []),
      ['Birth reg. no', reg.birth_reg_no && <span className="font-mono">{reg.birth_reg_no}</span>],
      ['Date of birth', reg.birth_date],
      ...(variant === 9
        ? [['Blood group', reg.blood_group] as DetailRow]
        : [['Scout', reg.scout_status || 'No'] as DetailRow]),
      ['Email', reg.email],
      ['Father phone', reg.father_phone],
      ['Mother phone', reg.mother_phone],
    ];
    const parents: DetailRow[] = [
      ['Father', join(reg.father_name_bn, reg.father_name_en)],
      ['Father NID', reg.father_nid],
      ['Mother', join(reg.mother_name_bn, reg.mother_name_en)],
      ['Mother NID', reg.mother_nid],
    ];
    const addresses: DetailRow[] = [
      ['Present', address(reg, 'present')],
      ['Permanent', address(reg, 'permanent')],
      [
        'Nearby student',
        (variant === 9 ? reg.nearby_nine_student_info : reg.nearby_student_info) ||
          'Not applicable',
      ],
    ];
    const academic: DetailRow[] = [
      ['Previous school', join(reg.prev_school_name)],
      ['School location', join(reg.prev_school_upazila, reg.prev_school_district)],
      ...(variant === 6
        ? ([
            ['Section / roll', join(reg.section_in_prev_school, reg.roll_in_prev_school)],
            ['Passing year', reg.prev_school_passing_year],
          ] as DetailRow[])
        : []),
      ...(variant === 8 || variant === 'jse'
        ? ([
            ['Class 6 reg. year', reg.class6_reg_year],
            ['Class 6 board', reg.class6_board],
            ['Class 6 reg. no', reg.class6_reg_no],
            ['Class 6 ID / roll', reg.class6_roll_no],
          ] as DetailRow[])
        : []),
      ...(variant === 9
        ? ([
            ['Group', reg.group_class_nine],
            ['Main subject', reg.main_subject],
            ['4th subject', reg.fourth_subject],
            ['JSC year', reg.jsc_passing_year],
            ['JSC ID / roll', reg.jsc_roll_no],
            ['JSC reg. no', reg.jsc_reg_no],
          ] as DetailRow[])
        : []),
    ];
    const guardian: DetailRow[] = reg.guardian_name
      ? [
          ['Name', join(reg.guardian_name, reg.guardian_relation && `(${reg.guardian_relation})`)],
          ['Phone', reg.guardian_phone],
          ['NID', reg.guardian_nid],
          ['Address', address(reg, 'guardian')],
        ]
      : [['Guardian', 'Parents (no separate guardian)']];
    return { personal, parents, addresses, academic, guardian };
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{cfg.title}</h1>
            {activeTab === 'registrations' && (
              <select
                aria-label={cfg.yearLabel}
                value={year}
                onChange={(e) => setFilterYear(e.target.value)}
                className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {variant === 9 ? `SSC ${y}` : y}
                  </option>
                ))}
              </select>
            )}
          </div>
          {activeTab === 'registrations' && (
            <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
          )}
        </div>
        {activeTab === 'registrations' && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Download /> Export <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                {filtersActive ? 'Current filters' : 'All registrations'}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => handleExport('sheet')}>
                <FileSpreadsheet /> Excel sheet
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleExport('photos')}>
                <ImageIcon /> Photos (ZIP)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} className="mb-6" />

      {activeTab === 'settings' ? (
        <SectionCard
          title="Registration settings"
          description={cfg.settingsCardDesc}
          icon={<Settings size={20} />}
          headerAction={
            <RegistrationSettingsYearHeader
              id={cfg.yearHeaderId}
              label={cfg.yearLabel}
              settingsYear={settingsYear}
              settingsYearOptions={settingsYearOptions}
              defaultSettingsYear={defaultSettingsYear}
              settingsYearTouched={settingsYearTouched}
              onYearChange={onSettingsYearChange}
              onUseLatest={onUseLatestSettingsYear}
            />
          }
        >
          {latestSettingsLoading || settingsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit((data) => settingsMutation.mutate(data))}>
              <div className="space-y-8">
                <RegistrationSettingsYearStatus
                  statusId={cfg.yearHeaderStatusId}
                  settingsFetching={settingsFetching}
                  loadingLabel={cfg.loadingLabel}
                  showCreateHint={!settingsExist && Boolean(settingsData)}
                  createHint={cfg.createHint(normalizedSettingsYear)}
                />

                <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-4">
                  <input type="checkbox" {...register('reg_open')} className="mt-0.5 h-4 w-4" />
                  <span>
                    <span className="block text-sm font-medium">Accept registrations</span>
                    <span className="text-muted-foreground block text-sm">
                      Students can submit the form while this is on.
                    </span>
                  </span>
                </label>

                <FormSection title="Sections">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Section A roll range" error={errors.a_sec_roll?.message}>
                      <Input {...register('a_sec_roll')} placeholder="01-50" />
                    </Field>
                    <Field label="Section B roll range" error={errors.b_sec_roll?.message}>
                      <Input {...register('b_sec_roll')} placeholder="51-100" />
                    </Field>
                  </div>
                </FormSection>

                <FormSection title="Notice">
                  <input
                    ref={noticeInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => pickNotice(e.target.files?.[0])}
                  />
                  {selectedNotice || settingsForm.notice_key ? (
                    <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {selectedNotice ? selectedNotice.name : 'Current notice'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {selectedNotice
                            ? `${(selectedNotice.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                            : 'PDF · shown to students on the registration page'}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {selectedNotice ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => pickNotice(null)}
                          >
                            <X /> Remove
                          </Button>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" asChild>
                            <a
                              href={getFileUrl(settingsForm.notice_key!)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink /> View
                            </a>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => noticeInputRef.current?.click()}
                        >
                          <Upload /> Replace
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => noticeInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        pickNotice(e.dataTransfer.files[0]);
                      }}
                      className="border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <Upload size={20} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Upload notice PDF</span>
                      <span className="text-muted-foreground text-xs">
                        Click or drop a file here
                      </span>
                    </button>
                  )}
                </FormSection>

                <FormSection title="Instructions">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Section A" error={errors.instruction_for_a?.message}>
                      <Textarea {...register('instruction_for_a')} className="h-24" />
                    </Field>
                    <Field label="Section B" error={errors.instruction_for_b?.message}>
                      <Textarea {...register('instruction_for_b')} className="h-24" />
                    </Field>
                  </div>
                  <Field label="Attachments" error={errors.attachment_instruction?.message}>
                    <Textarea {...register('attachment_instruction')} className="h-24" />
                  </Field>
                </FormSection>

                <FormSection title="Classmates list">
                  <Field
                    label="Source"
                    hint={
                      settingsForm.classmates_source === 'custom'
                        ? 'Students pick from your list in the nearby student field.'
                        : cfg.classmatesEnrollmentLabel
                    }
                    error={errors.classmates_source?.message}
                  >
                    <select
                      {...register('classmates_source')}
                      className={cn(filterSelectClassName, 'sm:max-w-sm')}
                    >
                      <option value="default">Current student list</option>
                      <option value="custom">Custom list</option>
                    </select>
                  </Field>
                  {settingsForm.classmates_source === 'custom' && (
                    <Field
                      label="Names"
                      hint="Separate names with commas."
                      error={errors.classmates?.message}
                    >
                      <Textarea
                        {...register('classmates')}
                        placeholder="আব্দুল করিম, রহিম উদ্দিন, সালমা খাতুন"
                        className="h-24"
                      />
                    </Field>
                  )}
                </FormSection>
              </div>

              <div className="border-border mt-8 flex items-center justify-end gap-3 border-t pt-4">
                {(isDirty || selectedNotice) && (
                  <span className="text-muted-foreground text-sm">Unsaved changes</span>
                )}
                <Button
                  type="submit"
                  disabled={
                    !settingsYearIsValid ||
                    !settingsData ||
                    settingsMutation.isPending ||
                    (settingsExist && !isDirty && !selectedNotice)
                  }
                >
                  {settingsMutation.isPending && <Loader2 className="animate-spin" />}
                  {settingsExist ? 'Save settings' : 'Create settings'}
                </Button>
              </div>
            </form>
          )}
        </SectionCard>
      ) : (
        <SectionCard noPadding className="mb-6">
          {/* One table for every screen: narrow screens scroll it sideways. */}
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full min-w-[44rem] border-collapse text-left">
              <thead className="xl:sticky xl:top-0 xl:z-10">
                <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                  {columns.map((col) => (
                    <th
                      key={col.label}
                      aria-sort={
                        sort && col.sortKey === sort.key
                          ? sort.order === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                      className={cn(
                        'text-muted-foreground px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                        col.className,
                      )}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {loading ? (
                  Array.from({ length: 8 }, (_, i) => (
                    <tr key={i}>
                      <td colSpan={columns.length} className="px-4 py-2">
                        <Skeleton className="h-9 w-full" />
                      </td>
                    </tr>
                  ))
                ) : registrations.length > 0 ? (
                  registrations.map((reg) => (
                    // Opaque row colours so the pinned Student cell hides what scrolls under it.
                    <tr
                      key={reg.id}
                      className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                    >
                      <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                        <div className="flex max-w-[12rem] items-center gap-3 sm:max-w-none">
                          <RegPhoto reg={reg} className="h-9 w-7" />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setDetailReg(reg)}
                              className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                            >
                              {reg.student_name_en}
                            </button>
                            {reg.student_name_bn && (
                              <p className="text-muted-foreground truncate text-xs">
                                {reg.student_name_bn}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">{reg.section || '—'}</td>
                      <td className="px-4 py-2 text-sm tabular-nums">{reg.roll || '—'}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={reg.status} />
                      </td>
                      <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                        {formatDateWithTime(reg.created_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(reg)}</td>
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
            totalPages={meta?.totalPages ?? 0}
            limit={limit}
            loading={isFetching}
            totalFiltered={meta?.total}
            limitOptions={[50, 100, 200]}
            onPageChange={setPage}
            onLimitChange={(l) => {
              setLimit(l);
              setPage(1);
            }}
          />
        </SectionCard>
      )}

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete registration"
        msg={`Delete the registration for ${deleteTarget?.student_name_en ?? 'this student'}? This cannot be undone.`}
      />

      {detailReg && (
        <Popup
          open
          onOpenChange={(o) => !o && setDetailReg(null)}
          size="2xl"
          aria-labelledby="registration-details-title"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="registration-details-title" className="text-base font-semibold">
              Registration details
            </h2>
            <CloseButton onClick={() => setDetailReg(null)} />
          </div>

          <div className="max-h-[65vh] space-y-6 overflow-y-auto px-5 py-4">
            <div className="flex items-start gap-4">
              <RegPhoto reg={detailReg} className="h-28 w-[5.5rem] text-2xl" />
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-lg font-semibold leading-tight">{detailReg.student_name_en}</p>
                  {detailReg.student_name_bn && (
                    <p className="text-muted-foreground text-sm">{detailReg.student_name_bn}</p>
                  )}
                </div>
                <StatusBadge status={detailReg.status} />
                <p className="text-muted-foreground text-sm tabular-nums">
                  {join(
                    detailReg.section && `Section ${detailReg.section}`,
                    detailReg.roll && `Roll ${detailReg.roll}`,
                    `${cfg.yearLabel} ${String(
                      detailReg[cfg.recordYearKey as keyof Registration] ?? '—',
                    )}`,
                    detailReg.religion,
                  )}
                </p>
              </div>
            </div>
            {(() => {
              const rows = detailRows(detailReg);
              return (
                <>
                  <DetailSection title="Personal" rows={rows.personal} />
                  <DetailSection title="Parents" rows={rows.parents} />
                  <DetailSection title="Address" rows={rows.addresses} />
                  <DetailSection title="Education" rows={rows.academic} />
                  <DetailSection title="Guardian" rows={rows.guardian} />
                </>
              );
            })()}
            <p className="text-muted-foreground text-xs">
              Submitted {formatDateWithTime(detailReg.created_at)} · ID {detailReg.id}
            </p>
          </div>

          <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => previewPdf(detailReg)}>
              <FileText /> Preview PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pdfDownloadingId !== null}
              onClick={() => downloadPdf(detailReg)}
            >
              {pdfDownloadingId === detailReg.id ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              Download PDF
            </Button>
            <div className="ml-auto">
              {detailReg.status === 'pending' ? (
                <Button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => setStatus(detailReg, 'approved')}
                >
                  {statusMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CheckCircle2 />
                  )}
                  Approve
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={statusMutation.isPending}
                  onClick={() => setStatus(detailReg, 'pending')}
                >
                  <Clock /> Mark as pending
                </Button>
              )}
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
};

export default ClassRegForm;
