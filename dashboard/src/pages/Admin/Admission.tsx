import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
interface AdmissionData {
  id: string | number;
  status: string;
  student_name_en: string;
  student_name_bn?: string;
  admission_class?: string;
  section?: string;
  class?: string;
  admission_user_id?: string;
  roll?: string;
  serial_no?: string;
  birth_reg_no?: string;
  admission_year?: number | string;
  prev_school_passing_year?: number | string;
  year?: number | string;
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

interface Filters {
  status: string;
  class: string;
  admission_year: string;
  search: string;
  class_list?: string | string[];
}

interface EditFormData {
  id?: string | number;
  status?: string;
  student_name_en?: string;
  class?: string;
  admission_user_id?: string;
}

function Admission() {
  const [items, setItems] = useState<AdmissionData[]>([]);
  const [limit] = useState<number>(20);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<string>('');
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    class: '',
    admission_year: '',
    search: '',
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedAdmission, setSelectedAdmission] = useState<AdmissionData | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteTargetAdmission, setDeleteTargetAdmission] = useState<AdmissionData | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState<boolean>(false);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/admission/`);
        setFilters((prev) => ({ ...(prev || {}), ...(res.data || {}) }));
        setYear((res.data && res.data.admission_year) || '');
        const resp = await axios.get(`/api/admission/form/`);
        const json = resp.data;
        const data = json.data || [];
        setItems(data);
      } catch (err: unknown) {
        if ((err as { name?: string }).name !== 'AbortError')
          setError((err as Error).message || 'Failed');
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
    return () => controller.abort();
  }, [limit]);

  function formatDate(d: string | undefined, includeTime = true): string {
    if (!d) return '-';
    try {
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return d;
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      if (!includeTime) return `${dd}/${mm}/${yyyy}`;
      let hours = dt.getHours();
      const minutes = String(dt.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      const hh = String(hours).padStart(2, '0');
      return `${dd}/${mm}/${yyyy} ${hh}:${minutes} ${ampm}`;
    } catch {
      return d;
    }
  }

  const filteredAdmissions = items.filter((r) => {
    if (!r) return false;
    if (filters.status && filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.class) {
      const cls = r.admission_class || r.section || r.class;
      if (cls !== filters.class) return false;
    }
    if (filters.admission_year) {
      let ay: number | string | null =
        r.admission_year || r.prev_school_passing_year || r.year || null;
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
        .join(' ')
        .toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const yearStats = (() => {
    const year = filters.admission_year && String(filters.admission_year).trim();
    const arr = items.filter((r) => {
      if (!year) return true;
      let ay: number | string | null =
        r.admission_year || r.prev_school_passing_year || r.year || null;
      if (!ay) {
        const dateStr = r.submission_date || r.created_at || null;
        if (dateStr) {
          try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) ay = d.getFullYear();
          } catch (e) {
            console.error(e);
          }
        }
      }
      return ay != null && String(ay) === String(year);
    });

    return {
      total: arr.length,
      pending: arr.filter((d) => d && d.status === 'pending').length,
      approved: arr.filter((d) => d && d.status === 'approved').length,
    };
  })();

  const formatQuota = (q: string | undefined): string | null => {
    if (!q) return null;
    const key = String(q).trim();
    const map: Record<string, string> = {
      '(GEN)': 'সাধারণ (GEN)',
      '(DIS)': 'বিশেষ চাহিদা সম্পন্ন ছাত্র (DIS)',
      '(FF)': 'মুক্তিযোদ্ধার সন্তান (FF)',
      '(GOV)': 'সরকারী প্রাথমিক বিদ্যালয়ের ছাত্র (GOV)',
      '(ME)': 'শিক্ষা মন্ত্রণালয়ের কর্মকর্তা-কর্মচারী (ME)',
      '(SIB)': 'সহোদর ভাই (SIB)',
      '(TWN)': 'যমজ (TWN)',
      '(Mutual Transfer)': 'পারস্পরিক বদলি (Mutual Transfer)',
      '(Govt. Transfer)': 'সরকারি বদলি (Govt. Transfer)',
    };

    if (key in map) return map[key];

    const normalized = key.replace(/\s+/g, ' ').trim();
    if (normalized in map) return map[normalized];

    const noParens = normalized.replace(/[()]/g, '').trim();
    const withParens = `(${noParens})`;
    if (withParens in map) return map[withParens];

    return normalized;
  };

  const formatParentIncome = (p: string | undefined): string | null => {
    if (!p) return null;
    const key = String(p).trim();
    const map: Record<string, string> = {
      below_50000: '0 - 50,000',
      '50000_100000': '50,000 - 100,000',
      '100001_200000': '100,001 - 200,000',
      '200001_500000': '200,001 - 500,000',
      above_500000: 'Above 500,000',
    };
    if (map[key]) return map[key];
    const fallback = key.replace(/_/g, ' ').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    return fallback;
  };

  function getStatusBadge(st: string) {
    return (
      <span
        className={
          `inline-block rounded-full px-2 py-1 text-xs font-semibold ` +
          (st === 'approved'
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40'
            : st === 'pending'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30'
              : st === 'rejected'
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30'
                : 'bg-gray-200 text-gray-800 dark:bg-slate-700/30')
        }
      >
        {st || 'unknown'}
      </span>
    );
  }

  function handleExport() {
    (async () => {
      try {
        const params = {
          status: filters.status,
          search: filters.search,
          admission_year: filters.admission_year,
          class: filters.class,
        };
        const response = await axios.get(`/api/admission/form/excel`, {
          responseType: 'blob',
          params,
        });
        const blob = new Blob([response.data], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(blob, `admissions_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
      } catch (err) {
        console.error(err);
        setError('Failed to export Excel');
      }
    })();
  }

  function handleExportImages() {
    (async () => {
      try {
        const params = {
          status: filters.status,
          search: filters.search,
          admission_year: filters.admission_year,
          class: filters.class,
        };
        const response = await axios.get(`/api/admission/form/images-export`, {
          responseType: 'blob',
          params,
        });
        const blob = new Blob([response.data], { type: 'application/zip' });
        const yearPart = params.admission_year ? params.admission_year : 'all';
        downloadBlob(blob, `admission_images_${yearPart}.zip`);
      } catch (err) {
        console.error(err);
        setError('Failed to export images');
      }
    })();
  }

  function handleViewDetails(id: string | number) {
    const admission = items.find((x) => x.id === id);
    setSelectedAdmission(admission || null);
    setShowModal(true);
  }

  function handleEdit(id: string | number) {
    const admission = items.find((x) => x.id === id);
    setEditFormData(
      admission
        ? {
            id: admission.id,
            status: admission.status,
            student_name_en: admission.student_name_en,
            class: admission.admission_class || admission.section,
            admission_user_id: admission.admission_user_id || admission.roll || admission.serial_no,
          }
        : {},
    );
    setShowEditModal(true);
  }

  async function handleEditSubmit() {
    if (!editFormData || !editFormData.id) return;
    try {
      setLoading(true);
      if (editFormData.status === 'pending')
        await axios.put(`/api/admission/form/${editFormData.id}/pending`);
      else await axios.put(`/api/admission/form/${editFormData.id}/approve`);
      setItems((prev) =>
        prev.map((it) =>
          it.id === editFormData.id ? { ...it, status: editFormData.status || it.status } : it,
        ),
      );
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to update status');
    } finally {
      setLoading(false);
      setShowEditModal(false);
    }
  }

  function confirmDelete(admission: AdmissionData) {
    setDeleteTargetAdmission(admission);
    setShowDeleteModal(true);
  }

  async function handleDelete(id: string | number) {
    try {
      setLoading(true);
      await axios.delete(`/api/admission/form/${id}`);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setDeleteTargetAdmission(null);
      toast.success('Admission deleted successfully');
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err))
        setError(err.response?.data?.message || 'Failed to delete admission');
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  }

  return (
    <div className="min-h-screen p-4">
      <header className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Admissions</h1>
      </header>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-border rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 text-sm">Total</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {(() => {
              const f = filteredAdmissions.length;
              const t = yearStats.total || 0;
              if (f == t) return t;
              return `${f} / ${t}`;
            })()}
          </div>
        </div>

        <div className="border-border rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 text-sm">Pending</div>
          <div className="text-2xl font-semibold text-amber-600">
            {(() => {
              const f = filteredAdmissions.filter((a) => a.status === 'pending').length;
              const t = yearStats.pending || 0;
              if (filteredAdmissions.length == yearStats.total) return t;
              return `${f} / ${t}`;
            })()}{' '}
          </div>
        </div>

        <div className="border-border rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-1 text-sm">Approved</div>
          <div className="text-2xl font-semibold text-emerald-600">
            {(() => {
              const f = filteredAdmissions.filter((a) => a.status === 'approved').length;
              const t = yearStats.approved || 0;
              if (filteredAdmissions.length == yearStats.total) return t;
              return `${f} / ${t}`;
            })()}{' '}
          </div>
        </div>
      </div>

      <div className="border-border mb-6 rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center gap-2">
          <svg
            className="text-muted-foreground h-5 w-5 dark:text-gray-300"
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
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Filters</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={filters.status}
              onChange={(e) => {
                const v = e.target.value;
                setFilters((prev) => ({ ...prev, status: v }));
              }}
              className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:ring-2"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Class</label>
            <select
              value={filters.class}
              onChange={(e) => setFilters((prev) => ({ ...prev, class: e.target.value }))}
              className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:ring-2"
            >
              {(() => {
                const raw = filters.class_list || '';
                let formList: string[] = [];

                if (Array.isArray(raw)) {
                  formList = raw;
                } else if (typeof raw === 'string' && raw.trim()) {
                  const rows = raw
                    .split(/\r?\n/)
                    .map((r) => r.trim())
                    .filter(Boolean);

                  if (rows.length === 1) {
                    formList = rows[0]
                      .split(/[,;]+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                  } else {
                    formList = rows
                      .map((r) => {
                        const cols = r
                          .split(/[,;]+/)
                          .map((c) => c.trim())
                          .filter(Boolean);
                        return cols.length ? cols[0] : null;
                      })
                      .filter((item): item is string => item !== null);
                  }
                }
                formList = Array.from(new Set(formList));

                const allList = Array.from(
                  new Set((items || []).map((a) => a.admission_class || '').filter(Boolean)),
                ).sort();

                return (
                  <>
                    <option value="">All Classes</option>
                    {formList.map((cls) => (
                      <option key={`form-${cls}`} value={cls}>
                        {cls}
                      </option>
                    ))}

                    {allList.filter((c) => !formList.includes(c)).length > 0 && (
                      <optgroup
                        label={`Other classes (${
                          allList.filter((c) => !formList.includes(c)).length
                        })`}
                      >
                        {allList
                          .filter((c) => !formList.includes(c))
                          .map((cls) => (
                            <option key={`all-${cls}`} value={cls}>
                              {cls}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </>
                );
              })()}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Admission Year</label>
            <select
              value={filters.admission_year}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  admission_year: e.target.value,
                }))
              }
              className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 focus:border-blue-500 focus:ring-2"
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
            <label className="mb-1 block text-sm font-medium">Search</label>
            <div className="relative">
              <svg
                className="absolute top-2.5 left-3 h-4 w-4 text-gray-400"
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
                placeholder="Search by name, roll, birth reg, admission..."
                value={filters.search}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilters((prev) => ({ ...prev, search: v }));
                }}
                className="dark:bg-accent text-input border-border focus:ring-primary/20 w-full rounded-lg border py-2 pr-3 pl-10 focus:border-blue-500 focus:ring-2"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          {error}
        </div>
      )}

      <div className="bg-card text-card-foreground border-border overflow-hidden rounded-xl border shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="border-border bg-card border-b px-6 py-4 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Admissions</h3>
              <p className="text-muted-foreground mt-1 text-sm dark:text-gray-400">
                Showing {filteredAdmissions.length} of {items.length} students
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-700 dark:bg-blue-900/10 dark:text-blue-200"
              >
                <svg
                  className="h-4 w-4 text-blue-700 dark:text-blue-200"
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
                  <path d="M12 5v12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Excel
              </button>
              <button
                onClick={handleExportImages}
                disabled={loading}
                title="Export student images as ZIP"
                className="bg-muted/50 border-border hover:bg-muted inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-gray-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800/10 dark:text-gray-200"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
                </svg>
                Images
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-border border-b dark:border-gray-600 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Admission User ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase dark:text-gray-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2 dark:border-blue-300"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredAdmissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-muted-foreground px-6 py-12 text-center dark:text-gray-400"
                  >
                    No admissions found
                  </td>
                </tr>
              ) : (
                filteredAdmissions.map((admission) => (
                  <tr key={admission.id} className="hover:bg-muted/50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {admission.photo_path && (
                          <img
                            className="border-border h-10 w-10 rounded-full border object-cover dark:border-gray-600"
                            src={`${getFileUrl(admission.photo_path)}`}
                            alt=""
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {admission.student_name_en}
                          </div>
                          <div className="text-muted-foreground text-sm dark:text-gray-400">
                            {admission.student_name_bn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                        Class {admission.admission_class || admission.section || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-muted inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                        {admission.admission_user_id ||
                          admission.roll ||
                          admission.serial_no ||
                          '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(admission.status)}</td>
                    <td className="text-muted-foreground px-6 py-4 text-sm dark:text-gray-400">
                      {formatDate(admission.created_at || admission.submission_date)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(admission.id)}
                          className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 transition-colors hover:bg-blue-200 dark:bg-blue-900/10 dark:text-blue-200 dark:hover:bg-blue-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(admission.id)}
                          className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700 transition-colors hover:bg-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(admission)}
                          className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-200 dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-800"
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

      {showModal && selectedAdmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white text-black shadow-xl">
            <div className="border-border flex items-center justify-between rounded-t-xl border-b bg-linear-to-r from-blue-500 to-blue-400 p-6 text-white">
              <div>
                <h3 className="text-lg font-semibold">Admission Details</h3>
                <p className="mt-1 text-sm opacity-90">Complete student information</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white transition-colors hover:text-gray-200"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {selectedAdmission.photo_path && (
                <div className="bg-muted/50 border-border mb-6 flex flex-col items-center rounded-lg border p-4">
                  <h4 className="mb-2 text-sm font-semibold">Student's Photo</h4>
                  <img
                    src={`${getFileUrl(selectedAdmission.photo_path)}`}
                    alt="Student Photo"
                    className="border-border h-28 w-28 rounded-lg border-2 object-cover shadow"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="border-border bg-muted/50 mb-6 flex flex-wrap gap-x-4 gap-y-1 rounded border px-3 py-2 text-sm font-medium text-gray-800 shadow-sm">
                <span>Class: {selectedAdmission.admission_class || '-'}</span>
                <span>Admission User ID: {selectedAdmission.admission_user_id || '-'}</span>
                <span>Serial No: {selectedAdmission.serial_no || '-'}</span>
                <span>Qouta Year: {formatQuota(selectedAdmission.qouta) || '-'}</span>
                <span className="ml-auto">Status: {getStatusBadge(selectedAdmission.status)}</span>
              </div>
              <div className="border-border overflow-hidden rounded-lg border bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr>
                        <td
                          colSpan={2}
                          className="border-b bg-blue-100 px-4 py-3 text-lg font-bold text-blue-800"
                        >
                          ভর্তি তথ্য (Admission Information)
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Admission Class:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.admission_class || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">List Type:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.list_type || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Admission User ID:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.admission_user_id || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Serial No:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.serial_no || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Qouta:</td>
                        <td className="px-4 py-2">
                          {formatQuota(selectedAdmission.qouta) || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td
                          colSpan={2}
                          className="border-b bg-blue-100 px-4 py-3 text-lg font-bold text-blue-800"
                        >
                          ব্যক্তিগত তথ্য (Personal Information)
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="bg-muted/50 px-4 py-2 font-medium">ছাত্রের নাম :</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.student_name_bn || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">
                          Student's Name (In Capital Letter):
                        </td>
                        <td className="px-4 py-2">
                          {selectedAdmission.student_name_en || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="bg-muted/50 px-4 py-2 font-medium">
                          Student Nickname (BN):
                        </td>
                        <td className="px-4 py-2">
                          {selectedAdmission.student_nick_name_bn || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Birth Registration No.:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.birth_reg_no || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="bg-muted/50 px-4 py-2 font-medium">Registration Number:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.registration_no || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Date of Birth :</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.birth_date ? (
                            (() => {
                              const formatDateLong = (dateStr: string) => {
                                if (!dateStr) return '';
                                let d, m, y;
                                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                                  [d, m, y] = dateStr.split('/');
                                } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                                  [y, m, d] = dateStr.split('-');
                                } else {
                                  return dateStr;
                                }
                                const dateObj = new Date(`${y}-${m}-${d}`);
                                if (isNaN(dateObj.getTime())) return dateStr;
                                return dateObj.toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                });
                              };
                              return formatDateLong(selectedAdmission.birth_date);
                            })()
                          ) : (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>

                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Blood Group:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.blood_group || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Email Address:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.email || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Religion:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.religion || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td
                          colSpan={2}
                          className="border-b bg-blue-100 px-4 py-3 text-lg font-bold text-blue-800"
                        >
                          অবস্থান (Address)
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="bg-muted/50 px-4 py-2 font-medium">Present Address:</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [
                              selectedAdmission.present_village_road,
                              selectedAdmission.present_post_office
                                ? selectedAdmission.present_post_code
                                  ? `${selectedAdmission.present_post_office} (${selectedAdmission.present_post_code})`
                                  : selectedAdmission.present_post_office
                                : '',
                              selectedAdmission.present_upazila,
                              selectedAdmission.present_district,
                            ]
                              .filter(Boolean)
                              .map((s) => String(s).trim())
                              .filter(Boolean);
                            return parts.length > 0 ? (
                              parts.join(', ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Permanent Address:</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [
                              selectedAdmission.permanent_village_road,
                              selectedAdmission.permanent_post_office
                                ? selectedAdmission.permanent_post_code
                                  ? `${selectedAdmission.permanent_post_office} (${selectedAdmission.permanent_post_code})`
                                  : selectedAdmission.permanent_post_office
                                : '',
                              selectedAdmission.permanent_upazila,
                              selectedAdmission.permanent_district,
                            ]
                              .filter(Boolean)
                              .map((s) => String(s).trim())
                              .filter(Boolean);
                            return parts.length > 0 ? (
                              parts.join(', ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>

                      <tr>
                        <td
                          colSpan={2}
                          className="border-b bg-blue-100 px-4 py-3 text-lg font-bold text-blue-800"
                        >
                          অভিভাবক / পূর্বের স্কুল (Guardian / Previous School)
                        </td>
                      </tr>
                      <tr className="border-b">
                        <td className="bg-muted/50 px-4 py-2 font-medium">Guardian Info:</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [
                              selectedAdmission.guardian_name
                                ? `Name: ${selectedAdmission.guardian_name}`
                                : '',
                              selectedAdmission.guardian_relation
                                ? `Relation: ${selectedAdmission.guardian_relation}`
                                : '',
                              selectedAdmission.guardian_phone
                                ? `Phone: ${selectedAdmission.guardian_phone}`
                                : '',
                              selectedAdmission.guardian_nid
                                ? `NID: ${selectedAdmission.guardian_nid}`
                                : '',
                            ].filter(Boolean);
                            return parts.length > 0 ? (
                              parts.join(', ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Guardian Address:</td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [
                              selectedAdmission.guardian_village_road,
                              selectedAdmission.guardian_post_office
                                ? selectedAdmission.guardian_post_code
                                  ? `${selectedAdmission.guardian_post_office} (${selectedAdmission.guardian_post_code})`
                                  : selectedAdmission.guardian_post_office
                                : '',
                              selectedAdmission.guardian_upazila,
                              selectedAdmission.guardian_district,
                            ]
                              .filter(Boolean)
                              .map((s) => String(s).trim())
                              .filter(Boolean);
                            return parts.length > 0 ? (
                              parts.join(', ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">
                          Previous School Name & Address:
                        </td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [
                              selectedAdmission.prev_school_name,
                              selectedAdmission.prev_school_upazila,
                              selectedAdmission.prev_school_district,
                            ]
                              .filter(Boolean)
                              .map((s) => String(s).trim());
                            return parts.length > 0 ? (
                              parts.join(', ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">
                          Previous School Academic Info:
                        </td>
                        <td className="px-4 py-2">
                          {(() => {
                            const parts = [];
                            if (selectedAdmission.section_in_prev_school)
                              parts.push(`Section: ${selectedAdmission.section_in_prev_school}`);
                            if (selectedAdmission.roll_in_prev_school)
                              parts.push(`Roll: ${selectedAdmission.roll_in_prev_school}`);
                            if (selectedAdmission.prev_school_passing_year)
                              parts.push(`Year: ${selectedAdmission.prev_school_passing_year}`);
                            return parts.length > 0 ? (
                              parts.join(' / ')
                            ) : (
                              <span className="text-gray-400">Not provided</span>
                            );
                          })()}
                        </td>
                      </tr>

                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Father's Name (BN):</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.father_name_bn || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Father's Name (EN):</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.father_name_en || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">
                          Father's National ID Number:
                        </td>
                        <td className="px-4 py-2">
                          {selectedAdmission.father_nid || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Father's Mobile Number:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.father_phone || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Mother's Name (BN):</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.mother_name_bn || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Mother's Name (EN):</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.mother_name_en || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">
                          Mother's National ID Number:
                        </td>
                        <td className="px-4 py-2">
                          {selectedAdmission.mother_nid || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Mother's Mobile Number:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.mother_phone || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>

                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Father's Profession:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.father_profession || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-muted/50 border-b">
                        <td className="bg-muted px-4 py-2 font-medium">Mother's Profession:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.mother_profession || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">
                          Parent's Annual Income:
                        </td>
                        <td className="px-4 py-2">
                          {formatParentIncome(selectedAdmission.parent_income) || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Whatsapp Number:</td>
                        <td className="px-4 py-2">
                          {selectedAdmission.whatsapp_number || (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td className="bg-muted/50 px-4 py-2 font-medium">Submission Date:</td>
                        <td className="px-4 py-2">
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
            <div className="border-border bg-muted/50 flex items-center justify-between border-t p-6">
              <div className="text-muted-foreground text-sm">
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
                        { responseType: 'blob' },
                      );
                      const blob = new Blob([response.data], {
                        type: 'application/pdf',
                      });
                      downloadBlob(blob, `${selectedAdmission.student_name_en}.pdf`);
                    } catch (err) {
                      console.error(err);
                      setError('Failed to download PDF');
                    } finally {
                      setPdfDownloading(false);
                    }
                  }}
                  disabled={pdfDownloading}
                  className="bg-primary hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pdfDownloading ? (
                    <span className="inline-block h-4 w-4 animate-spin border-b-2 border-white"></span>
                  ) : (
                    <>Download PDF</>
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="bg-muted rounded-lg px-4 py-2 transition-colors hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="relative mx-auto w-96 rounded-md border bg-white p-5 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Update Admission Status</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="hover:text-muted-foreground text-gray-400"
              >
                ×
              </button>
            </div>
            <div className="mb-4">
              <div className="text-muted-foreground mb-3 text-sm">
                <strong>Student:</strong> {editFormData.student_name_en || 'N/A'}
                <br />
                <strong>Class:</strong> {editFormData.class || 'N/A'} |{' '}
                <strong>Admission User ID:</strong> {editFormData.admission_user_id || 'N/A'}
              </div>
              <label className="mb-2 block text-sm font-medium">Admission Status</label>
              <select
                value={editFormData.status || 'pending'}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                className="border-border focus:ring-primary/20 w-full rounded border px-3 py-2 text-black focus:border-blue-500 focus:ring-2 dark:bg-white"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
              </select>
              <p className="mt-1 text-xs text-red-500">
                Only status can be modified for existing admissions
              </p>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="border-border rounded border bg-red-500 px-4 py-2 hover:bg-red-700"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="bg-primary hover:bg-primary/90 rounded px-4 py-2 text-white"
              >
                Update Status
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTargetAdmission && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteModal(false);
          }}
        >
          <div className="relative top-20 mx-auto w-96 rounded-md border bg-white p-5 shadow-lg">
            <div className="mt-3 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
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
              <h3 className="mt-2 text-lg leading-6 font-medium text-gray-900">Delete Admission</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-muted-foreground text-sm">
                  Are you sure you want to delete the admission for{' '}
                  <strong>{deleteTargetAdmission.student_name_en}</strong>? This action cannot be
                  undone.
                </p>
              </div>
              <div className="px-4 py-3">
                <div className="flex justify-between">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="rounded-md bg-gray-300 px-4 py-2 text-base font-medium shadow-sm hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteTargetAdmission.id)}
                    className="rounded-md bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700"
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
