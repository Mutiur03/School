import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { toast } from 'react-hot-toast';
import {
  Send,
  Trash2,
  Filter,
  Calendar,
  Settings,
  MessageSquare,
  CreditCard,
  Save,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import Loading from '@/components/Loading';
import { Textarea } from '@/components/ui/textarea';
import {
  formatDobForDateInput as toDateInputValue,
  calculateSMSCount,
  PHONE_NUMBER,
} from '@school/shared-schemas';
import {
  PageHeader,
  TabNav,
  SectionCard,
  StatsCard,
  FilterSelection,
  FilterField,
} from '@/components';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { TabItem } from '@/components';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocation, useSearchParams } from 'react-router-dom';

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
  student: Student;
  phone_number: string;
  attendance_date: string;
  status: 'sent' | 'failed' | 'pending';
  sms_count: number | null;
  retry_count: number;
  message: string;
  error_reason: string | null;
  created_at: string;
}

interface Stats {
  sent?: number;
  failed?: number;
  pending?: number;
}

interface Filters {
  status: string;
  date: string;
  limit: number;
}

interface SmsLogsResponse {
  smsLogs: SmsLog[];
  totalPages: number;
  stats: Stats;
}

interface SmsBalance {
  estimatedSms?: number | null;
  message?: string;
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

const EMPTY_SETTINGS: SmsSettings = {
  present_template: '',
  absent_template: '',
  run_awayed_template: '',
  send_to_present: false,
  send_to_absent: false,
  send_to_run_awayed: false,
  is_active: false,
};

const CORE_TOKENS = ['{student_name}'] as const;
const ELECTIVE_TOKENS = [
  { id: '{login_id}', label: 'Login ID' },
  { id: '{date}', label: 'Date' },
  { id: '{school_name}', label: 'School Name' },
  { id: '{class}', label: 'Class' },
  { id: '{section}', label: 'Section' },
  { id: '{roll}', label: 'Roll' },
] as const;

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

function SmsManagement() {
  const formatIsoToDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'logs' | 'settings' | 'bulk'>(
    tabParam === 'settings' ? 'settings' : tabParam === 'bulk' ? 'bulk' : 'logs',
  );
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    date: formatIsoToDisplayDate(new Date().toISOString()),
    limit: 50,
  });

  const handleTabChange = (id: string) => {
    const next = id as 'logs' | 'settings' | 'bulk';
    setActiveTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'settings' || tab === 'bulk' || tab === 'logs') {
      setActiveTab(tab);
    } else {
      setActiveTab('logs');
      setSearchParams({ tab: 'logs' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Settings State
  const [testForm, setTestForm] = useState({ phoneNumber: '', message: '' });
  const [testErrors, setTestErrors] = useState<{ phoneNumber?: string; message?: string }>({});
  const [settingsErrors, setSettingsErrors] = useState<{
    present_template?: string;
    absent_template?: string;
    run_awayed_template?: string;
  }>({});
  const queryClient = useQueryClient();
  const [settingsDraft, setSettingsDraft] = useState<SmsSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [requiredPlaceholders, setRequiredPlaceholders] = useState<string[]>([]);

  // Bulk SMS State
  const [selectedClasses, setSelectedClasses] = useState<number[]>([]);
  const [bulkMessage, setBulkMessage] = useState<string>('');
  const availableClasses = [6, 7, 8, 9, 10];

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

  const statusColors: Record<string, string> = {
    sent: 'bg-green-500',
    failed: 'bg-red-500',
    pending: 'bg-yellow-500',
  };

  const statusLabels: Record<string, string> = {
    sent: 'Sent',
    failed: 'Failed',
    pending: 'Pending',
  };

  const [estimates, setEstimates] = useState<{
    [key: string]: { count: number; encoding: string; length: number };
  }>({});

  const calculateEstimate = useCallback((key: string, text: string) => {
    const raw = text ?? '';
    if (!raw.length) {
      setEstimates((prev) => ({ ...prev, [key]: { count: 0, encoding: 'None', length: 0 } }));
      return;
    }
    const result = calculateSMSCount(raw);
    setEstimates((prev) => ({
      ...prev,
      [key]: { count: result.count, encoding: result.encoding, length: result.length },
    }));
  }, []);

  const smsLogsQuery = useQuery<SmsLogsResponse>({
    queryKey: ['smsLogs', currentPage, filters.limit, filters.date],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: filters.limit.toString(),
        date: toDateInputValue(filters.date) || filters.date,
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

  const smsBalanceQuery = useQuery<SmsBalance>({
    queryKey: ['smsBalance'],
    queryFn: async () => {
      const response = await axios.get('/api/sms-settings/balance');
      return response.data.data;
    },
    enabled: activeTab === 'settings',
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
      toast.success('SMS settings updated successfully');
      queryClient.invalidateQueries({ queryKey: ['smsSettings'] });
      setSettingsDirty(false);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update SMS settings';
      toast.error(errorMessage);
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async (payload: { phoneNumber: string; message: string }) => {
      await axios.post('/api/sms-settings/test', payload);
    },
    onSuccess: () => {
      toast.success('Test SMS sent successfully');
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
      toast.success(data.message || 'Bulk SMS sent successfully');
      setSelectedClasses([]);
      setBulkMessage('');
      setActiveTab('logs');
      setSearchParams({ tab: 'logs' }, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['smsLogs'] });
      queryClient.invalidateQueries({ queryKey: ['smsBalance'] });
      queryClient.invalidateQueries({ queryKey: ['smsUsage'] });
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to send bulk SMS';
      toast.error(errorMessage);
    },
  });

  useEffect(() => {
    if (smsLogsQuery.isError) toast.error('Failed to fetch SMS logs');
  }, [smsLogsQuery.isError]);

  useEffect(() => {
    if (smsSettingsQuery.isError) toast.error('Failed to fetch SMS settings');
  }, [smsSettingsQuery.isError]);

  useEffect(() => {
    if (smsBalanceQuery.isError) toast.error('Failed to fetch SMS balance');
  }, [smsBalanceQuery.isError]);

  useEffect(() => {
    if (smsSettingsQuery.data && !settingsDirty) {
      setSettingsDraft(smsSettingsQuery.data);

      // Sync elective placeholders from existing templates
      const templates =
        (smsSettingsQuery.data.present_template || '') +
        (smsSettingsQuery.data.absent_template || '') +
        (smsSettingsQuery.data.run_awayed_template || '');
      const initial = ELECTIVE_TOKENS.map((t) => t.id).filter((token) => templates.includes(token));
      setRequiredPlaceholders(initial);
    }
  }, [smsSettingsQuery.data, settingsDirty]);

  useEffect(() => {
    if (activeTab === 'settings' && smsSettingsQuery.data) {
      calculateEstimate('present', smsSettingsQuery.data.present_template || '');
      calculateEstimate('absent', smsSettingsQuery.data.absent_template || '');
      calculateEstimate('run_awayed', smsSettingsQuery.data.run_awayed_template || '');
    }
  }, [activeTab, smsSettingsQuery.data, calculateEstimate]);

  useEffect(() => {
    calculateEstimate('test', testForm.message || '');
  }, [testForm.message, calculateEstimate]);

  useEffect(() => {
    calculateEstimate('bulk', bulkMessage || '');
  }, [bulkMessage, calculateEstimate]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;

    const presentValidation = validateTemplate(
      settingsDraft.present_template || '',
      requiredPlaceholders,
    );
    const absentValidation = validateTemplate(
      settingsDraft.absent_template || '',
      requiredPlaceholders,
    );
    const runAwayValidation = validateTemplate(
      settingsDraft.run_awayed_template || '',
      requiredPlaceholders,
    );
    const nextErrors: {
      present_template?: string;
      absent_template?: string;
      run_awayed_template?: string;
    } = {};

    if (settingsDraft.is_active && settingsDraft.send_to_present && !presentValidation.isValid) {
      const parts = [];
      if (presentValidation.missing.length > 0)
        parts.push(`missing mandatory ${presentValidation.missing.join(', ')}`);
      if (presentValidation.forbidden.length > 0)
        parts.push(`contains forbidden ${presentValidation.forbidden.join(', ')}`);
      nextErrors.present_template = `Present template ${parts.join(' and ')}.`;
    }

    if (settingsDraft.is_active && settingsDraft.send_to_absent && !absentValidation.isValid) {
      const parts = [];
      if (absentValidation.missing.length > 0)
        parts.push(`missing mandatory ${absentValidation.missing.join(', ')}`);
      if (absentValidation.forbidden.length > 0)
        parts.push(`contains forbidden ${absentValidation.forbidden.join(', ')}`);
      nextErrors.absent_template = `Absent template ${parts.join(' and ')}.`;
    }

    if (settingsDraft.is_active && settingsDraft.send_to_run_awayed && !runAwayValidation.isValid) {
      const parts = [];
      if (runAwayValidation.missing.length > 0)
        parts.push(`missing mandatory ${runAwayValidation.missing.join(', ')}`);
      if (runAwayValidation.forbidden.length > 0)
        parts.push(`contains forbidden ${runAwayValidation.forbidden.join(', ')}`);
      nextErrors.run_awayed_template = `Running Away template ${parts.join(' and ')}.`;
    }

    setSettingsErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // toast.error("Please fix template validation errors before saving.");
      return;
    }

    settingsMutation.mutate({
      settings: settingsDraft,
      requiredPlaceholders,
    });
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normalizePhoneNumber(testForm.phoneNumber);
    const message = testForm.message.trim();
    const nextErrors: { phoneNumber?: string; message?: string } = {};

    if (!phone) {
      nextErrors.phoneNumber = 'Phone number is required.';
    } else if (!PHONE_NUMBER.test(phone)) {
      nextErrors.phoneNumber = 'Phone must be 11 digits and start with 01.';
    }

    if (!message) {
      nextErrors.message = 'Message is required.';
    }

    setTestErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the test SMS form errors.');
      return;
    }

    testSmsMutation.mutate({ phoneNumber: phone, message });
  };

  const smsLogs = smsLogsQuery.data?.smsLogs || [];
  const stats: Stats = smsLogsQuery.data?.stats || {};
  const totalPages = smsLogsQuery.data?.totalPages || 1;
  const loadingLogs = smsLogsQuery.isLoading;
  const logsError = smsLogsQuery.isError;
  const settings = settingsDraft;
  const settingsLoading = smsSettingsQuery.isLoading;
  const settingsError = smsSettingsQuery.isError;
  const balance = smsBalanceQuery.data || null;
  const balanceLoading = smsBalanceQuery.isLoading;
  const balanceError = smsBalanceQuery.isError;

  const displayedLogs = useMemo(() => {
    if (filters.status === 'all') return smsLogs;
    return smsLogs.filter((log: SmsLog) => log.status === filters.status);
  }, [smsLogs, filters.status]);

  const totalSms = (stats.sent || 0) + (stats.failed || 0) + (stats.pending || 0);

  const handleRetrySelected = async (): Promise<void> => {
    if (selectedLogs.length === 0) {
      toast.error('Please select SMS logs to retry');
      return;
    }

    const failedLogs: SmsLog[] = smsLogs.filter(
      (log) =>
        selectedLogs.includes(log.id) && (log.status === 'failed' || log.status === 'pending'),
    );

    if (failedLogs.length === 0) {
      toast.error('Please select only failed SMS logs for retry');
      return;
    }

    retryMutation.mutate(failedLogs.map((log) => log.id));
  };

  const handleDeleteSelected = async (): Promise<void> => {
    if (selectedLogs.length === 0) {
      toast.error('Please select SMS logs to delete');
      return;
    }
    deleteMutation.mutate(selectedLogs);
  };

  const handleSelectAll = (): void => {
    if (selectedLogs.length === displayedLogs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(displayedLogs.map((log) => log.id));
    }
  };

  const handleFilterChange = (key: keyof Filters, value: string | number): void => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const getStudentInfo = (student: Student | null | undefined): string => {
    if (!student || !student.enrollments || student.enrollments.length === 0) {
      return 'N/A';
    }
    const enrollment = student.enrollments[0];
    return `Class ${enrollment.class}, Section ${enrollment.section}, Roll ${enrollment.roll}`;
  };

  const tabs: TabItem[] = [
    {
      id: 'logs',
      label: 'Delivery Logs',
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
      label: 'SMS Settings',
      icon: <Settings size={16} />,
      href: `${location.pathname}?tab=settings`,
    },
  ];

  // if (loadingLogs && smsLogs.length === 0) {
  //   return <Loading />;
  // }

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="SMS Management"
        description="Track delivery logs, test SMS delivery, and configure attendance notifications."
      />

      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={handleTabChange} className="mb-6" />

      {activeTab === 'settings' ? (
        <div className="space-y-6">
          {(settingsError || balanceError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unable to load SMS settings or balance. Please refresh.
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              title="Estimated SMS Remaining"
              icon={<CreditCard className="text-primary h-5 w-5" />}
              className="lg:col-span-1"
            >
              <div className="space-y-4">
                <div className="border-border rounded-xl border bg-slate-50 p-4 dark:bg-slate-900">
                  <div className="text-muted-foreground mb-1 text-sm">Estimated SMS Remaining</div>
                  <div className="flex items-center gap-2 text-3xl font-bold text-slate-900 dark:text-white">
                    {balanceLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      (balance?.estimatedSms ?? '...')
                    )}
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['smsBalance'] })}
                      className="rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                      disabled={balanceLoading}
                    >
                      <RefreshCw className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  {balance?.message || 'Estimated remaining SMS credits'}
                </div>
                <p className="text-muted-foreground text-xs">
                  Crediting balance is managed by a super admin.
                </p>
              </div>
            </SectionCard>

            <SectionCard
              title="Test SMS Delivery"
              icon={<Send className="text-primary h-5 w-5" />}
              className="lg:col-span-2"
            >
              <form onSubmit={handleSendTestSms} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="testPhone">Phone Number</Label>
                    <Input
                      id="testPhone"
                      placeholder="017XXXXXXXX"
                      value={testForm.phoneNumber}
                      onChange={(e) => {
                        setTestForm({ ...testForm, phoneNumber: e.target.value });
                        if (testErrors.phoneNumber) {
                          setTestErrors((prev) => ({ ...prev, phoneNumber: undefined }));
                        }
                      }}
                      disabled={settingsLoading}
                    />
                    {testErrors.phoneNumber && (
                      <p className="text-xs text-red-500">{testErrors.phoneNumber}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="testMessage">Test Message</Label>
                    <Input
                      id="testMessage"
                      placeholder="Hello from school system!"
                      value={testForm.message}
                      onChange={(e) => {
                        setTestForm({ ...testForm, message: e.target.value });
                        if (testErrors.message) {
                          setTestErrors((prev) => ({ ...prev, message: undefined }));
                        }
                      }}
                      disabled={settingsLoading}
                    />
                    {testErrors.message && (
                      <p className="text-xs text-red-500">{testErrors.message}</p>
                    )}
                    {estimates.test && (
                      <div className="text-primary mt-1 text-[10px] font-medium">
                        Est: <span className="font-bold">{estimates.test.count}</span> credit
                        {estimates.test.count !== 1 ? 's' : ''} ({estimates.test.encoding}){' '}
                        {estimates.test.length} chars
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={testSmsMutation.isPending || settingsLoading}
                  className="w-full sm:w-auto"
                >
                  {testSmsMutation.isPending ? 'Sending...' : 'Send Test SMS'}
                </Button>
              </form>
            </SectionCard>
          </div>

          <SectionCard
            title="Notification Templates & Rules"
            icon={<Settings className="text-primary h-5 w-5" />}
          >
            {settingsLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                </div>
                <Skeleton className="h-10 w-40" />
              </div>
            ) : settings ? (
              <form onSubmit={handleUpdateSettings} className="space-y-8">
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <div className="border-border space-y-4 rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-900">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        Present Student SMS
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="send_to_present"
                          checked={settings.send_to_present}
                          onCheckedChange={(checked) => {
                            if (!settingsDirty) setSettingsDirty(true);
                            setSettingsDraft((prev) => ({
                              ...(prev || EMPTY_SETTINGS),
                              send_to_present: !!checked,
                            }));
                            if (!checked && settingsErrors.present_template) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                present_template: undefined,
                              }));
                            }
                          }}
                        />
                        <Label htmlFor="send_to_present">Enable</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="present_template">Message Template</Label>
                      <Textarea
                        id="present_template"
                        rows={4}
                        value={settings.present_template}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (!settingsDirty) setSettingsDirty(true);
                          setSettingsDraft((prev) => ({
                            ...(prev || EMPTY_SETTINGS),
                            present_template: nextValue,
                          }));
                          calculateEstimate('present', nextValue);
                          if (settingsErrors.present_template) {
                            const validation = validateTemplate(nextValue, requiredPlaceholders);
                            if (validation.isValid) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                present_template: undefined,
                              }));
                            }
                          }
                        }}
                      />
                      {settingsErrors.present_template && (
                        <p className="text-xs text-red-500">{settingsErrors.present_template}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-red-500">Mandatory:</span>
                          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                            {'{student_name}'}
                          </code>
                          {requiredPlaceholders.map((p) => (
                            <code key={p} className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                              {p}
                            </code>
                          ))}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            Forbidden:
                          </span>
                          {ELECTIVE_TOKENS.filter((t) => !requiredPlaceholders.includes(t.id)).map(
                            (t) => (
                              <code
                                key={t.id}
                                className="rounded bg-slate-100 px-1 italic line-through opacity-60 dark:bg-slate-900"
                              >
                                {t.id}
                              </code>
                            ),
                          )}
                        </div>
                        {estimates.present && (
                          <div className="text-primary text-[10px] font-medium">
                            Est: <span className="font-bold">{estimates.present.count}</span> credit
                            {estimates.present.count !== 1 ? 's' : ''} ({estimates.present.encoding}
                            )
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-border space-y-4 rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-900">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        Absent Student SMS
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="send_to_absent"
                          checked={settings.send_to_absent}
                          onCheckedChange={(checked) => {
                            if (!settingsDirty) setSettingsDirty(true);
                            setSettingsDraft((prev) => ({
                              ...(prev || EMPTY_SETTINGS),
                              send_to_absent: !!checked,
                            }));
                            if (!checked && settingsErrors.absent_template) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                absent_template: undefined,
                              }));
                            }
                          }}
                        />
                        <Label htmlFor="send_to_absent">Enable</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="absent_template">Message Template</Label>
                      <Textarea
                        id="absent_template"
                        rows={4}
                        value={settings.absent_template}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (!settingsDirty) setSettingsDirty(true);
                          setSettingsDraft((prev) => ({
                            ...(prev || EMPTY_SETTINGS),
                            absent_template: nextValue,
                          }));
                          calculateEstimate('absent', nextValue);
                          if (settingsErrors.absent_template) {
                            const validation = validateTemplate(nextValue, requiredPlaceholders);
                            if (validation.isValid) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                absent_template: undefined,
                              }));
                            }
                          }
                        }}
                      />
                      {settingsErrors.absent_template && (
                        <p className="text-xs text-red-500">{settingsErrors.absent_template}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-red-500">Mandatory:</span>
                          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                            {'{student_name}'}
                          </code>
                          {requiredPlaceholders.map((p) => (
                            <code key={p} className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                              {p}
                            </code>
                          ))}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            Forbidden:
                          </span>
                          {ELECTIVE_TOKENS.filter((t) => !requiredPlaceholders.includes(t.id)).map(
                            (t) => (
                              <code
                                key={t.id}
                                className="rounded bg-slate-100 px-1 italic line-through opacity-60 dark:bg-slate-900"
                              >
                                {t.id}
                              </code>
                            ),
                          )}
                        </div>
                        {estimates.absent && (
                          <div className="text-primary text-[10px] font-medium">
                            Est: <span className="font-bold">{estimates.absent.count}</span> credit
                            {estimates.absent.count !== 1 ? 's' : ''} ({estimates.absent.encoding})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-border space-y-4 rounded-xl border bg-slate-50/50 p-4 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900">
                          <MessageSquare className="h-4 w-4" />
                        </div>
                        Running Away Student SMS
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="send_to_run_awayed"
                          checked={settings.send_to_run_awayed}
                          onCheckedChange={(checked) => {
                            if (!settingsDirty) setSettingsDirty(true);
                            setSettingsDraft((prev) => ({
                              ...(prev || EMPTY_SETTINGS),
                              send_to_run_awayed: !!checked,
                            }));
                            if (!checked && settingsErrors.run_awayed_template) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                run_awayed_template: undefined,
                              }));
                            }
                          }}
                        />
                        <Label htmlFor="send_to_run_awayed">Enable</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="run_awayed_template">Message Template</Label>
                      <Textarea
                        id="run_awayed_template"
                        rows={4}
                        value={settings.run_awayed_template}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          if (!settingsDirty) setSettingsDirty(true);
                          setSettingsDraft((prev) => ({
                            ...(prev || EMPTY_SETTINGS),
                            run_awayed_template: nextValue,
                          }));
                          calculateEstimate('run_awayed', nextValue);
                          if (settingsErrors.run_awayed_template) {
                            const validation = validateTemplate(nextValue, requiredPlaceholders);
                            if (validation.isValid) {
                              setSettingsErrors((prev) => ({
                                ...prev,
                                run_awayed_template: undefined,
                              }));
                            }
                          }
                        }}
                      />
                      {settingsErrors.run_awayed_template && (
                        <p className="text-xs text-red-500">{settingsErrors.run_awayed_template}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-red-500">Mandatory:</span>
                          <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                            {'{student_name}'}
                          </code>
                          {requiredPlaceholders.map((p) => (
                            <code key={p} className="rounded bg-slate-200 px-1 dark:bg-slate-800">
                              {p}
                            </code>
                          ))}
                        </div>
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-[10px]">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            Forbidden:
                          </span>
                          {ELECTIVE_TOKENS.filter((t) => !requiredPlaceholders.includes(t.id)).map(
                            (t) => (
                              <code
                                key={t.id}
                                className="rounded bg-slate-100 px-1 italic line-through opacity-60 dark:bg-slate-900"
                              >
                                {t.id}
                              </code>
                            ),
                          )}
                        </div>
                        {estimates.run_awayed && (
                          <div className="text-primary text-[10px] font-medium">
                            Est: <span className="font-bold">{estimates.run_awayed.count}</span>{' '}
                            credit{estimates.run_awayed.count !== 1 ? 's' : ''} (
                            {estimates.run_awayed.encoding})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-border flex items-center justify-between border-t pt-4">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Required Placeholders</Label>
                    <div className="border-border flex flex-wrap gap-x-6 gap-y-3 rounded-lg border bg-slate-100 p-4 dark:bg-slate-800/50">
                      <div className="flex cursor-not-allowed items-center gap-2 opacity-50">
                        <Checkbox checked disabled />
                        <span className="text-sm">Student Name</span>
                      </div>
                      {ELECTIVE_TOKENS.map((token) => (
                        <div key={token.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`req_${token.id}`}
                            checked={requiredPlaceholders.includes(token.id)}
                            onCheckedChange={(checked) => {
                              if (!settingsDirty) setSettingsDirty(true);
                              const next = checked
                                ? [...requiredPlaceholders, token.id]
                                : requiredPlaceholders.filter((p) => p !== token.id);
                              setRequiredPlaceholders(next);
                            }}
                          />
                          <Label htmlFor={`req_${token.id}`} className="cursor-pointer text-sm">
                            {token.label}
                          </Label>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Checkbox
                        id="is_active"
                        checked={settings.is_active}
                        onCheckedChange={(checked) => {
                          if (!settingsDirty) setSettingsDirty(true);
                          setSettingsDraft((prev) => ({
                            ...(prev || EMPTY_SETTINGS),
                            is_active: !!checked,
                          }));
                          if (!checked) {
                            setSettingsErrors({});
                          }
                        }}
                      />
                      <Label htmlFor="is_active">Global System Active</Label>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={settingsMutation.isPending || !settingsDirty}
                    size="lg"
                    className="px-8 shadow-md"
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {settingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Loading />
              </div>
            )}
          </SectionCard>
        </div>
      ) : activeTab === 'bulk' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <SectionCard
              title="Select Classes"
              icon={<Filter className="text-primary h-5 w-5" />}
              className="lg:col-span-1"
            >
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  Select the classes you want to send this SMS to.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {availableClasses.map((className) => (
                    <div key={className} className="flex items-center space-x-2">
                      <Checkbox
                        id={`class-${className}`}
                        checked={selectedClasses.includes(className)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedClasses([...selectedClasses, className]);
                          } else {
                            setSelectedClasses(selectedClasses.filter((c) => c !== className));
                          }
                        }}
                      />
                      <Label htmlFor={`class-${className}`}>Class {className}</Label>
                    </div>
                  ))}
                </div>
                {selectedClasses.length > 0 && (
                  <div className="space-y-2 pt-3">
                    <div className="border-border space-y-1 rounded-lg border bg-slate-50 p-3 text-sm dark:bg-slate-900">
                      {studentCountLoading && !studentCount ? (
                        <div className="flex items-center justify-center py-4">
                          <RefreshCw className="text-primary h-5 w-5 animate-spin" />
                        </div>
                      ) : studentCount ? (
                        <>
                          <div className="border-border space-y-2 border-b pb-2">
                            {Object.entries(
                              studentCount.classBreakdown as Record<
                                number,
                                { total: number; withPhone: number }
                              >,
                            ).map(([cls, info]) => (
                              <div key={cls} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground font-medium">
                                  Class {cls}:
                                </span>
                                <span className="text-foreground">
                                  {info.total} students ({info.withPhone} w/ phone)
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between pt-1">
                            <span className="text-muted-foreground">Total Students:</span>
                            <span className="font-semibold">{studentCount.totalStudents}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground italic">
                              Target SMS (Unique):
                            </span>
                            <span className="text-primary font-semibold">
                              {studentCount.withPhone}
                            </span>
                          </div>
                          {estimates.bulk && (
                            <div className="border-border mt-1 flex justify-between border-t pt-1">
                              <span className="text-muted-foreground font-medium underline decoration-dotted">
                                Total Credits:
                              </span>
                              <span className="text-primary font-bold">
                                {studentCount.withPhone * estimates.bulk.count}
                              </span>
                            </div>
                          )}
                        </>
                      ) : null}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedClasses([])}
                      className="border-destructive/20 text-destructive hover:bg-destructive/10 hover:text-destructive text-xs transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Compose Message"
              icon={<MessageSquare className="text-primary h-5 w-5" />}
              className="lg:col-span-2"
            >
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-message">Message Content</Label>
                  <Textarea
                    id="bulk-message"
                    placeholder="Type your bulk SMS message here..."
                    rows={6}
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-[10px] italic">
                      Note: This message will be sent to all students in the selected classes.
                    </p>
                    {estimates.bulk && (
                      <div className="text-primary text-[10px] font-medium">
                        Est: <span className="font-bold">{estimates.bulk.count}</span> credit
                        {estimates.bulk.count !== 1 ? 's' : ''} ({estimates.bulk.encoding}){' '}
                        {estimates.bulk.length} chars
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={
                          selectedClasses.length === 0 ||
                          !bulkMessage.trim() ||
                          bulkSmsMutation.isPending
                        }
                        className="bg-primary hover:bg-primary/90"
                      >
                        {bulkSmsMutation.isPending ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="mr-2 h-4 w-4" />
                        )}
                        Send Bulk SMS
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="text-muted-foreground space-y-2 text-sm">
                            <p>
                              This will send the SMS to all students in{' '}
                              <strong className="text-foreground">
                                Class {selectedClasses.sort((a, b) => a - b).join(', ')}
                              </strong>
                              .
                            </p>
                            {studentCount && estimates.bulk && (
                              <div className="border-border space-y-1 rounded-lg border bg-slate-50 p-3 dark:bg-slate-900">
                                <div className="flex justify-between">
                                  <span>Students with phone:</span>
                                  <span className="text-foreground font-semibold">
                                    {studentCount.withPhone}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Credits per student:</span>
                                  <span className="text-foreground font-semibold">
                                    {estimates.bulk.count}
                                  </span>
                                </div>
                                <div className="border-border mt-1 flex justify-between border-t pt-1">
                                  <span className="font-medium">Total credits needed:</span>
                                  <span className="text-primary font-bold">
                                    {studentCount.withPhone * estimates.bulk.count}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            bulkSmsMutation.mutate({
                              classNames: selectedClasses,
                              message: bulkMessage,
                            })
                          }
                          className="bg-primary hover:bg-primary/90"
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      ) : (
        <>
          {logsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              Unable to load SMS logs. Please refresh.
            </div>
          )}

          <SectionCard
            title="Daily Credit Usage (Last 30 Days)"
            icon={<RefreshCw className="text-primary h-5 w-5" />}
          >
            <div className="h-[250px] w-full pt-4">
              {smsUsageQuery.isLoading ? (
                <div className="flex h-full w-full items-center justify-center">
                  <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={smsUsageQuery.data?.stats || []}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="rgba(0,0,0,0.05)"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return (
                          d.getDate().toString().padStart(2, '0') +
                          '/' +
                          (d.getMonth() + 1).toString().padStart(2, '0')
                        );
                      }}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const date = new Date(payload[0].payload.date).toLocaleDateString(
                            'en-GB',
                          );
                          return (
                            <div className="border-border rounded-lg border bg-white p-2 text-xs shadow-xl dark:bg-slate-900">
                              <div className="mb-1 border-b pb-1 font-bold">{date}</div>
                              <div className="text-primary flex items-center gap-1">
                                <span className="bg-primary h-2 w-2 rounded-full" />
                                Usage: {payload[0].value} Credits
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={20}>
                      {smsUsageQuery.data?.stats?.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.count > 0 ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
                          fillOpacity={entry.count > 0 ? 1 : 0.2}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              label="Total SMS"
              value={totalSms}
              color="default"
              icon={<MessageSquare className="h-5 w-5" />}
              loading={false}
            />
            <StatsCard
              label="Sent"
              value={stats.sent || 0}
              color="emerald"
              icon={<Send className="h-5 w-5" />}
              loading={false}
            />
            <StatsCard
              label="Failed"
              value={stats.failed || 0}
              color="red"
              icon={<Trash2 className="h-5 w-5" />}
              loading={false}
            />
            <StatsCard
              label="Pending"
              value={stats.pending || 0}
              color="amber"
              icon={<RefreshCw className="h-5 w-5" />}
              loading={false}
            />
          </div>

          <FilterSelection
            headerAction={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={handleRetrySelected}
                  disabled={retryMutation.isPending || selectedLogs.length === 0}
                  className="bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 flex-1 sm:flex-initial"
                >
                  <Send className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Retry Selected</span>
                  <span className="sm:hidden">Retry ({selectedLogs.length})</span>
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      disabled={selectedLogs.length === 0}
                      className="flex-1 sm:flex-initial"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span className="hidden sm:inline">Delete Selected</span>
                      <span className="sm:hidden">Delete ({selectedLogs.length})</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete SMS Logs</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedLogs.length} selected SMS log(s)?
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelected}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            }
          >
            <FilterField label="Status" htmlFor="status-filter">
              <Select
                value={filters.status}
                onValueChange={(value) => handleFilterChange('status', value)}
              >
                <SelectTrigger id="status-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>

            <FilterField label="Date" htmlFor="date-filter">
              <div className="relative">
                <Calendar className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="date-filter"
                  type="date"
                  value={toDateInputValue(filters.date)}
                  onChange={(e) => {
                    handleFilterChange('date', formatIsoToDisplayDate(e.target.value));
                  }}
                  className="w-full cursor-pointer pl-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-clear-button]:hidden [&::-webkit-inner-spin-button]:hidden"
                />
              </div>
            </FilterField>

            <FilterField label="Per Page" htmlFor="limit-filter">
              <Select
                value={filters.limit.toString()}
                onValueChange={(value) => handleFilterChange('limit', parseInt(value))}
              >
                <SelectTrigger id="limit-filter" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </FilterField>
          </FilterSelection>

          <SectionCard
            title="SMS Logs"
            icon={<Inbox className="h-5 w-5" />}
            headerAction={
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedLogs.length === displayedLogs.length && displayedLogs.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-muted-foreground hidden text-sm sm:inline dark:text-slate-400">
                  Select All
                </span>
              </div>
            }
            noPadding
          >
            <div className="p-6">
              <div className="hidden overflow-x-auto lg:block">
                {loadingLogs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-11 items-center gap-3">
                        {Array.from({ length: 11 }).map((__, j) => (
                          <Skeleton key={j} className="h-4 w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-border border-b dark:border-slate-700">
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          <Checkbox
                            checked={
                              selectedLogs.length === displayedLogs.length &&
                              displayedLogs.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Student
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Class Info
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Phone
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Date
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Status
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          SMS count
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Retry Count
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Message
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Error
                        </th>
                        <th className="text-muted-foreground p-3 text-left font-medium dark:text-slate-400">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLogs.map((log: SmsLog) => (
                        <tr
                          key={log.id}
                          className="border-border hover:bg-muted/50 group border-b transition-colors hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-white"
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedLogs.includes(log.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLogs((prev) => [...prev, log.id]);
                                } else {
                                  setSelectedLogs((prev) => prev.filter((id) => id !== log.id));
                                }
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-slate-900 group-hover:text-slate-900 dark:text-white dark:group-hover:text-white">
                                {log.student?.name || 'N/A'}
                              </div>
                              <div className="text-muted-foreground group-hover:text-muted-foreground text-sm dark:text-slate-400 dark:group-hover:text-slate-400">
                                ID: {log.student?.login_id || 'N/A'}
                              </div>
                            </div>
                          </td>
                          <td className="text-muted-foreground group-hover:text-muted-foreground p-3 text-sm dark:text-slate-400 dark:group-hover:text-slate-400">
                            {getStudentInfo(log.student)}
                          </td>
                          <td className="p-3 text-slate-900 group-hover:text-slate-900 dark:text-white dark:group-hover:text-white">
                            {log.phone_number}
                          </td>
                          <td className="p-3 text-slate-900 group-hover:text-slate-900 dark:text-white dark:group-hover:text-white">
                            {formatIsoToDisplayDate(log.attendance_date)}
                          </td>
                          <td className="p-3">
                            <Badge className={`text-white ${statusColors[log.status]}`}>
                              {statusLabels[log.status]}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {log.sms_count ? (
                              <div className="rounded border border-green-200 bg-green-50 px-2 py-1 text-sm font-semibold text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
                                {log.sms_count}
                              </div>
                            ) : (
                              <span className="text-muted-foreground group-hover:text-muted-foreground dark:text-slate-400 dark:group-hover:text-slate-400">
                                N/A
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center text-slate-900 group-hover:text-slate-900 dark:text-white dark:group-hover:text-white">
                            {log.retry_count}
                          </td>
                          <td className="max-w-xs p-3">
                            <div
                              className="truncate text-slate-900 group-hover:text-slate-900 dark:text-white dark:group-hover:text-white"
                              title={log.message}
                            >
                              {log.message}
                            </div>
                          </td>
                          <td className="max-w-xs p-3">
                            {log.error_reason && (
                              <div
                                className="truncate text-sm text-red-600 group-hover:text-red-600 dark:text-red-400 dark:group-hover:text-red-400"
                                title={log.error_reason}
                              >
                                {log.error_reason}
                              </div>
                            )}
                          </td>
                          <td className="text-muted-foreground group-hover:text-muted-foreground p-3 text-sm dark:text-slate-400 dark:group-hover:text-slate-400">
                            {formatIsoToDisplayDate(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="space-y-4 lg:hidden">
                {loadingLogs
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <Card key={i} className="border-border border dark:border-slate-700">
                        <CardContent className="space-y-3 p-4">
                          <Skeleton className="h-4 w-40" />
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-24" />
                        </CardContent>
                      </Card>
                    ))
                  : displayedLogs.map((log: SmsLog) => (
                      <Card key={log.id} className="border-border border dark:border-slate-700">
                        <CardContent className="p-4">
                          <div className="mb-3 flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedLogs.includes(log.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedLogs((prev) => [...prev, log.id]);
                                  } else {
                                    setSelectedLogs((prev) => prev.filter((id) => id !== log.id));
                                  }
                                }}
                              />
                              <div>
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {log.student?.name || 'N/A'}
                                </div>
                                <div className="text-muted-foreground text-sm dark:text-slate-400">
                                  ID: {log.student?.login_id || 'N/A'}
                                </div>
                              </div>
                            </div>
                            <Badge className={`text-white ${statusColors[log.status]}`}>
                              {statusLabels[log.status]}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                Class Info:
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {getStudentInfo(log.student)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                Phone:
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {log.phone_number}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                Date:
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {formatIsoToDisplayDate(log.attendance_date)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                SMS Count:
                              </span>
                              {log.sms_count ? (
                                <span className="font-semibold text-green-600 dark:text-green-400">
                                  {log.sms_count}
                                </span>
                              ) : (
                                <span className="text-muted-foreground dark:text-slate-400">
                                  N/A
                                </span>
                              )}
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                Retry Count:
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {log.retry_count}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground dark:text-slate-400">
                                Created:
                              </span>
                              <span className="text-slate-900 dark:text-white">
                                {formatIsoToDisplayDate(log.created_at)}
                              </span>
                            </div>
                            {log.message && (
                              <div className="pt-2">
                                <div className="text-muted-foreground mb-1 dark:text-slate-400">
                                  Message:
                                </div>
                                <div className="bg-muted rounded p-2 text-xs text-slate-900 dark:bg-slate-800 dark:text-white">
                                  {log.message}
                                </div>
                              </div>
                            )}
                            {log.error_reason && (
                              <div className="pt-2">
                                <div className="text-muted-foreground mb-1 dark:text-slate-400">
                                  Error:
                                </div>
                                <div className="rounded bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
                                  {log.error_reason}
                                </div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
              </div>

              {displayedLogs.length === 0 && !loadingLogs && (
                <div className="text-muted-foreground py-8 text-center dark:text-slate-400">
                  No SMS logs found matching the current filters.
                </div>
              )}

              {totalPages > 1 && (
                <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="w-full sm:w-auto"
                  >
                    Previous
                  </Button>

                  <span className="text-muted-foreground flex items-center px-3 py-2 dark:text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    className="w-full sm:w-auto"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

export default SmsManagement;
