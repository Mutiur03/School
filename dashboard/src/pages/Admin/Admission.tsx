import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import axios, { isAxiosError } from 'axios';
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  StatusBadge,
  SectionCard,
  Popup,
  ConfirmationPopup,
  TablePagination,
  filterSelectClassName,
} from '@/components';
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

interface AdmissionData {
  id: string | number;
  status: string;
  student_name_en: string;
  student_name_bn?: string;
  admission_class?: string;
  section?: string;
  admission_user_id?: string;
  roll?: string;
  serial_no?: string;
  birth_reg_no?: string;
  admission_year?: number | string;
  prev_school_passing_year?: number | string;
  submission_date?: string;
  created_at?: string;
  photo_path?: string;
  list_type?: string;
  student_nick_name_bn?: string;
  registration_no?: string;
  birth_date?: string;
  blood_group?: string;
  email?: string;
  religion?: string;
  present_village_road?: string;
  present_post_office?: string;
  present_post_code?: string;
  present_upazila?: string;
  present_district?: string;
  permanent_village_road?: string;
  permanent_post_office?: string;
  permanent_post_code?: string;
  permanent_upazila?: string;
  permanent_district?: string;
  guardian_name?: string;
  guardian_relation?: string;
  guardian_phone?: string;
  guardian_nid?: string;
  guardian_village_road?: string;
  guardian_post_office?: string;
  guardian_post_code?: string;
  guardian_upazila?: string;
  guardian_district?: string;
  prev_school_name?: string;
  prev_school_upazila?: string;
  prev_school_district?: string;
  section_in_prev_school?: string;
  roll_in_prev_school?: string;
  father_name_bn?: string;
  father_name_en?: string;
  father_nid?: string;
  father_phone?: string;
  mother_name_bn?: string;
  mother_name_en?: string;
  mother_nid?: string;
  mother_phone?: string;
  father_profession?: string;
  mother_profession?: string;
  parent_income?: string;
  whatsapp_number?: string;
  qouta?: string;
}

type ListMeta = {
  total: number;
  pending: number;
  approved: number;
  page: number;
  limit: number;
  totalPages: number;
};

type SortKey = 'name' | 'class' | 'userId' | 'status' | 'date';

const QUOTA_LABELS: Record<string, string> = {
  '(GEN)': 'সাধারণ (GEN)',
  '(DIS)': 'বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)',
  '(FF)': 'মুক্তিযোদ্ধার সন্তান (FF)',
  '(GOV)': 'সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)',
  '(ME)': 'শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)',
  '(SIB)': 'সহোদর ভাই (SIB)',
  '(TWN)': 'যমজ (TWN)',
  '(Mutual Transfer)': 'পারস্পরিক বদলি (Mutual Transfer)',
  '(Govt. Transfer)': 'সরকারি বদলি (Govt. Transfer)',
};

const formatQuota = (q?: string) => {
  if (!q) return null;
  const normalized = String(q).replace(/\s+/g, ' ').trim();
  return (
    QUOTA_LABELS[normalized] ??
    QUOTA_LABELS[`(${normalized.replace(/[()]/g, '').trim()})`] ??
    normalized
  );
};

const INCOME_LABELS: Record<string, string> = {
  below_50000: '0 - 50,000',
  '50000_100000': '50,000 - 100,000',
  '100001_200000': '100,001 - 200,000',
  '200001_500000': '200,001 - 500,000',
  above_500000: 'Above 500,000',
};

const formatParentIncome = (p?: string) => {
  if (!p) return null;
  const key = String(p).trim();
  return INCOME_LABELS[key] ?? key.replace(/_/g, ' ').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
};

/** "12/05/2015" or "2015-05-12" → "12 May 2015"; anything else is shown as-is. */
const formatDateLong = (dateStr?: string) => {
  if (!dateStr) return null;
  let d, m, y;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) [d, m, y] = dateStr.split('/');
  else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) [y, m, d] = dateStr.split('-');
  else return dateStr;
  const date = new Date(`${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`);
  return Number.isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

/** Class list from admission settings: comma list, or one class per line (first column). */
const parseClassList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  const rows = raw
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  const split = (r: string) =>
    r
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  return rows.length === 1 ? split(rows[0]) : rows.map((r) => split(r)[0]).filter(Boolean);
};

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Joins the non-empty parts with ", "; null when nothing is left. */
const join = (...parts: unknown[]) => parts.filter(Boolean).join(', ') || null;

const address = (a: AdmissionData, prefix: 'present' | 'permanent' | 'guardian') => {
  const get = (key: string) => (a as unknown as Record<string, unknown>)[`${prefix}_${key}`];
  const post = [get('post_office'), get('post_code')].filter(Boolean).join('-');
  return join(get('village_road'), post, get('upazila'), get('district'));
};

const classOf = (a: AdmissionData) => a.admission_class || a.section || '';
const userIdOf = (a: AdmissionData) => a.admission_user_id || a.roll || a.serial_no || '';
const dateOf = (a: AdmissionData) => a.created_at || a.submission_date || '';

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

// Admission photos are passport crops; keep the portrait ratio so heads aren't cut off.
const AdmissionPhoto = ({ item, className }: { item: AdmissionData; className: string }) =>
  item.photo_path ? (
    <img
      src={getFileUrl(item.photo_path)}
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
      {(item.student_name_en || '?').charAt(0).toUpperCase()}
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
            {value || <span className="text-muted-foreground">—</span>}
          </dd>
        </div>
      ))}
    </dl>
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

const fetchPdf = async (id: AdmissionData['id']) => {
  const res = await axios.get(`/api/admission/form/${id}/pdf`, { responseType: 'blob' });
  return new Blob([res.data], { type: 'application/pdf' });
};

function Admission() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [filterYear, setFilterYear] = useState<string | null>(null); // null = settings year
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [detail, setDetail] = useState<AdmissionData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionData | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<AdmissionData['id'] | null>(null);

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['admissionSettings'],
    queryFn: async () => {
      const res = await axios.get('/api/admission/');
      return (res.data?.data ?? res.data ?? {}) as {
        class_list?: string | string[];
        admission_year?: string | number;
      };
    },
    staleTime: 5 * 60 * 1000,
  });
  const settingsYear = settings?.admission_year ? String(settings.admission_year) : '';
  const year = filterYear ?? settingsYear; // '' = all years

  // Only two statuses exist: one ticked = filter, none or both = all.
  const statusParam = statusFilters.length === 1 ? statusFilters[0] : 'all';
  const listParams = {
    status: statusParam,
    class: classFilter || undefined,
    admission_year: year || undefined,
    search: deferredSearch || undefined,
    sort: sort?.key,
    order: sort?.order,
  };
  const filterKey = JSON.stringify(listParams);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const {
    data: listResponse,
    isFetching,
    error: listError,
  } = useQuery({
    queryKey: ['admissionForms', { page, limit, ...listParams }],
    queryFn: async () => {
      const res = await axios.get('/api/admission/form/', {
        params: { page, limit, ...listParams },
      });
      const payload = res.data?.data;
      if (payload && Array.isArray(payload.data))
        return { data: payload.data as AdmissionData[], meta: payload.meta as ListMeta };
      return { data: (Array.isArray(payload) ? payload : []) as AdmissionData[], meta: undefined };
    },
    enabled: !settingsLoading,
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });

  const meta = listResponse?.meta;
  const loading = settingsLoading || (!listResponse && isFetching);
  const filtersActive = Boolean(search.trim()) || statusFilters.length > 0 || Boolean(classFilter);

  const items = useMemo(() => listResponse?.data ?? [], [listResponse]);

  const classOptions = useMemo(() => {
    const fromSettings = parseClassList(settings?.class_list);
    const seen = (listResponse?.data ?? []).map(classOf).filter(Boolean);
    return Array.from(new Set([...fromSettings, ...seen, classFilter].filter(Boolean)));
  }, [settings, listResponse, classFilter]);

  const yearOptions = useMemo(() => {
    const latest = Number(settingsYear) || currentYear;
    const years = Array.from({ length: 6 }, (_, i) => latest - i);
    const selected = Number(year);
    if (year && !Number.isNaN(selected) && !years.includes(selected)) {
      years.push(selected);
      years.sort((a, b) => b - a);
    }
    return years;
  }, [settingsYear, currentYear, year]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setClassFilter('');
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: AdmissionData['id']; status: 'approved' | 'pending' }) =>
      axios.put(`/api/admission/form/${id}/${status === 'pending' ? 'pending' : 'approve'}`),
    onSuccess: (_, { id, status }) => {
      toast.success(status === 'approved' ? 'Admission approved' : 'Marked as pending');
      setDetail((a) => (a?.id === id ? { ...a, status } : a));
      queryClient.invalidateQueries({ queryKey: ['admissionForms'] });
    },
    onError: () => toast.error('Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: AdmissionData['id']) => axios.delete(`/api/admission/form/${id}`),
    onSuccess: (_, id) => {
      toast.success('Admission deleted');
      setDetail((a) => (a?.id === id ? null : a));
      queryClient.invalidateQueries({ queryKey: ['admissionForms'] });
    },
    onError: (err) =>
      toast.error(
        (isAxiosError(err) && err.response?.data?.message) || 'Failed to delete admission',
      ),
  });

  const setStatus = (a: AdmissionData, status: 'approved' | 'pending') =>
    statusMutation.mutate({ id: a.id, status });

  const previewPdf = async (a: AdmissionData) => {
    // Open the tab now, inside the click, so popup blockers allow it.
    const tab = window.open('', '_blank');
    try {
      const url = URL.createObjectURL(await fetchPdf(a.id));
      if (tab) tab.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      tab?.close();
      toast.error(await blobErrorMessage(error, 'Failed to open PDF'));
    }
  };

  const downloadPdf = async (a: AdmissionData) => {
    if (pdfBusyId !== null) return;
    setPdfBusyId(a.id);
    try {
      downloadBlob(await fetchPdf(a.id), `${a.student_name_en}.pdf`);
    } catch (error) {
      toast.error(await blobErrorMessage(error, 'Failed to download PDF'));
    } finally {
      setPdfBusyId(null);
    }
  };

  const handleExport = async (type: 'sheet' | 'photos') => {
    const label = type === 'sheet' ? 'Excel sheet' : 'Photos';
    try {
      toast.loading(`Preparing ${label.toLowerCase()}…`, { id: 'export' });
      const res = await axios.get(
        `/api/admission/form/${type === 'sheet' ? 'excel' : 'images-export'}`,
        { params: listParams, responseType: 'blob' },
      );
      downloadBlob(
        new Blob([res.data]),
        type === 'sheet'
          ? `admissions_export_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `admission_images_${year || 'all'}.zip`,
      );
      toast.success(`${label} exported`, { id: 'export' });
    } catch (error) {
      toast.error(await blobErrorMessage(error, `Failed to export ${label.toLowerCase()}`), {
        id: 'export',
      });
    }
  };

  const summary = meta
    ? [
        plural(meta.pending + meta.approved, 'application'),
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
            placeholder: 'Name, user ID, roll, birth reg…',
          }}
        />
      ),
    },
    {
      label: 'Class',
      sortKey: 'class',
      className: 'w-32',
      header: (
        <ColumnHeaderMenu
          label="Class"
          {...sortProps('class')}
          options={classOptions.map((c) => ({ value: c, label: c }))}
          selected={classFilter ? [classFilter] : []}
          // The API filters one class at a time: the latest tick wins.
          onSelectedChange={(values) =>
            setClassFilter(values.filter((v) => v !== classFilter).at(-1) ?? '')
          }
        />
      ),
    },
    {
      label: 'User ID',
      sortKey: 'userId',
      className: 'w-32',
      header: <ColumnHeaderMenu label="User ID" {...sortProps('userId')} />,
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

  const rowActions = (a: AdmissionData) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton action="view" iconOnly onClick={() => setDetail(a)} />
      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <ActionButton iconOnly label="More actions" icon={<MoreHorizontal size={16} />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate normal-case tracking-normal">
            {a.student_name_en}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDetail(a)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => previewPdf(a)}>
            <FileText /> Preview PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => downloadPdf(a)}>
            <Download /> Download PDF
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {a.status === 'pending' ? (
            <DropdownMenuItem onSelect={() => setStatus(a, 'approved')}>
              <CheckCircle2 /> Approve
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setStatus(a, 'pending')}>
              <Clock /> Mark as pending
            </DropdownMenuItem>
          )}
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(a)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {listError ? (
        <p>Couldn't load admissions. Try again in a moment.</p>
      ) : filtersActive ? (
        <>
          <p>No admissions match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <p>No admission applications{year ? ` for ${year}` : ''} yet.</p>
      )}
    </div>
  );

  const detailSections = (a: AdmissionData): [string, DetailRow[]][] => [
    [
      'Admission',
      [
        ['Class', a.admission_class],
        ['List type', a.list_type],
        [
          'User ID',
          a.admission_user_id && <span className="font-mono">{a.admission_user_id}</span>,
        ],
        ['Serial no', a.serial_no],
        ['Quota', formatQuota(a.qouta)],
      ],
    ],
    [
      'Personal',
      [
        ['Name (Bangla)', a.student_name_bn],
        ['Nickname', a.student_nick_name_bn],
        ['Birth reg. no', a.birth_reg_no && <span className="font-mono">{a.birth_reg_no}</span>],
        ['Registration no', a.registration_no],
        ['Date of birth', formatDateLong(a.birth_date)],
        ['Blood group', a.blood_group],
        ['Email', a.email],
        ['Religion', a.religion],
        ['WhatsApp', a.whatsapp_number],
      ],
    ],
    [
      'Parents',
      [
        ['Father', join(a.father_name_bn, a.father_name_en)],
        ['Father NID', a.father_nid],
        ['Father phone', a.father_phone],
        ['Father profession', a.father_profession],
        ['Mother', join(a.mother_name_bn, a.mother_name_en)],
        ['Mother NID', a.mother_nid],
        ['Mother phone', a.mother_phone],
        ['Mother profession', a.mother_profession],
        ['Annual income', formatParentIncome(a.parent_income)],
      ],
    ],
    [
      'Address',
      [
        ['Present', address(a, 'present')],
        ['Permanent', address(a, 'permanent')],
      ],
    ],
    [
      'Previous school',
      [
        ['School', a.prev_school_name],
        ['School location', join(a.prev_school_upazila, a.prev_school_district)],
        ['Section / roll', join(a.section_in_prev_school, a.roll_in_prev_school)],
        ['Passing year', a.prev_school_passing_year],
      ],
    ],
    [
      'Guardian',
      a.guardian_name
        ? [
            ['Name', join(a.guardian_name, a.guardian_relation && `(${a.guardian_relation})`)],
            ['Phone', a.guardian_phone],
            ['NID', a.guardian_nid],
            ['Address', address(a, 'guardian')],
          ]
        : [['Guardian', 'Parents (no separate guardian)']],
    ],
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Admissions</h1>
            <select
              aria-label="Admission year"
              value={year}
              onChange={(e) => setFilterYear(e.target.value)}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
            >
              <option value="">All years</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline">
              <Download /> Export <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              {filtersActive ? 'Current filters' : 'All applications'}
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleExport('sheet')}>
              <FileSpreadsheet /> Excel sheet
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport('photos')}>
              <ImageIcon /> Photos (ZIP)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[48rem] border-collapse text-left">
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
              {loading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length > 0 ? (
                items.map((a) => (
                  // Opaque row colours so the pinned Student cell hides what scrolls under it.
                  <tr
                    key={a.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                      <div className="flex max-w-[12rem] items-center gap-3 sm:max-w-none">
                        <AdmissionPhoto item={a} className="h-9 w-7" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetail(a)}
                            className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                          >
                            {a.student_name_en || '—'}
                          </button>
                          {a.student_name_bn && (
                            <p className="text-muted-foreground truncate text-xs">
                              {a.student_name_bn}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">{classOf(a) || '—'}</td>
                    <td className="px-4 py-2 font-mono text-sm tabular-nums">
                      {userIdOf(a) || '—'}
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={a.status || 'unknown'} />
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                      {dateOf(a) ? formatDateWithTime(dateOf(a)) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(a)}</td>
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

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete admission"
        msg={`Delete the admission application for ${deleteTarget?.student_name_en || 'this student'}? This cannot be undone.`}
      />

      {detail && (
        <Popup
          open
          onOpenChange={(o) => !o && setDetail(null)}
          size="2xl"
          aria-labelledby="admission-details-title"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="admission-details-title" className="text-base font-semibold">
              Admission details
            </h2>
            <CloseButton onClick={() => setDetail(null)} />
          </div>

          <div className="max-h-[65vh] space-y-6 overflow-y-auto px-5 py-4">
            <div className="flex items-start gap-4">
              <AdmissionPhoto item={detail} className="h-28 w-[5.5rem] text-2xl" />
              <div className="min-w-0 space-y-2">
                <div>
                  <p className="text-lg font-semibold leading-tight">
                    {detail.student_name_en || '—'}
                  </p>
                  {detail.student_name_bn && (
                    <p className="text-muted-foreground text-sm">{detail.student_name_bn}</p>
                  )}
                </div>
                <StatusBadge status={detail.status || 'unknown'} />
                <p className="text-muted-foreground text-sm tabular-nums">
                  {join(
                    classOf(detail) && `Class ${classOf(detail)}`,
                    userIdOf(detail) && `User ID ${userIdOf(detail)}`,
                    `Admission year ${detail.admission_year ?? '—'}`,
                  )}
                </p>
              </div>
            </div>
            {detailSections(detail).map(([title, rows]) => (
              <DetailSection key={title} title={title} rows={rows} />
            ))}
            <p className="text-muted-foreground text-xs">
              Submitted {detail.submission_date ? formatDateWithTime(detail.submission_date) : '—'}{' '}
              · ID {detail.id}
            </p>
          </div>

          <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => previewPdf(detail)}>
              <FileText /> Preview PDF
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusyId !== null}
              onClick={() => downloadPdf(detail)}
            >
              {pdfBusyId === detail.id ? <Loader2 className="animate-spin" /> : <Download />}
              Download PDF
            </Button>
            <div className="ml-auto">
              {detail.status === 'pending' ? (
                <Button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => setStatus(detail, 'approved')}
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
                  onClick={() => setStatus(detail, 'pending')}
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
}

export default Admission;
