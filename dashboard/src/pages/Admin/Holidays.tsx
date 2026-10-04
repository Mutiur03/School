import React, { useState } from 'react';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
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
import { SectionCard, Popup, ConfirmationPopup, filterSelectClassName } from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { Calendar } from '@/components/Calendar';
import DateRangePickerF from '@/components/DateRangePickerF';
import {
  useHolidays,
  useAddHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  type Holiday,
  type HolidayFormData,
} from '@/queries/holidays.queries';
import { cn, formatDay, formatDayLong, formatYmd, parseLocalDate } from '@/lib/utils';

interface DateRange {
  from: Date | null;
  to: Date | null;
}

type SortKey = 'title' | 'start' | 'days';

const EMPTY_FORM: HolidayFormData = {
  title: '',
  start_date: '',
  end_date: '',
  description: '',
  is_optional: false,
};

const DAY_MS = 86_400_000;

/** API dates may come back as ISO timestamps; the calendar day is the first 10 chars. */
const toDay = (s: string) => parseLocalDate(s.slice(0, 10));
const dayCount = (h: Holiday) =>
  Math.round((toDay(h.end_date).getTime() - toDay(h.start_date).getTime()) / DAY_MS) + 1;
const covers = (h: Holiday, date: Date) => {
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return t >= toDay(h.start_date).getTime() && t <= toDay(h.end_date).getTime();
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

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="block text-sm font-medium">{label}</span>
    {children}
  </label>
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

// Pinned Holiday column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const HolidayCalendar = () => {
  const { data: holidays = [], isLoading, isError } = useHolidays();
  const addHoliday = useAddHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [search, setSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>({
    key: 'start',
    order: 'asc',
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HolidayFormData>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  // ---- Derived ----
  const yearOptions = [
    ...new Set([
      currentYear,
      ...holidays.flatMap((h) => [
        toDay(h.start_date).getFullYear(),
        toDay(h.end_date).getFullYear(),
      ]),
    ]),
  ].sort((a, b) => b - a);

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const yearHolidays = holidays.filter(
    (h) => toDay(h.start_date) <= yearEnd && toDay(h.end_date) >= yearStart,
  );

  // Unique dates off inside the year (overlapping holidays count once).
  const offDays = new Set<string>();
  for (const h of yearHolidays) {
    const last = Math.min(toDay(h.end_date).getTime(), yearEnd.getTime());
    for (
      let d = new Date(Math.max(toDay(h.start_date).getTime(), yearStart.getTime()));
      d.getTime() <= last;
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
    ) {
      offDays.add(formatYmd(d));
    }
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcomingCount = yearHolidays.filter((h) => toDay(h.end_date) >= today).length;
  const optionalCount = yearHolidays.filter((h) => h.is_optional).length;

  const q = search.trim().toLowerCase();
  const filtersActive = q !== '' || typeFilters.length > 0;
  const rows = yearHolidays
    .filter(
      (h) =>
        (!q ||
          h.title.toLowerCase().includes(q) ||
          (h.description ?? '').toLowerCase().includes(q)) &&
        (typeFilters.length === 0 ||
          typeFilters.includes(h.is_optional ? 'optional' : 'mandatory')),
    )
    .sort((a, b) => {
      if (!sort) return 0;
      const dir = sort.order === 'asc' ? 1 : -1;
      if (sort.key === 'title') return dir * a.title.localeCompare(b.title);
      if (sort.key === 'days') return dir * (dayCount(a) - dayCount(b));
      return dir * (toDay(a.start_date).getTime() - toDay(b.start_date).getTime());
    });

  const clearFilters = () => {
    setSearch('');
    setTypeFilters([]);
  };

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });

  // ---- Form ----
  const handleDateRange = (range: DateRange) => {
    setDateRange(range);
    if (range.from && range.to) {
      setForm((prev) => ({
        ...prev,
        start_date: formatYmd(range.from as Date),
        end_date: formatYmd(range.to as Date),
      }));
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDateRange({ from: null, to: null });
  };

  const handleAdd = () => {
    handleClose();
    setOpen(true);
  };

  const handleEdit = (holiday: Holiday) => {
    setForm({
      title: holiday.title,
      start_date: holiday.start_date,
      end_date: holiday.end_date,
      description: holiday.description,
      is_optional: holiday.is_optional,
    });
    setDateRange({ from: toDay(holiday.start_date), to: toDay(holiday.end_date) });
    setEditingId(holiday.id);
    setSelectedDate(null);
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateHoliday.mutateAsync({ id: editingId, formData: form });
      } else {
        await addHoliday.mutateAsync(form);
      }
      handleClose();
    } catch {
      // Mutation onError already toasts the API message; swallow to avoid unhandled rejection / double toast
    }
  };

  const saving = addHoliday.isPending || updateHoliday.isPending;
  const dateHolidays = selectedDate ? holidays.filter((h) => covers(h, selectedDate)) : [];

  const rowActions = (h: Holiday) => (
    // modal={false}: items open dialogs; a modal menu would leave pointer-events locked
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ActionButton
          iconOnly
          label="More actions"
          icon={<MoreHorizontal size={16} />}
          className="pointer-coarse:h-10 pointer-coarse:w-10"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="truncate normal-case tracking-normal">
          {h.title}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => handleEdit(h)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(h)}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns: {
    label: string;
    sortKey?: SortKey;
    className?: string;
    header: React.ReactNode;
  }[] = [
    {
      label: 'Holiday',
      sortKey: 'title',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Holiday"
          {...sortProps('title')}
          filterInput={{ value: search, onChange: setSearch, placeholder: 'Title or description…' }}
        />
      ),
    },
    {
      label: 'Dates',
      sortKey: 'start',
      className: 'w-64',
      header: <ColumnHeaderMenu label="Dates" {...sortProps('start')} />,
    },
    {
      label: 'Days',
      sortKey: 'days',
      className: 'w-24',
      header: <ColumnHeaderMenu label="Days" {...sortProps('days')} />,
    },
    {
      label: 'Type',
      className: 'w-36',
      header: (
        <ColumnHeaderMenu
          label="Type"
          options={[
            { value: 'mandatory', label: 'Mandatory' },
            { value: 'optional', label: 'Optional' },
          ]}
          selected={typeFilters}
          onSelectedChange={setTypeFilters}
        />
      ),
    },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      header: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={clearFilters}
          className="pointer-coarse:h-10 pointer-coarse:w-10"
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Holidays</h1>
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {isLoading
              ? ' '
              : `${plural(yearHolidays.length, 'holiday')} · ${plural(offDays.size, 'day')} off in ${year}`}
          </p>
        </div>
        <Button type="button" onClick={handleAdd}>
          <Plus /> Add holiday
        </Button>
      </header>

      <div className="border-border bg-card mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border px-5 py-4 shadow-sm sm:grid-cols-4">
        <Stat label="Holidays" value={yearHolidays.length} />
        <Stat label="Days off" value={offDays.size} />
        <Stat label="Upcoming" value={upcomingCount} dot="bg-emerald-500" />
        <Stat label="Optional" value={optionalCount} dot="bg-amber-500" />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_22rem]">
        <SectionCard noPadding className="min-w-0">
          {/* One table for every screen: narrow screens scroll it sideways. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
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
                ) : rows.length > 0 ? (
                  rows.map((h) => {
                    const days = dayCount(h);
                    const past = toDay(h.end_date) < today;
                    return (
                      // Opaque row colours so the pinned Holiday cell hides what scrolls under it.
                      <tr
                        key={h.id}
                        className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                      >
                        <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                          <div className="max-w-[14rem] sm:max-w-md">
                            <button
                              type="button"
                              onClick={() => handleEdit(h)}
                              className={cn(
                                'focus-visible:ring-ring pointer-coarse:py-1.5 block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2',
                                past && 'text-muted-foreground',
                              )}
                            >
                              {h.title}
                            </button>
                            {h.description && (
                              <p
                                className="text-muted-foreground truncate text-xs"
                                title={h.description}
                              >
                                {h.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="text-muted-foreground whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                          {formatDay(toDay(h.start_date))}
                          {days > 1 && ` – ${formatDay(toDay(h.end_date))}`}
                        </td>
                        <td className="px-4 py-2 text-sm tabular-nums">{days}</td>
                        <td className="px-4 py-2 text-sm">
                          {h.is_optional ? (
                            <span className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                              Optional
                            </span>
                          ) : (
                            'Mandatory'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(h)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={columns.length}>
                      <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
                        {isError ? (
                          <p>Couldn't load holidays. Try again in a moment.</p>
                        ) : filtersActive ? (
                          <>
                            <p>No holidays match these filters.</p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={clearFilters}
                            >
                              <X /> Clear filters
                            </Button>
                          </>
                        ) : (
                          <>
                            <p>No holidays in {year} yet.</p>
                            <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
                              <Plus /> Add holiday
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard>
          <h3 className="text-sm font-semibold">Calendar</h3>
          <p className="text-muted-foreground mb-3 text-sm">Pick a date to see its holidays.</p>
          <Calendar
            onDateSelect={(date: Date | null) => date && setSelectedDate(date)}
            modifiers={{ holiday: (date: Date) => holidays.some((h) => covers(h, date)) }}
            modifiersClassNames={{
              holiday:
                'bg-red-500 text-white dark:text-white dark:bg-red-500 dark:hover:bg-red-600 hover:bg-red-600 hover:text-white',
            }}
          />
        </SectionCard>
      </div>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteHoliday.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete holiday"
        msg={`Delete "${deleteTarget?.title ?? 'this holiday'}"? This cannot be undone.`}
      />

      {selectedDate && (
        <Popup
          open
          onOpenChange={(o) => !o && setSelectedDate(null)}
          size="md"
          aria-labelledby="holiday-date-title"
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="holiday-date-title" className="text-base font-semibold">
              {formatDayLong(selectedDate)}
            </h2>
            <CloseButton onClick={() => setSelectedDate(null)} />
          </div>
          <div className="space-y-3 px-5 py-4">
            {dateHolidays.length === 0 ? (
              <p className="text-muted-foreground text-sm">No holiday on this date.</p>
            ) : (
              dateHolidays.map((h) => (
                <div key={h.id} className="border-border space-y-1 rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{h.title}</p>
                    <ActionButton
                      action="edit"
                      iconOnly
                      onClick={() => handleEdit(h)}
                      className="pointer-coarse:h-10 pointer-coarse:w-10"
                    />
                  </div>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatDay(toDay(h.start_date))} – {formatDay(toDay(h.end_date))} ·{' '}
                    {h.is_optional ? 'Depends on moon' : 'Mandatory'}
                  </p>
                  {h.description && <p className="text-sm">{h.description}</p>}
                </div>
              ))
            )}
          </div>
        </Popup>
      )}

      {/* overflow-visible: the date-range picker drops down past the dialog edge. */}
      <Popup
        open={open}
        onOpenChange={(o) => !o && handleClose()}
        size="lg"
        className="overflow-visible"
        aria-labelledby="holiday-form-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="holiday-form-title" className="text-base font-semibold">
              {editingId ? 'Edit holiday' : 'Add holiday'}
            </h2>
            <CloseButton onClick={handleClose} />
          </div>
          <div className="space-y-4 px-5 py-4">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </Field>
            {/* Not a <label>: clicks inside the picker's calendar would re-focus its input. */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">Dates</span>
              <DateRangePickerF date={dateRange} setDate={handleDateRange} className="w-full" />
            </div>
            <Field label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3">
              <input
                type="checkbox"
                checked={form.is_optional}
                onChange={(e) => setForm({ ...form, is_optional: e.target.checked })}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium">Optional</span>
                <span className="text-muted-foreground block text-sm">
                  Date depends on the moon sighting.
                </span>
              </span>
            </label>
          </div>
          <div className="border-border flex justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {editingId ? 'Save changes' : 'Add holiday'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default HolidayCalendar;
