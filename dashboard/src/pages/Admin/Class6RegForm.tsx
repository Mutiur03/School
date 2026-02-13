import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Eye,
    Filter,
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

const host = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const Class6RegForm = () => {
    const [activeTab, setActiveTab] = useState("registrations");
    const [registrations, setRegistrations] = useState([]);
    const [settings, setSettings] = useState({
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
    const [selectedNotice, setSelectedNotice] = useState(null);
    const [filters, setFilters] = useState({
        status: "all",
        section: "",
        year: new Date().getFullYear().toString(),
        search: ""
    });
    const [showDetails, setShowDetails] = useState(false);
    const [selectedReg, setSelectedReg] = useState(null);
    const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${host}/api/reg/class-6`);
            if (res.data.success) {
                setSettings(res.data.data);
            }
        } catch (error) {
            console.error("Fetch settings error:", error);
        }
    };

    const fetchRegistrations = useCallback(async () => {
        setLoading(true);
        try {
            const { status, section, year, search } = filters;
            const res = await axios.get(`${host}/api/reg/class-6/form`, {
                params: { status, section, class6_year: year, search }
            });
            if (res.data.success) {
                setRegistrations(res.data.data);
                const data = res.data.data;
                setStats({
                    total: data.length,
                    pending: data.filter(r => r.status === "pending").length,
                    approved: data.filter(r => r.status === "approved").length
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

    const handleSettingsSubmit = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        try {
            let notice_key = settings.notice;

            if (selectedNotice) {
                // 1. Get upload URL
                const { data: urlData } = await axios.post(`${host}/api/reg/class-6/upload-url`, {
                    filename: selectedNotice.name,
                    filetype: selectedNotice.type
                });

                if (urlData.success) {
                    // 2. Upload to R2
                    await axios.put(urlData.url, selectedNotice, {
                        headers: { "Content-Type": selectedNotice.type }
                    });
                    notice_key = urlData.key;
                }
            }

            const payload = {
                ...settings,
                notice_key,
                reg_open: settings.reg_open.toString()
            };

            const res = await axios.post(`${host}/api/reg/class-6`, payload);
            if (res.data.success) {
                toast.success("Settings updated successfully");
                fetchSettings();
                setSelectedNotice(null);
            }
        } catch (error) {
            toast.error("Failed to update settings");
        } finally {
            setFormLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            const res = await axios.put(`${host}/api/reg/class-6/form/${id}/status`, { status });
            if (res.data.success) {
                toast.success(`Registration ${status}`);
                fetchRegistrations();
            }
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleDeleteDetails = async (id) => {
        if (!window.confirm("Are you sure you want to delete this registration?")) return;
        try {
            const res = await axios.delete(`${host}/api/reg/class-6/form/${id}`);
            if (res.data.success) {
                toast.success("Registration deleted");
                fetchRegistrations();
                setShowDetails(false);
            }
        } catch (error) {
            toast.error("Failed to delete registration");
        }
    };

    const handleExport = () => {
        const { status, section, year } = filters;
        window.open(`${host}/api/reg/class-6/form/export?status=${status}&section=${section}&class6_year=${year}`, '_blank');
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case "approved":
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400"><CheckCircle2 size={12} /> Approved</span>;
            case "rejected":
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"><XCircle size={12} /> Rejected</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400"><AlertCircle size={12} /> Pending</span>;
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
                                        type="number"
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
                                        onChange={(e) => setSelectedNotice(e.target.files[0])}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                    {settings.notice && (
                                        <a
                                            href={`${host}/${settings.notice}`}
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
                                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="all">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Section</label>
                                <select
                                    value={filters.section}
                                    onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                                >
                                    <option value="">All</option>
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                </select>
                            </div>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                            >
                                <Download size={18} />
                                Export
                            </button>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                        <th className="px-6 py-4 text-xs font-semibold uppercase">Student Info</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase text-center">Section</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase text-center">Roll</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase text-center">Status</th>
                                        <th className="px-6 py-4 text-xs font-semibold uppercase text-right">Actions</th>
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
                                            <td colSpan={5} className="py-12 text-center text-gray-500">No registrations found</td>
                                        </tr>
                                    ) : (
                                        registrations.map((reg) => (
                                            <tr key={reg.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {reg.photo_path ? (
                                                            <img src={`${host}/${reg.photo_path}`} className="w-10 h-10 rounded-full object-cover border" alt="" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><Users size={18} /></div>
                                                        )}
                                                        <div>
                                                            <p className="font-semibold">{reg.student_name_en}</p>
                                                            <p className="text-xs text-gray-500">{reg.birth_reg_no}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">{reg.section}</td>
                                                <td className="px-6 py-4 text-center font-mono">{reg.roll}</td>
                                                <td className="px-6 py-4 text-center">{getStatusBadge(reg.status)}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedReg(reg);
                                                                setShowDetails(true);
                                                            }}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="View Details"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        {reg.status === "pending" && (
                                                            <button
                                                                onClick={() => handleStatusUpdate(reg.id, "approved")}
                                                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="Approve"
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteDetails(reg.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 size={18} />
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="text-xl font-bold">Registration Data Preview</h3>
                            <button onClick={() => setShowDetails(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full"><XCircle size={24} /></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="md:col-span-1 flex flex-col items-center">
                                    {selectedReg.photo_path ? (
                                        <img src={`${host}/${selectedReg.photo_path}`} className="w-full aspect-square object-cover rounded-xl border shadow-sm mb-4" alt="" />
                                    ) : (
                                        <div className="w-full aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center mb-4"><Users size={64} className="text-gray-400" /></div>
                                    )}
                                    <div className="w-full space-y-2">
                                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
                                            <p className="text-xs text-blue-600 uppercase font-bold mb-1">Status</p>
                                            <div className="flex justify-center">{getStatusBadge(selectedReg.status)}</div>
                                        </div>
                                        {selectedReg.status === "pending" && (
                                            <button
                                                onClick={() => { handleStatusUpdate(selectedReg.id, "approved"); setShowDetails(false); }}
                                                className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors font-semibold"
                                            >
                                                Approve Registration
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="md:col-span-2 space-y-6">
                                    <section>
                                        <h4 className="text-sm font-bold text-blue-600 uppercase mb-3 pb-1 border-b">General Information</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-gray-500">Full Name (BN)</p><p className="font-medium">{selectedReg.student_name_bn}</p></div>
                                            <div><p className="text-gray-500">Full Name (EN)</p><p className="font-medium">{selectedReg.student_name_en}</p></div>
                                            <div><p className="text-gray-500">Birth Reg No</p><p className="font-medium">{selectedReg.birth_reg_no}</p></div>
                                            <div><p className="text-gray-500">Date of Birth</p><p className="font-medium">{selectedReg.birth_date}</p></div>
                                            <div><p className="text-gray-500">Religion</p><p className="font-medium">{selectedReg.religion || "N/A"}</p></div>
                                            <div><p className="text-gray-500">Blood Group</p><p className="font-medium">{selectedReg.blood_group || "N/A"}</p></div>
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-sm font-bold text-blue-600 uppercase mb-3 pb-1 border-b">Parental Information</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-gray-500">Father's Name (EN)</p><p className="font-medium">{selectedReg.father_name_en}</p></div>
                                            <div><p className="text-gray-500">Father's Phone</p><p className="font-medium">{selectedReg.father_phone}</p></div>
                                            <div><p className="text-gray-500">Mother's Name (EN)</p><p className="font-medium">{selectedReg.mother_name_en}</p></div>
                                            <div><p className="text-gray-500">Mother's Phone</p><p className="font-medium">{selectedReg.mother_phone}</p></div>
                                        </div>
                                    </section>
                                    <section>
                                        <h4 className="text-sm font-bold text-blue-600 uppercase mb-3 pb-1 border-b">Academic Info</h4>
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div><p className="text-gray-500">Section</p><p className="font-medium">{selectedReg.section}</p></div>
                                            <div><p className="text-gray-500">Roll No</p><p className="font-medium font-mono">{selectedReg.roll}</p></div>
                                            <div className="col-span-2"><p className="text-gray-500">Previous School</p><p className="font-medium">{selectedReg.prev_school_name}</p></div>
                                        </div>
                                    </section>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Class6RegForm;
