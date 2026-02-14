import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Eye,
    Download,
    Image as ImageIcon,
    FileText,
    Settings,
    Users,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle
} from "lucide-react";
import { toast } from "react-hot-toast";
import { cdn } from "@/lib/backend";

interface Registration {
    id: string;
    student_name_bn: string;
    student_nick_name_bn?: string;
    student_name_en: string;
    section: string;
    roll: string;
    status: string;
    photo?: string;
    birth_reg_no: string;
    birth_date: string;
    religion?: string;
    blood_group?: string;
    email?: string;
    father_name_bn: string;
    father_name_en: string;
    father_phone?: string;
    father_nid?: string;
    mother_name_bn: string;
    mother_name_en: string;
    mother_phone?: string;
    mother_nid?: string;
    present_village_road: string;
    present_post_office: string;
    present_post_code: string;
    present_upazila: string;
    present_district: string;
    permanent_village_road: string;
    permanent_post_office: string;
    permanent_post_code: string;
    permanent_upazila: string;
    permanent_district: string;
    prev_school_name: string;
    prev_school_district: string;
    prev_school_upazila: string;
    section_in_prev_school?: string;
    roll_in_prev_school?: string;
    prev_school_passing_year?: string;
    guardian_name?: string;
    guardian_relation?: string;
    guardian_phone?: string;
    guardian_nid?: string;
    guardian_village_road?: string;
    guardian_post_office?: string;
    guardian_post_code?: string;
    guardian_upazila?: string;
    guardian_district?: string;
    class6_year: number;
    nearby_student_info?: string;
    created_at: string;
}

interface Class6RegSettings {
    id?: number;
    a_sec_roll: string;
    b_sec_roll: string;
    class6_year: string;
    reg_open: boolean;
    instruction_for_a: string;
    instruction_for_b: string;
    attachment_instruction: string;
    notice: string | null;
}

const Class6RegForm = () => {
    const [activeTab, setActiveTab] = useState<"registrations" | "settings">("registrations");
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [settings, setSettings] = useState<Class6RegSettings>({
        a_sec_roll: "",
        b_sec_roll: "",
        class6_year: new Date().getFullYear().toString(),
        reg_open: false,
        instruction_for_a: "",
        instruction_for_b: "",
        attachment_instruction: "",
        notice: null
    });
    const [loading, setLoading] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [selectedNotice, setSelectedNotice] = useState<File | null>(null);
    const [filters, setFilters] = useState({
        status: "all",
        section: "",
        year: new Date().getFullYear().toString(),
        search: ""
    });
    const [showDetails, setShowDetails] = useState(false);
    const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
    const [showEditModal, setShowEditModal] = useState(false);
    const [editFormData, setEditFormData] = useState<{ id: string; status: string } | null>(null);
    const [pdfDownloading, setPdfDownloading] = useState(false);

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`/api/reg/class-6`);
            if (res.data.success) {
                setSettings(res.data.data);
                // Update filter year to match setting if not already set
                if (res.data.data.class6_year) {
                    setFilters(prev => ({ ...prev, year: res.data.data.class6_year.toString() }));
                }
            }
        } catch (error) {
            console.error("Fetch settings error:", error);
        }
    };

    const fetchRegistrations = useCallback(async () => {
        setLoading(true);
        try {
            const { status, section, year, search } = filters;
            const res = await axios.get(`/api/reg/class-6/form`, {
                params: { status, section, class6_year: year, search }
            });
            if (res.data.success) {
                setRegistrations(res.data.data);
                const data = res.data.data;
                setStats({
                    total: data.length,
                    pending: data.filter((r: Registration) => r.status === "pending").length,
                    approved: data.filter((r: Registration) => r.status === "approved").length
                });
            }
        } catch (error) {
            toast.error("Failed to fetch registrations");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        fetchRegistrations();
    }, [fetchRegistrations]);

    const handleSettingsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            let notice_key = settings.notice;

            if (selectedNotice) {
                // 1. Get upload URL
                const { data: urlData } = await axios.post(`/api/reg/class-6/upload-url`, {
                    filename: selectedNotice.name,
                    filetype: selectedNotice.type
                });

                if (urlData.success) {
                    // 2. Upload to R2
                    await axios.put(urlData.url, selectedNotice, {
                        headers: { "Content-Type": selectedNotice.type },
                        withCredentials: false
                    });
                    notice_key = urlData.key;
                }
            }

            const payload = {
                ...settings,
                notice_key,
                reg_open: settings.reg_open.toString()
            };

            const res = await axios.post(`/api/reg/class-6`, payload);
            if (res.data.success) {
                toast.success("Settings updated successfully");
                fetchSettings();
                setSelectedNotice(null);
            }
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setFormLoading(false);
            const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            if (fileInput) fileInput.value = "";
        }
    };

    const handleStatusUpdate = async (id: string, status: string) => {
        try {
            const res = await axios.put(`/api/reg/class-6/form/${id}/status`, { status });
            if (res.data.success) {
                toast.success(`Registration ${status}`);
                fetchRegistrations();
            }
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleDeleteDetails = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this registration?")) return;
        try {
            const res = await axios.delete(`/api/reg/class-6/form/${id}`);
            if (res.data.success) {
                toast.success("Registration deleted");
                fetchRegistrations();
                setShowDetails(false);
            }
        } catch (error) {
            toast.error("Failed to delete registration");
        }
    };

    const handleExport = async (type: "sheet" | "photos") => {
        const { status, section, year } = filters;
        const endpoint = type === "sheet" ? "export" : "export-photos";
        const url = `/api/reg/class-6/form/${endpoint}?status=${status}&section=${section}&class6_year=${year}`;

        try {
            toast.loading(`Preparing ${type}...`, { id: "export" });
            const res = await axios.get(url, { responseType: "blob" });
            const extension = type === "sheet" ? "xlsx" : "zip";
            const blob = new Blob([res.data]);
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `Class6_${type}_${year}${section ? `_${section}` : ""}.${extension}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} exported successfully`, { id: "export" });
        } catch (error: any) {
            console.error(`Export ${type} error:`, error);
            let message = `Failed to export ${type}`;
            if (error.response && error.response.data instanceof Blob) {
                // Try to read the error message from the blob
                const reader = new FileReader();
                reader.onload = () => {
                    try {
                        const errData = JSON.parse(reader.result as string);
                        toast.error(errData.message || message, { id: "export" });
                    } catch {
                        toast.error(message, { id: "export" });
                    }
                };
                reader.readAsText(error.response.data);
            } else {
                toast.error(message, { id: "export" });
            }
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle2 size={12} /> Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"><XCircle size={12} /> Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"><AlertCircle size={12} /> Pending</span>;
        }
    };

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return "-";
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            const d = String(date.getDate()).padStart(2, '0');
            const m = date.toLocaleString('en-GB', { month: 'short' });
            const y = date.getFullYear();
            return `${d} ${m} ${y}`;
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Class Six Registration Management</h1>
                <p className="text-gray-600 dark:text-gray-400">Manage student registrations and notification settings for Class Six.</p>
            </div>

            <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab("registrations")}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === "registrations" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Users size={16} />
                        Registrations
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab("settings")}
                    className={`pb-2 px-1 text-sm font-medium transition-colors relative ${activeTab === "settings" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                >
                    <div className="flex items-center gap-2">
                        <Settings size={16} />
                        Settings
                    </div>
                </button>
            </div>

            {activeTab === "settings" ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-6">
                        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                            <Settings size={20} className="text-blue-500" />
                            Registration Settings
                        </h3>
                        <form onSubmit={handleSettingsSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section A Roll Range (e.g., 01-50)</label>
                                    <input
                                        type="text"
                                        value={settings.a_sec_roll || ""}
                                        onChange={(e) => setSettings({ ...settings, a_sec_roll: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="01-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section B Roll Range</label>
                                    <input
                                        type="text"
                                        value={settings.b_sec_roll || ""}
                                        onChange={(e) => setSettings({ ...settings, b_sec_roll: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                        placeholder="51-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Academic Year</label>
                                    <input
                                        type="text"
                                        value={settings.class6_year || ""}
                                        onChange={(e) => setSettings({ ...settings, class6_year: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-gray-700 rounded-lg w-full">
                                        <input
                                            type="checkbox"
                                            checked={settings.reg_open}
                                            onChange={(e) => setSettings({ ...settings, reg_open: e.target.checked })}
                                            className="w-4 h-4 text-blue-600"
                                        />
                                        <span className="text-sm font-medium">Registration Open</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notice File (PDF)</label>
                                <div className="mt-1 flex items-center gap-4">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => setSelectedNotice(e.target.files?.[0] || null)}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {settings.notice && (
                                        <a
                                            href={`${cdn}/${settings.notice}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline flex items-center gap-1 text-sm font-medium shrink-0"
                                        >
                                            <FileText size={16} /> Current Notice
                                        </a>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruction for Section A</label>
                                    <textarea
                                        value={settings.instruction_for_a || ""}
                                        onChange={(e) => setSettings({ ...settings, instruction_for_a: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-24"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instruction for Section B</label>
                                    <textarea
                                        value={settings.instruction_for_b || ""}
                                        onChange={(e) => setSettings({ ...settings, instruction_for_b: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-24"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Attachment Instructions</label>
                                    <textarea
                                        value={settings.attachment_instruction || ""}
                                        onChange={(e) => setSettings({ ...settings, attachment_instruction: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 h-24"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {formLoading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                    Save Settings
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-gray-500 mb-1">Total Registrations</p>
                            <h4 className="text-2xl font-bold">{stats.total}</h4>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-amber-500 mb-1">Pending</p>
                            <h4 className="text-2xl font-bold text-amber-600">{stats.pending}</h4>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            <p className="text-sm text-emerald-500 mb-1">Approved</p>
                            <h4 className="text-2xl font-bold text-emerald-600">{stats.approved}</h4>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-[240px]">
                                <label className="block text-sm font-medium mb-1">Search</label>
                                <div className="relative">
                                    <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={filters.search}
                                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                                        placeholder="Search by name, roll, birth reg..."
                                        className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Status</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
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
                                    onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
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
                                    onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
                                >
                                    {(() => {
                                        const currentYear = new Date().getFullYear();
                                        const years = [];
                                        for (let i = 0; i < 5; i++) years.push(currentYear - i);
                                        // Include settings year if not in range
                                        const settingsYear = parseInt(settings.class6_year);
                                        if (settings.class6_year && !isNaN(settingsYear) && !years.includes(settingsYear)) {
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
                                <button
                                    onClick={() => handleExport("sheet")}
                                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                >
                                    <FileText size={18} />
                                    <span>Export Sheet</span>
                                </button>
                                <button
                                    onClick={() => handleExport("photos")}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    <ImageIcon size={18} />
                                    <span>Export Photos</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Student</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Section</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Roll</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center">
                                                <Loader2 className="animate-spin mx-auto text-blue-500" size={32} />
                                            </td>
                                        </tr>
                                    ) : registrations.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-gray-500">No registrations found</td>
                                        </tr>
                                    ) : (
                                        registrations.map((reg) => (
                                            <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {reg.photo ? (
                                                            <img src={`${cdn}/${reg.photo}`} className="w-10 h-10 rounded-full object-cover border" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Users size={18} /></div>
                                                        )}
                                                        <div>
                                                            <p className="font-medium">{reg.student_name_en}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                                                        {reg.section || "-"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-medium text-gray-600 dark:text-gray-400">
                                                    {reg.roll || "-"}
                                                </td>
                                                <td className="px-6 py-4">{getStatusBadge(reg.status)}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                    {formatDate(reg.created_at)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedReg(reg);
                                                                setShowDetails(true);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors dark:bg-blue-900/10 dark:text-blue-200 dark:hover:bg-blue-800"
                                                            title="View"
                                                        >
                                                            <Eye size={14} /> View
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setEditFormData({ id: reg.id, status: reg.status });
                                                                setShowEditModal(true);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-800"
                                                            title="Edit"
                                                        >
                                                            <Edit size={14} /> Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDetails(reg.id)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-800"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={14} /> Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {showDetails && selectedReg && (
                <div className="fixed inset-0 bg-transparent backdrop-blur-sm bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white text-black dark:bg-gray-800 dark:text-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b border-gray-300 dark:border-gray-700 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-t-xl">
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
                                    <div className="bg-gray-50 sticky top-20 dark:bg-gray-900/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex flex-col items-center">
                                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Student Photo</h4>
                                        {selectedReg.photo ? (
                                            <img
                                                src={`${cdn}/${selectedReg.photo}`}
                                                className="w-full aspect-[3/4] object-cover rounded-lg border-2 border-white dark:border-gray-800 shadow-md"
                                                alt="Student"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.src = "/placeholder-student.png";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full aspect-[3/4] bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                                                <Users size={48} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div className="mt-4 w-full">
                                            <div className="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 text-center">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Status</p>
                                                <div className="flex justify-center">{getStatusBadge(selectedReg.status)}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-3 space-y-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                                        <div>
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Section</p>
                                            <p className="font-semibold">{selectedReg.section || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Roll No</p>
                                            <p className="font-semibold">{selectedReg.roll || "-"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Academic Year</p>
                                            <p className="font-semibold">{selectedReg.class6_year}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-blue-600 dark:text-blue-400 uppercase font-bold">Religion</p>
                                            <p className="font-semibold">{selectedReg.religion || "-"}</p>
                                        </div>
                                    </div>

                                    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-sm">
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                <tr>
                                                    <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                        Personal Information (ব্যক্তিগত তথ্য)
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 w-1/3 bg-gray-50/30 dark:bg-gray-800/30">Student Name (BN)</td>
                                                    <td className="px-4 py-2.5 font-medium">{selectedReg.student_name_bn} {selectedReg.student_nick_name_bn && `(${selectedReg.student_nick_name_bn})`}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Student Name (EN)</td>
                                                    <td className="px-4 py-2.5 font-bold text-blue-700 dark:text-blue-400 uppercase">{selectedReg.student_name_en}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Birth Reg. No</td>
                                                    <td className="px-4 py-2.5 font-mono">{selectedReg.birth_reg_no}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Date of Birth</td>
                                                    <td className="px-4 py-2.5">{formatDate(selectedReg.birth_date)}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Blood Group</td>
                                                    <td className="px-4 py-2.5 font-semibold text-red-600 dark:text-red-400">{selectedReg.blood_group || "Not Set"}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Contact Info</td>
                                                    <td className="px-4 py-2.5">
                                                        <p>Email: {selectedReg.email || "-"}</p>
                                                        <p>Father Ph: {selectedReg.father_phone || "-"}</p>
                                                        <p>Mother Ph: {selectedReg.mother_phone || "-"}</p>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                        Parent Information (পিতা-মাতার তথ্য)
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Father's Info</td>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-semibold">{selectedReg.father_name_bn}</p>
                                                        <p className="text-xs uppercase text-gray-500">{selectedReg.father_name_en}</p>
                                                        <p className="text-xs">NID: {selectedReg.father_nid || "-"}</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">Mother's Info</td>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-semibold">{selectedReg.mother_name_bn}</p>
                                                        <p className="text-xs uppercase text-gray-500">{selectedReg.mother_name_en}</p>
                                                        <p className="text-xs">NID: {selectedReg.mother_nid || "-"}</p>
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                        Address Details (ঠিকানা)
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 align-top">Present Address</td>
                                                    <td className="px-4 py-2.5 leading-relaxed">
                                                        {selectedReg.present_village_road}, {selectedReg.present_post_office}-{selectedReg.present_post_code}, {selectedReg.present_upazila}, {selectedReg.present_district}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 align-top">Permanent Address</td>
                                                    <td className="px-4 py-2.5 leading-relaxed">
                                                        {selectedReg.permanent_village_road}, {selectedReg.permanent_post_office}-{selectedReg.permanent_post_code}, {selectedReg.permanent_upazila}, {selectedReg.permanent_district}
                                                    </td>
                                                </tr>

                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 align-top">Nearby Student Info</td>
                                                    <td className="px-4 py-2.5">
                                                        {selectedReg.nearby_student_info || "Not Applicable"}
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} className="bg-gray-50 dark:bg-gray-900/50 px-4 py-2 font-bold text-gray-700 dark:text-gray-200 uppercase tracking-tight text-xs">
                                                        Guardian Info (অভিভাবক)
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 align-top">Prev. School</td>
                                                    <td className="px-4 py-2.5">
                                                        <p className="font-bold text-gray-800 dark:text-gray-200 uppercase text-xs">{selectedReg.prev_school_name}</p>
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                                            {selectedReg.prev_school_upazila}, {selectedReg.prev_school_district}
                                                        </p>
                                                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                                                            <div>
                                                                <p className="text-[9px] uppercase font-bold text-gray-400 leading-none">Section</p>
                                                                <p className="text-xs font-semibold">{selectedReg.section_in_prev_school || "-"}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] uppercase font-bold text-gray-400 leading-none">Roll</p>
                                                                <p className="text-xs font-semibold">{selectedReg.roll_in_prev_school || "-"}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] uppercase font-bold text-gray-400 leading-none">Year</p>
                                                                <p className="text-xs font-semibold">{selectedReg.prev_school_passing_year || "-"}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30 align-top">Guardian</td>
                                                    <td className="px-4 py-2.5">
                                                        {selectedReg.guardian_name ? (
                                                            <div className="space-y-1.5">
                                                                <p className="font-semibold text-gray-800 dark:text-gray-200">
                                                                    {selectedReg.guardian_name} <span className="text-xs font-normal text-gray-500">({selectedReg.guardian_relation})</span>
                                                                </p>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                                                    <p><span className="text-gray-400">Phone:</span> {selectedReg.guardian_phone || "-"}</p>
                                                                    <p><span className="text-gray-400">NID:</span> {selectedReg.guardian_nid || "-"}</p>
                                                                </div>
                                                                {(selectedReg.guardian_village_road || selectedReg.guardian_district) && (
                                                                    <div className="pt-1 mt-1 border-t border-gray-100 dark:border-gray-700/50">
                                                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Guardian Address</p>
                                                                        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-400">
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
                                                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 bg-gray-50/30 dark:bg-gray-800/30">System Info</td>
                                                    <td className="px-4 py-2.5 text-[10px] text-gray-500">
                                                        <p>ID: {selectedReg.id}</p>
                                                        <p>Submitted: {formatDate(selectedReg.created_at)}</p>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-wrap items-center justify-between gap-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={async () => {
                                        if (!selectedReg || pdfDownloading) return;
                                        setPdfDownloading(true);
                                        try {
                                            const response = await axios.get(
                                                `/api/reg/class-6/form/${selectedReg.id}/pdf`,
                                                { responseType: "blob" }
                                            );
                                            const blob = new Blob([response.data], { type: "application/pdf" });
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement("a");
                                            a.href = url;
                                            a.download = `Class6_Registration_${selectedReg.student_name_en.replace(/\s+/g, '_')}.pdf`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                            window.URL.revokeObjectURL(url);
                                            toast.success("PDF Downloaded successfully");
                                        } catch (err) {
                                            console.error(err);
                                            toast.error("Failed to download PDF");
                                        } finally {
                                            setPdfDownloading(false);
                                        }
                                    }}
                                    disabled={pdfDownloading}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-semibold shadow-md disabled:opacity-50"
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
                                        Approve Now
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
                    </div>
                </div>
            )}
            {showEditModal && editFormData && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold">Update Registration Status</h3>
                            <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                                <XCircle size={24} className="text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Status</label>
                                <div className="grid grid-cols-1 gap-3">
                                    {["pending", "approved"].map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => setEditFormData({ ...editFormData, status: s })}
                                            className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${editFormData.status === s
                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-full ${s === "approved" ? "bg-emerald-100 text-emerald-600" : s === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                                                    {s === "approved" ? <CheckCircle2 size={20} /> : s === "rejected" ? <XCircle size={20} /> : <AlertCircle size={20} />}
                                                </div>
                                                <span className="font-semibold capitalize text-gray-900 dark:text-white">{s}</span>
                                            </div>
                                            {editFormData.status === s && <div className="w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_0_4px_rgba(59,130,246,0.2)]" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <button
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        await handleStatusUpdate(editFormData.id, editFormData.status);
                                        setShowEditModal(false);
                                    }}
                                    className="px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                >
                                    Update Status
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Class6RegForm;
