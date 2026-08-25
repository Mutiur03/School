import { useState, useEffect, useMemo, useDeferredValue, useCallback } from 'react';
import type { ChangeEvent } from 'react';
import axios from 'axios';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  Plus,
  Search,
  XCircle,
  Download,
  Image as ImageIcon,
  FileText,
  Settings,
  Users,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import {
  PageHeader,
  TabNav,
  StatsCard,
  StatusBadge,
  SectionCard,
  Popup,
  FilterSelection,
  FilterField,
  filterSelectClassName,
  filterInputClassName,
} from '@/components';
import type { TabItem } from '@/components';
import DeleteConfirmation from '@/components/DeleteConfimation';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import ActionButton from '@/components/ActionButton';
import { formatDateWithTime } from '@/lib/utils';
import type {
  Class9RegistrationRecord,
  Class9RegistrationSettingsData,
} from '@school/shared-schemas';
import { class9RegistrationSettingsSchema } from '@school/shared-schemas';

/** Full DB record as returned by the admin API — all server-managed fields are non-nullable here. */
type Registration = Omit<
  Class9RegistrationRecord,
  'ssc_batch' | 'birth_date' | 'created_at' | 'status'
> & {
  ssc_batch: string;
  birth_date: string;
  created_at: string;
  status: string;
};

const Class9RegForm = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'registrations' | 'settings'>(
    tabParam === 'settings' ? 'settings' : 'registrations',
  );

  const handleTabChange = (id: string) => {
    const next = id as 'registrations' | 'settings';
    setActiveTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'registrations') {
      setActiveTab(tab);
    } else {
      setActiveTab('registrations');
      setSearchParams({ tab: 'registrations' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const currentYear = new Date().getFullYear().toString();
  const [selectedNotice, setSelectedNotice] = useState<File | null>(null);
  const [settingsYear, setSettingsYear] = useState(currentYear);
  const [settingsYearTouched, setSettingsYearTouched] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    section: '',
    year: currentYear,
    search: '',
  });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const deferredFilters = useDeferredValue(filters);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState<{ id: string; status: string } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<Class9RegistrationSettingsData>({
    resolver: zodResolver(class9RegistrationSettingsSchema),
    defaultValues: {
      a_sec_roll: '',
      b_sec_roll: '',
      ssc_year: currentYear,
      reg_open: false,
      instruction_for_a: '',
      instruction_for_b: '',
      attachment_instruction: '',
      notice_key: null,
      classmates: '',
      classmates_source: 'default',
    },
  });

  const settingsForm = watch();
  const normalizedSettingsYear = settingsYear.trim();
  const settingsYearIsValid = /^\d{4}$/.test(normalizedSettingsYear);

  const {
    data: latestSettingsData,
    isLoading: latestSettingsLoading,
    isFetched: latestSettingsFetched,
  } = useQuery({
    queryKey: ['class9RegSettings', 'latest'],
    queryFn: async () => {
      const res = await axios.get(`/api/reg/class-9`);
      return res.data.success ? res.data.data : null;
    },
  });

  const {
    data: settingsData,
    isLoading: settingsLoading,
    isFetching: settingsFetching,
  } = useQuery({
    queryKey: ['class9RegSettings', normalizedSettingsYear],
    queryFn: async () => {
      const res = await axios.get(`/api/reg/class-9`, {
        params: { ssc_year: normalizedSettingsYear },
      });
      return res.data.success ? res.data.data : null;
    },
    enabled: settingsYearIsValid && (settingsYearTouched || latestSettingsFetched),
  });

  const defaultSettingsYear = String(latestSettingsData?.ssc_year || currentYear);

  const settingsYearOptions = useMemo(() => {
    const baseYear = Number(defaultSettingsYear);
    const years = Number.isInteger(baseYear)
      ? Array.from({ length: 6 }, (_, i) => baseYear - i)
      : [];

    for (const value of [settingsYear, settingsForm.ssc_year, filters.year]) {
      const parsed = Number(value);
      if (value && Number.isInteger(parsed) && !years.includes(parsed)) {
        years.push(parsed);
      }
    }

    return years.sort((a, b) => b - a);
  }, [defaultSettingsYear, filters.year, settingsForm.ssc_year, settingsYear]);

  useEffect(() => {
    if (!settingsYearTouched && latestSettingsData?.ssc_year) {
      setSettingsYear(String(latestSettingsData.ssc_year));
    }
  }, [latestSettingsData?.ssc_year, settingsYearTouched]);

  const handleSettingsYearChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSettingsYearTouched(true);
    setSettingsYear(event.target.value);
  }, []);

  const handleLatestSettingsYear = useCallback(() => {
    setSettingsYearTouched(false);
    setSettingsYear(defaultSettingsYear);
  }, [defaultSettingsYear]);

  useEffect(() => {
    if (settingsData) {
      const formData = {
        ...settingsData,
        ssc_year: settingsData.ssc_year || normalizedSettingsYear,
        notice_key: settingsData.notice,
      };
      reset(formData);
    }
  }, [normalizedSettingsYear, settingsData, reset]);

  const {
    data: registrationsResponse,
    isLoading: registrationsLoading,
    error: registrationsError,
  } = useQuery({
    queryKey: ['class9Registrations', { page, limit, ...deferredFilters }],
    queryFn: async () => {
      const res = await axios.get(`/api/reg/class-9/form`, {
        params: {
          page,
          limit,
          ssc_batch: deferredFilters.year,
          status: deferredFilters.status,
          section: deferredFilters.section,
          search: deferredFilters.search.trim() || undefined,
        },
      });
      return res.data.success ? res.data.data : [];
    },
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const registrations = useMemo(() => registrationsResponse?.data ?? [], [registrationsResponse]);
  const meta = registrationsResponse?.meta;

  const errorMessage = registrationsError
    ? (registrationsError as any).response?.status === 404
      ? 'No registrations found.'
      : 'An error occurred while fetching registrations.'
    : '';

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [deferredFilters]);

  const stats = useMemo(
    () => ({
      total: meta?.total ?? 0,
      pending: meta?.pending ?? 0,
    }),
    [meta],
  );

  useEffect(() => {
    if (latestSettingsData?.ssc_year) {
      setFilters((prev) => ({ ...prev, year: latestSettingsData.ssc_year.toString() }));
    }
  }, [latestSettingsData?.ssc_year]);

  const settingsMutation = useMutation({
    mutationFn: async (updatedSettings: Class9RegistrationSettingsData) => {
      let notice_key = updatedSettings.notice_key;

      if (selectedNotice) {
        const { data: urlData } = await axios.post(`/api/reg/class-9/upload-url`, {
          filename: selectedNotice.name,
          filetype: selectedNotice.type,
        });

        if (urlData.success) {
          await putFileToPresignedUrl(urlData.data.uploadUrl, selectedNotice, selectedNotice.type);
          notice_key = urlData.data.key;
        }
      }

      const payload = {
        ...updatedSettings,
        ssc_year: updatedSettings.ssc_year || normalizedSettingsYear,
        notice_key,
        reg_open:
          typeof updatedSettings.reg_open === 'boolean'
            ? updatedSettings.reg_open.toString()
            : updatedSettings.reg_open,
      };

      const res = await axios.post(`/api/reg/class-9`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['class9RegSettings'] });
      setSelectedNotice(null);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: () => {
      toast.error('Failed to update settings');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await axios.put(`/api/reg/class-9/form/${id}/status`, { status });
      return res.data;
    },
    onSuccess: (_, variables) => {
      toast.success(`Registration ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['class9Registrations'] });
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await axios.delete(`/api/reg/class-9/form/${id}`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Registration deleted');
      queryClient.invalidateQueries({ queryKey: ['class9Registrations'] });
      setShowDetails(false);
    },
    onError: () => {
      toast.error('Failed to delete registration');
    },
  });

  const handleSettingsSubmit = handleSubmit((data) => {
    settingsMutation.mutate(data);
  });

  const handleStatusUpdate = useCallback(
    (id: string, status: string) => {
      statusMutation.mutate({ id, status });
    },
    [statusMutation],
  );

  const handleDeleteDetails = useCallback(
    (id: string) => {
      if (confirm('Are you sure you want to delete this registration?')) {
        deleteMutation.mutate(id);
      }
    },
    [deleteMutation],
  );

  const handlePreviewPDF = useCallback((id: string) => {
    const previewUrl = `/preview/class9/${id}`;
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  }, []);

  const handleExport = useCallback(
    async (type: 'sheet' | 'photos') => {
      const { status, section, year } = filters;
      const endpoint = type === 'sheet' ? 'export' : 'export-photos';
      const url = `/api/reg/class-9/form/${endpoint}?status=${status}&section=${section}&ssc_batch=${year}`;

      try {
        toast.loading(`Preparing ${type}...`, { id: 'export' });
        const res = await axios.get(url, { responseType: 'blob' });
        const extension = type === 'sheet' ? 'xlsx' : 'zip';
        const blob = new Blob([res.data]);
        downloadBlob(blob, `Class_9_${type}_${year}${section ? `_${section}` : ''}.${extension}`);
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`, {
          id: 'export',
        });
      } catch (error) {
        console.error(`Export ${type} error:`, error);
        toast.error(`Failed to export ${type}`, { id: 'export' });
      }
    },
    [filters],
  );

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

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

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Class 9 Registration Management"
        description="Manage student registrations and notification settings for Class 9."
      />

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} className="mb-6" />

      {activeTab === 'settings' ? (
        <SectionCard
          title="Registration Settings"
          description="Settings are saved separately for each SSC batch."
          icon={<Settings size={20} />}
          headerAction={
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
              <div className="min-w-0 sm:w-44">
                <label
                  htmlFor="class9-settings-year"
                  className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs font-medium"
                >
                  <CalendarDays size={13} aria-hidden="true" />
                  SSC Batch
                </label>
                <select
                  id="class9-settings-year"
                  name="class9-settings-year"
                  value={settingsYear}
                  onChange={handleSettingsYearChange}
                  className={`${filterSelectClassName} h-10 min-w-32 tabular-nums`}
                  aria-describedby="class9-settings-year-status"
                >
                  {settingsYearOptions.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={handleLatestSettingsYear}
                disabled={settingsYear === defaultSettingsYear && !settingsYearTouched}
                className="h-10 gap-2"
              >
                <RotateCcw size={15} aria-hidden="true" />
                Use Latest
              </Button>
            </div>
          }
        >
          {latestSettingsLoading || settingsLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={40} className="text-primary animate-spin" />
            </div>
          ) : (
            <form onSubmit={handleSettingsSubmit} className="space-y-6">
              {settingsFetching && (
                <div
                  id="class9-settings-year-status"
                  aria-live="polite"
                  className="text-muted-foreground -mt-2 flex items-center gap-2 text-sm"
                >
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  Loading selected batch settings…
                </div>
              )}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Section A Roll Range (e.g., 01-50)
                  </label>
                  <Input type="text" {...register('a_sec_roll')} placeholder="01-50" />
                  {errors.a_sec_roll && (
                    <p className="mt-1 text-xs text-red-500">{errors.a_sec_roll.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Section B Roll Range
                  </label>
                  <Input type="text" {...register('b_sec_roll')} placeholder="51-100" />
                  {errors.b_sec_roll && (
                    <p className="mt-1 text-xs text-red-500">{errors.b_sec_roll.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    SSC Batch
                  </label>
                  <Input type="text" {...register('ssc_year')} readOnly />
                  {errors.ssc_year && (
                    <p className="mt-1 text-xs text-red-500">{errors.ssc_year.message}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <label className="bg-muted/40 flex w-full cursor-pointer items-center gap-2 rounded-lg p-2">
                    <input
                      type="checkbox"
                      {...register('reg_open')}
                      className="text-primary h-4 w-4"
                    />
                    <span className="text-sm font-medium">Registration Open</span>
                  </label>
                  {errors.reg_open && (
                    <p className="mt-1 text-xs text-red-500">{errors.reg_open.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Notice File (PDF)
                </label>
                <div className="mt-1 flex items-center gap-4">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedNotice(e.target.files?.[0] || null)}
                    className="text-muted-foreground block w-full text-sm file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                  {settingsForm.notice_key && (
                    <a
                      href={getFileUrl(settingsForm.notice_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
                    >
                      <FileText size={16} /> Current Notice
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Instruction for Section A
                  </label>
                  <Textarea {...register('instruction_for_a')} className="h-24" />
                  {errors.instruction_for_a && (
                    <p className="mt-1 text-xs text-red-500">{errors.instruction_for_a.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Instruction for Section B
                  </label>
                  <Textarea {...register('instruction_for_b')} className="h-24" />
                  {errors.instruction_for_b && (
                    <p className="mt-1 text-xs text-red-500">{errors.instruction_for_b.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Classmates List Source
                  </label>
                  <select
                    {...register('classmates_source')}
                    className="bg-card border-border text-foreground focus:ring-primary/30 block w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
                  >
                    <option value="default">Default (Current Student List)</option>
                    <option value="custom">Manual (Custom List)</option>
                  </select>
                  {errors.classmates_source && (
                    <p className="mt-1 text-xs text-red-500">{errors.classmates_source.message}</p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {settingsForm.classmates_source === 'custom'
                      ? 'Enter your own student names.'
                      : 'Automatically uses names from the Class 10 enrollment list.'}
                  </p>
                </div>
                {settingsForm.classmates_source === 'custom' && (
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Manual Classmates List
                    </label>
                    <Textarea
                      {...register('classmates')}
                      placeholder="Enter student names separated by commas (e.g., আব্দুল করিম, রহিম উদ্দিন, সালমা খাতুন)"
                      className="h-24"
                    />
                    {errors.classmates && (
                      <p className="mt-1 text-xs text-red-500">{errors.classmates.message}</p>
                    )}
                    <p className="text-muted-foreground mt-1 text-xs">
                      Students will be able to select from this list in the registration form's
                      nearby student field.
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">
                    Attachment Instructions
                  </label>
                  <Textarea {...register('attachment_instruction')} className="h-24" />
                  {errors.attachment_instruction && (
                    <p className="mt-1 text-xs text-red-500">
                      {errors.attachment_instruction.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={
                    !settingsYearIsValid ||
                    settingsMutation.isPending ||
                    (!isDirty && !selectedNotice)
                  }
                  className="bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-lg px-6 py-2 text-white transition-colors disabled:opacity-50"
                >
                  {settingsMutation.isPending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Plus size={18} />
                  )}
                  Save Settings
                </button>
              </div>
            </form>
          )}
        </SectionCard>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatsCard
              label="Total Registrations"
              value={stats.total}
              loading={registrationsLoading}
            />
            {stats.pending > 0 && (
              <StatsCard
                label="Pending"
                value={stats.pending}
                color="amber"
                loading={registrationsLoading}
              />
            )}
          </div>

          <FilterSelection
            headerAction={
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport('sheet')}
                  className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <FileText size={18} />
                  <span>Export Sheet</span>
                </button>
                <button
                  onClick={() => handleExport('photos')}
                  className="bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-white shadow-sm transition-colors"
                >
                  <ImageIcon size={18} />
                  <span>Export Photos</span>
                </button>
              </div>
            }
          >
            <FilterField label="Search" wide>
              <div className="relative">
                <Search
                  size={16}
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
                />
                <Input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Search by name, roll, birth reg..."
                  className={`${filterInputClassName} pl-9`}
                />
              </div>
            </FilterField>
            <FilterField label="Status">
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className={filterSelectClassName}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
            </FilterField>
            <FilterField label="Section">
              <select
                value={filters.section}
                onChange={(e) => handleFilterChange('section', e.target.value)}
                className={filterSelectClassName}
              >
                <option value="">All Sections</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </FilterField>
            <FilterField label="SSC Batch">
              <select
                value={filters.year}
                onChange={(e) => handleFilterChange('year', e.target.value)}
                className={filterSelectClassName}
              >
                {(() => {
                  const currentBatchYear = Number(
                    settingsData?.ssc_year || settingsData?.ssc_batch || new Date().getFullYear(),
                  );
                  const years = [];
                  for (let i = 0; i < 6; i++) {
                    years.push(currentBatchYear - i);
                  }

                  const settingsYearValue = Number(settingsForm.ssc_year);
                  if (
                    settingsForm.ssc_year &&
                    !isNaN(settingsYearValue) &&
                    !years.includes(settingsYearValue)
                  ) {
                    years.push(settingsYearValue);
                    years.sort((a, b) => b - a);
                  }
                  return years.map((y) => (
                    <option key={y} value={y.toString()}>
                      {y}
                    </option>
                  ));
                })()}
              </select>
            </FilterField>
          </FilterSelection>

          <SectionCard noPadding className="mb-6">
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-muted border-border border-b">
                    <th className="text-foreground/70 px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                      Student
                    </th>
                    <th className="text-foreground/70 px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                      Section
                    </th>
                    <th className="text-foreground/70 px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                      Roll
                    </th>
                    <th className="text-foreground/70 px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                      Status
                    </th>
                    <th className="text-foreground/70 px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                      Date
                    </th>
                    <th className="text-foreground/70 px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {registrationsLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Loader2 className="text-primary h-8 w-8 animate-spin" />
                          <p className="text-muted-foreground text-sm dark:text-gray-400">
                            Loading registrations...
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : registrations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground py-12 text-center">
                        {errorMessage || 'No registrations found'}
                      </td>
                    </tr>
                  ) : (
                    registrations.map((reg: Registration) => (
                      <tr key={reg.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {reg.photo_path ? (
                              <img
                                src={getFileUrl(reg.photo_path)}
                                className="border-border h-10 w-10 rounded-full border object-cover"
                                alt=""
                              />
                            ) : (
                              <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
                                <Users size={18} />
                              </div>
                            )}
                            <div>
                              <div className="text-foreground font-medium">
                                {reg.student_name_en}
                              </div>
                              <div className="text-muted-foreground text-sm">
                                {reg.student_name_bn}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                            {reg.section || '-'}
                          </span>
                        </td>
                        <td className="text-muted-foreground px-6 py-4 text-center font-mono font-medium">
                          {reg.roll || '-'}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={reg.status} />
                        </td>
                        <td className="text-muted-foreground px-6 py-4 text-sm">
                          {formatDateWithTime(reg.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            <ActionButton
                              action="view"
                              onClick={() => {
                                setSelectedReg(reg);
                                setShowDetails(true);
                              }}
                            />
                            <ActionButton
                              action="edit"
                              onClick={() => {
                                setEditFormData({ id: reg.id, status: reg.status });
                                setShowEditModal(true);
                              }}
                            />
                            <DeleteConfirmation onDelete={() => handleDeleteDetails(reg.id)} />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="lg:hidden">
              {registrationsLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 py-12">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                  <p className="text-muted-foreground text-sm dark:text-gray-400">
                    Loading registrations...
                  </p>
                </div>
              ) : registrations.length > 0 ? (
                <ul className="divide-border divide-y">
                  {registrations.map((reg: Registration) => (
                    <li key={reg.id} className="space-y-3 p-4">
                      <div className="flex items-start gap-3">
                        {reg.photo_path ? (
                          <img
                            src={getFileUrl(reg.photo_path)}
                            className="border-border h-12 w-12 shrink-0 rounded-full border object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                            <Users size={18} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate font-medium">
                            {reg.student_name_en}
                          </p>
                          <p className="text-muted-foreground truncate text-sm">
                            {reg.student_name_bn}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                              {reg.section || '-'}
                            </span>
                            <span className="text-muted-foreground font-mono text-xs font-medium">
                              Roll {reg.roll || '-'}
                            </span>
                            <StatusBadge status={reg.status} />
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            {formatDateWithTime(reg.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="view"
                          onClick={() => {
                            setSelectedReg(reg);
                            setShowDetails(true);
                          }}
                        />
                        <ActionButton
                          action="edit"
                          onClick={() => {
                            setEditFormData({ id: reg.id, status: reg.status });
                            setShowEditModal(true);
                          }}
                        />
                        <DeleteConfirmation onDelete={() => handleDeleteDetails(reg.id)} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-4 py-12 text-center text-sm">
                  {errorMessage || 'No registrations found'}
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
                    {[50, 100, 200].map((v) => (
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
                        disabled={registrationsLoading}
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
                        disabled={registrationsLoading}
                      >
                        {p}
                      </Button>
                    ),
                  );
                })()}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {showDetails && selectedReg && (
        <Popup open onOpenChange={(o) => !o && setShowDetails(false)}>
          <div className="border-border flex items-center justify-between rounded-t-xl border-b bg-linear-to-r from-blue-600 to-blue-500 p-6 text-white dark:border-gray-700">
            <div>
              <h3 className="text-xl font-bold">Registration Details</h3>
              <p className="mt-1 text-sm opacity-90">Full student information preview</p>
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="p-2 text-white transition-colors hover:text-gray-200"
            >
              <XCircle size={24} />
            </button>
          </div>

          <div className="p-6">
            <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-4">
              <div className="md:col-span-1">
                <div className="bg-muted/50 border-border sticky top-20 flex flex-col items-center rounded-xl border p-4 dark:border-gray-700 dark:bg-gray-900/50">
                  <h4 className="text-muted-foreground mb-3 text-xs font-bold tracking-wider uppercase">
                    Student Photo
                  </h4>
                  {selectedReg.photo ? (
                    <img
                      src={getFileUrl(selectedReg.photo as any)}
                      className="aspect-3/4 w-full rounded-lg border-2 border-white object-cover shadow-md dark:border-gray-800"
                      alt="Student"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = '/placeholder-student.png';
                      }}
                    />
                  ) : (
                    <div className="border-border flex aspect-3/4 w-full items-center justify-center rounded-lg border-2 border-dashed bg-gray-200 dark:border-gray-600 dark:bg-gray-700">
                      <Users size={48} className="text-gray-400" />
                    </div>
                  )}
                  <div className="mt-4 w-full">
                    <div className="bg-card rounded-lg border border-gray-100 p-3 text-center shadow-sm dark:border-gray-700">
                      <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-wider uppercase">
                        Status
                      </p>
                      <div className="flex justify-center">
                        <StatusBadge status={selectedReg.status} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6 md:col-span-3">
                <div className="grid grid-cols-2 gap-4 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:grid-cols-4 dark:border-blue-900/20 dark:bg-blue-900/10">
                  <div>
                    <p className="text-primary dark:text-primary/70 text-[10px] font-bold uppercase">
                      Section
                    </p>
                    <p className="font-semibold">{selectedReg.section || '-'}</p>
                  </div>
                  <div>
                    <p className="text-primary dark:text-primary/70 text-[10px] font-bold uppercase">
                      Roll No
                    </p>
                    <p className="font-semibold">{selectedReg.roll || '-'}</p>
                  </div>
                  <div>
                    <p className="text-primary dark:text-primary/70 text-[10px] font-bold uppercase">
                      Academic Year
                    </p>
                    <p className="font-semibold">{selectedReg.ssc_batch}</p>
                  </div>
                  <div>
                    <p className="text-primary dark:text-primary/70 text-[10px] font-bold uppercase">
                      Religion
                    </p>
                    <p className="font-semibold">{selectedReg.religion || '-'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="border-border overflow-hidden rounded-xl border shadow-sm dark:border-gray-700">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        <tr>
                          <td
                            colSpan={2}
                            className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-tight text-gray-700 uppercase dark:bg-gray-900/50 dark:text-gray-200"
                          >
                            Personal Information (ব্যক্তিগত তথ্য)
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Student Name (EN)
                          </td>
                          <td className="dark:text-primary/70 px-4 py-2.5 font-bold text-blue-700 uppercase">
                            {selectedReg.student_name_en}
                            {selectedReg.student_nick_name_bn && (
                              <span className="text-muted-foreground ml-2 text-sm font-normal lowercase">
                                ({selectedReg.student_nick_name_bn})
                              </span>
                            )}
                            {selectedReg.student_name_bn && (
                              <div className="text-muted-foreground mt-0.5 text-sm font-normal">
                                {selectedReg.student_name_bn}
                              </div>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Birth Reg. No
                          </td>
                          <td className="px-4 py-2.5 font-mono">{selectedReg.birth_reg_no}</td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Date of Birth
                          </td>
                          <td className="px-4 py-2.5">{selectedReg.birth_date}</td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Blood Group
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-red-500">
                            {selectedReg.blood_group || '-'}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Contact Info
                          </td>
                          <td className="px-4 py-2.5">
                            <p>Email: {selectedReg.email || '-'}</p>
                            <p>Father Ph: {selectedReg.father_phone || '-'}</p>
                            <p>Mother Ph: {selectedReg.mother_phone || '-'}</p>
                          </td>
                        </tr>

                        <tr>
                          <td
                            colSpan={2}
                            className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-tight text-gray-700 uppercase dark:bg-gray-900/50 dark:text-gray-200"
                          >
                            Parent Information (পিতা-মাতার তথ্য)
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Father's Info
                          </td>
                          <td className="px-4 py-2.5">
                            <p>
                              <strong>Father's Name (BN):</strong>{' '}
                              {selectedReg.father_name_bn || '-'}
                            </p>
                            <p>
                              <strong>Father's Name (EN):</strong>{' '}
                              {selectedReg.father_name_en || '-'}
                            </p>
                            <p className="text-xs">NID: {selectedReg.father_nid || '-'}</p>
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            Mother's Info
                          </td>
                          <td className="px-4 py-2.5 text-lg font-bold text-gray-900 dark:text-gray-100">
                            {selectedReg.mother_name_bn || '-'}
                            <span className="text-muted-foreground mt-1 block text-sm font-normal uppercase">
                              {selectedReg.mother_name_en || '-'}
                            </span>
                            <p className="text-xs">NID: {selectedReg.mother_nid || '-'}</p>
                          </td>
                        </tr>

                        <tr>
                          <td
                            colSpan={2}
                            className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-tight text-gray-700 uppercase dark:bg-gray-900/50 dark:text-gray-200"
                          >
                            Address Details (ঠিকানা)
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Present Address
                          </td>
                          <td className="px-4 py-2.5 leading-relaxed">
                            {selectedReg.present_village_road &&
                              `${selectedReg.present_village_road}, `}
                            {selectedReg.present_post_office}-{selectedReg.present_post_code},{' '}
                            {selectedReg.present_upazila}, {selectedReg.present_district}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Permanent Address
                          </td>
                          <td className="px-4 py-2.5 leading-relaxed">
                            {selectedReg.permanent_village_road &&
                              `${selectedReg.permanent_village_road}, `}
                            {selectedReg.permanent_post_office}-{selectedReg.permanent_post_code},{' '}
                            {selectedReg.permanent_upazila}, {selectedReg.permanent_district}
                          </td>
                        </tr>

                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Nearby Student Info
                          </td>
                          <td className="px-4 py-2.5">
                            {selectedReg.nearby_nine_student_info || 'Not Applicable'}
                          </td>
                        </tr>

                        <tr>
                          <td
                            colSpan={2}
                            className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-tight text-gray-700 uppercase dark:bg-gray-900/50 dark:text-gray-200"
                          >
                            SSC & JSC Information (শিক্ষাগত তথ্য)
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Class 9 Academic
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-bold text-gray-800 uppercase dark:text-gray-200">
                              Group: {selectedReg.group_class_nine || '-'}
                            </p>
                            <div className="mt-1 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                              <p>
                                <span className="text-gray-400">Main:</span>{' '}
                                {selectedReg.main_subject || '-'}
                              </p>
                              <p>
                                <span className="text-gray-400">4th Sub:</span>{' '}
                                {selectedReg.fourth_subject || '-'}
                              </p>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            JSC Information
                          </td>
                          <td className="px-4 py-2.5 text-sm">
                            <div className="flex flex-wrap gap-x-4 gap-y-2">
                              <p>
                                <strong>Year:</strong> {selectedReg.jsc_passing_year || '-'}
                              </p>
                              <p>
                                <strong>JSC/JDC/Class 8 ID/Roll:</strong>{' '}
                                <span className="font-mono">{selectedReg.jsc_roll_no || '-'}</span>
                              </p>
                              <p>
                                <strong>Reg:</strong>{' '}
                                <span className="font-mono">{selectedReg.jsc_reg_no || '-'}</span>
                              </p>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td
                            colSpan={2}
                            className="bg-muted/50 px-4 py-2 text-xs font-bold tracking-tight text-gray-700 uppercase dark:bg-gray-900/50 dark:text-gray-200"
                          >
                            Guardian Info (অভিভাবক)
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Prev. School
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-bold text-gray-800 uppercase dark:text-gray-200">
                              {selectedReg.prev_school_name || '-'}
                            </p>
                            <p className="text-muted-foreground mt-1 text-xs dark:text-gray-400">
                              {selectedReg.prev_school_upazila}, {selectedReg.prev_school_district}
                            </p>
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 align-top dark:bg-gray-800/30 dark:text-gray-400">
                            Guardian
                          </td>
                          <td className="px-4 py-2.5">
                            {selectedReg.guardian_name ? (
                              <div className="space-y-1.5">
                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                  {selectedReg.guardian_name}{' '}
                                  <span className="text-muted-foreground text-xs font-normal">
                                    ({selectedReg.guardian_relation})
                                  </span>
                                </p>
                                <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                                  <p>
                                    <span className="text-gray-400">Phone:</span>{' '}
                                    {selectedReg.guardian_phone || '-'}
                                  </p>
                                  <p>
                                    <span className="text-gray-400">NID:</span>{' '}
                                    {selectedReg.guardian_nid || '-'}
                                  </p>
                                </div>
                                {(selectedReg.guardian_village_road ||
                                  selectedReg.guardian_district) && (
                                  <div className="mt-1 border-t border-gray-100 pt-1 dark:border-gray-700/50">
                                    <p className="mb-0.5 text-[10px] font-bold text-gray-400 uppercase">
                                      Guardian Address
                                    </p>
                                    <p className="text-muted-foreground text-xs leading-relaxed dark:text-gray-400">
                                      {selectedReg.guardian_village_road},{' '}
                                      {selectedReg.guardian_post_office}-
                                      {selectedReg.guardian_post_code},{' '}
                                      {selectedReg.guardian_upazila},{' '}
                                      {selectedReg.guardian_district}
                                    </p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                Parent (No separate guardian specified)
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="text-muted-foreground bg-muted/50/30 px-4 py-2.5 dark:bg-gray-800/30 dark:text-gray-400">
                            System Info
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-[10px]">
                            <p>ID: {selectedReg.id}</p>
                            <p>Submitted: {formatDateWithTime(selectedReg.created_at)}</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="border-border bg-muted/50 flex flex-wrap items-center justify-between gap-4 border-t p-6 dark:border-gray-700 dark:bg-gray-900/50">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (!selectedReg) return;
                  handlePreviewPDF(selectedReg.id);
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 font-semibold text-white shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-violet-700"
              >
                <FileText size={18} />
                Preview PDF
              </button>
              <button
                onClick={async () => {
                  if (!selectedReg || pdfDownloading) return;
                  setPdfDownloading(true);
                  try {
                    const response = await axios.get(
                      `/api/reg/class-9/form/${selectedReg.id}/pdf`,
                      { responseType: 'blob' },
                    );
                    const blob = new Blob([response.data], { type: 'application/pdf' });
                    downloadBlob(
                      blob,
                      `Class9_Registration_${selectedReg.student_name_en.replace(/\s+/g, '_')}.pdf`,
                    );
                  } catch (err) {
                    console.error(err);
                    toast.error('Failed to download PDF');
                  } finally {
                    setPdfDownloading(false);
                  }
                }}
                disabled={pdfDownloading}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-xl px-6 py-2.5 font-semibold text-white shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] disabled:opacity-50"
              >
                {pdfDownloading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Download size={18} />
                )}
                {pdfDownloading ? 'Generating PDF...' : 'Download PDF'}
              </button>
              {selectedReg.status === 'pending' && (
                <button
                  onClick={() => {
                    handleStatusUpdate(selectedReg.id, 'approved');
                    setShowDetails(false);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 font-semibold text-white shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-emerald-700"
                >
                  <CheckCircle2 size={18} />
                  Approve
                </button>
              )}
            </div>
            <button
              onClick={() => setShowDetails(false)}
              className="rounded-xl bg-gray-200 px-6 py-2.5 font-semibold text-gray-800 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Close Preview
            </button>
          </div>
        </Popup>
      )}

      {showEditModal && editFormData && (
        <Popup open onOpenChange={(o) => !o && setShowEditModal(false)} size="sm">
          <div className="border-border flex items-center justify-between border-b px-5 py-4 dark:border-gray-700">
            <h3 className="text-lg font-bold">Update Status</h3>
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="hover:bg-muted rounded-full p-1 transition-colors dark:hover:bg-gray-700"
              aria-label="Close"
            >
              <XCircle size={22} className="text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Status
              </label>
              <div className="grid grid-cols-1 gap-2">
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditFormData({ ...editFormData, status: s })}
                    className={`flex items-center justify-between rounded-xl border-2 px-3 py-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                      editFormData.status === s
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'hover:border-border border-gray-100 dark:border-gray-700 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-full p-2 ${
                          s === 'approved'
                            ? 'bg-emerald-100 text-emerald-600'
                            : s === 'rejected'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-600'
                        }`}
                      >
                        {s === 'approved' ? (
                          <CheckCircle2 size={18} />
                        ) : s === 'rejected' ? (
                          <XCircle size={18} />
                        ) : (
                          <AlertCircle size={18} />
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-900 capitalize dark:text-white">
                        {s}
                      </span>
                    </div>
                    {editFormData.status === s && (
                      <div className="bg-primary h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(59,130,246,0.2)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="hover:bg-muted rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleStatusUpdate(editFormData.id, editFormData.status);
                  setShowEditModal(false);
                }}
                className="bg-primary hover:bg-primary/90 rounded-lg px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors"
              >
                Update Status
              </button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
};

export default Class9RegForm;
