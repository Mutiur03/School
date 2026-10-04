import React, { useMemo, useRef, useState } from 'react';
import axios, { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
import { cn, formatDateWithTime } from '@/lib/utils';
import { ConfirmationPopup, Popup, SectionCard, filterSelectClassName } from '@/components';
import ActionButton from '@/components/ActionButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdmissionResultRow {
  id: number;
  class_name: string;
  admission_year: number;
  merit_list: string | null;
  waiting_list_1: string | null;
  waiting_list_2: string | null;
  created_at: string;
}

type ListKey = 'merit_list' | 'waiting_list_1' | 'waiting_list_2';

interface FormData {
  class_name: string;
  admission_year: number;
  merit_list: File | string | null;
  waiting_list_1: File | string | null;
  waiting_list_2: File | string | null;
}

interface UploadInitItem {
  type: ListKey;
  filename: string;
  success: boolean;
  error?: string;
  mode: 'simple' | 'multipart';
  uploadUrl?: string;
  key: string;
  uploadId?: string;
  chunkSize?: number;
  endpoints?: { signPart: string; complete: string };
}

const CLASSES = ['6', '7', '8', '9'];
const LIST_TYPES: { key: ListKey; label: string }[] = [
  { key: 'merit_list', label: '1st Result List' },
  { key: 'waiting_list_1', label: 'Waiting List 1' },
  { key: 'waiting_list_2', label: 'Waiting List 2' },
];

// Pinned Class column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="block text-sm font-medium">{label}</span>
    {children}
  </label>
);

const emptyForm = (year: number, className = '6'): FormData => ({
  class_name: className,
  admission_year: year,
  merit_list: null,
  waiting_list_1: null,
  waiting_list_2: null,
});

function AdmissionResult() {
  const queryClient = useQueryClient();
  const thisYear = new Date().getFullYear();

  const settingsQuery = useQuery({
    queryKey: ['admission-settings'],
    queryFn: async () =>
      (await axios.get('/api/admission')).data as { admission_year?: number | string } | null,
  });
  const settingsYear = Number(settingsQuery.data?.admission_year) || null;

  const resultsQuery = useQuery({
    queryKey: ['admission-results'],
    queryFn: async () => (await axios.get<AdmissionResultRow[]>('/api/admission-result')).data,
  });
  const results = useMemo(() => resultsQuery.data ?? [], [resultsQuery.data]);

  const [pickedYear, setPickedYear] = useState<number | null>(null);
  const baseYear = settingsYear ?? thisYear;
  const selectedYear = pickedYear ?? baseYear;
  const yearOptions = useMemo(
    () =>
      [
        ...new Set([
          baseYear,
          baseYear - 1,
          baseYear - 2,
          selectedYear,
          ...results.map((r) => r.admission_year),
        ]),
      ].sort((a, b) => b - a),
    [baseYear, selectedYear, results],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(() => emptyForm(thisYear));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionResultRow | null>(null);
  const fileRefs = {
    merit_list: useRef<HTMLInputElement>(null),
    waiting_list_1: useRef<HTMLInputElement>(null),
    waiting_list_2: useRef<HTMLInputElement>(null),
  };
  const isEditing = editId !== null;

  const yearResults = results.filter((r) => r.admission_year === selectedYear);
  // One row per uploaded record; classes with nothing yet still get a row.
  const rows = CLASSES.flatMap((cls) => {
    const forClass = yearResults.filter((r) => r.class_name === cls);
    return forClass.length
      ? forClass.map((r) => ({ cls, result: r as AdmissionResultRow | null }))
      : [{ cls, result: null }];
  });
  const classesWithResults = new Set(yearResults.map((r) => r.class_name)).size;
  const pdfCount = yearResults.reduce((n, r) => n + LIST_TYPES.filter((l) => r[l.key]).length, 0);

  const openCreate = (className = '6') => {
    setEditId(null);
    setFormData(emptyForm(selectedYear, className));
    setFormOpen(true);
  };

  const openEdit = (result: AdmissionResultRow) => {
    setEditId(result.id);
    setFormData({
      class_name: result.class_name,
      admission_year: result.admission_year,
      merit_list: result.merit_list,
      waiting_list_1: result.waiting_list_1,
      waiting_list_2: result.waiting_list_2,
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    if (isSubmitting) return;
    setFormOpen(false);
    setEditId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: ListKey) => {
    const file = e.target.files?.[0];
    if (file && file.type !== 'application/pdf') {
      toast.error('Please upload only PDF files');
      e.target.value = '';
      setFormData((prev) => ({ ...prev, [field]: null }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: file ?? null }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!/^\d{4}$/.test(String(formData.admission_year))) {
      toast.error('Enter a 4-digit admission year');
      return;
    }

    const filesToUpload = LIST_TYPES.flatMap(({ key }) => {
      const value = formData[key];
      return value instanceof File ? [{ file: value, type: key }] : [];
    });

    if (!isEditing && filesToUpload.length === 0) {
      toast.error('Please upload at least one PDF file');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Preparing upload...');

    try {
      const payload: Record<string, unknown> = {
        class_name: formData.class_name,
        admission_year: formData.admission_year,
      };

      if (filesToUpload.length > 0) {
        toast.loading(`Initializing upload for ${filesToUpload.length} files...`, {
          id: toastId,
        });

        const { data: uploadResponse } = await axios.post('/api/admission-result/upload', {
          files: filesToUpload.map((f) => ({
            filename: f.file.name,
            contentType: f.file.type || 'application/pdf',
            fileSize: f.file.size,
            type: f.type,
          })),
          className: formData.class_name,
          admissionYear: formData.admission_year,
        });

        if (!uploadResponse.success) throw new Error('Failed to initialize uploads');

        await Promise.all(
          (uploadResponse.data as UploadInitItem[]).map(async (item) => {
            const fileObj = filesToUpload.find((f) => f.type === item.type);
            if (!fileObj) return;

            if (!item.success) {
              throw new Error(
                `Error initializing ${item.filename}: ${item.error || 'Unknown error'}`,
              );
            }

            if (item.mode === 'simple') {
              toast.loading(`Uploading ${item.type}...`, { id: toastId });
              await axios.put(item.uploadUrl!, fileObj.file, {
                headers: { 'Content-Type': fileObj.file.type },
                withCredentials: false,
              });
              payload[item.type] = item.key;
            } else if (item.mode === 'multipart') {
              const { uploadId, key, endpoints, chunkSize } = item;
              const PART_SIZE = chunkSize || 10 * 1024 * 1024;
              const totalParts = Math.ceil(fileObj.file.size / PART_SIZE);
              const parts: { ETag: string; PartNumber: number }[] = [];

              for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
                const start = (partNumber - 1) * PART_SIZE;
                const chunk = fileObj.file.slice(
                  start,
                  Math.min(start + PART_SIZE, fileObj.file.size),
                );

                const { data: signData } = await axios.post(endpoints!.signPart, {
                  key,
                  uploadId,
                  partNumber,
                });
                if (!signData.success)
                  throw new Error(`Failed to sign part ${partNumber} for ${item.type}`);

                const uploadRes = await axios.put(signData.url, chunk, {
                  headers: { 'Content-Type': fileObj.file.type },
                  withCredentials: false,
                });

                const etag = uploadRes.headers['etag']?.replace(/"/g, '');
                if (!etag) throw new Error(`Missing ETag for part ${partNumber} of ${item.type}`);
                parts.push({ ETag: etag, PartNumber: partNumber });

                toast.loading(
                  `Uploading ${item.type}: ${((partNumber / totalParts) * 100).toFixed(0)}%`,
                  { id: toastId },
                );
              }

              const { data: completeData } = await axios.post(endpoints!.complete, {
                key,
                uploadId,
                parts,
              });
              if (!completeData.success)
                throw new Error(`Failed to complete upload for ${item.type}`);

              payload[item.type] = key;
            }
          }),
        );
      }

      toast.loading('Saving changes...', { id: toastId });

      if (isEditing) {
        await axios.put(`/api/admission-result/${editId}`, payload);
        toast.success('Admission result updated successfully', { id: toastId });
      } else {
        await axios.post('/api/admission-result', payload);
        toast.success('Admission result uploaded successfully', { id: toastId });
      }

      setFormOpen(false);
      setEditId(null);
      queryClient.invalidateQueries({ queryKey: ['admission-results'] });
    } catch (error) {
      console.error('Error submitting form:', error);
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to upload admission result', {
          id: toastId,
        });
      } else {
        toast.error(
          'Failed to upload admission result: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
          { id: toastId },
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`/api/admission-result/${id}`);
      toast.success('Result deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admission-results'] });
    } catch (error) {
      console.error('Error deleting result:', error);
      toast.error('Failed to delete result');
    }
  };

  const openPdf = (key: string) => window.open(getFileUrl(key), '_blank', 'noopener,noreferrer');

  const summary = resultsQuery.isSuccess
    ? `${classesWithResults} of ${CLASSES.length} classes published · ${pdfCount} PDF${pdfCount === 1 ? '' : 's'}`
    : ' ';

  const loading = resultsQuery.isLoading;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Admission results</h1>
            <select
              aria-label="Admission year"
              value={selectedYear}
              onChange={(e) => setPickedYear(Number(e.target.value))}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={() => openCreate()}>
          <Upload /> Upload result
        </Button>
      </header>

      <SectionCard noPadding>
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                <th
                  className={cn(
                    stickyCell,
                    'text-foreground/70 w-28 px-3 py-2 text-xs font-semibold uppercase tracking-wider sm:px-4',
                  )}
                >
                  Class
                </th>
                {LIST_TYPES.map((l) => (
                  <th
                    key={l.key}
                    className="text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                  >
                    {l.label}
                  </th>
                ))}
                <th className="text-foreground/70 w-44 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="w-px px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : resultsQuery.isError ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    Couldn't load admission results. Try again in a moment.
                  </td>
                </tr>
              ) : (
                rows.map(({ cls, result }) => (
                  // Opaque row colours so the pinned Class cell hides what scrolls under it.
                  <tr
                    key={result?.id ?? `empty-${cls}`}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 text-sm font-medium sm:px-4')}>
                      Class {cls}
                    </td>
                    {LIST_TYPES.map((l) => {
                      const key = result?.[l.key];
                      return (
                        <td key={l.key} className="px-4 py-2 text-sm">
                          {key ? (
                            <a
                              href={getFileUrl(key)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded py-1 hover:underline"
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              View PDF
                            </a>
                          ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-1.5">
                              <XCircle className="h-4 w-4" />
                              Not uploaded
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                      {result ? formatDateWithTime(result.created_at) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <ActionButton
                            iconOnly
                            label="More actions"
                            icon={<MoreHorizontal size={16} />}
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuLabel className="normal-case tracking-normal">
                            Class {cls} · {selectedYear}
                          </DropdownMenuLabel>
                          {result ? (
                            <>
                              {LIST_TYPES.filter((l) => result[l.key]).map((l) => (
                                <DropdownMenuItem
                                  key={l.key}
                                  onSelect={() => openPdf(result[l.key]!)}
                                >
                                  <Eye /> {l.label}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem onSelect={() => openEdit(result)}>
                                <Pencil /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeleteTarget(result)}
                              >
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onSelect={() => openCreate(cls)}>
                              <Upload /> Upload result
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title="Delete result?"
        confirmLabel="Delete"
        msg={`Delete the Class ${deleteTarget?.class_name ?? ''} ${deleteTarget?.admission_year ?? ''} result and its PDFs? This cannot be undone.`}
      />

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && closeForm()}
        size="lg"
        aria-labelledby="admission-result-form-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="admission-result-form-title" className="text-base font-semibold">
              {isEditing ? 'Edit admission result' : 'Upload admission result'}
            </h2>
            <CloseButton onClick={closeForm} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class">
                <select
                  className={filterSelectClassName}
                  value={formData.class_name}
                  required
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      class_name: e.target.value,
                      merit_list: null,
                      waiting_list_1: null,
                      waiting_list_2: null,
                    }));
                    Object.values(fileRefs).forEach((r) => {
                      if (r.current) r.current.value = '';
                    });
                  }}
                >
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Admission year">
                <Input
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  minLength={4}
                  required
                  className="tabular-nums"
                  value={Number.isNaN(formData.admission_year) ? '' : formData.admission_year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      admission_year: parseInt(e.target.value),
                    }))
                  }
                />
              </Field>
            </div>

            <p className="text-muted-foreground text-sm">
              Upload one or more result lists (PDF, max 10MB each).
            </p>

            {LIST_TYPES.map(({ key, label }) => {
              const value = formData[key];
              return (
                <div
                  key={key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const input = fileRefs[key].current;
                    if (!input || !e.dataTransfer.files.length) return;
                    input.files = e.dataTransfer.files;
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                  }}
                  className={cn(
                    'border-border flex items-center gap-3 rounded-lg border p-3',
                    !value && 'border-dashed',
                  )}
                >
                  <input
                    ref={fileRefs[key]}
                    type="file"
                    accept=".pdf"
                    aria-label={`${label} PDF`}
                    onChange={(e) => handleFileChange(e, key)}
                    className="sr-only"
                    tabIndex={-1}
                  />
                  <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                    <FileText size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      {label}
                      {value && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                      {value instanceof File
                        ? `New: ${value.name}`
                        : value
                          ? value.split('/').pop()
                          : 'Not uploaded · drop a PDF here'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="pointer-coarse:h-10 shrink-0"
                    onClick={() => fileRefs[key].current?.click()}
                  >
                    <Upload /> {value ? 'Replace' : 'Choose PDF'}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Upload />}
              {isEditing
                ? isSubmitting
                  ? 'Updating...'
                  : 'Update result'
                : isSubmitting
                  ? 'Uploading...'
                  : 'Upload result'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
}

export default AdmissionResult;
