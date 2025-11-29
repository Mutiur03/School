import axios from "axios";
import React, { useEffect, useState } from "react";

function Admission() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [year, setYear] = useState("");
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0 });
  const [filters, setFilters] = useState({
    status: "all",
    class: "",
    admission_year: "",
    search: "",
  });
  const host = import.meta.env.VITE_BACKEND_URL;
  const [showModal, setShowModal] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetAdmission, setDeleteTargetAdmission] = useState(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams();
        q.set("page", page);
        q.set("limit", limit);
        if (status && status !== "all") q.set("status", status);
        if (search) q.set("search", search);
        const res = await axios.get(`/api/admission/`);
        setFilters((prev) => ({ ...(prev || {}), ...(res.data || {}) }));
        setYear((res.data && res.data.admission_year) || "");
        const resp = await axios.get(`/api/admission/form/`);
        const json = resp.data;
        const data = json.data || [];
        setItems(data);
        const total =
          json.pagination && json.pagination.total
            ? json.pagination.total
            : data.length;
        const pending = data.filter((d) => d.status === "pending").length;
        const approved = data.filter((d) => d.status === "approved").length;
        setStats({ total, pending, approved });
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message || "Failed");
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
    return () => controller.abort();
  }, [page, limit, search, status]);
  function formatDate(d) {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  }
  const filteredAdmissions = items.filter((r) => {
    if (!r) return false;
    if (
      filters.status &&
      filters.status !== "all" &&
      r.status !== filters.status
    )
      return false;
    if (filters.class) {
      const cls = r.admission_class || r.section || r.class;
      if (cls !== filters.class) return false;
    }
    if (filters.admission_year) {
      // Records may store the target year under different keys.
      // Try admission_year, prev_school_passing_year, or infer from dates.
      let ay = r.admission_year || r.prev_school_passing_year || r.year || null;
      if (!ay) {
        const dateStr = r.submission_date || r.created_at || null;
        if (dateStr) {
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) ay = d.getFullYear();
        }
      }
      if (!ay || String(ay) !== String(filters.admission_year)) return false;
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const hay = [
        r.student_name_en,
        r.student_name_bn,
        r.serial_no,
        r.admission_user_id,
        r.roll,
        r.birth_reg_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  function getStatusBadge(st) {
    return (
      <span
        className={
          `inline-block px-2 py-1 rounded-full text-xs font-semibold ` +
          (st === "approved"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40"
            : st === "pending"
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30"
            : st === "rejected"
            ? "bg-red-100 text-red-800 dark:bg-red-900/30"
            : "bg-gray-200 text-gray-800 dark:bg-slate-700/30")
        }
      >
        {st || "unknown"}
      </span>
    );
  }

  function handleExport() {
    (async () => {
      try {
        // setLoading(true);
        const params = {
          status: filters.status,
          search: filters.search,
          admission_year: filters.admission_year,
          class: filters.class,
        };
        const response = await axios.get(`/api/admission/form/excel`, {
          responseType: "blob",
          params,
        });
        const blob = new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `admissions_export_${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error(err);
        setError("Failed to export Excel");
      }
      // finally {
      //   setLoading(false);
      // }
    })();
  }

  function handleViewDetails(id) {
    const admission = items.find((x) => x.id === id);
    setSelectedAdmission(admission || null);
    setShowModal(true);
  }

  function handleEdit(id) {
    const admission = items.find((x) => x.id === id);
    setEditFormData(
      admission
        ? {
            id: admission.id,
            status: admission.status,
            student_name_en: admission.student_name_en,
            class: admission.admission_class || admission.section,
            admission_user_id:
              admission.admission_user_id ||
              admission.roll ||
              admission.serial_no,
          }
        : {}
    );
    setShowEditModal(true);
  }

  async function handleEditSubmit() {
    if (!editFormData || !editFormData.id) return;
    try {
      setLoading(true);
      if (editFormData.status === "pending")
        await axios.put(`/api/admission/form/${editFormData.id}/pending`);
      else await axios.put(`/api/admission/form/${editFormData.id}/approve`);
      setItems((prev) =>
        prev.map((it) =>
          it.id === editFormData.id
            ? { ...it, status: editFormData.status }
            : it
        )
      );
      setShowEditModal(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update status");
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete(admission) {
    setDeleteTargetAdmission(admission);
    setShowDeleteModal(true);
  }

  async function handleDelete(id) {
    try {
      setLoading(true);
      await axios.delete(`/api/admission/form/${id}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setShowDeleteModal(false);
      setDeleteTargetAdmission(null);
    } catch (err) {
      console.error(err);
      setError("Failed to delete admission");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-4">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="px-3 py-2 rounded-md border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 min-w-[220px]"
            placeholder="Search by name, birth admission no or serial..."
            value={filters.search}
            onChange={(e) => {
              const v = e.target.value;
              setFilters((prev) => ({ ...prev, search: v }));
              setSearch(v);
              setPage(1);
            }}
            aria-label="Search admissions"
          />

          <select
            className="px-3 py-2 rounded-md border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100"
            value={filters.status}
            onChange={(e) => {
              const v = e.target.value;
              setFilters((prev) => ({ ...prev, status: v }));
              setStatus(v);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <div className="text-sm mb-1">Total</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {stats.total || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <div className="text-sm mb-1">Pending</div>
          <div className="text-2xl font-semibold text-amber-600">
            {stats.pending || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
          <div className="text-sm mb-1">Approved</div>
          <div className="text-2xl font-semibold text-emerald-600">
            {stats.approved || 0}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-gray-500 dark:text-gray-300"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              d="M21 21l-4.35-4.35"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3 className="font-medium text-gray-900 dark:text-gray-100">
            Filters
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({ ...prev, status: v }));
              }}
              className="w-full px-3 py-2 border dark:bg-accent border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Class</label>
            <select
              value={filters.class}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, class: e.target.value }))
              }
              className="w-full px-3 py-2 border dark:bg-accent border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Classes</option>
              {(() => {
                const raw = filters.class_list || "";
                let list = [];

                if (Array.isArray(raw)) {
                  list = raw;
                } else if (typeof raw === "string" && raw.trim()) {
                  const rows = raw
                    .split(/\r?\n/)
                    .map((r) => r.trim())
                    .filter(Boolean);

                  if (rows.length === 1) {
                    list = rows[0]
                      .split(/[,;]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                  } else {
                    list = rows
                      .map((r) => {
                        const cols = r
                          .split(/[,;]+/)
                          .map((c) => c.trim())
                          .filter(Boolean);
                        return cols.length ? cols[0] : null;
                      })
                      .filter(Boolean);
                  }
                }
                list = Array.from(new Set(list)).sort();

                return list.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Admission Year
            </label>
            <select
              value={filters.admission_year}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  admission_year: e.target.value,
                }))
              }
              className="w-full px-3 py-2 border dark:bg-accent  border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Years</option>
              {(() => {
                let currentYear = null;
                if (filters && year) {
                  const parsed = Number(year);
                  currentYear = !isNaN(parsed) ? parsed : null;
                }
                if (!currentYear) currentYear = new Date().getFullYear();

                const years = [];
                for (let i = 0; i <= 5; i++) years.push(currentYear - i);
                return years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ));
              })()}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <svg
                className="absolute left-3 top-2.5 text-gray-400 w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  d="M21 21l-4.35-4.35"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by name, roll, birth admission..."
                value={filters.search}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((prev) => ({ ...prev, search: v }));
                }}
                className="w-full pl-10 dark:bg-accent pr-3 py-2 border text-input border-gray-300 rounded-lg focus:ring-2  focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Admissions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Showing {filteredAdmissions.length} of {items.length} students
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-700"
              >
                <svg
                  className="w-4 h-4 text-blue-700 dark:text-blue-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M7 10l5-5 5 5"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 5v12"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Excel
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Admission User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-300"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                  >
                    No admissions found
                  </td>
                </tr>
              ) : (
                filteredAdmissions.map((admission) => (
                  <tr
                    key={admission.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {admission.photo_path && (
                          <img
                            className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                            src={`${host}/${admission.photo_path}`}
                            alt=""
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {admission.student_name_en}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {admission.student_name_bn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                        Class{" "}
                        {admission.admission_class || admission.section || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                        {admission.admission_user_id ||
                          admission.roll ||
                          admission.serial_no ||
                          "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(admission.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(
                        admission.created_at || admission.submission_date
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(admission.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors dark:bg-blue-900/10 dark:text-blue-200 dark:hover:bg-blue-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(admission.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(admission)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-800"
                        >
                          Delete
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

      {/* View Modal */}
      {showModal && selectedAdmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white text-black rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-linear-to-r from-blue-500 to-blue-400 text-white rounded-t-xl">
              <div>
                <h3 className="text-lg font-semibold">Admission Details</h3>
                <p className="text-sm opacity-90 mt-1">
                  Complete student information
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {selectedAdmission.photo_path && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col items-center mb-6">
                  <h4 className="text-sm font-semibold mb-2">
                    Student's Photo
                  </h4>
                  <img
                    src={`${host}/${selectedAdmission.photo_path}`}
                    alt="Student Photo"
                    className="w-28 h-28 object-cover border-2 border-gray-300 rounded-lg shadow"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1 shadow-sm mb-6">
                <span>
                  Class:{" "}
                  {selectedAdmission.admission_class ||
                    selectedAdmission.section ||
                    "-"}
                </span>
                <span>
                  Admission User ID:{" "}
                  {selectedAdmission.admission_user_id ||
                    selectedAdmission.roll ||
                    "-"}
                </span>
                <span>Religion: {selectedAdmission.religion || "-"}</span>
                <span className="ml-auto">
                  Status: {getStatusBadge(selectedAdmission.status)}
                </span>
              </div>
              <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td
                          colSpan="2"
                          className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                        >
                          বক্তিগত তথ্য (Personal Information)
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 font-medium  bg-gray-50">
                          ছাত্রের নাম :
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.student_name_bn || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 px-4 font-medium  bg-gray-100">
                          Student's Name (In Capital Letter):
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.student_name_en || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="py-2 px-4 font-medium  bg-gray-50">
                          Birth Admission No. (In English):
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.birth_reg_no || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 px-4 font-medium  bg-gray-100">
                          Date of Birth :
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.birth_date ? (
                            (() => {
                              const formatDateLong = (dateStr) => {
                                if (!dateStr) return "";
                                let d, m, y;
                                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                                  [d, m, y] = dateStr.split("/");
                                } else if (
                                  /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
                                ) {
                                  [y, m, d] = dateStr.split("-");
                                } else {
                                  return dateStr;
                                }
                                const dateObj = new Date(`${y}-${m}-${d}`);
                                if (isNaN(dateObj.getTime())) return dateStr;
                                return dateObj.toLocaleDateString("en-GB", {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                });
                              };
                              return formatDateLong(
                                selectedAdmission.birth_date
                              );
                            })()
                          ) : (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 px-4 font-medium  bg-gray-100">
                          Mobile No (s):
                        </td>
                        <td className="py-2 px-4">
                          {[
                            selectedAdmission.father_phone,
                            selectedAdmission.mother_phone,
                            selectedAdmission.guardian_phone,
                          ].filter(Boolean).length > 0
                            ? [
                                selectedAdmission.father_phone,
                                selectedAdmission.mother_phone,
                                selectedAdmission.guardian_phone,
                              ]
                                .filter(Boolean)
                                .join(", ")
                            : "No"}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 px-4 font-medium  bg-gray-50">
                          SSC Batch:
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.ssc_batch || (
                            <span className="text-gray-400">Not set</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 px-4 font-medium  bg-gray-100">
                          Submission Date:
                        </td>
                        <td className="py-2 px-4">
                          {selectedAdmission.submission_date ? (
                            formatDate(selectedAdmission.submission_date)
                          ) : (
                            <span className="text-gray-400">Not available</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                Admission ID: {selectedAdmission.id}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={async () => {
                    if (!selectedAdmission || pdfDownloading) return;
                    setPdfDownloading(true);
                    try {
                      const response = await axios.get(
                        `/api/admission/form/${selectedAdmission.id}/pdf`,
                        { responseType: "blob" }
                      );
                      const blob = new Blob([response.data], {
                        type: "application/pdf",
                      });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `Admission_${
                        selectedAdmission.student_name_en ||
                        selectedAdmission.roll
                      }.pdf`;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch (err) {
                      console.error(err);
                      setError("Failed to download PDF");
                    } finally {
                      setPdfDownloading(false);
                    }
                  }}
                  disabled={pdfDownloading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {pdfDownloading ? (
                    <span className="animate-spin inline-block w-4 h-4 border-b-2 border-white"></span>
                  ) : (
                    <>Download PDF</>
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-gray-100  rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Update Admission Status
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-3">
                <strong>Student:</strong>{" "}
                {editFormData.student_name_en || "N/A"}
                <br />
                <strong>Class:</strong> {editFormData.class || "N/A"} |{" "}
                <strong>Admission User ID:</strong>{" "}
                {editFormData.admission_user_id || "N/A"}
              </div>
              <label className="block text-sm font-medium  mb-2">
                Admission Status
              </label>
              <select
                value={editFormData.status || "pending"}
                onChange={(e) =>
                  setEditFormData({ ...editFormData, status: e.target.value })
                }
                className="w-full border dark:bg-white text-black border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
              <p className="text-xs text-red-500 mt-1">
                Only status can be modified for existing admissions
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 bg-red-500 rounded hover:bg-red-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTargetAdmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-medium text-gray-900 mt-2">
                Delete Admission
              </h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete the admission for{" "}
                  <strong>{deleteTargetAdmission.student_name_en}</strong>? This
                  action cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-300 text-base font-medium rounded-md shadow-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteTargetAdmission.id)}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Admission;
