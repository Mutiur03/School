import React, { useRef, useState } from 'react';
import axios, { type AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ConfirmationPopup, Popup, SectionCard, filterSelectClassName } from '@/components';
import ActionButton from '@/components/ActionButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { cn, formatDay } from '@/lib/utils';

interface Syllabus {
  id: number;
  class: string | number;
  year: string | number;
  pdf_url: string;
  download_url: string;
  created_at?: string;
}

interface SyllabusForm {
  class: string;
  year: string;
  pdf: File | null;
}

/** Message from a failed axios call, falling back to `fallback`. */
const apiError = (err: unknown, fallback: string) => {
  const data = (err as AxiosError<{ message?: string; error?: string }>).response?.data;
  return data?.message || data?.error || fallback;
};

const CLASSES = [6, 7, 8, 9, 10];
const QUERY_KEY = ['syllabus'];

const Field = ({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

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

// Pinned Class column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const fileName = (url: string) => url.split('/').pop() || 'Syllabus PDF';

function Syllabus() {
  const currentYear = new Date().getFullYear();
  const limitedYears = [String(currentYear - 1), String(currentYear), String(currentYear + 1)];
  const queryClient = useQueryClient();

  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Syllabus | null>(null);
  const [form, setForm] = useState<SyllabusForm>({
    class: '',
    year: String(currentYear),
    pdf: null,
  });
  const [errors, setErrors] = useState<{ class?: string; pdf?: string }>({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Syllabus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const {
    data: syllabuses = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => (await axios.get<{ data: Syllabus[] }>('/api/syllabus')).data.data,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const yearRows = syllabuses.filter((s) => String(s.year) === yearFilter);
  // One row per class: uploaded syllabuses, or a "Not uploaded" placeholder.
  type Row = { cls: string; syllabus: Syllabus | null };
  const rows: Row[] = [
    ...CLASSES.flatMap((c): Row[] => {
      const matches = yearRows.filter((s) => String(s.class) === String(c));
      return matches.length
        ? matches.map((s) => ({ cls: String(c), syllabus: s }))
        : [{ cls: String(c), syllabus: null }];
    }),
    ...yearRows
      .filter((s) => !CLASSES.includes(Number(s.class)))
      .map((s) => ({ cls: String(s.class), syllabus: s })),
  ];
  const uploadedClasses = new Set(yearRows.map((s) => String(s.class))).size;
  const summary = isLoading
    ? ' '
    : `${uploadedClasses} of ${CLASSES.length} classes uploaded for ${yearFilter}`;

  const openForm = (syllabus: Syllabus | null, cls = '') => {
    setEditing(syllabus);
    setForm({
      class: syllabus ? String(syllabus.class) : cls,
      year: syllabus ? String(syllabus.year) : yearFilter,
      pdf: null,
    });
    setErrors({});
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
  };

  const pickFile = (file: File | null | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (file && file.type !== 'application/pdf') {
      toast.error('Syllabus must be a PDF');
      return;
    }
    setForm((f) => ({ ...f, pdf: file ?? null }));
    if (file) setErrors((e) => ({ ...e, pdf: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors = {
      class: form.class ? undefined : 'Select a class',
      pdf: !editing && !form.pdf ? 'Please select a PDF file.' : undefined,
    };
    setErrors(nextErrors);
    if (nextErrors.class || nextErrors.pdf) return;

    setSaving(true);
    setProgress(0);
    try {
      const key = form.pdf
        ? await uploadToR2('/api/syllabus/presigned-url', form.pdf, setProgress)
        : undefined;
      if (editing) {
        await axios.put(`/api/syllabus/${editing.id}`, {
          class: form.class,
          year: form.year,
          ...(key ? { key } : {}),
        });
      } else {
        await axios.post('/api/syllabus/upload', { class: form.class, year: form.year, key });
      }
      await refresh();
      toast.success(editing ? 'Syllabus updated' : 'Syllabus uploaded');
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(apiError(err, 'Failed to upload/update syllabus.'));
    } finally {
      setSaving(false);
      setProgress(0);
    }
  };

  const handleDelete = async (s: Syllabus) => {
    try {
      await axios.delete(`/api/syllabus/${s.id}`);
      await refresh();
      toast.success('Syllabus deleted');
    } catch (err) {
      toast.error(apiError(err, 'Failed to delete syllabus.'));
    }
  };

  const rowActions = (cls: string, s: Syllabus | null) =>
    s ? (
      <div className="flex items-center justify-end gap-0.5">
        <ActionButton
          action="edit"
          iconOnly
          className="pointer-coarse:h-11 pointer-coarse:w-11"
          onClick={() => openForm(s)}
        />
        {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <ActionButton
              iconOnly
              label="More actions"
              icon={<MoreHorizontal size={16} />}
              className="pointer-coarse:h-11 pointer-coarse:w-11"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="truncate normal-case tracking-normal">
              Class {cls} · {String(s.year)}
            </DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <a href={getFileUrl(s.pdf_url)} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View PDF
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={getFileUrl(s.download_url)} download>
                <Download /> Download
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openForm(s)}>
              <Pencil /> Edit / replace PDF
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(s)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : (
      <ActionButton
        icon={<Upload size={14} />}
        label="Upload"
        className="pointer-coarse:py-2.5"
        onClick={() => openForm(null, cls)}
      />
    );

  const editingFile = editing?.pdf_url;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Syllabus</h1>
            <select
              aria-label="Year"
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value)}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium')}
            >
              {limitedYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus /> Upload syllabus
        </Button>
      </header>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left">
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
                <th className="text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                  File
                </th>
                <th className="text-foreground/70 w-36 px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                  Added
                </th>
                <th className="w-px px-3 py-2 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    Couldn&apos;t load syllabuses. Try again in a moment.
                  </td>
                </tr>
              ) : (
                rows.map(({ cls, syllabus: s }) => (
                  // Opaque row colours so the pinned Class cell hides what scrolls under it.
                  <tr
                    key={s ? s.id : `missing-${cls}`}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 text-sm font-medium sm:px-4')}>
                      Class {cls}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {s ? (
                        <a
                          href={getFileUrl(s.pdf_url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="focus-visible:ring-ring pointer-coarse:py-2 inline-flex max-w-[18rem] items-center gap-2 rounded hover:underline focus-visible:outline-none focus-visible:ring-2"
                        >
                          <FileText
                            className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
                            aria-hidden="true"
                          />
                          <span className="truncate">{fileName(s.pdf_url)}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Not uploaded</span>
                      )}
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                      {s?.created_at ? formatDay(s.created_at.split('T')[0]) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(cls, s)}</td>
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
          if (deleteTarget) void handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete syllabus"
        msg={`Delete the class ${deleteTarget ? String(deleteTarget.class) : ''} syllabus for ${deleteTarget ? String(deleteTarget.year) : ''}? This cannot be undone.`}
      />

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && closeForm()}
        size="lg"
        aria-labelledby="syllabus-form-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="syllabus-form-title" className="text-base font-semibold">
              {editing ? 'Edit syllabus' : 'Upload syllabus'}
            </h2>
            <CloseButton onClick={closeForm} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Class" error={errors.class}>
                <select
                  value={form.class}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, class: e.target.value }));
                    setErrors((er) => ({ ...er, class: undefined }));
                  }}
                  disabled={saving}
                  aria-invalid={Boolean(errors.class)}
                  className={filterSelectClassName}
                >
                  <option value="" disabled>
                    Select class
                  </option>
                  {CLASSES.map((c) => (
                    <option key={c} value={String(c)}>
                      Class {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Year">
                <select
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  disabled={saving}
                  className={filterSelectClassName}
                >
                  {[...new Set([...limitedYears, form.year])].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-medium">PDF</span>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {form.pdf || editingFile ? (
                <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {form.pdf ? form.pdf.name : fileName(editingFile!)}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {form.pdf
                        ? `${(form.pdf.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                        : 'Current file · PDF'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {form.pdf ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => pickFile(null)}
                      >
                        <X /> Remove
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <a
                          href={getFileUrl(editingFile!)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink /> View
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload /> Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  className={cn(
                    'hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2',
                    errors.pdf ? 'border-destructive' : 'border-border',
                  )}
                >
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload syllabus PDF</span>
                  <span className="text-muted-foreground text-xs">Click or drop a file here</span>
                </button>
              )}
              {errors.pdf && <p className="text-destructive text-xs">{errors.pdf}</p>}
            </div>
          </div>

          <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="ghost" onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {saving && form.pdf ? `Uploading ${progress}%…` : editing ? 'Save changes' : 'Upload'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
}

export default Syllabus;
