import { useState, useEffect, useMemo, useDeferredValue, useCallback } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams, useLocation } from "react-router-dom";
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
} from "lucide-react";
import { toast } from "react-hot-toast";
import { getFileUrl } from "@/lib/backend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { PageHeader, TabNav, StatsCard, StatusBadge, SectionCard, Popup } from "@/components";
import type { TabItem } from "@/components";
import DeleteConfirmation from "@/components/DeleteConfimation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import ActionButton from "@/components/ActionButton";
import { formatDateWithTime } from "@/lib/utils";
import type { Class9RegistrationRecord, Class9RegistrationSettingsData } from "@school/shared-schemas";
import { class9RegistrationSettingsSchema } from "@school/shared-schemas";

/** Full DB record as returned by the admin API — all server-managed fields are non-nullable here. */
type Registration = Omit<Class9RegistrationRecord, "ssc_batch" | "birth_date" | "created_at" | "status"> & {
    ssc_batch: string;
    birth_date: string;
    created_at: string;
    status: string;
};

const Class9RegForm = () => {
    const queryClient = useQueryClient();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const [activeTab, setActiveTab] = useState<"registrations" | "settings">(
        tabParam === "settings" ? "settings" : "registrations"
    );

    const handleTabChange = (id: string) => {
        const next = id as "registrations" | "settings";
        setActiveTab(next);
        setSearchParams({ tab: next }, { replace: true });
    };

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab === "settings" || tab === "registrations") {
            setActiveTab(tab);
        } else {
            setActiveTab("registrations");
            setSearchParams({ tab: "registrations" }, { replace: true });
        }
    }, [searchParams, setSearchParams]);

    const [selectedNotice, setSelectedNotice] = useState<File | null>(null);
    const [filters, setFilters] = useState({
        status: "all",
        section: "",
        year: new Date().getFullYear().toString(),
        search: ""
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
        formState: { errors, isDirty }
    } = useForm<Class9RegistrationSettingsData>({
        resolver: zodResolver(class9RegistrationSettingsSchema),
        defaultValues: {
            a_sec_roll: "",
            b_sec_roll: "",
            ssc_year: new Date().getFullYear().toString(),
            reg_open: false,
            instruction_for_a: "",
            instruction_for_b: "",
            attachment_instruction: "",
            notice_key: null,
            classmates: "",
            classmates_source: "default"
        }
    });

    const settingsForm = watch();

    const { data: settingsData, isLoading: settingsLoading } = useQuery({
        queryKey: ["class9RegSettings"],
        queryFn: async () => {
            const res = await axios.get(`/api/reg/class-9`);
            return res.data.success ? res.data.data : null;
        },
    });

    useEffect(() => {
        if (settingsData) {
            const formData = {
                ...settingsData,
                ssc_year: settingsData.ssc_year || "",
                notice_key: settingsData.notice,
            };
            reset(formData);
        }
    }, [settingsData, reset]);

    const { data: registrationsResponse, isLoading: registrationsLoading, error: registrationsError } = useQuery({
        queryKey: ["class9Registrations", { page, limit, ...deferredFilters }],
        queryFn: async () => {
            const res = await axios.get(`/api/reg/class-9/form`, {
                params: {
                    page,
                    limit,
                    ssc_batch: deferredFilters.year,
                    status: deferredFilters.status,
                    section: deferredFilters.section,
                    search: deferredFilters.search.trim() || undefined
                }
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
        ? ((registrationsError as any).response?.status === 404
            ? "No registrations found."
            : "An error occurred while fetching registrations.")
        : "";

    // Reset page when filters change
    useEffect(() => {
        setPage(1);
    }, [deferredFilters]);

    const stats = useMemo(() => {
        const filteredData: Registration[] = registrations || [];
        return {
            total: {
                filtered: filteredData.length,
                all: meta?.total ?? 0,
            },
            pending: {
                filtered: filteredData.filter((r: Registration) => r.status === "pending").length,
                all: 0,
            },
            approved: {
                filtered: filteredData.filter((r: Registration) => r.status === "approved").length,
                all: 0,
            }
        };
    }, [registrations, meta]);

    const renderCount = (filtered: number, total: number) => {
        if (filtered === total) return total;
        return `${filtered} / ${total}`;
    };

    useEffect(() => {
        if (settingsData?.ssc_year) {
            setFilters(prev => ({ ...prev, year: settingsData.ssc_year.toString() }));
        }
    }, [settingsData?.ssc_year]);

    const settingsMutation = useMutation({
        mutationFn: async (updatedSettings: Class9RegistrationSettingsData) => {
            let notice_key = updatedSettings.notice_key;

            if (selectedNotice) {
                const { data: urlData } = await axios.post(`/api/reg/class-9/upload-url`, {
                    filename: selectedNotice.name,
                    filetype: selectedNotice.type
                });

                if (urlData.success) {
                    await axios.put(urlData.data.uploadUrl, selectedNotice, {
                        headers: { "Content-Type": selectedNotice.type }
                    });
                    notice_key = urlData.data.key;
                }
            }

            const payload = {
                ...updatedSettings,
                notice_key,
                reg_open: typeof updatedSettings.reg_open === "boolean" ? updatedSettings.reg_open.toString() : updatedSettings.reg_open
            };

            const res = await axios.post(`/api/reg/class-9`, payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Settings updated successfully");
            queryClient.invalidateQueries({ queryKey: ["class9RegSettings"] });
            setSelectedNotice(null);
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = "";
        },
        onError: () => {
            toast.error("Failed to update settings");
        }
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const res = await axios.put(`/api/reg/class-9/form/${id}/status`, { status });
            return res.data;
        },
        onSuccess: (_, variables) => {
            toast.success(`Registration ${variables.status}`);
            queryClient.invalidateQueries({ queryKey: ["class9Registrations"] });
        },
        onError: () => {
            toast.error("Failed to update status");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await axios.delete(`/api/reg/class-9/form/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Registration deleted");
            queryClient.invalidateQueries({ queryKey: ["class9Registrations"] });
            setShowDetails(false);
        },
        onError: () => {
            toast.error("Failed to delete registration");
        }
    });

    const handleSettingsSubmit = handleSubmit((data) => {
        settingsMutation.mutate(data);
    });

    const handleStatusUpdate = useCallback((id: string, status: string) => {
        statusMutation.mutate({ id, status });
    }, [statusMutation]);

    const handleDeleteDetails = useCallback((id: string) => {
        if (confirm("Are you sure you want to delete this registration?")) {
            deleteMutation.mutate(id);
        }
    }, [deleteMutation]);

    const handlePreviewPDF = useCallback((id: string) => {
        const previewUrl = `/preview/class9/${id}`;
        window.open(previewUrl, "_blank", "noopener,noreferrer");
    }, []);

    const handleExport = useCallback(async (type: "sheet" | "photos") => {
        const { status, section, year } = filters;
        const endpoint = type === "sheet" ? "export" : "export-photos";
        const url = `/api/reg/class-9/form/${endpoint}?status=${status}&section=${section}&ssc_batch=${year}`;

        try {
            toast.loading(`Preparing ${type}...`, { id: "export" });
            const res = await axios.get(url, { responseType: "blob" });
            const extension = type === "sheet" ? "xlsx" : "zip";
            const blob = new Blob([res.data]);
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `Class_9_${type}_${year}${section ? `_${section}` : ""}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`, { id: "export" });
        } catch (error) {
            console.error(`Export ${type} error:`, error);
            toast.error(`Failed to export ${type}`, { id: "export" });
        }
    }, [filters]);

    const handleFilterChange = useCallback((key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const tabs: TabItem[] = [
        { id: "registrations", label: "Registrations", icon: <Users size={16} />, href: `${location.pathname}?tab=registrations` },
        { id: "settings", label: "Settings", icon: <Settings size={16} />, href: `${location.pathname}?tab=settings` },
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <PageHeader
                title="Class 9 Registration Management"
                description="Manage student registrations and notification settings for Class 9."
            />

            <TabNav
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                className="mb-6"
            />

            {activeTab === "settings" ? (
                <SectionCard
                    title="Registration Settings"
                    icon={<Settings size={20} />}
                >
                    {settingsLoading ? (
                        <div className="py-20 flex justify-center">
                            <Loader2 size={40} className="animate-spin text-primary" />
                        </div>
                    ) : (
                        <form onSubmit={handleSettingsSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Section A Roll Range (e.g., 01-50)</label>
                                    <Input
                                        type="text"
                                        {...register("a_sec_roll")}
                                        placeholder="01-50"
                                    />
                                    {errors.a_sec_roll && <p className="text-xs text-red-500 mt-1">{errors.a_sec_roll.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Section B Roll Range</label>
                                    <Input
                                        type="text"
                                        {...register("b_sec_roll")}
                                        placeholder="51-100"
                                    />
                                    {errors.b_sec_roll && <p className="text-xs text-red-500 mt-1">{errors.b_sec_roll.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">SSC Batch</label>
                                    <Input
                                        type="text"
                                        {...register("ssc_year")}
                                    />
                                    {errors.ssc_year && <p className="text-xs text-red-500 mt-1">{errors.ssc_year.message}</p>}
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-muted/40 rounded-lg w-full">
                                        <input
                                            type="checkbox"
                                            {...register("reg_open")}
                                            className="w-4 h-4 text-primary"
                                        />
                                        <span className="text-sm font-medium">Registration Open</span>
                                    </label>
                                    {errors.reg_open && <p className="text-xs text-red-500 mt-1">{errors.reg_open.message}</p>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-1">Notice File (PDF)</label>
                                <div className="mt-1 flex items-center gap-4">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setSelectedNotice(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {settingsForm.notice_key && (
                                        <a
                                            href={getFileUrl(settingsForm.notice_key)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline flex items-center gap-1 text-sm font-medium shrink-0"
                                        >
                                            <FileText size={16} /> Current Notice
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Instruction for Section A</label>
                                    <Textarea
                                        {...register("instruction_for_a")}
                                        className="h-24"
                                    />
                                    {errors.instruction_for_a && <p className="text-xs text-red-500 mt-1">{errors.instruction_for_a.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Instruction for Section B</label>
                                    <Textarea
                                        {...register("instruction_for_b")}
                                        className="h-24"
                                    />
                                    {errors.instruction_for_b && <p className="text-xs text-red-500 mt-1">{errors.instruction_for_b.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Classmates List Source</label>
                                    <select
                                        {...register("classmates_source")}
                                        className="block w-full border rounded-md px-3 py-2 text-sm bg-card border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    >
                                        <option value="default">Default (Current Student List)</option>
                                        <option value="custom">Manual (Custom List)</option>
                                    </select>
                                    {errors.classmates_source && <p className="text-xs text-red-500 mt-1">{errors.classmates_source.message}</p>}
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {settingsForm.classmates_source === "custom"
                                            ? "Enter your own student names."
                                            : "Automatically uses names from the Class 10 enrollment list."}
                                    </p>
                                </div>
                                {settingsForm.classmates_source === "custom" && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Manual Classmates List</label>
                                        <Textarea
                                            {...register("classmates")}
                                            placeholder="Enter student names separated by commas (e.g., আব্দুল করিম, রহিম উদ্দিন, সালমা খাতুন)"
                                            className="h-24"
                                        />
                                        {errors.classmates && <p className="text-xs text-red-500 mt-1">{errors.classmates.message}</p>}
                                        <p className="text-xs text-muted-foreground mt-1">Students will be able to select from this list in the registration form's nearby student field.</p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Attachment Instructions</label>
                                    <Textarea
                                        {...register("attachment_instruction")}
                                        className="h-24"
                                    />
                                    {errors.attachment_instruction && <p className="text-xs text-red-500 mt-1">{errors.attachment_instruction.message}</p>}
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={settingsMutation.isPending || (!isDirty && !selectedNotice)}
                                    className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                                >
                                    {settingsMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    Save Settings
                                </button>
                            </div>
                        </form>
                    )}
                </SectionCard>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatsCard
                            label="Total Registrations"
                            value={renderCount(stats.total.filtered, stats.total.all)}
                            loading={registrationsLoading}
                        />
                        <StatsCard
                            label="Pending"
                            value={renderCount(stats.pending.filtered, stats.pending.all)}
                            color="amber"
                            loading={registrationsLoading}
                        />
                        <StatsCard
                            label="Approved"
                            value={renderCount(stats.approved.filtered, stats.approved.all)}
                            color="emerald"
                            loading={registrationsLoading}
                        />
                    </div>

                    <SectionCard>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-60">
                                <label className="block text-sm font-medium mb-1">Search</label>
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                    <Input
                                        type="text"
                                        value={filters.search}
                                        onChange={(e) => handleFilterChange("search", e.target.value)}
                                        placeholder="Search by name, roll, birth reg..."
                                        className="pl-10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => handleFilterChange("status", e.target.value)}
                                    className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                >
                                    <option value="all">All Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Section</label>
                                <select
                                    value={filters.section}
                                    onChange={(e) => handleFilterChange("section", e.target.value)}
                                    className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                >
                                    <option value="">All Sections</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">SSC Batch</label>
                                <select
                                    value={filters.year}
                                    onChange={(e) => handleFilterChange("year", e.target.value)}
                                    className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                >
                                    {(() => {
                                        const currentBatchYear = Number(settingsData?.ssc_year || settingsData?.ssc_batch || new Date().getFullYear());
                                        const years = [];
                                        // Current and previous 5 batches (total 6 years)
                                        for (let i = 0; i < 6; i++) {
                                            years.push(currentBatchYear - i);
                                        }

                                        const settingsYearValue = Number(settingsForm.ssc_year);
                                        if (settingsForm.ssc_year && !isNaN(settingsYearValue) && !years.includes(settingsYearValue)) {
                                            years.push(settingsYearValue);
                                            years.sort((a, b) => b - a);
                                        }
                                        return years.map(y => (
                                            <option key={y} value={y.toString()}>{y}</option>
                                        ));
                                    })()}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleExport("sheet")}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    <FileText size={18} />
                                    <span>Export Sheet</span>
                                </button>
                                <button
                                    onClick={() => handleExport("photos")}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                                >
                                    <ImageIcon size={18} />
                                    <span>Export Photos</span>
                                </button>
                            </div>
                        </div>
                    </SectionCard>

                    <SectionCard noPadding className="mb-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted border-b border-border">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Student</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-foreground/70 uppercase tracking-wider">Section</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-foreground/70 uppercase tracking-wider">Roll</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-foreground/70 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-foreground/70 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {registrationsLoading ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center">
                                                <div className="flex flex-col justify-center items-center gap-2">
                                                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                                                    <p className="text-sm text-muted-foreground dark:text-gray-400">Loading registrations...</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : registrations.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-muted-foreground">
                                                {errorMessage || "No registrations found"}
                                            </td>
                                        </tr>
                                    ) : (
                                        registrations.map((reg: Registration) => (
                                            <tr key={reg.id} className="hover:bg-muted/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {reg.photo_path ? (
                                                            <img src={getFileUrl(reg.photo_path)} className="w-10 h-10 rounded-full object-cover  border border-border" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Users size={18} /></div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium text-foreground">
                                                                {reg.student_name_en}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">
                                                                {reg.student_name_bn}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                                                        {reg.section || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-medium text-muted-foreground">
                                                    {reg.roll || "-"}
                                                </td>
                                                <td className="px-6 py-4"><StatusBadge status={reg.status} /></td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">
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
                    </SectionCard>

                    <SectionCard className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="text-sm text-muted-foreground">
                                Page {meta?.page ?? page} of {meta?.totalPages ?? 0}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-muted-foreground">Rows</span>
                                    <select
                                        className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
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
                                                variant={i + 1 === currentPage ? "default" : "outline"}
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
                                    let end = Math.min(totalPages, start + maxVisible - 1);
                                    if (end - start < maxVisible - 1) {
                                        start = Math.max(1, end - maxVisible + 1);
                                    }
                                    if (start > 1) {
                                        pages.push(1);
                                        if (start > 2) pages.push("...");
                                    }
                                    for (let i = start; i <= end; i++) {
                                        pages.push(i);
                                    }
                                    if (end < totalPages) {
                                        if (end < totalPages - 1) pages.push("...");
                                        pages.push(totalPages);
                                    }
                                    return pages.map((p, idx) =>
                                        p === "..." ? (
                                            <span key={idx} className="px-2 text-muted-foreground">
                                                ...
                                            </span>
                                        ) : (
                                            <Button
                                                key={idx}
                                                type="button"
                                                variant={p === currentPage ? "default" : "outline"}
                                                onClick={() => setPage(p as number)}
                                                disabled={registrationsLoading}
                                            >
                                                {p}
                                            </Button>
                                        )
                                    );
                                })()}
                            </div>
                        </div>
                    </SectionCard>
                </div>
            )}

            {showDetails && selectedReg && (
                <Popup open onOpenChange={(o) => !o && setShowDetails(false)}>
                    <div className="flex justify-between items-center p-6 border-b border-border dark:border-gray-700 bg-linear-to-r from-blue-600 to-blue-500 text-white rounded-t-xl">
                        <div>
                            <h3 className="text-xl font-bold">Registration Details</h3>
                            <p className="text-sm opacity-90 mt-1">Full student information preview</p>
                        </div>
                        <button
                            onClick={() => setShowDetails(false)}
                            className="text-white hover:text-gray-200 transition-colors p-2"
                        >
                            <XCircle size={24} />
                        </button>
                    </div>

                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                            <div className="md:col-span-1">
                                <div className="bg-muted/50 sticky top-20 dark:bg-gray-900/50 p-4 rounded-xl border border-border dark:border-gray-700 flex flex-col items-center">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Student Photo</h4>
                                    {selectedReg.photo ? (
                                        <img
                                            src={getFileUrl(selectedReg.photo as any)}
                                            className="w-full aspect-3/4 object-cover rounded-lg border-2 border-white dark:border-gray-800 shadow-md"
                                            alt="Student"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                target.src = "/placeholder-student.png";
                                            }}
                                        />
                                    ) : (
                                        <div className="w-full aspect-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-border dark:border-gray-600">
                                            <Users size={48} className="text-gray-400" />
                                        </div>
                                    )}
                                    <div className="mt-4 w-full">
                                        <div className="p-3 bg-card rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Status</p>
                                            <div className="flex justify-center"><StatusBadge status={selectedReg.status} /></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3 space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                    <div>
                                        <p className="text-[10px] text-primary dark:text-primary/70 uppercase font-bold">Section</p>
                                        <p className="font-semibold">{selectedReg.section || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-primary dark:text-primary/70 uppercase font-bold">Roll No</p>
                                        <p className="font-semibold">{selectedReg.roll || "-"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-primary dark:text-primary/70 uppercase font-bold">Academic Year</p>
                                        <p className="font-semibold">{selectedReg.ssc_batch}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-primary dark:text-primary/70 uppercase font-bold">Religion</p>
                                        <p className="font-semibold">{selectedReg.religion || "-"}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="border border-border dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            <tr>
                                                <td colSpan={2} className="bg-muted/50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                    Personal Information (ব্যক্তিগত তথ্য)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Student Name (EN)</td>
                                                <td className="px-4 py-2.5 font-bold text-blue-700 dark:text-primary/70 uppercase">
                                                    {selectedReg.student_name_en}
                                                    {selectedReg.student_nick_name_bn && <span className="ml-2 text-sm font-normal text-muted-foreground lowercase">({selectedReg.student_nick_name_bn})</span>}
                                                    {selectedReg.student_name_bn && <div className="text-sm font-normal text-muted-foreground mt-0.5">{selectedReg.student_name_bn}</div>}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Birth Reg. No</td>
                                                <td className="px-4 py-2.5 font-mono">{selectedReg.birth_reg_no}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Date of Birth</td>
                                                <td className="px-4 py-2.5">{selectedReg.birth_date}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Blood Group</td>
                                                <td className="px-4 py-2.5 font-semibold text-red-500">{selectedReg.blood_group || "-"}</td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Contact Info</td>
                                                <td className="px-4 py-2.5">
                                                    <p>Email: {selectedReg.email || "-"}</p>
                                                    <p>Father Ph: {selectedReg.father_phone || "-"}</p>
                                                    <p>Mother Ph: {selectedReg.mother_phone || "-"}</p>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td colSpan={2} className="bg-muted/50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                    Parent Information (পিতা-মাতার তথ্য)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Father's Info</td>
                                                <td className="px-4 py-2.5">
                                                    <p><strong>Father's Name (BN):</strong> {selectedReg.father_name_bn || "-"}</p>
                                                    <p><strong>Father's Name (EN):</strong> {selectedReg.father_name_en || "-"}</p>
                                                    <p className="text-xs">NID: {selectedReg.father_nid || "-"}</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">Mother's Info</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-gray-100 text-lg">
                                                    {selectedReg.mother_name_bn || "-"}
                                                    <span className="block text-sm font-normal text-muted-foreground uppercase mt-1">{selectedReg.mother_name_en || "-"}</span>
                                                    <p className="text-xs">NID: {selectedReg.mother_nid || "-"}</p>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td colSpan={2} className="bg-muted/50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                    Address Details (ঠিকানা)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Present Address</td>
                                                <td className="px-4 py-2.5 leading-relaxed">
                                                    {selectedReg.present_village_road && `${selectedReg.present_village_road}, `}
                                                    {selectedReg.present_post_office}-{selectedReg.present_post_code}, {selectedReg.present_upazila}, {selectedReg.present_district}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Permanent Address</td>
                                                <td className="px-4 py-2.5 leading-relaxed">
                                                    {selectedReg.permanent_village_road && `${selectedReg.permanent_village_road}, `}
                                                    {selectedReg.permanent_post_office}-{selectedReg.permanent_post_code}, {selectedReg.permanent_upazila}, {selectedReg.permanent_district}
                                                </td>
                                            </tr>

                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Nearby Student Info</td>
                                                <td className="px-4 py-2.5">
                                                    {selectedReg.nearby_nine_student_info || "Not Applicable"}
                                                </td>
                                            </tr>
                                            
                                            <tr>
                                                <td colSpan={2} className="bg-muted/50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                    SSC & JSC Information (শিক্ষাগত তথ্য)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Class 9 Academic</td>
                                                <td className="px-4 py-2.5">
                                                    <p className="font-bold text-gray-800 dark:text-gray-200 uppercase text-xs">Group: {selectedReg.group_class_nine || "-"}</p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                                                        <p><span className="text-gray-400">Main:</span> {selectedReg.main_subject || "-"}</p>
                                                        <p><span className="text-gray-400">4th Sub:</span> {selectedReg.fourth_subject || "-"}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">JSC Information</td>
                                                <td className="px-4 py-2.5 text-sm">
                                                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                                                        <p><strong>Year:</strong> {selectedReg.jsc_passing_year || "-"}</p>
                                                        <p><strong>Roll:</strong> <span className="font-mono">{selectedReg.jsc_roll_no || "-"}</span></p>
                                                        <p><strong>Reg:</strong> <span className="font-mono">{selectedReg.jsc_reg_no || "-"}</span></p>
                                                    </div>
                                                </td>
                                            </tr>

                                            <tr>
                                                <td colSpan={2} className="bg-muted/50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                    Guardian Info (অভিভাবক)
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Prev. School</td>
                                                <td className="px-4 py-2.5">
                                                    <p className="font-bold text-gray-800 dark:text-gray-200 uppercase text-xs">{selectedReg.prev_school_name || "-"}</p>
                                                    <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                                                        {selectedReg.prev_school_upazila}, {selectedReg.prev_school_district}
                                                    </p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30 align-top">Guardian</td>
                                                <td className="px-4 py-2.5">
                                                    {selectedReg.guardian_name ? (
                                                        <div className="space-y-1.5">
                                                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                                                                {selectedReg.guardian_name} <span className="text-xs font-normal text-muted-foreground">({selectedReg.guardian_relation})</span>
                                                            </p>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                <p><span className="text-gray-400">Phone:</span> {selectedReg.guardian_phone || "-"}</p>
                                                                <p><span className="text-gray-400">NID:</span> {selectedReg.guardian_nid || "-"}</p>
                                                            </div>
                                                            {(selectedReg.guardian_village_road || selectedReg.guardian_district) && (
                                                                <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700/50">
                                                                    <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Guardian Address</p>
                                                                    <p className="text-xs leading-relaxed text-muted-foreground dark:text-gray-400">
                                                                        {selectedReg.guardian_village_road}, {selectedReg.guardian_post_office}-{selectedReg.guardian_post_code}, {selectedReg.guardian_upazila}, {selectedReg.guardian_district}
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-400 italic">Parent (No separate guardian specified)</span>
                                                    )}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="px-4 py-2.5 text-muted-foreground dark:text-gray-400 bg-muted/50/30 dark:bg-gray-800/30">System Info</td>
                                                <td className="px-4 py-2.5 text-[10px] text-muted-foreground">
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

                    <div className="p-6 border-t border-border dark:border-gray-700 bg-muted/50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex gap-2">
                            <button
                                onClick={() => {
                                    if (!selectedReg) return;
                                    handlePreviewPDF(selectedReg.id);
                                }}
                                className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-all font-semibold shadow-md"
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
                                            { responseType: "blob" }
                                        );
                                        const blob = new Blob([response.data], { type: "application/pdf" });
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `Class9_Registration_${selectedReg.student_name_en.replace(/\s+/g, '_')}.pdf`;
                                        document.body.appendChild(a);
                                        a.click();
                                        a.remove();
                                        window.URL.revokeObjectURL(url);

                                    } catch (err) {
                                        console.error(err);
                                        toast.error("Failed to download PDF");
                                    } finally {
                                        setPdfDownloading(false);
                                    }
                                }}
                                disabled={pdfDownloading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-md disabled:opacity-50"
                            >
                                {pdfDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                                {pdfDownloading ? "Generating PDF..." : "Download PDF"}
                            </button>
                            {selectedReg.status === "pending" && (
                                <button
                                    onClick={() => {
                                        handleStatusUpdate(selectedReg.id, "approved");
                                        setShowDetails(false);
                                    }}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-semibold shadow-md"
                                >
                                    <CheckCircle2 size={18} />
                                    Approve
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowDetails(false)}
                            className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-all font-semibold"
                        >
                            Close Preview
                        </button>
                    </div>
                </Popup>
            )}

            {showEditModal && editFormData && (
                <Popup open onOpenChange={(o) => !o && setShowEditModal(false)}>
                    <div className="p-6">
                        <h3 className="text-lg font-bold mb-4">Edit Registration Status</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    value={editFormData.status}
                                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <Button variant="outline" onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => {
                                        handleStatusUpdate(editFormData.id, editFormData.status);
                                        setShowEditModal(false);
                                    }}
                                >
                                    Save Changes
                                </Button>
                            </div>
                        </div>
                    </div>
                </Popup>
            )}
        </div>
    );
};

export default Class9RegForm;
