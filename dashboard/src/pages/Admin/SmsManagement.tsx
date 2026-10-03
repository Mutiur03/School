import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Inbox, Loader2, RefreshCw, RotateCw, Send, Settings, Trash2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { TabNav, SectionCard, StatusBadge, TablePagination, ConfirmationPopup } from '@/components';
import type { TabItem } from '@/components';
import { ColumnHeaderMenu } from '@/components/ColumnHeaderMenu';
import {
  formatDobForDateInput as toDateInputValue,
  calculateSMSCount,
  PHONE_NUMBER,
} from '@school/shared-schemas';
import { fillSmsTemplate, type SmsTemplateValues } from '@/lib/sms';
import { useSmsSettings } from '@/queries/attendence.queries';
import { cn } from '@/lib/utils';

interface Enrollment {
  class: string;
  section: string;
  roll: string;
}

interface Student {
  name: string;
  login_id: string;
  enrollments: Enrollment[];
}

interface SmsLog {
  id: number;
  student: Student | null;
  phone_number: string;
  attendance_date: string | null;
  category: 'attendance' | 'password_reset' | 'test' | 'bulk';
  status: 'sent' | 'failed' | 'pending';
  sms_count: number | null;
  retry_count: number;
  message: string;
  error_reason: string | null;
  created_at: string;
}

const CATEGORY_LABELS: Record<SmsLog['category'], string> = {
  attendance: 'Attendance',
  password_reset: 'Password reset',
  test: 'Test',
  bulk: 'Bulk',
};

interface Stats {
  sent?: number;
  failed?: number;
  pending?: number;
}

interface SmsLogsResponse {
  smsLogs: SmsLog[];
  totalPages: number;
  stats: Stats;
}

interface SmsBalance {
  estimatedSms?: number | null;
  message?: string;
  selfHosted?: boolean;
}

interface SmsSettings {
  present_template: string;
  absent_template: string;
  run_awayed_template: string;
  send_to_present: boolean;
  send_to_absent: boolean;
  send_to_run_awayed: boolean;
  is_active: boolean;
}

type TemplateField = 'present_template' | 'absent_template' | 'run_awayed_template';

const EMPTY_SETTINGS: SmsSettings = {
  present_template: '',
  absent_template: '',
  run_awayed_template: '',
  send_to_present: false,
  send_to_absent: false,
  send_to_run_awayed: false,
  is_active: false,
};

const TEMPLATES: {
  field: TemplateField;
  toggle: 'send_to_present' | 'send_to_absent' | 'send_to_run_awayed';
  title: string;
  description: string;
  dot: string;
}[] = [
  {
    field: 'present_template',
    toggle: 'send_to_present',
    title: 'Present',
    description: 'Sent when a student is marked present.',
    dot: 'bg-emerald-500',
  },
  {
    field: 'absent_template',
    toggle: 'send_to_absent',
    title: 'Absent',
    description: 'Sent when a student is marked absent.',
    dot: 'bg-red-500',
  },
  {
    field: 'run_awayed_template',
    toggle: 'send_to_run_awayed',
    title: 'Ran away',
    description: 'Sent from the Running away page.',
    dot: 'bg-amber-500',
  },
];

// Typical values for estimating one attendance SMS. Real names vary; a Bangla name switches the
// whole message to Unicode (70 chars per credit instead of 160).
const SAMPLE_SMS_VALUES: SmsTemplateValues = {
  student_name: 'Md. Abdullah Al Mamun',
  login_id: '26100045',
  date: '04/10/2026',
  class: '10',
  section: 'A',
  roll: '45',
};

const CORE_TOKENS = ['{student_name}'] as const;

const ELECTIVE_TOKENS = [
  { id: '{login_id}', label: 'Login ID' },
  { id: '{date}', label: 'Date' },
  { id: '{school_name}', label: 'School name' },
  { id: '{class}', label: 'Class' },
  { id: '{section}', label: 'Section' },
  { id: '{roll}', label: 'Roll' },
] as const;

const STATUS_BADGE: Record<SmsLog['status'], string> = {
  sent: 'approved',
  failed: 'rejected',
  pending: 'pending',
};

const normalizePhoneNumber = (value: string) => value.replace(/\s+/g, '');

const validateTemplate = (template: string, requiredPlaceholders: string[]) => {
  const allRequired = [...CORE_TOKENS, ...requiredPlaceholders];
  const missing = allRequired.filter((token) => !template.includes(token));

  const allPossibleElectives = ELECTIVE_TOKENS.map((t) => t.id);
  const forbidden = allPossibleElectives.filter(
    (token) => !requiredPlaceholders.includes(token) && template.includes(token),
  );

  return {
    missing,
    forbidden,
    isValid: template.trim().length > 0 && missing.length === 0 && forbidden.length === 0,
  };
};

const formatIsoToDisplayDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
};

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** "≈ 2 credits · 148 chars · GSM-7" for a message (empty text shows nothing). */
const Estimate = ({ text, suffix }: { text: string; suffix?: string }) => {
  if (!text) return null;
  const { count, length, encoding } = calculateSMSCount(text);
  return (
    <p className="text-muted-foreground text-xs tabular-nums">
      ≈ <span className="text-foreground font-semibold">{count}</span> credit
      {count !== 1 ? 's' : ''}
      {suffix} · {length} chars · {encoding}
    </p>
  );
};

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
  </div>
);

const ClassInfo = ({ student }: { student: Student | null }) => {
  const e = student?.enrollments?.[0];
  return e ? (
    <>
      Class {e.class} {e.section} · Roll {e.roll}
    </>
  ) : null;
};

type Tab = 'logs' | 'bulk' | 'settings';

function SmsManagement() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: Tab = tabParam === 'settings' || tabParam === 'bulk' ? tabParam : 'logs';
  const goToTab = (tab: string) => setSearchParams({ tab }, { replace: true });

  const queryClient = useQueryClient();

  // ---- Logs ----
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [date, setDate] = useState(formatIsoToDisplayDate(new Date().toISOString()));
  const [categoryFilters, setCategoryFilters] = useState<string[]>(['attendance']);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  // Sent to the server as comma lists; nothing ticked = no filter.
  const category = categoryFilters.join(',') || 'all';
  const statusParam = statusFilters.join(',') || 'all';

  // ---- Settings ----
  const [testForm, setTestForm] = useState({ phoneNumber: '', message: '' });
  const [testErrors, setTestErrors] = useState<{ phoneNumber?: string; message?: string }>({});
  const [settingsErrors, setSettingsErrors] = useState<Partial<Record<TemplateField, string>>>({});
  const [settingsDraft, setSettingsDraft] = useState<SmsSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [requiredPlaceholders, setRequiredPlaceholders] = useState<string[]>([]);

  // ---- Bulk ----
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [bulkMessage, setBulkMessage] = useState('');
  const availableClasses = [6, 7, 8, 9, 10];

  const { data: publicSmsSettings } = useSmsSettings();
  const schoolName: string = publicSmsSettings?.school_name ?? '';

  const { data: studentCount, isLoading: studentCountLoading } = useQuery({
    queryKey: ['studentCount', selectedClasses],
    queryFn: async () => {
      const res = await axios.get(`/api/sms/student-count?classes=${selectedClasses.join(',')}`);
      return res.data as {
        totalStudents: number;
        withPhone: number;
        classBreakdown: Record<number, { total: number; withPhone: number }>;
      };
    },
    enabled: selectedClasses.length > 0,
    placeholderData: keepPreviousData,
  });

  const smsLogsQuery = useQuery<SmsLogsResponse>({
    queryKey: ['smsLogs', currentPage, limit, date, category, statusParam],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        category,
        status: statusParam,
        date: toDateInputValue(date) || date,
      });
      const response = await axios.get(`/api/sms/sms-logs?${params}`);
      return response.data;
    },
    enabled: activeTab === 'logs',
    placeholderData: (prev) => prev,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const smsUsageQuery = useQuery({
    queryKey: ['smsUsage'],
    queryFn: async () => {
      const response = await axios.get('/api/sms/usage-stats?days=30');
      return response.data;
    },
    enabled: activeTab === 'logs',
  });

  const smsSettingsQuery = useQuery<SmsSettings>({
    queryKey: ['smsSettings'],
    queryFn: async () => {
      const response = await axios.get('/api/sms-settings');
      return response.data.data;
    },
    enabled: activeTab === 'settings',
  });

  // Balance shows in the page header on every tab.
  const smsBalanceQuery = useQuery<SmsBalance>({
    queryKey: ['smsBalance'],
    queryFn: async () => {
      const response = await axios.get('/api/sms-settings/balance');
      return response.data.data;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 60000,
  });

  const settingsMutation = useMutation({
    mutationFn: async (payload: { settings: SmsSettings; requiredPlaceholders: string[] }) => {
      await axios.patch('/api/sms-settings', {
        ...payload.settings,
        requiredPlaceholders: payload.requiredPlaceholders,
      });
    },
    onSuccess: () => {
      toast.success('SMS settings saved');
      queryClient.invalidateQueries({ queryKey: ['smsSettings'] });
      queryClient.invalidateQueries({ queryKey: ['smsSettingsPublic'] });
      setSettingsDirty(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to save SMS settings');
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async (payload: { phoneNumber: string; message: string }) => {
      await axios.post('/api/sms-settings/test', payload);
    },
    onSuccess: () => {
      toast.success('Test SMS sent');
      setTestForm((prev) => ({ ...prev, message: '' }));
      setTestErrors({});
      queryClient.invalidateQueries({ queryKey: ['smsBalance'] });
      queryClient.invalidateQueries({ queryKey: ['smsUsage'] });
    },
    onError: () => {
      toast.error('Failed to send test SMS');
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (smsLogIds: number[]) => {
      const response = await axios.post('/api/sms/retry-sms', { smsLogIds });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedLogs([]);
      queryClient.invalidateQueries({ queryKey: ['smsLogs'] });
      queryClient.invalidateQueries({ queryKey: ['smsBalance'] });
      queryClient.invalidateQueries({ queryKey: ['smsUsage'] });
    },
    onError: () => {
      toast.error('Failed to retry SMS messages');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (smsLogIds: number[]) => {
      const response = await axios.delete('/api/sms/sms-logs', { data: { smsLogIds } });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedLogs([]);
      queryClient.invalidateQueries({ queryKey: ['smsLogs'] });
    },
    onError: () => {
      toast.error('Failed to delete SMS logs');
    },
  });

  const bulkSmsMutation = useMutation({
    mutationFn: async (payload: { classNames: number[]; message: string }) => {
      const response = await axios.post('/api/sms/bulk-sms', payload);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Bulk SMS sent');
      setSelectedClasses([]);
      setBulkMessage('');
      // Show what was just sent: today's bulk messages.
      setCategoryFilters(['bulk']);
      setDate(formatIsoToDisplayDate(new Date().toISOString()));
      setCurrentPage(1);
      goToTab('logs');
      queryClient.invalidateQueries({ queryKey: ['smsLogs'] });
      queryClient.invalidateQueries({ queryKey: ['smsBalance'] });
      queryClient.invalidateQueries({ queryKey: ['smsUsage'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to send bulk SMS');
    },
  });

  useEffect(() => {
    if (smsLogsQuery.isError) toast.error('Failed to fetch SMS logs');
  }, [smsLogsQuery.isError]);

  useEffect(() => {
    if (smsSettingsQuery.isError) toast.error('Failed to fetch SMS settings');
  }, [smsSettingsQuery.isError]);

  // Load (or, after Discard/Save, reload) the editable copy from the server.
  useEffect(() => {
    if (smsSettingsQuery.data && !settingsDirty) {
      setSettingsDraft(smsSettingsQuery.data);
      setSettingsErrors({});
      const templates =
        (smsSettingsQuery.data.present_template || '') +
        (smsSettingsQuery.data.absent_template || '') +
        (smsSettingsQuery.data.run_awayed_template || '');
      setRequiredPlaceholders(
        ELECTIVE_TOKENS.map((t) => t.id).filter((token) => templates.includes(token)),
      );
    }
  }, [smsSettingsQuery.data, settingsDirty]);

  const updateDraft = (patch: Partial<SmsSettings>) => {
    setSettingsDirty(true);
    setSettingsDraft((prev) => ({ ...(prev || EMPTY_SETTINGS), ...patch }));
  };

  const templateError = (t: (typeof TEMPLATES)[number], draft: SmsSettings, required: string[]) => {
    if (!draft.is_active || !draft[t.toggle]) return undefined;
    const v = validateTemplate(draft[t.field] || '', required);
    if (v.isValid) return undefined;
    if (!draft[t.field]?.trim()) return 'Message is empty.';
    const parts = [];
    if (v.missing.length) parts.push(`add ${v.missing.join(', ')}`);
    if (v.forbidden.length) parts.push(`remove ${v.forbidden.join(', ')}`);
    return `To save: ${parts.join(' and ')}.`;
  };

  const handleUpdateSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;
    const nextErrors: Partial<Record<TemplateField, string>> = {};
    for (const t of TEMPLATES) {
      const err = templateError(t, settingsDraft, requiredPlaceholders);
      if (err) nextErrors[t.field] = err;
    }
    setSettingsErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    settingsMutation.mutate({ settings: settingsDraft, requiredPlaceholders });
  };

  const handleSendTestSms = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normalizePhoneNumber(testForm.phoneNumber);
    const message = testForm.message.trim();
    const nextErrors: { phoneNumber?: string; message?: string } = {};

    if (!phone) nextErrors.phoneNumber = 'Phone number is required.';
    else if (!PHONE_NUMBER.test(phone))
      nextErrors.phoneNumber = 'Phone must be 11 digits and start with 01.';
    if (!message) nextErrors.message = 'Message is required.';

    setTestErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    testSmsMutation.mutate({ phoneNumber: phone, message });
  };

  const smsLogs = useMemo(() => smsLogsQuery.data?.smsLogs || [], [smsLogsQuery.data]);
  const stats: Stats = smsLogsQuery.data?.stats || {};
  const totalPages = smsLogsQuery.data?.totalPages || 1;
  const loadingLogs = smsLogsQuery.isLoading;
  const settings = settingsDraft;
  const balance = smsBalanceQuery.data || null;

  const displayedLogs = smsLogs;

  const retryableIds = smsLogs
    .filter((log) => selectedLogs.includes(log.id) && log.status !== 'sent')
    .map((log) => log.id);
  const allVisibleSelected =
    displayedLogs.length > 0 && displayedLogs.every((log) => selectedLogs.includes(log.id));
  const filtersActive = statusFilters.length > 0 || category !== 'attendance';
  const typeSummary =
    categoryFilters.length === 0 || categoryFilters.length === Object.keys(CATEGORY_LABELS).length
      ? 'All types'
      : categoryFilters.map((c) => CATEGORY_LABELS[c as SmsLog['category']]).join(', ');

  const toggleLog = (id: number, checked: boolean) =>
    setSelectedLogs((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));

  /** Wraps a setter so changing it also goes back to page 1 and clears the selection. */
  const resetPage =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setCurrentPage(1);
      setSelectedLogs([]);
    };

  const tabs: TabItem[] = [
    {
      id: 'logs',
      label: 'Delivery logs',
      icon: <Inbox size={16} />,
      href: `${location.pathname}?tab=logs`,
    },
    {
      id: 'bulk',
      label: 'Bulk SMS',
      icon: <Send size={16} />,
      href: `${location.pathname}?tab=bulk`,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings size={16} />,
      href: `${location.pathname}?tab=settings`,
    },
  ];

  const bulkCount = bulkMessage ? calculateSMSCount(bulkMessage).count : 0;
  const bulkCredits = (studentCount?.withPhone ?? 0) * bulkCount;
  const balanceNumber = balance?.estimatedSms ?? null;
  const bulkTooExpensive = balanceNumber != null && bulkCredits > balanceNumber;
  const sortedClasses = [...selectedClasses].sort((a, b) => a - b);

  const usageStats: { date: string; count: number }[] = smsUsageQuery.data?.stats || [];
  const usageTotal = usageStats.reduce((sum, d) => sum + (d.count || 0), 0);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">SMS</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
            {smsBalanceQuery.isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : smsBalanceQuery.isError ? (
              'Balance unavailable'
            ) : (
              <>
                <span className="text-foreground font-medium tabular-nums">
                  {balanceNumber != null ? `≈ ${balanceNumber.toLocaleString()}` : '—'}
                </span>{' '}
                SMS credits left
              </>
            )}
            <button
              type="button"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['smsBalance'] })}
              disabled={smsBalanceQuery.isFetching}
              aria-label="Refresh balance"
              title="Refresh balance"
              className="hover:bg-muted hover:text-foreground rounded p-1 transition-colors"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', smsBalanceQuery.isFetching && 'animate-spin')}
              />
            </button>
          </p>
        </div>
      </header>

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={goToTab} className="mb-6" />

      {activeTab === 'settings' ? (
        settings ? (
          <form onSubmit={handleUpdateSettings} className="space-y-6">
            {/* Master switch */}
            <label className="border-border bg-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-sm">
              <input
                type="checkbox"
                checked={settings.is_active}
                onChange={(e) => {
                  updateDraft({ is_active: e.target.checked });
                  if (!e.target.checked) setSettingsErrors({});
                }}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium">Send attendance SMS</span>
                <span className="text-muted-foreground block text-sm">
                  Master switch. When off, no attendance messages are sent, whatever the settings
                  below say.
                </span>
              </span>
            </label>

            <div className={cn('space-y-6', !settings.is_active && 'opacity-60')}>
              <div className="grid gap-4 lg:grid-cols-3">
                {TEMPLATES.map((t) => {
                  const text = settings[t.field] || '';
                  const filled = fillSmsTemplate(text, {
                    ...SAMPLE_SMS_VALUES,
                    school_name: schoolName,
                  });
                  return (
                    <SectionCard key={t.field} className="flex flex-col">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-sm font-semibold">
                            <span className={cn('h-2 w-2 rounded-full', t.dot)} aria-hidden />
                            {t.title}
                          </h3>
                          <p className="text-muted-foreground text-sm">{t.description}</p>
                        </div>
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={settings[t.toggle]}
                            onChange={(e) => {
                              updateDraft({ [t.toggle]: e.target.checked });
                              if (!e.target.checked)
                                setSettingsErrors((prev) => ({ ...prev, [t.field]: undefined }));
                            }}
                            className="h-4 w-4"
                          />
                          Send
                        </label>
                      </div>
                      <Textarea
                        aria-label={`${t.title} message`}
                        rows={5}
                        value={text}
                        disabled={!settings[t.toggle]}
                        onChange={(e) => {
                          updateDraft({ [t.field]: e.target.value });
                          if (settingsErrors[t.field])
                            setSettingsErrors((prev) => ({
                              ...prev,
                              [t.field]: templateError(
                                t,
                                { ...settings, [t.field]: e.target.value },
                                requiredPlaceholders,
                              ),
                            }));
                        }}
                        className="flex-1 font-mono text-sm"
                      />
                      {settingsErrors[t.field] && (
                        <p className="text-destructive mt-1.5 text-xs">{settingsErrors[t.field]}</p>
                      )}
                      <div className="mt-3 space-y-1.5">
                        <Estimate text={filled} suffix=" per student" />
                        {text && (
                          <details className="text-sm">
                            <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                              Preview with a sample student
                            </summary>
                            <p className="bg-muted mt-2 whitespace-pre-wrap rounded-md p-3 text-sm">
                              {filled}
                            </p>
                          </details>
                        )}
                      </div>
                    </SectionCard>
                  );
                })}
              </div>

              <SectionCard>
                <h3 className="text-sm font-semibold">Placeholders</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  Ticked placeholders must appear in every message; unticked ones aren't allowed.{' '}
                  <code className="bg-muted rounded px-1 text-xs">{'{student_name}'}</code> is
                  always required.
                </p>
                <div className="flex flex-wrap gap-2">
                  {ELECTIVE_TOKENS.map((token) => {
                    const on = requiredPlaceholders.includes(token.id);
                    return (
                      <label
                        key={token.id}
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          on ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => {
                            setSettingsDirty(true);
                            setRequiredPlaceholders((prev) =>
                              e.target.checked
                                ? [...prev, token.id]
                                : prev.filter((p) => p !== token.id),
                            );
                          }}
                          className="h-4 w-4"
                        />
                        {token.label}
                        <code className="text-muted-foreground text-xs">{token.id}</code>
                      </label>
                    );
                  })}
                </div>
              </SectionCard>
            </div>

            <SectionCard>
              <h3 className="text-sm font-semibold">Send a test SMS</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Uses one real credit. Placeholders aren't filled in.
              </p>
              <div className="grid gap-4 sm:grid-cols-[14rem_1fr_auto] sm:items-start">
                <div className="space-y-1.5">
                  <Input
                    aria-label="Phone number"
                    inputMode="tel"
                    placeholder="017XXXXXXXX"
                    value={testForm.phoneNumber}
                    onChange={(e) => {
                      setTestForm({ ...testForm, phoneNumber: e.target.value });
                      if (testErrors.phoneNumber)
                        setTestErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                    }}
                  />
                  {testErrors.phoneNumber && (
                    <p className="text-destructive text-xs">{testErrors.phoneNumber}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Input
                    aria-label="Test message"
                    placeholder="Hello from school"
                    value={testForm.message}
                    onChange={(e) => {
                      setTestForm({ ...testForm, message: e.target.value });
                      if (testErrors.message)
                        setTestErrors((prev) => ({ ...prev, message: undefined }));
                    }}
                  />
                  {testErrors.message ? (
                    <p className="text-destructive text-xs">{testErrors.message}</p>
                  ) : (
                    <Estimate text={testForm.message} />
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendTestSms}
                  disabled={testSmsMutation.isPending}
                >
                  {testSmsMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send test
                </Button>
              </div>
            </SectionCard>

            {settingsDirty && (
              <div
                role="region"
                aria-label="Unsaved settings"
                className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2 shadow-lg"
              >
                <p className="text-sm font-medium">Unsaved changes</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSettingsDirty(false)}
                  >
                    Discard
                  </Button>
                  <Button type="submit" size="sm" disabled={settingsMutation.isPending}>
                    {settingsMutation.isPending && <Loader2 className="animate-spin" />}
                    Save settings
                  </Button>
                </div>
              </div>
            )}
          </form>
        ) : smsSettingsQuery.isError ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            Couldn't load SMS settings. Refresh to try again.
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        )
      ) : activeTab === 'bulk' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <SectionCard className="lg:col-span-2">
            <h3 className="text-sm font-semibold">Message</h3>
            <p className="text-muted-foreground mb-3 text-sm">
              Sent as-is to one parent number per student (father's, else mother's). Placeholders
              aren't filled in.
            </p>
            <Textarea
              aria-label="Bulk message"
              placeholder="Type your message…"
              rows={8}
              value={bulkMessage}
              onChange={(e) => setBulkMessage(e.target.value)}
            />
            <div className="mt-2">
              <Estimate text={bulkMessage} suffix=" per parent" />
            </div>
          </SectionCard>

          <SectionCard>
            <h3 className="text-sm font-semibold">Recipients</h3>
            <p className="text-muted-foreground mb-3 text-sm">Choose classes.</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Classes">
              {availableClasses.map((c) => {
                const on = selectedClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setSelectedClasses((prev) =>
                        on ? prev.filter((x) => x !== c) : [...prev, c],
                      )
                    }
                    className={cn(
                      'focus-visible:ring-ring h-9 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
                      on
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    Class {c}
                  </button>
                );
              })}
            </div>

            {selectedClasses.length > 0 && (
              <div className="mt-4 text-sm">
                {studentCountLoading && !studentCount ? (
                  <Skeleton className="h-28 w-full" />
                ) : studentCount ? (
                  <dl className="border-border divide-border divide-y rounded-lg border">
                    {Object.entries(studentCount.classBreakdown).map(([cls, info]) => (
                      <div key={cls} className="flex justify-between px-3 py-2">
                        <dt className="text-muted-foreground">Class {cls}</dt>
                        <dd className="tabular-nums">
                          {info.withPhone} of {info.total} reachable
                        </dd>
                      </div>
                    ))}
                    <div className="flex justify-between px-3 py-2">
                      <dt className="text-muted-foreground">Parents to text</dt>
                      <dd className="font-semibold tabular-nums">{studentCount.withPhone}</dd>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <dt className="text-muted-foreground">Credits needed</dt>
                      <dd
                        className={cn(
                          'font-semibold tabular-nums',
                          bulkTooExpensive && 'text-destructive',
                        )}
                      >
                        {bulkMessage ? bulkCredits.toLocaleString() : '—'}
                      </dd>
                    </div>
                  </dl>
                ) : null}
                {bulkTooExpensive && (
                  <p className="text-destructive mt-2 text-xs">
                    Not enough balance ({balanceNumber?.toLocaleString()} left).
                  </p>
                )}
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={
                    selectedClasses.length === 0 ||
                    !bulkMessage.trim() ||
                    bulkSmsMutation.isPending ||
                    bulkTooExpensive
                  }
                >
                  {bulkSmsMutation.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                  Send to{' '}
                  {studentCount?.withPhone ? plural(studentCount.withPhone, 'parent') : 'parents'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Send this SMS?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Class {sortedClasses.join(', ')}:{' '}
                    {studentCount ? plural(studentCount.withPhone, 'parent') : 'parents'},{' '}
                    {bulkCredits.toLocaleString()} credits. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      bulkSmsMutation.mutate({ classNames: selectedClasses, message: bulkMessage })
                    }
                  >
                    Send SMS
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </SectionCard>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="border-border bg-card grid grid-cols-2 content-center gap-x-6 gap-y-4 rounded-xl border px-5 py-4 shadow-sm">
              <p className="text-muted-foreground col-span-2 text-xs font-semibold uppercase tracking-wider">
                {date} · {typeSummary}
              </p>
              <Stat label="Sent" value={stats.sent || 0} dot="bg-emerald-500" />
              <Stat label="Failed" value={stats.failed || 0} dot="bg-red-500" />
              <Stat label="Pending" value={stats.pending || 0} dot="bg-amber-500" />
              <Stat
                label="Total"
                value={(stats.sent || 0) + (stats.failed || 0) + (stats.pending || 0)}
              />
            </div>
            <div className="border-border bg-card rounded-xl border px-5 py-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Credits used · last 30 days
                </p>
                <p className="text-sm font-semibold tabular-nums">{usageTotal.toLocaleString()}</p>
              </div>
              <div className="mt-2 h-32">
                {smsUsageQuery.isLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageStats} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(val) => {
                          const d = new Date(val);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="var(--muted-foreground)"
                        minTickGap={16}
                      />
                      <YAxis
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        stroke="var(--muted-foreground)"
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: 'var(--muted)' }}
                        content={({ active, payload }) =>
                          active && payload?.length ? (
                            <div className="border-border bg-popover rounded-md border px-2 py-1 text-xs shadow-md">
                              {new Date(payload[0].payload.date).toLocaleDateString('en-GB')}:{' '}
                              <span className="font-semibold">{payload[0].value}</span> credits
                            </div>
                          ) : null
                        }
                      />
                      <Bar
                        dataKey="count"
                        fill="var(--primary)"
                        radius={[3, 3, 0, 0]}
                        maxBarSize={16}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <SectionCard noPadding className="mb-6">
            <div className="border-border flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <label className="text-muted-foreground flex items-center gap-2 text-sm">
                Date
                <Input
                  type="date"
                  value={toDateInputValue(date)}
                  onChange={(e) =>
                    e.target.value && resetPage(setDate)(formatIsoToDisplayDate(e.target.value))
                  }
                  className="h-8 w-auto"
                />
              </label>
              {smsLogsQuery.isFetching && !loadingLogs && (
                <Loader2
                  className="text-muted-foreground h-4 w-4 animate-spin"
                  aria-label="Updating"
                />
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <thead>
                  <tr className="bg-muted border-border text-foreground/70 border-b text-xs font-semibold uppercase tracking-wider">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Select all on this page"
                        checked={allVisibleSelected}
                        onChange={(e) =>
                          setSelectedLogs(e.target.checked ? displayedLogs.map((l) => l.id) : [])
                        }
                        className="h-4 w-4 align-middle"
                      />
                    </th>
                    <th className="px-4 py-2">Recipient</th>
                    <th className="w-36 px-4 py-2">
                      <ColumnHeaderMenu
                        label="Type"
                        options={Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        selected={categoryFilters}
                        onSelectedChange={resetPage(setCategoryFilters)}
                      />
                    </th>
                    <th className="w-32 px-4 py-2">
                      <ColumnHeaderMenu
                        label="Status"
                        options={[
                          { value: 'sent', label: 'Sent' },
                          { value: 'failed', label: 'Failed' },
                          { value: 'pending', label: 'Pending' },
                        ]}
                        selected={statusFilters}
                        onSelectedChange={resetPage(setStatusFilters)}
                      />
                    </th>
                    <th className="px-4 py-2">Message</th>
                    <th className="w-20 px-4 py-2 text-right">Credits</th>
                    <th className="w-24 px-4 py-2">Date</th>
                    <th className="w-px px-3 py-2 text-right">
                      {filtersActive ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStatusFilters([]);
                            resetPage(setCategoryFilters)(['attendance']);
                          }}
                        >
                          <X /> Reset
                        </Button>
                      ) : (
                        <span className="sr-only">Clear filters</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {loadingLogs ? (
                    Array.from({ length: 8 }, (_, i) => (
                      <tr key={i}>
                        <td colSpan={8} className="px-4 py-2">
                          <Skeleton className="h-9 w-full" />
                        </td>
                      </tr>
                    ))
                  ) : displayedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="text-muted-foreground px-4 py-12 text-center text-sm"
                      >
                        {smsLogsQuery.isError
                          ? "Couldn't load SMS logs. Try again in a moment."
                          : `No messages on ${date}${filtersActive ? ' with these filters' : ''}.`}
                      </td>
                    </tr>
                  ) : (
                    displayedLogs.map((log) => {
                      const selected = selectedLogs.includes(log.id);
                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            'align-top transition-colors',
                            selected
                              ? 'bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]'
                              : 'hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]',
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              aria-label={`Select message to ${log.phone_number}`}
                              checked={selected}
                              onChange={(e) => toggleLog(log.id, e.target.checked)}
                              className="h-4 w-4 align-middle"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <p className="text-sm font-medium">{log.student?.name || '—'}</p>
                            <p className="text-muted-foreground text-xs tabular-nums">
                              {log.phone_number}
                              {log.student?.enrollments?.length ? (
                                <>
                                  {' · '}
                                  <ClassInfo student={log.student} />
                                </>
                              ) : null}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-sm">{CATEGORY_LABELS[log.category]}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge
                              status={STATUS_BADGE[log.status]}
                              label={log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                            />
                            {log.retry_count > 0 && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {log.retry_count} {log.retry_count === 1 ? 'retry' : 'retries'}
                              </p>
                            )}
                          </td>
                          <td className="max-w-md px-4 py-2.5">
                            <p className="line-clamp-2 text-sm" title={log.message}>
                              {log.message}
                            </p>
                            {log.error_reason && (
                              <p
                                className="text-destructive mt-1 line-clamp-2 text-xs"
                                title={log.error_reason}
                              >
                                {log.error_reason}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right text-sm tabular-nums">
                            {log.sms_count ?? '—'}
                          </td>
                          <td className="text-muted-foreground px-4 py-2.5 text-sm tabular-nums">
                            {formatIsoToDisplayDate(log.attendance_date ?? log.created_at)}
                          </td>
                          <td />
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={currentPage}
              totalPages={totalPages}
              limit={limit}
              loading={smsLogsQuery.isFetching}
              limitOptions={[25, 50, 100]}
              onPageChange={(p) => {
                setCurrentPage(p);
                setSelectedLogs([]);
              }}
              onLimitChange={resetPage(setLimit)}
            />
          </SectionCard>

          {selectedLogs.length > 0 && (
            <div
              role="region"
              aria-label="Bulk actions"
              className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLogs([])}
                  aria-label="Clear selection"
                  className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-md p-1"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="text-sm font-medium tabular-nums">
                  {plural(selectedLogs.length, 'message')} selected
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => retryMutation.mutate(retryableIds)}
                  disabled={retryMutation.isPending || retryableIds.length === 0}
                  title={
                    retryableIds.length === 0
                      ? 'Only failed or pending messages can be retried'
                      : undefined
                  }
                >
                  {retryMutation.isPending ? <Loader2 className="animate-spin" /> : <RotateCw />}
                  Retry{retryableIds.length ? ` ${retryableIds.length}` : ''}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 /> Delete
                </Button>
              </div>
            </div>
          )}

          <ConfirmationPopup
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={() => {
              setDeleteOpen(false);
              deleteMutation.mutate(selectedLogs);
            }}
            confirmLabel="Delete logs"
            msg={`Delete ${plural(selectedLogs.length, 'SMS log')}? This can't be undone.`}
          />
        </>
      )}
    </div>
  );
}

export default SmsManagement;
