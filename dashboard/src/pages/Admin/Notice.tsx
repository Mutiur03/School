import React, { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import {
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
import { SectionCard, Popup, ConfirmationPopup, TablePagination } from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { Input } from '@/components/ui/input';
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
import {
  useNotices,
  useAddNotice,
  useUpdateNotice,
  useDeleteNotice,
  type Notice,
} from '@/queries/notice.queries';
import { noticeSchema, type NoticeFormData } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { cn, formatDay } from '@/lib/utils';

type SortKey = 'title' | 'date';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

/** Date part only, so the shown day doesn't shift with the viewer's timezone. */
const ymd = (iso: string) => iso.split('T')[0];

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

// Pinned Title column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const openPdf = (notice: Notice) =>
  window.open(getFileUrl(notice.file), '_blank', 'noopener,noreferrer');

const NoticePage = () => {
  const { data: notices = [], isLoading, isError } = useNotices();
  const addMutation = useAddNotice();
  const updateMutation = useUpdateNotice();
  const deleteMutation = useDeleteNotice();
  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  // ---- List state ----
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);

  // ---- Form state ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    watch,
    formState: { errors },
  } = useForm<NoticeFormData>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { title: '', file: undefined, created_at: '' },
  });
  const formFile = watch('file');

  const query = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = query ? notices.filter((n) => n.title.toLowerCase().includes(query)) : notices;
    if (!sort) return list;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...list].sort((a, b) =>
      sort.key === 'title'
        ? a.title.localeCompare(b.title) * dir
        : a.created_at.localeCompare(b.created_at) * dir,
    );
  }, [notices, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * limit, currentPage * limit);
  const filtersActive = Boolean(query);

  const latest = notices.reduce<string | null>(
    (max, n) => (!max || n.created_at > max ? n.created_at : max),
    null,
  );
  const summary = isLoading
    ? ' '
    : [plural(notices.length, 'notice'), latest ? `latest ${formatDay(ymd(latest))}` : null]
        .filter(Boolean)
        .join(' · ');

  const openCreate = () => {
    reset({ title: '', file: undefined, created_at: '' });
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    reset({
      title: notice.title,
      file: notice.file,
      created_at: notice.created_at ? ymd(notice.created_at) : '',
    });
    setEditing(notice);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (isSubmitting) return;
    setFormOpen(false);
    setEditing(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const pickFile = (file: File | null | undefined) => {
    if (file && file.type !== 'application/pdf') {
      toast.error('Notice must be a PDF');
      return;
    }
    // Removing a newly picked file falls back to the notice's current file when editing.
    setValue('file', file ?? editing?.file ?? undefined, { shouldValidate: true });
    // Clear the input so picking the same file again still fires onChange.
    if (fileRef.current) fileRef.current.value = '';
  };

  const onSubmit = (data: NoticeFormData) => {
    const file = data.file instanceof File ? data.file : undefined;
    if (!editing && !file) {
      setError('file', { message: 'Choose a PDF to publish' });
      return;
    }
    // The mutations show their own success/error toasts.
    const done = { onSuccess: () => setFormOpen(false) };
    if (editing) {
      updateMutation.mutate(
        { id: editing.id, data: { title: data.title, file, created_at: data.created_at } },
        done,
      );
    } else {
      addMutation.mutate({ title: data.title, file: file!, created_at: data.created_at }, done);
    }
  };

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });

  const columns: {
    label: string;
    sortKey?: SortKey;
    className?: string;
    header: React.ReactNode;
  }[] = [
    {
      label: 'Title',
      sortKey: 'title',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Title"
          {...sortProps('title')}
          filterInput={{
            value: search,
            onChange: (v) => {
              setSearch(v);
              setPage(1);
            },
            placeholder: 'Search titles…',
          }}
        />
      ),
    },
    {
      label: 'Published',
      sortKey: 'date',
      className: 'w-40',
      header: <ColumnHeaderMenu label="Published" {...sortProps('date')} />,
    },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      header: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={() => setSearch('')}
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  const rowActions = (notice: Notice) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton action="edit" iconOnly onClick={() => openEdit(notice)} />
      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <ActionButton iconOnly label="More actions" icon={<MoreHorizontal size={16} />} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="truncate normal-case tracking-normal">
            {notice.title}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => openPdf(notice)}>
            <ExternalLink /> Open PDF
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(notice)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(notice)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <p>Couldn't load notices. Try again in a moment.</p>
      ) : filtersActive ? (
        <>
          <p>No notices match "{search.trim()}".</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setSearch('')}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <>
          <p>No notices published yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            <Plus /> New notice
          </Button>
        </>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notices</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> New notice
        </Button>
      </header>

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[32rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    aria-sort={
                      sort && col.sortKey === sort.key
                        ? sort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 8 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length > 0 ? (
                rows.map((notice) => (
                  // Opaque row colours so the pinned Title cell hides what scrolls under it.
                  <tr
                    key={notice.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                      <div className="flex max-w-[16rem] items-center gap-3 sm:max-w-none">
                        <div className="bg-primary/10 text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
                          <FileText size={18} />
                        </div>
                        <a
                          href={getFileUrl(notice.file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={notice.title}
                          className="focus-visible:ring-ring line-clamp-2 rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                        >
                          {notice.title}
                        </a>
                      </div>
                    </td>
                    <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                      {notice.created_at ? formatDay(ymd(notice.created_at)) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(notice)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          limit={limit}
          totalFiltered={filtered.length}
          limitOptions={[25, 50, 100]}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
        />
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete notice"
        msg={`Delete "${deleteTarget?.title ?? 'this notice'}"? The PDF is removed from storage. This cannot be undone.`}
      />

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && closeForm()}
        size="lg"
        aria-labelledby="notice-form-title"
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="notice-form-title" className="text-base font-semibold">
              {editing ? 'Edit notice' : 'New notice'}
            </h2>
            <CloseButton onClick={closeForm} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Title" error={errors.title?.message}>
              <Input
                {...register('title')}
                placeholder="e.g. Annual Sports Day 2026 schedule"
                aria-invalid={Boolean(errors.title)}
              />
            </Field>
            <Field
              label="Publish date"
              hint={
                editing ? 'Leave empty to keep the current date.' : 'Optional. Defaults to today.'
              }
            >
              <Input type="date" {...register('created_at')} className="w-auto" />
            </Field>

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
              {formFile ? (
                <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {formFile instanceof File ? formFile.name : 'Current file'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formFile instanceof File
                        ? `${(formFile.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                        : 'PDF · shown on the website'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {formFile instanceof File ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => pickFile(null)}
                      >
                        <X /> Remove
                      </Button>
                    ) : (
                      <Button type="button" variant="ghost" size="sm" asChild>
                        <a
                          href={getFileUrl(formFile as string)}
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
                    errors.file ? 'border-destructive' : 'border-border',
                  )}
                >
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload notice PDF</span>
                  <span className="text-muted-foreground text-xs">Click or drop a file here</span>
                </button>
              )}
              {errors.file && (
                <p className="text-destructive text-xs">{errors.file.message as string}</p>
              )}
            </div>
          </div>

          <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="ghost" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {editing ? 'Save changes' : 'Publish notice'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default NoticePage;
