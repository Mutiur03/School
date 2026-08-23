import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import axios from 'axios';
import { useEffect, useState, useMemo, useDeferredValue } from 'react';
import { toast } from 'react-hot-toast';
import { Search, Image as ImageIcon, FileText, Users, Loader2 } from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  StatsCard,
  StatusBadge,
  FilterSelection,
  FilterField,
  filterSelectClassName,
  filterInputClassName,
} from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActionButton from '@/components/ActionButton';
import DeleteConfirmation from '@/components/DeleteConfimation';
import { formatDateWithTime } from '@/lib/utils';
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
}

interface AdmissionSettingsMeta {
  class_list?: string | string[];
  admission_year?: string | number;
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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [meta, setMeta] = useState<{
    total: number;
    pending: number;
    approved: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsMeta, setSettingsMeta] = useState<AdmissionSettingsMeta>({});
  const [filters, setFilters] = useState<Filters>({
    status: 'all',
    class: '',
    admission_year: '',
    search: '',
  });
  const deferredFilters = useDeferredValue(filters);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedAdmission, setSelectedAdmission] = useState<AdmissionData | null>(null);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editFormData, setEditFormData] = useState<EditFormData>({});
  const [pdfDownloading, setPdfDownloading] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadSettings() {
      try {
        const res = await axios.get(`/api/admission/`);
        if (cancelled) return;
        const data = res.data?.data ?? res.data ?? {};
        setSettingsMeta({
          class_list: data.class_list,
          admission_year: data.admission_year,
        });
        if (data.admission_year) {
          setFilters((prev) =>
            prev.admission_year ? prev : { ...prev, admission_year: String(data.admission_year) },
          );
        }
      } catch {
        /* settings optional for list */
      }
    }
    loadSettings();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [deferredFilters]);

  useEffect(() => {
    const controller = new AbortController();
    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get(`/api/admission/form/`, {
          signal: controller.signal,
          params: {
            page,
            limit,
            status: deferredFilters.status,
            class: deferredFilters.class || undefined,
            admission_year: deferredFilters.admission_year || undefined,
            search: deferredFilters.search.trim() || undefined,
          },
        });
        const payload = resp.data?.data;
        if (payload && Array.isArray(payload.data) && payload.meta) {
          setItems(payload.data);
          setMeta(payload.meta);
        } else if (Array.isArray(payload)) {
          setItems(payload);
          setMeta(null);
        } else {
          setItems([]);
          setMeta(null);
        }
      } catch (err: unknown) {
        if (axios.isCancel(err) || (err as { name?: string }).name === 'CanceledError') return;
        if ((err as { name?: string }).name !== 'AbortError')
          setError((err as Error).message || 'Failed');
      } finally {
        setLoading(false);
      }
    }
    fetchPage();
    return () => controller.abort();
  }, [page, limit, deferredFilters, refreshKey]);

  const year = settingsMeta.admission_year ? String(settingsMeta.admission_year) : '';

  const stats = useMemo(() => {
    const pageItems = items || [];
    return {
      total: {
        filtered: pageItems.length,
        all: meta?.total ?? pageItems.length,
      },
      pending: {
        filtered: pageItems.filter((r) => r.status === 'pending').length,
        all: meta?.pending ?? 0,
      },
      approved: {
        filtered: pageItems.filter((r) => r.status === 'approved').length,
        all: meta?.approved ?? 0,
      },
    };
  }, [items, meta]);

  const renderCount = (filtered: number, total: number) => {
    if (!total || filtered === total) return total || filtered;
    return `${filtered} / ${total}`;
  };

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
    return <StatusBadge status={st || 'unknown'} />;
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
      setRefreshKey((k) => k + 1);
      toast.success('Status updated');
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to update status');
    } finally {
      setLoading(false);
      setShowEditModal(false);
    }
  }

  async function handleDelete(id: string | number) {
    try {
      setLoading(true);
      await axios.delete(`/api/admission/form/${id}`);
      setRefreshKey((k) => k + 1);
      toast.success('Admission deleted successfully');
    } catch (err: unknown) {
      console.error(err);
      if (axios.isAxiosError(err))
        setError(err.response?.data?.message || 'Failed to delete admission');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Admissions"
        description="Review and manage student admission applications."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          label="Total Applications"
          value={renderCount(stats.total.filtered, stats.total.all)}
          loading={loading}
        />
        <StatsCard
          label="Pending"
          value={renderCount(stats.pending.filtered, stats.pending.all)}
          color="amber"
          loading={loading}
        />
        <StatsCard
          label="Approved"
          value={renderCount(stats.approved.filtered, stats.approved.all)}
          color="emerald"
          loading={loading}
        />
      </div>

      <FilterSelection
        headerAction={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              <FileText size={18} />
              <span>Export Sheet</span>
            </button>
            <button
              type="button"
              onClick={handleExportImages}
              disabled={loading}
              className="bg-primary hover:bg-primary/90 flex items-center gap-2 rounded-lg px-4 py-2 text-white shadow-sm transition-colors disabled:opacity-50"
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
              placeholder="Search by name, roll, birth reg..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className={`${filterInputClassName} pl-9`}
            />
          </div>
        </FilterField>

        <FilterField label="Status">
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className={filterSelectClassName}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
        </FilterField>

        <FilterField label="Class">
          <select
            value={filters.class}
            onChange={(e) => setFilters((prev) => ({ ...prev, class: e.target.value }))}
            className={filterSelectClassName}
          >
            {(() => {
              const raw = settingsMeta.class_list || '';
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
        </FilterField>

        <FilterField label="Admission Year">
          <select
            value={filters.admission_year}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                admission_year: e.target.value,
              }))
            }
            className={filterSelectClassName}
          >
            <option value="">All Years</option>
            {(() => {
              let currentYear = null;
              if (year) {
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
        </FilterField>
      </FilterSelection>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>
      )}

      <SectionCard noPadding className="mb-0">
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border border-b">
                <th className="text-foreground/70 px-6 py-3 text-left text-xs font-semibold tracking-wider uppercase">
                  Student
                </th>
                <th className="text-foreground/70 px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                  Class
                </th>
                <th className="text-foreground/70 px-6 py-3 text-center text-xs font-semibold tracking-wider uppercase">
                  User ID
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="text-primary h-8 w-8 animate-spin" />
                      <p className="text-muted-foreground text-sm">Loading admissions...</p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground py-12 text-center">
                    No admissions found
                  </td>
                </tr>
              ) : (
                items.map((admission) => (
                  <tr key={admission.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {admission.photo_path ? (
                          <img
                            className="border-border h-10 w-10 rounded-full border object-cover"
                            src={`${getFileUrl(admission.photo_path)}`}
                            alt=""
                          />
                        ) : (
                          <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full">
                            <Users size={18} />
                          </div>
                        )}
                        <div>
                          <div className="text-foreground font-medium">
                            {admission.student_name_en}
                          </div>
                          <div className="text-muted-foreground text-sm">
                            {admission.student_name_bn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                        {admission.admission_class || admission.section || '-'}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-6 py-4 text-center font-mono font-medium">
                      {admission.admission_user_id || admission.roll || admission.serial_no || '-'}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(admission.status)}</td>
                    <td className="text-muted-foreground px-6 py-4 text-sm">
                      {formatDateWithTime(admission.created_at || admission.submission_date || '')}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="view"
                          onClick={() => handleViewDetails(admission.id)}
                        />
                        <ActionButton action="edit" onClick={() => handleEdit(admission.id)} />
                        <DeleteConfirmation onDelete={() => handleDelete(admission.id)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="lg:hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Loading admissions...</p>
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              No admissions found
            </p>
          ) : (
            <ul className="-mx-0">
              {items.map((admission) => (
                <li
                  key={admission.id}
                  className="border-border space-y-3 border-b p-4 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    {admission.photo_path ? (
                      <img
                        className="border-border h-12 w-12 shrink-0 rounded-full border object-cover"
                        src={`${getFileUrl(admission.photo_path)}`}
                        alt=""
                      />
                    ) : (
                      <div className="bg-muted text-muted-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
                        <Users size={20} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground font-medium">{admission.student_name_en}</div>
                      <div className="text-muted-foreground text-sm">
                        {admission.student_name_bn}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                          Class {admission.admission_class || admission.section || '-'}
                        </span>
                        <span className="bg-muted inline-flex items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-medium">
                          {admission.admission_user_id ||
                            admission.roll ||
                            admission.serial_no ||
                            '-'}
                        </span>
                        {getStatusBadge(admission.status)}
                      </div>
                      <p className="text-muted-foreground mt-2 text-sm">
                        {formatDateWithTime(
                          admission.created_at || admission.submission_date || '',
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <ActionButton action="view" onClick={() => handleViewDetails(admission.id)} />
                    <ActionButton action="edit" onClick={() => handleEdit(admission.id)} />
                    <DeleteConfirmation onDelete={() => handleDelete(admission.id)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-sm">
            Page {meta?.page ?? page} of {meta?.totalPages ?? 0}
            {meta?.total != null ? (
              <span className="text-muted-foreground/80"> · {meta.total} total</span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows</span>
              <select
                className={filterSelectClassName}
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
              if (totalPages <= 0) return null;
              if (totalPages <= maxVisible) {
                return Array.from({ length: totalPages }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={i + 1 === currentPage ? 'default' : 'outline'}
                    onClick={() => setPage(i + 1)}
                    disabled={loading}
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
                    disabled={loading}
                  >
                    {p}
                  </Button>
                ),
              );
            })()}
          </div>
        </div>
      </SectionCard>

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
                <div className="max-w-full overflow-x-auto">
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
                            formatDateWithTime(selectedAdmission.submission_date || '')
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
    </div>
  );
}

export default Admission;
