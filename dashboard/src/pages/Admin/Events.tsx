import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { SectionCard, Popup, ConfirmationPopup, TablePagination } from '@/components';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { cn, formatDay, formatYmd, parseLocalDate } from '@/lib/utils';
import { getFileUrl } from '@/lib/backend';
import {
  useEvents,
  useAddEvent,
  useUpdateEvent,
  useDeleteEvent,
  type Event,
} from '@/queries/events.queries';

interface FormValues {
  title: string;
  details: string;
  location: string;
  file: File | null | string;
  image: File | null | string;
  date: string | null;
}

const EMPTY_FORM: FormValues = {
  title: '',
  details: '',
  location: '',
  file: null,
  image: null,
  date: null,
};

type SortKey = 'title' | 'date';

/** Event date → yyyy-MM-dd. Older rows are stored as MM-DD-YYYY (en-US toLocaleDateString). */
const toYmd = (d: string | null) => {
  if (!d) return '';
  const mmddyyyy = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (mmddyyyy) return `${mmddyyyy[3]}-${mmddyyyy[1]}-${mmddyyyy[2]}`;
  return d.slice(0, 10);
};

const showDate = (d: string) => {
  const ymd = toYmd(d);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? formatDay(parseLocalDate(ymd)) : formatDay(new Date(d));
};

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
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

const Field = ({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {optional && <span className="text-muted-foreground font-normal"> (optional)</span>}
      </span>
      {children}
    </label>
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

const EventThumb = ({ event }: { event: Event }) =>
  event.image ? (
    <img
      src={getFileUrl(event.image)}
      alt=""
      loading="lazy"
      className="border-border h-9 w-12 shrink-0 rounded border object-cover"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex h-9 w-12 shrink-0 items-center justify-center rounded text-xs font-semibold">
      {event.title.charAt(0).toUpperCase()}
    </div>
  );

// Pinned Event column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const dropzoneClass =
  'border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2';

const Events: React.FC = () => {
  const { data: events = [], isLoading, isError } = useEvents();
  const addMutation = useAddEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();
  const submitting = addMutation.isPending || updateMutation.isPending;

  // ---- Form dialog ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [dateError, setDateError] = useState<string | null>(null);
  const fileref = useRef<HTMLInputElement>(null);
  const imageref = useRef<HTMLInputElement>(null);

  // ---- List ----
  const [detail, setDetail] = useState<Event | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Event | null>(null);
  const [search, setSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [whenFilters, setWhenFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const today = formatYmd(new Date());
  const isUpcoming = (e: Event) => toYmd(e.date) >= today;
  const upcomingCount = events.filter(isUpcoming).length;

  const filtersActive =
    Boolean(search.trim()) || Boolean(locationSearch.trim()) || whenFilters.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const loc = locationSearch.trim().toLowerCase();
    const rows = events.filter(
      (e) =>
        (!q || `${e.title} ${e.details ?? ''}`.toLowerCase().includes(q)) &&
        (!loc || (e.location ?? '').toLowerCase().includes(loc)) &&
        (whenFilters.length === 0 ||
          whenFilters.includes(toYmd(e.date) >= today ? 'upcoming' : 'past')),
    );
    if (!sort) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort(
      (a, b) =>
        dir *
        (sort.key === 'title'
          ? a.title.localeCompare(b.title)
          : toYmd(a.date).localeCompare(toYmd(b.date))),
    );
  }, [events, search, locationSearch, whenFilters, sort, today]);

  const totalPages = Math.ceil(filtered.length / limit);
  const pageRows = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, locationSearch, whenFilters, sort, limit]);

  const clearFilters = () => {
    setSearch('');
    setLocationSearch('');
    setWhenFilters([]);
  };

  // Preview for the photo card: the picked file, else the saved image.
  const imagePreview = useMemo(
    () =>
      formValues.image instanceof File
        ? URL.createObjectURL(formValues.image)
        : formValues.image
          ? getFileUrl(formValues.image)
          : null,
    [formValues.image],
  );
  useEffect(
    () => () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const openCreate = () => {
    setEditing(null);
    setFormValues(EMPTY_FORM);
    setDateError(null);
    setFormOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    setFormValues({
      title: event.title,
      details: event.details || '',
      file: event.file,
      image: event.image,
      date: event.date,
      location: event.location || '',
    });
    setDateError(null);
    setDetail(null);
    setFormOpen(true);
  };

  const handleCancel = () => {
    setFormValues(EMPTY_FORM);
    if (fileref.current) fileref.current.value = '';
    if (imageref.current) imageref.current.value = '';
    setEditing(null);
    setFormOpen(false);
  };

  const pickImage = (file: File | null | undefined) => {
    if (file && !file.type.startsWith('image/')) {
      toast.error('Photo must be an image');
      return;
    }
    // Removing a new pick falls back to the saved image (the API can't clear it).
    setFormValues((v) => ({ ...v, image: file ?? editing?.image ?? null }));
    if (imageref.current) imageref.current.value = '';
  };

  const pickFile = (file: File | null | undefined) => {
    if (file && file.type !== 'application/pdf') {
      toast.error('Notice must be a PDF');
      return;
    }
    setFormValues((v) => ({ ...v, file: file ?? editing?.file ?? null }));
    if (fileref.current) fileref.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (!formValues.date) {
      setDateError('Event date is required.');
      toast.error('Please select event date.');
      return;
    }
    setDateError(null);

    const data = {
      title: formValues.title,
      details: formValues.details,
      location: formValues.location,
      date: formValues.date,
      image: formValues.image instanceof File ? formValues.image : undefined,
      file: formValues.file instanceof File ? formValues.file : undefined,
    };
    try {
      if (editing) await updateMutation.mutateAsync({ id: editing.id, data });
      else await addMutation.mutateAsync(data);
      handleCancel();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (event: Event) => {
    try {
      await deleteMutation.mutateAsync(event.id);
      setDetail((d) => (d?.id === event.id ? null : d));
    } catch (error) {
      console.error('Error deleting event:', error);
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
      label: 'Event',
      sortKey: 'title',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Event"
          {...sortProps('title')}
          filterInput={{ value: search, onChange: setSearch, placeholder: 'Title or details…' }}
        />
      ),
    },
    {
      label: 'Date',
      sortKey: 'date',
      className: 'w-40',
      header: (
        <ColumnHeaderMenu
          label="Date"
          {...sortProps('date')}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
          selected={whenFilters}
          onSelectedChange={setWhenFilters}
        />
      ),
    },
    {
      label: 'Location',
      className: 'w-48',
      header: (
        <ColumnHeaderMenu
          label="Location"
          filterInput={{
            value: locationSearch,
            onChange: setLocationSearch,
            placeholder: 'Location…',
          }}
        />
      ),
    },
    { label: 'Notice', className: 'w-28', header: 'Notice' },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      header: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={clearFilters}
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  const rowActions = (event: Event) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton
        action="view"
        iconOnly
        className="pointer-coarse:h-11 pointer-coarse:w-11"
        onClick={() => setDetail(event)}
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
            {event.title}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDetail(event)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(event)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          {event.file && (
            <DropdownMenuItem asChild>
              <a href={getFileUrl(event.file)} target="_blank" rel="noopener noreferrer">
                <FileText /> Open notice PDF
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(event)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <p>Couldn't load events. Try again in a moment.</p>
      ) : filtersActive ? (
        <>
          <p>No events match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <>
          <p>No events yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            <Plus /> New event
          </Button>
        </>
      )}
    </div>
  );

  const newFile = formValues.file instanceof File ? formValues.file : null;
  const newImage = formValues.image instanceof File ? formValues.image : null;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {isLoading
              ? ' '
              : `${plural(events.length, 'event')} · ${upcomingCount.toLocaleString()} upcoming`}
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> New event
        </Button>
      </header>

      {!isLoading && events.length > 0 && (
        <div className="border-border bg-card mb-6 grid grid-cols-3 gap-x-6 rounded-xl border px-5 py-4 shadow-sm sm:w-fit sm:min-w-[24rem]">
          <Stat label="Total" value={events.length} />
          <Stat label="Upcoming" value={upcomingCount} dot="bg-emerald-500" />
          <Stat label="Past" value={events.length - upcomingCount} dot="bg-slate-400" />
        </div>
      )}

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[44rem] border-collapse text-left">
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
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length > 0 ? (
                pageRows.map((event) => {
                  const upcoming = isUpcoming(event);
                  return (
                    // Opaque row colours so the pinned Event cell hides what scrolls under it.
                    <tr
                      key={event.id}
                      className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                    >
                      <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                        <div className="flex max-w-[14rem] items-center gap-3 sm:max-w-md">
                          <EventThumb event={event} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setDetail(event)}
                              className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                            >
                              {event.title}
                            </button>
                            {event.details && (
                              <p className="text-muted-foreground truncate text-xs">
                                {event.details}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                        <p>{showDate(event.date)}</p>
                        <p
                          className={cn(
                            'text-xs',
                            upcoming
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-muted-foreground',
                          )}
                        >
                          {upcoming ? 'Upcoming' : 'Past'}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {event.location || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {event.file ? (
                          <a
                            href={getFileUrl(event.file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary pointer-coarse:py-2 inline-flex items-center gap-1 hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {rowActions(event)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          limit={limit}
          totalFiltered={filtered.length}
          limitOptions={[25, 50, 100]}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete event"
        msg={`Delete "${deleteTarget?.title ?? 'this event'}"? This cannot be undone.`}
      />

      {detail && (
        <Popup
          open
          onOpenChange={(o) => !o && setDetail(null)}
          size="lg"
          aria-labelledby="event-details-title"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="event-details-title" className="text-base font-semibold">
              Event details
            </h2>
            <CloseButton onClick={() => setDetail(null)} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            {detail.image && (
              <img
                src={getFileUrl(detail.image)}
                alt=""
                className="bg-muted border-border max-h-64 w-full rounded-lg border object-contain"
              />
            )}
            <div>
              <p className="text-lg font-semibold leading-tight">{detail.title}</p>
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums">
                <span>{showDate(detail.date)}</span>
                {detail.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {detail.location}
                  </span>
                )}
              </p>
            </div>
            {detail.details && <p className="whitespace-pre-wrap text-sm">{detail.details}</p>}
            {detail.file && (
              <div className="border-border flex items-center gap-3 rounded-lg border p-3">
                <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                  <FileText size={20} />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">Notice PDF</p>
                <Button type="button" variant="ghost" size="sm" asChild>
                  <a href={getFileUrl(detail.file)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink /> View
                  </a>
                </Button>
              </div>
            )}
          </div>

          <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(detail)}
            >
              <Trash2 /> Delete
            </Button>
            <Button type="button" className="ml-auto" onClick={() => openEdit(detail)}>
              <Pencil /> Edit event
            </Button>
          </div>
        </Popup>
      )}

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && !submitting && handleCancel()}
        size="lg"
        aria-labelledby="event-form-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="event-form-title" className="text-base font-semibold">
              {editing ? 'Edit event' : 'New event'}
            </h2>
            <CloseButton onClick={handleCancel} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <Field label="Title">
              <Input
                name="title"
                placeholder="Enter event title"
                value={formValues.title}
                onChange={(e) => setFormValues({ ...formValues, title: e.target.value })}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" error={dateError}>
                <Input
                  type="date"
                  name="date"
                  required
                  value={toYmd(formValues.date)}
                  onChange={(e) => {
                    setFormValues({ ...formValues, date: e.target.value || null });
                    setDateError(null);
                  }}
                />
              </Field>
              <Field label="Location" optional>
                <Input
                  name="location"
                  placeholder="Enter event location"
                  value={formValues.location}
                  onChange={(e) => setFormValues({ ...formValues, location: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Details" optional>
              <Textarea
                name="details"
                placeholder="Enter detailed event text"
                maxLength={100}
                value={formValues.details}
                onChange={(e) => setFormValues({ ...formValues, details: e.target.value })}
                className="resize-none"
              />
            </Field>
            <p className="text-muted-foreground -mt-2 text-right text-xs tabular-nums">
              {formValues.details.length}/100
            </p>

            {/* Photo */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">
                Photo <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <input
                ref={imageref}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
              {imagePreview ? (
                <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                  <img
                    src={imagePreview}
                    alt=""
                    className="border-border h-12 w-16 shrink-0 rounded-md border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {newImage ? newImage.name : 'Current photo'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {newImage
                        ? `${(newImage.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                        : 'Shown on the events page'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {newImage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => pickImage(null)}
                      >
                        <X /> Remove
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageref.current?.click()}
                    >
                      <Upload /> Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageref.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickImage(e.dataTransfer.files[0]);
                  }}
                  className={dropzoneClass}
                >
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload photo</span>
                  <span className="text-muted-foreground text-xs">Click or drop an image here</span>
                </button>
              )}
            </div>

            {/* Notice PDF */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">
                Notice PDF <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <input
                ref={fileref}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              {formValues.file ? (
                <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                  <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {newFile ? newFile.name : 'Current notice'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {newFile
                        ? `${(newFile.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                        : 'PDF'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {newFile ? (
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
                          href={getFileUrl(formValues.file as string)}
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
                      onClick={() => fileref.current?.click()}
                    >
                      <Upload /> Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileref.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickFile(e.dataTransfer.files[0]);
                  }}
                  className={dropzoneClass}
                >
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload notice PDF</span>
                  <span className="text-muted-foreground text-xs">Click or drop a file here</span>
                </button>
              )}
            </div>
          </div>

          <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="animate-spin" />}
              {editing ? 'Save changes' : 'Create event'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default Events;
