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
import type { Class8RegistrationRecord, Class8RegistrationSettingsData } from "@school/shared-schemas";
import { class8RegistrationSettingsSchema } from "@school/shared-schemas";

/** Full DB record as returned by the admin API — all server-managed fields are non-nullable here. */
type Registration = Omit<Class8RegistrationRecord, "class8_year" | "birth_date" | "created_at" | "status"> & {
    class8_year: number;
    birth_date: string;
    created_at: string;
    status: string;
};

const Class8RegForm = () => {
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
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<{ id: string; status: string } | null>(null);
    const [pdfDownloading, setPdfDownloading] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isDirty }
    } = useForm<Class8RegistrationSettingsData>({
        resolver: zodResolver(class8RegistrationSettingsSchema),
        defaultValues: {
            a_sec_roll: "",
            b_sec_roll: "",
            class8_year: new Date().getFullYear().toString(),
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
        queryKey: ["class8RegSettings"],
        queryFn: async () => {
            const res = await axios.get(`/api/reg/class-8`);
            return res.data.success ? res.data.data : null;
        },
    });

    useEffect(() => {
        if (settingsData) {
            const formData = {
                ...settingsData,
                notice_key: settingsData.notice,
            };
            reset(formData);
        }
    }, [settingsData, reset]);

    const { data: registrationsResponse, isLoading: registrationsLoading, error: registrationsError } = useQuery({
        queryKey: ["class8Registrations", { page, limit, ...deferredFilters }],
        queryFn: async () => {
            const res = await axios.get(`/api/reg/class-8/form`, {
                params: {
                    page,
                    limit,
                    class8_year: deferredFilters.year,
                    status: deferredFilters.status,
                    section: deferredFilters.section,
                    search: deferredFilters.search.trim() || undefined
                }
            });
            return res.data.success ? res.data.data : [];
        },
        placeholderData: keepPreviousData,
        staleTime: 2 * 60 * 1000,
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
        if (settingsData?.class8_year) {
            setFilters(prev => ({ ...prev, year: settingsData.class8_year.toString() }));
        }
    }, [settingsData?.class8_year]);

    const settingsMutation = useMutation({
        mutationFn: async (updatedSettings: Class8RegistrationSettingsData) => {
            let notice_key = updatedSettings.notice_key;

            if (selectedNotice) {
                const { data: urlData } = await axios.post(`/api/reg/class-8/upload-url`, {
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

            const res = await axios.post(`/api/reg/class-8`, payload);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Settings updated successfully");
            queryClient.invalidateQueries({ queryKey: ["class8RegSettings"] });
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
            const res = await axios.put(`/api/reg/class-8/form/${id}/status`, { status });
            return res.data;
        },
        onSuccess: (_, variables) => {
            toast.success(`Registration ${variables.status}`);
            queryClient.invalidateQueries({ queryKey: ["class8Registrations"] });
        },
        onError: () => {
            toast.error("Failed to update status");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await axios.delete(`/api/reg/class-8/form/${id}`);
            return res.data;
        },
        onSuccess: () => {
            toast.success("Registration deleted");
            queryClient.invalidateQueries({ queryKey: ["class8Registrations"] });
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
        const previewUrl = `/preview/class8/${id}`;
        window.open(previewUrl, "_blank", "noopener,noreferrer");
    }, []);

    const handleExport = useCallback(async (type: "sheet" | "photos") => {
        const { status, section, year } = filters;
        const endpoint = type === "sheet" ? "export" : "export-photos";
        const url = `/api/reg/class-8/form/${endpoint}?status=${status}&section=${section}&class8_year=${year}`;

        try {
            toast.loading(`Preparing ${type}...`, { id: "export" });
            const res = await axios.get(url, { responseType: "blob" });
            const extension = type === "sheet" ? "xlsx" : "zip";
            const blob = new Blob([res.data]);
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `Class8_${type}_${year}${section ? `_${section}` : ""}.${extension}`;
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
                title="Class Eight Registration Management"
                description="Manage student registrations and notification settings for Class Eight."
            />

            <TabNav
                tabs={tabs}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                className="mb-6"
            />

            {activeTab === "settings" ? (
                <SectionCard title="Registration Settings" icon={<Settings size={20} />}>
                    {settingsLoading ? (
                        <div className="py-20 flex justify-center"><Loader2 size={40} className="animate-spin text-primary" /></div>
                    ) : (
                        <form onSubmit={handleSettingsSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Section A Roll Range (e.g., 01-50)</label>
                                    <Input {...register("a_sec_roll")} placeholder="01-50" />
                                    {errors.a_sec_roll && <p className="text-xs text-red-500 mt-1">{errors.a_sec_roll.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Section B Roll Range</label>
                                    <Input {...register("b_sec_roll")} placeholder="51-100" />
                                    {errors.b_sec_roll && <p className="text-xs text-red-500 mt-1">{errors.b_sec_roll.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Academic Year</label>
                                    <Input {...register("class8_year")} />
                                    {errors.class8_year && <p className="text-xs text-red-500 mt-1">{errors.class8_year.message}</p>}
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
                                        className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer"
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
                                    <Textarea {...register("instruction_for_a")} className="h-24" />
                                    {errors.instruction_for_a && <p className="text-xs text-red-500 mt-1">{errors.instruction_for_a.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Instruction for Section B</label>
                                    <Textarea {...register("instruction_for_b")} className="h-24" />
                                    {errors.instruction_for_b && <p className="text-xs text-red-500 mt-1">{errors.instruction_for_b.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Classmates List Source</label>
                                    <select {...register("classmates_source")} className="block w-full border rounded-md px-3 py-2 text-sm bg-card">
                                        <option value="default">Default (Current Student List)</option>
                                        <option value="custom">Manual (Custom List)</option>
                                    </select>
                                    {errors.classmates_source && <p className="text-xs text-red-500 mt-1">{errors.classmates_source.message}</p>}
                                </div>
                                {settingsForm.classmates_source === "custom" && (
                                    <div>
                                        <label className="block text-sm font-medium text-foreground mb-1">Manual Classmates List</label>
                                        <Textarea {...register("classmates")} placeholder=" আব্দুল করিম, রহিম উদ্দিন" className="h-24" />
                                        {errors.classmates && <p className="text-xs text-red-500 mt-1">{errors.classmates.message}</p>}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-foreground mb-1">Attachment Instructions</label>
                                    <Textarea {...register("attachment_instruction")} className="h-24" />
                                    {errors.attachment_instruction && <p className="text-xs text-red-500 mt-1">{errors.attachment_instruction.message}</p>}
                                </div>
                            </div>
                            <div className="flex justify-end pt-4">
                                <Button type="submit" disabled={settingsMutation.isPending || (!isDirty && !selectedNotice)}>
                                    {settingsMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    Save Settings
                                </Button>
                            </div>
                        </form>
                    )}
                </SectionCard>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <StatsCard label="Total Registrations" value={renderCount(stats.total.filtered, stats.total.all)} loading={registrationsLoading} />
                        <StatsCard label="Pending" value={renderCount(stats.pending.filtered, stats.pending.all)} color="amber" loading={registrationsLoading} />
                        <StatsCard label="Approved" value={renderCount(stats.approved.filtered, stats.approved.all)} color="emerald" loading={registrationsLoading} />
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
                                <label className="block text-sm font-medium mb-1">Academic Year</label>
                                <select
                                    value={filters.year}
                                    onChange={(e) => handleFilterChange("year", e.target.value)}
                                    className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                                >
                                    {(() => {
                                        const currentYear = new Date().getFullYear();
                                        const years = [];
                                        for (let i = 0; i < 5; i++) years.push(currentYear - i);

                                        const settingsYear = Number(settingsForm.class8_year);
                                        if (settingsForm.class8_year && !isNaN(settingsYear) && !years.includes(settingsYear)) {
                                            years.push(settingsYear);
                                            years.sort((a, b) => b - a);
                                        }
                                        return years.map(y => (
                                            <option key={y} value={y.toString()}>{y}</option>
                                        ));
                                    })()}
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={() => handleExport("sheet")} className="bg-emerald-600 hover:bg-emerald-700 h-10">
                                    <FileText size={18} />
                                    <span>Export Sheet</span>
                                </Button>
                                <Button onClick={() => handleExport("photos")} className="h-10">
                                    <ImageIcon size={18} />
                                    <span>Export Photos</span>
                                </Button>
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
                                                    <p className="text-sm text-muted-foreground">Loading registrations...</p>
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
                                                        {reg.photo ? (
                                                            <img src={getFileUrl(reg.photo)} className="w-10 h-10 rounded-full object-cover border border-border" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground"><Users size={18} /></div>
                                                        )}
                                                        <div>
                                                            <div className="font-medium text-foreground">{reg.student_name_en}</div>
                                                            <div className="text-sm text-muted-foreground">{reg.student_name_bn}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                                                        {reg.section || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-medium text-muted-foreground">{reg.roll || "-"}</td>
                                                <td className="px-6 py-4"><StatusBadge status={reg.status} /></td>
                                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                                    {formatDateWithTime(reg.created_at)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-center gap-2">
                                                        <ActionButton action="view" onClick={() => { setSelectedReg(reg); setShowDetails(true); }} />
                                                        <ActionButton action="edit" onClick={() => { setEditFormData({ id: reg.id, status: reg.status }); setShowEditModal(true); }} />
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
                                            <span key={idx} className="px-2 text-muted-foreground">...</span>
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
                    <div className="flex justify-between items-center p-6 bg-blue-600 text-white rounded-t-xl">
                        <h3 className="text-xl font-bold">Registration Details (Class 8)</h3>
                        <button onClick={() => setShowDetails(false)}><XCircle size={24} /></button>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="md:col-span-1">
                                {selectedReg.photo ? <img src={getFileUrl(selectedReg.photo)} className="w-full aspect-3/4 object-cover rounded-lg shadow-md" alt="Student" /> : <Users size={48} />}
                                <div className="mt-4"><StatusBadge status={selectedReg.status} /></div>
                            </div>
                            <div className="md:col-span-3 space-y-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50 rounded-xl">
                                    <div><p className="text-[10px] uppercase font-bold text-primary">Section</p><p className="font-semibold">{selectedReg.section || "-"}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-primary">Roll No</p><p className="font-semibold">{selectedReg.roll || "-"}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-primary">Year</p><p className="font-semibold">{selectedReg.class8_year}</p></div>
                                    <div><p className="text-[10px] uppercase font-bold text-primary">Rel.</p><p className="font-semibold">{selectedReg.religion || "-"}</p></div>
                                </div>
                                <div className="border rounded-xl overflow-hidden text-sm">
                                    <table className="w-full">
                                        <tbody className="divide-y">
                                            <tr><td className="px-4 py-2 bg-muted/30">Student (EN)</td><td className="px-4 py-2 font-bold uppercase">{selectedReg.student_name_en}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">Registration No</td><td className="px-4 py-2">{(selectedReg as any).registration_no || "-"}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">Class 6 Session</td><td className="px-4 py-2">{(selectedReg as any).class6_academic_session || "-"}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">Birth Reg</td><td className="px-4 py-2">{selectedReg.birth_reg_no}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">Father</td><td className="px-4 py-2">{selectedReg.father_name_en}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">Mother</td><td className="px-4 py-2">{selectedReg.mother_name_en}</td></tr>
                                            <tr><td className="px-4 py-2 bg-muted/30">School</td><td className="px-4 py-2">{selectedReg.prev_school_name}</td></tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div className="flex gap-2 pt-4">
                                    <Button onClick={() => handlePreviewPDF(selectedReg.id)} className="bg-violet-600"><FileText size={18} /> Preview PDF</Button>
                                    <Button onClick={async () => {
                                        if (!selectedReg || pdfDownloading) return;
                                        setPdfDownloading(true);
                                        try {
                                            const response = await axios.get(`/api/reg/class-8/form/${selectedReg.id}/pdf`, { responseType: "blob" });
                                            const blob = new Blob([response.data], { type: "application/pdf" });
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `Class8_Registration_${selectedReg.student_name_en.replace(/\s+/g, '_')}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                            window.URL.revokeObjectURL(url);
                                        } catch (err) { toast.error("Failed to download PDF"); } finally { setPdfDownloading(false); }
                                    }} disabled={pdfDownloading}>
                                        {pdfDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} PDF
                                    </Button>
                                    {selectedReg.status === "pending" && <Button onClick={() => { handleStatusUpdate(selectedReg.id, "approved"); setShowDetails(false); }} className="bg-emerald-600">Approve</Button>}
                                </div>
                            </div>
                        </div>
                    </div>
                </Popup>
            )}

            {showEditModal && editFormData && (
                <Popup open onOpenChange={(o) => !o && setShowEditModal(false)} size="md">
                    <div className="p-6 border-b flex justify-between items-center"><h3 className="text-xl font-bold">Update Status</h3><button onClick={() => setShowEditModal(false)}><XCircle size={24} /></button></div>
                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-1 gap-3">
                            {["pending", "approved"].map((s) => (
                                <button key={s} onClick={() => setEditFormData({ ...editFormData, status: s })} className={`flex items-center justify-between p-4 rounded-xl border-2 ${editFormData.status === s ? "border-blue-500 bg-blue-50" : "border-gray-100"}`}>
                                    <div className="flex items-center gap-3"><span className="font-semibold capitalize">{s}</span></div>
                                    {editFormData.status === s && <div className="w-3 h-3 bg-primary rounded-full" />}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3 justify-end pt-4">
                            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancel</Button>
                            <Button onClick={async () => { await handleStatusUpdate(editFormData.id, editFormData.status); setShowEditModal(false); }}>Update Status</Button>
                        </div>
                    </div>
                </Popup>
            )}
        </div>
    );
};

export default Class8RegForm;
