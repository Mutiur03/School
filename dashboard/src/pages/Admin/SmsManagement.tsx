import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
} from "@/components/ui/alert-dialog";
import { toast } from "react-hot-toast";
import { Send, Trash2, Filter, Calendar, Settings, MessageSquare, CreditCard, Save, RefreshCw, Inbox } from "lucide-react";
import Loading from "@/components/Loading";
import { Textarea } from "@/components/ui/textarea";
import { formatDobForDateInput as toDateInputValue, calculateSMSCount, PHONE_NUMBER } from "@school/shared-schemas";
import { PageHeader, TabNav, SectionCard, StatsCard } from "@/components";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { TabItem } from "@/components";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation, useSearchParams } from "react-router-dom";

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
  status: "sent" | "failed" | "pending";
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
  balance?: number;
  credits?: number;
}

interface SmsSettings {
  present_template: string;
  absent_template: string;
  send_to_present: boolean;
  send_to_absent: boolean;
  is_active: boolean;
}

const EMPTY_SETTINGS: SmsSettings = {
  present_template: "",
  absent_template: "",
  send_to_present: false,
  send_to_absent: false,
  is_active: false,
};

const CORE_TOKENS = ["{student_name}"] as const;
const ELECTIVE_TOKENS = [
  { id: "{login_id}", label: "Login ID" },
  { id: "{date}", label: "Date" },
  { id: "{school_name}", label: "School Name" },
  { id: "{class}", label: "Class" },
  { id: "{section}", label: "Section" },
  { id: "{roll}", label: "Roll" },
] as const;

const normalizePhoneNumber = (value: string) => value.replace(/\s+/g, "");

const validateTemplate = (template: string, requiredPlaceholders: string[]) => {
  const allRequired = [...CORE_TOKENS, ...requiredPlaceholders];
  const missing = allRequired.filter((token) => !template.includes(token));
  
  const allPossibleElectives = ELECTIVE_TOKENS.map(t => t.id);
  const forbidden = allPossibleElectives.filter(token => !requiredPlaceholders.includes(token) && template.includes(token));

  return {
    missing,
    forbidden,
    isValid: template.trim().length > 0 && missing.length === 0 && forbidden.length === 0,
  };
};

function SmsManagement() {
  const formatIsoToDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"logs" | "settings">(
    tabParam === "settings" ? "settings" : "logs",
  );
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    date: formatIsoToDisplayDate(new Date().toISOString()),
    limit: 50,
  });

  const handleTabChange = (id: string) => {
    const next = id as "logs" | "settings";
    setActiveTab(next);
    setSearchParams({ tab: next }, { replace: true });
  };

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "settings" || tab === "logs") {
      setActiveTab(tab);
    } else {
      setActiveTab("logs");
      setSearchParams({ tab: "logs" }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Settings State
  const [testForm, setTestForm] = useState({ phoneNumber: "", message: "" });
  const [testErrors, setTestErrors] = useState<{ phoneNumber?: string; message?: string }>({});
  const [settingsErrors, setSettingsErrors] = useState<{ present_template?: string; absent_template?: string }>({});
  const [addBalanceAmount, setAddBalanceAmount] = useState<string>("");
  const queryClient = useQueryClient();
  const [settingsDraft, setSettingsDraft] = useState<SmsSettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [requiredPlaceholders, setRequiredPlaceholders] = useState<string[]>([]);

  const statusColors: Record<string, string> = {
    sent: "bg-green-500",
    failed: "bg-red-500",
    pending: "bg-yellow-500",
  };

  const statusLabels: Record<string, string> = {
    sent: "Sent",
    failed: "Failed",
    pending: "Pending",
  };

  const [estimates, setEstimates] = useState<{ [key: string]: { count: number; encoding: string; length: number } }>({});

  const generateTemplates = (placeholders: string[]) => {
    const getSms = (status: string) => {
      let optional = "";
      if (placeholders.includes("{login_id}")) optional += " (ID: {login_id})";
      if (placeholders.includes("{class}")) optional += ", Class: {class}";
      if (placeholders.includes("{section}")) optional += ", Section: {section}";
      if (placeholders.includes("{roll}")) optional += ", Roll: {roll}";
      
      const datePart = placeholders.includes("{date}") ? " today ({date})" : "";
      const schoolPart = placeholders.includes("{school_name}") ? "\nThank you.\n{school_name}" : "";
      
      return `Dear Parent,\nYour child {student_name}${optional} is ${status}${datePart}.${schoolPart}`;
    };

    setSettingsDraft(prev => ({
      ...(prev || EMPTY_SETTINGS),
      present_template: getSms("present"),
      absent_template: getSms("absent"),
    }));
    setSettingsDirty(true);
  };

  const calculateEstimate = useCallback((key: string, text: string) => {
    const raw = text ?? "";
    if (!raw.length) {
      setEstimates(prev => ({ ...prev, [key]: { count: 0, encoding: "None", length: 0 } }));
      return;
    }
    const result = calculateSMSCount(raw);
    setEstimates(prev => ({ ...prev, [key]: { count: result.count, encoding: result.encoding, length: result.length } }));
  }, []);

  const smsLogsQuery = useQuery<SmsLogsResponse>({
    queryKey: ["smsLogs", currentPage, filters.limit, filters.date],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: filters.limit.toString(),
        date: toDateInputValue(filters.date) || filters.date,
      });
      const response = await axios.get(`/api/sms/sms-logs?${params}`);
      return response.data;
    },
    enabled: activeTab === "logs",
    placeholderData: (prev) => prev,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 60000,
  });

  const smsUsageQuery = useQuery({
    queryKey: ["smsUsage"],
    queryFn: async () => {
      const response = await axios.get("/api/sms/usage-stats?days=30");
      return response.data;
    },
    enabled: activeTab === "logs",
  });

  const smsSettingsQuery = useQuery<SmsSettings>({
    queryKey: ["smsSettings"],
    queryFn: async () => {
      const response = await axios.get("/api/sms-settings");
      return response.data.data;
    },
    enabled: activeTab === "settings",
  });

  const smsBalanceQuery = useQuery<SmsBalance>({
    queryKey: ["smsBalance"],
    queryFn: async () => {
      const response = await axios.get("/api/sms-settings/balance");
      return response.data.data;
    },
    enabled: activeTab === "settings",
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 60000,
  });

  const settingsMutation = useMutation({
    mutationFn: async (payload: { settings: SmsSettings; requiredPlaceholders: string[] }) => {
      await axios.patch("/api/sms-settings", {
        ...payload.settings,
        requiredPlaceholders: payload.requiredPlaceholders,
      });
    },
    onSuccess: () => {
      toast.success("SMS settings updated successfully");
      queryClient.invalidateQueries({ queryKey: ["smsSettings"] });
      setSettingsDirty(false);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || "Failed to update SMS settings";
      toast.error(errorMessage);
    },
  });

  const addBalanceMutation = useMutation({
    mutationFn: async (amount: number) => {
      await axios.post("/api/sms-settings/add-balance", { amount });
    },
    onSuccess: (_, amount) => {
      toast.success(`${amount} credits added successfully`);
      setAddBalanceAmount("");
      queryClient.invalidateQueries({ queryKey: ["smsBalance"] });
    },
    onError: () => {
      toast.error("Failed to add SMS balance");
    },
  });

  const testSmsMutation = useMutation({
    mutationFn: async (payload: { phoneNumber: string; message: string }) => {
      await axios.post("/api/sms-settings/test", payload);
    },
    onSuccess: () => {
      toast.success("Test SMS sent successfully");
      setTestForm((prev) => ({ ...prev, message: "" }));
      setTestErrors({});
      queryClient.invalidateQueries({ queryKey: ["smsBalance"] });
      queryClient.invalidateQueries({ queryKey: ["smsUsage"] });
    },
    onError: () => {
      toast.error("Failed to send test SMS");
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (smsLogIds: number[]) => {
      const response = await axios.post("/api/sms/retry-sms", { smsLogIds });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedLogs([]);
      queryClient.invalidateQueries({ queryKey: ["smsLogs"] });
      queryClient.invalidateQueries({ queryKey: ["smsBalance"] });
      queryClient.invalidateQueries({ queryKey: ["smsUsage"] });
    },
    onError: () => {
      toast.error("Failed to retry SMS messages");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (smsLogIds: number[]) => {
      const response = await axios.delete("/api/sms/sms-logs", { data: { smsLogIds } });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setSelectedLogs([]);
      queryClient.invalidateQueries({ queryKey: ["smsLogs"] });
    },
    onError: () => {
      toast.error("Failed to delete SMS logs");
    },
  });

  useEffect(() => {
    if (smsLogsQuery.isError) toast.error("Failed to fetch SMS logs");
  }, [smsLogsQuery.isError]);

  useEffect(() => {
    if (smsSettingsQuery.isError) toast.error("Failed to fetch SMS settings");
  }, [smsSettingsQuery.isError]);

  useEffect(() => {
    if (smsBalanceQuery.isError) toast.error("Failed to fetch SMS balance");
  }, [smsBalanceQuery.isError]);

  useEffect(() => {
    if (smsSettingsQuery.data && !settingsDirty) {
      setSettingsDraft(smsSettingsQuery.data);
      
      // Sync elective placeholders from existing templates
      const templates = (smsSettingsQuery.data.present_template || "") + (smsSettingsQuery.data.absent_template || "");
      const initial = ELECTIVE_TOKENS
        .map(t => t.id)
        .filter(token => templates.includes(token));
      setRequiredPlaceholders(initial);
    }
  }, [smsSettingsQuery.data, settingsDirty]);

  useEffect(() => {
    if (activeTab === "settings" && smsSettingsQuery.data) {
      calculateEstimate("present", smsSettingsQuery.data.present_template || "");
      calculateEstimate("absent", smsSettingsQuery.data.absent_template || "");
    }
  }, [activeTab, smsSettingsQuery.data, calculateEstimate]);

  useEffect(() => {
    calculateEstimate("test", testForm.message || "");
  }, [testForm.message, calculateEstimate]);

  const handleAddBalance = async () => {
    const amount = parseInt(addBalanceAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    addBalanceMutation.mutate(amount);
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDraft) return;

    const presentValidation = validateTemplate(settingsDraft.present_template || "", requiredPlaceholders);
    const absentValidation = validateTemplate(settingsDraft.absent_template || "", requiredPlaceholders);
    const nextErrors: { present_template?: string; absent_template?: string } = {};

    if (settingsDraft.is_active && settingsDraft.send_to_present && !presentValidation.isValid) {
      const parts = [];
      if (presentValidation.missing.length > 0) parts.push(`missing mandatory ${presentValidation.missing.join(", ")}`);
      if (presentValidation.forbidden.length > 0) parts.push(`contains forbidden ${presentValidation.forbidden.join(", ")}`);
      nextErrors.present_template = `Present template ${parts.join(" and ")}.`;
    }

    if (settingsDraft.is_active && settingsDraft.send_to_absent && !absentValidation.isValid) {
      const parts = [];
      if (absentValidation.missing.length > 0) parts.push(`missing mandatory ${absentValidation.missing.join(", ")}`);
      if (absentValidation.forbidden.length > 0) parts.push(`contains forbidden ${absentValidation.forbidden.join(", ")}`);
      nextErrors.absent_template = `Absent template ${parts.join(" and ")}.`;
    }

    setSettingsErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      // toast.error("Please fix template validation errors before saving.");
      return;
    }

    settingsMutation.mutate({
      settings: settingsDraft,
      requiredPlaceholders
    });
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = normalizePhoneNumber(testForm.phoneNumber);
    const message = testForm.message.trim();
    const nextErrors: { phoneNumber?: string; message?: string } = {};

    if (!phone) {
      nextErrors.phoneNumber = "Phone number is required.";
    } else if (!PHONE_NUMBER.test(phone)) {
      nextErrors.phoneNumber = "Phone must be 11 digits and start with 01.";
    }

    if (!message) {
      nextErrors.message = "Message is required.";
    }

    setTestErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      toast.error("Please fix the test SMS form errors.");
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
    if (filters.status === "all") return smsLogs;
    return smsLogs.filter((log: SmsLog) => log.status === filters.status);
  }, [smsLogs, filters.status]);

  const totalSms = (stats.sent || 0) + (stats.failed || 0) + (stats.pending || 0);

  const handleRetrySelected = async (): Promise<void> => {
    if (selectedLogs.length === 0) {
      toast.error("Please select SMS logs to retry");
      return;
    }

    const failedLogs: SmsLog[] = smsLogs.filter(
      (log) => selectedLogs.includes(log.id) && (log.status === "failed" || log.status === "pending")
    );

    if (failedLogs.length === 0) {
      toast.error("Please select only failed SMS logs for retry");
      return;
    }

    retryMutation.mutate(failedLogs.map((log) => log.id));
  };

  const handleDeleteSelected = async (): Promise<void> => {
    if (selectedLogs.length === 0) {
      toast.error("Please select SMS logs to delete");
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
      return "N/A";
    }
    const enrollment = student.enrollments[0];
    return `Class ${enrollment.class}, Section ${enrollment.section}, Roll ${enrollment.roll}`;
  };

  const tabs: TabItem[] = [
    {
      id: "logs",
      label: "Delivery Logs",
      icon: <Inbox size={16} />,
      href: `${location.pathname}?tab=logs`,
    },
    {
      id: "settings",
      label: "SMS Settings",
      icon: <Settings size={16} />,
      href: `${location.pathname}?tab=settings`,
    },
  ];

  // if (loadingLogs && smsLogs.length === 0) {
  //   return <Loading />;
  // }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      <PageHeader
        title="SMS Management"
        description="Track delivery logs, test SMS delivery, and configure attendance notifications."
      />

      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        className="mb-6"
      />

      {activeTab === "settings" ? (
        <div className="space-y-6">
          {(settingsError || balanceError) && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
              Unable to load SMS settings or balance. Please refresh.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SectionCard
              title="Account Balance"
              icon={<CreditCard className="w-5 h-5 text-primary" />}
              className="lg:col-span-1"
            >
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-border">
                  <div className="text-sm text-muted-foreground mb-1">Available Credits</div>
                  <div className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {balanceLoading ? (
                      <Skeleton className="h-8 w-24" />
                    ) : (
                      balance?.credits ?? balance?.balance ?? "..."
                    )}
                    <button
                      onClick={() => queryClient.invalidateQueries({ queryKey: ["smsBalance"] })}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                      disabled={balanceLoading}
                    >
                      <RefreshCw className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Internal Database Balance
                </div>

                <div className="pt-4 border-t border-border space-y-3">
                  <Label htmlFor="add_credits">Add Credits</Label>
                  <div className="flex gap-2">
                    <Input
                      id="add_credits"
                      type="number"
                      placeholder="Amount"
                      value={addBalanceAmount}
                      onChange={(e) => setAddBalanceAmount(e.target.value)}
                      disabled={balanceLoading}
                    />
                    <Button
                      onClick={handleAddBalance}
                      disabled={addBalanceMutation.isPending || !addBalanceAmount || balanceLoading}
                      variant="outline"
                      size="lg"
                    >
                      {addBalanceMutation.isPending ? "..." : "Add"}
                    </Button>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Test SMS Delivery"
              icon={<Send className="w-5 h-5 text-primary" />}
              className="lg:col-span-2"
            >
              <form onSubmit={handleSendTestSms} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      <div className="text-[10px] font-medium text-primary mt-1">
                        Est: <span className="font-bold">{estimates.test.count}</span> credit{estimates.test.count !== 1 ? "s" : ""} ({estimates.test.encoding}) {estimates.test.length} chars
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit" disabled={testSmsMutation.isPending || settingsLoading} className="w-full sm:w-auto">
                  {testSmsMutation.isPending ? "Sending..." : "Send Test SMS"}
                </Button>
              </form>
            </SectionCard>
          </div>

          <SectionCard
            title="Notification Templates & Rules"
            icon={<Settings className="w-5 h-5 text-primary" />}
          >
            {settingsLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4 p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center text-green-600">
                          <MessageSquare className="w-4 h-4" />
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
                              setSettingsErrors((prev) => ({ ...prev, present_template: undefined }));
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
                          calculateEstimate("present", nextValue);
                          if (settingsErrors.present_template) {
                            const validation = validateTemplate(nextValue, requiredPlaceholders);
                            if (validation.isValid) {
                              setSettingsErrors((prev) => ({ ...prev, present_template: undefined }));
                            }
                          }
                        }}
                      />
                      {settingsErrors.present_template && (
                        <p className="text-xs text-red-500">{settingsErrors.present_template}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
                          <span className="font-semibold text-red-500">Mandatory:</span>
                          <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{"{student_name}"}</code>
                          {requiredPlaceholders.map(p => (
                            <code key={p} className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{p}</code>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">Forbidden:</span>
                          {ELECTIVE_TOKENS.filter(t => !requiredPlaceholders.includes(t.id)).map(t => (
                            <code key={t.id} className="bg-slate-100 dark:bg-slate-900 px-1 rounded opacity-60 italic line-through">{t.id}</code>
                          ))}
                        </div>
                        {estimates.present && (
                          <div className="text-[10px] font-medium text-primary">
                            Est: <span className="font-bold">{estimates.present.count}</span> credit{estimates.present.count !== 1 ? 's' : ''} ({estimates.present.encoding})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-semibold">
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center text-red-600">
                          <MessageSquare className="w-4 h-4" />
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
                              setSettingsErrors((prev) => ({ ...prev, absent_template: undefined }));
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
                          calculateEstimate("absent", nextValue);
                          if (settingsErrors.absent_template) {
                            const validation = validateTemplate(nextValue, requiredPlaceholders);
                            if (validation.isValid) {
                              setSettingsErrors((prev) => ({ ...prev, absent_template: undefined }));
                            }
                          }
                        }}
                      />
                      {settingsErrors.absent_template && (
                        <p className="text-xs text-red-500">{settingsErrors.absent_template}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
                          <span className="font-semibold text-red-500">Mandatory:</span>
                          <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{"{student_name}"}</code>
                          {requiredPlaceholders.map(p => (
                            <code key={p} className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{p}</code>
                          ))}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-2">
                          <span className="font-semibold text-slate-500 dark:text-slate-400">Forbidden:</span>
                          {ELECTIVE_TOKENS.filter(t => !requiredPlaceholders.includes(t.id)).map(t => (
                            <code key={t.id} className="bg-slate-100 dark:bg-slate-900 px-1 rounded opacity-60 italic line-through">{t.id}</code>
                          ))}
                        </div>
                        {estimates.absent && (
                          <div className="text-[10px] font-medium text-primary">
                            Est: <span className="font-bold">{estimates.absent.count}</span> credit{estimates.absent.count !== 1 ? 's' : ''} ({estimates.absent.encoding})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="space-y-4">
                    <Label className="text-sm font-semibold">Required Placeholders</Label>
                    <div className="flex flex-wrap gap-x-6 gap-y-3 p-4 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-border">
                       <div className="flex items-center gap-2 opacity-50 cursor-not-allowed">
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
                                : requiredPlaceholders.filter(p => p !== token.id);
                              setRequiredPlaceholders(next);
                              generateTemplates(next);
                            }}
                          />
                          <Label htmlFor={`req_${token.id}`} className="text-sm cursor-pointer">{token.label}</Label>
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
                    <Save className="w-4 h-4 mr-2" />
                    {settingsMutation.isPending ? "Saving..." : "Save Configuration"}
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
      ) : (
        <>
          {logsError && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
              Unable to load SMS logs. Please refresh.
            </div>
          )}

          <SectionCard
            title="Daily Credit Usage (Last 30 Days)"
            icon={<RefreshCw className="w-5 h-5 text-primary" />}
          >
            <div className="h-[250px] w-full pt-4">
              {smsUsageQuery.isLoading ? (
                <div className="h-full w-full flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={smsUsageQuery.data?.stats || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => {
                        const d = new Date(val);
                        return d.getDate().toString().padStart(2, "0") + "/" + (d.getMonth() + 1).toString().padStart(2, "0");
                      }}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const date = new Date(payload[0].payload.date).toLocaleDateString("en-GB");
                          return (
                            <div className="bg-white dark:bg-slate-900 border border-border p-2 rounded-lg shadow-xl text-xs">
                              <div className="font-bold border-b pb-1 mb-1">{date}</div>
                              <div className="text-primary flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-primary" />
                                Usage: {payload[0].value} Credits
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--primary)"
                      radius={[4, 4, 0, 0]}
                      barSize={20}
                    >
                      {smsUsageQuery.data?.stats?.map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                          fillOpacity={entry.count > 0 ? 1 : 0.2}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              label="Total SMS"
              value={totalSms}
              color="default"
              icon={<MessageSquare className="w-5 h-5" />}
              loading={false}
            />
            <StatsCard
              label="Sent"
              value={stats.sent || 0}
              color="emerald"
              icon={<Send className="w-5 h-5" />}
              loading={false}
            />
            <StatsCard
              label="Failed"
              value={stats.failed || 0}
              color="red"
              icon={<Trash2 className="w-5 h-5" />}
              loading={false}
            />
            <StatsCard
              label="Pending"
              value={stats.pending || 0}
              color="amber"
              icon={<RefreshCw className="w-5 h-5" />}
              loading={false}
            />
          </div>

          <SectionCard title="Filters & Actions" icon={<Filter className="w-5 h-5" />}>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label
                    htmlFor="status-filter"
                    className="text-muted-foreground dark:text-slate-400"
                  >
                    Status
                  </Label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => handleFilterChange("status", value)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label
                    htmlFor="date-filter"
                    className="text-muted-foreground dark:text-slate-400"
                  >
                    Date
                  </Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      id="date-filter"
                      type="date"
                      value={toDateInputValue(filters.date)}
                      onChange={(e) => {
                        handleFilterChange(
                          "date",
                          formatIsoToDisplayDate(e.target.value)
                        );
                      }}
                      className="w-full pl-10 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-inner-spin-button]:hidden [&::-webkit-clear-button]:hidden"
                    />
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="limit-filter"
                    className="text-muted-foreground dark:text-slate-400"
                  >
                    Per Page
                  </Label>
                  <Select
                    value={filters.limit.toString()}
                    onValueChange={(value) =>
                      handleFilterChange("limit", parseInt(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  onClick={handleRetrySelected}
                  disabled={retryMutation.isPending || selectedLogs.length === 0}
                  className="bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 flex-1 sm:flex-initial"
                >
                  <Send className="w-4 h-4 mr-2" />
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
                      <Trash2 className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">Delete Selected</span>
                      <span className="sm:hidden">
                        Delete ({selectedLogs.length})
                      </span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete SMS Logs</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete {selectedLogs.length}{" "}
                        selected SMS log(s)? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteSelected}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="SMS Logs"
            icon={<Inbox className="w-5 h-5" />}
            headerAction={
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    selectedLogs.length === displayedLogs.length &&
                    displayedLogs.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground dark:text-slate-400 hidden sm:inline">
                  Select All
                </span>
              </div>
            }
            noPadding
          >
            <div className="p-6">
              <div className="hidden lg:block overflow-x-auto">
                {loadingLogs ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="grid grid-cols-11 gap-3 items-center">
                        {Array.from({ length: 11 }).map((__, j) => (
                          <Skeleton key={j} className="h-4 w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border dark:border-slate-700">
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          <Checkbox
                            checked={
                              selectedLogs.length === displayedLogs.length &&
                              displayedLogs.length > 0
                            }
                            onCheckedChange={handleSelectAll}
                          />
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Student
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Class Info
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Phone
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Date
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Status
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          SMS count
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Retry Count
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Message
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Error
                        </th>
                        <th className="text-left p-3 text-muted-foreground dark:text-slate-400 font-medium">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLogs.map((log: SmsLog) => (
                        <tr
                          key={log.id}
                          className="border-b border-border dark:border-slate-700 hover:bg-muted/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white transition-colors group"
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selectedLogs.includes(log.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLogs((prev) => [...prev, log.id]);
                                } else {
                                  setSelectedLogs((prev) =>
                                    prev.filter((id) => id !== log.id)
                                  );
                                }
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                                {log.student?.name || "N/A"}
                              </div>
                              <div className="text-sm text-muted-foreground dark:text-slate-400 group-hover:text-muted-foreground dark:group-hover:text-slate-400">
                                ID: {log.student?.login_id || "N/A"}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground dark:text-slate-400 group-hover:text-muted-foreground dark:group-hover:text-slate-400">
                            {getStudentInfo(log.student)}
                          </td>
                          <td className="p-3 text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                            {log.phone_number}
                          </td>
                          <td className="p-3 text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                            {formatIsoToDisplayDate(log.attendance_date)}
                          </td>
                          <td className="p-3">
                            <Badge
                              className={`text-white ${statusColors[log.status]}`}
                            >
                              {statusLabels[log.status]}
                            </Badge>
                          </td>
                          <td className="p-3">
                            {log.sms_count ? (
                              <div className="font-semibold text-sm bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 px-2 py-1 rounded border border-green-200 dark:border-green-800">
                                {log.sms_count}
                              </div>
                            ) : (
                              <span className="text-muted-foreground dark:text-slate-400 group-hover:text-muted-foreground dark:group-hover:text-slate-400">
                                N/A
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white">
                            {log.retry_count}
                          </td>
                          <td className="p-3 max-w-xs">
                            <div
                              className="truncate text-slate-900 dark:text-white group-hover:text-slate-900 dark:group-hover:text-white"
                              title={log.message}
                            >
                              {log.message}
                            </div>
                          </td>
                          <td className="p-3 max-w-xs">
                            {log.error_reason && (
                              <div
                                className="text-red-600 dark:text-red-400 group-hover:text-red-600 dark:group-hover:text-red-400 text-sm truncate"
                                title={log.error_reason}
                              >
                                {log.error_reason}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground dark:text-slate-400 group-hover:text-muted-foreground dark:group-hover:text-slate-400">
                            {formatIsoToDisplayDate(log.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="lg:hidden space-y-4">
                {loadingLogs ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="border border-border dark:border-slate-700">
                      <CardContent className="p-4 space-y-3">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-24" />
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  displayedLogs.map((log: SmsLog) => (
                    <Card
                      key={log.id}
                      className="border border-border dark:border-slate-700"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={selectedLogs.includes(log.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLogs((prev) => [...prev, log.id]);
                                } else {
                                  setSelectedLogs((prev) =>
                                    prev.filter((id) => id !== log.id)
                                  );
                                }
                              }}
                            />
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {log.student?.name || "N/A"}
                              </div>
                              <div className="text-sm text-muted-foreground dark:text-slate-400">
                                ID: {log.student?.login_id || "N/A"}
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
                              <div className="text-muted-foreground dark:text-slate-400 mb-1">
                                Message:
                              </div>
                              <div className="text-slate-900 dark:text-white text-xs bg-muted dark:bg-slate-800 p-2 rounded">
                                {log.message}
                              </div>
                            </div>
                          )}
                          {log.error_reason && (
                            <div className="pt-2">
                              <div className="text-muted-foreground dark:text-slate-400 mb-1">
                                Error:
                              </div>
                              <div className="text-red-600 dark:text-red-400 text-xs bg-red-50 dark:bg-red-950/20 p-2 rounded">
                                {log.error_reason}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {displayedLogs.length === 0 && !loadingLogs && (
                <div className="text-center py-8 text-muted-foreground dark:text-slate-400">
                  No SMS logs found matching the current filters.
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row justify-center items-center mt-6 gap-2">
                  <Button
                    variant="outline"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    className="w-full sm:w-auto"
                  >
                    Previous
                  </Button>

                  <span className="flex items-center px-3 py-2 text-muted-foreground dark:text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                    }
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
