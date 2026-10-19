/**
 * Holidays, replicating dashboard/src/pages/Admin/Holidays.tsx: title + Year selector, "N
 * holidays · N days off in YYYY", Add holiday, a 4-up stats strip, the holiday table (Holiday /
 * Dates / Days / Type / actions) and the add/edit dialog (title, dates, description, Optional).
 * Below the table, the month calendar (holiday days highlighted; press a date for its holidays).
 * Live data: GET/POST/PATCH/DELETE /api/holidays.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { HolidayCalendar } from '@/features/holidays/HolidayCalendar';
import {
  dayCount,
  formatRange,
  holidayStats,
  inYear,
  todayYmd,
  validateHoliday,
  yearOptions,
} from '@/features/holidays/model';
import type { Holiday, HolidayInput } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const EMPTY: HolidayInput = {
  title: '',
  start_date: '',
  end_date: '',
  description: '',
  is_optional: false,
};

function TypeCell({ h }: { h: Holiday }) {
  return h.is_optional ? (
    <View className="flex-row items-center gap-1.5">
      <View className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      <Text size="sm">Optional</Text>
    </View>
  ) : (
    <Text size="sm">Mandatory</Text>
  );
}

export default function HolidaysScreen() {
  const { holidays } = useApi();
  const { resolution } = useTenant();
  const today = todayYmd();
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState<HolidayInput | null>(null);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof HolidayInput, string>>>({});
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'holidays'),
    queryFn: ({ signal }) => holidays.list(signal),
    staleTime: 60_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const [sort, setSort] = useState<TableSort | null>(null);
  const rows = useMemo(
    () =>
      sortRows(inYear(all, year), sort, {
        title: (h) => h.title,
        start: (h) => h.start_date,
        days: (h) => dayCount(h),
      }),
    [all, year, sort],
  );
  const stats = holidayStats(rows, year, today);

  const close = () => {
    setForm(null);
    setEditing(null);
    setErrors({});
  };
  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: HolidayInput }) =>
      v.id ? holidays.update(v.id, v.input) : holidays.create(v.input),
    invalidate: [['holidays']],
    success: () => (editing ? 'Holiday updated successfully' : 'Holiday added successfully'),
    failure: editing ? 'Error updating holiday' : 'Error adding holiday',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => holidays.remove(id),
    invalidate: [['holidays']],
    success: 'Holiday deleted successfully',
    failure: 'Error deleting holiday',
    onSuccess: () => setDeleteTarget(null),
  });

  const openAdd = () => {
    setEditing(null);
    setErrors({});
    setForm({ ...EMPTY });
  };
  const openEdit = (h: Holiday) => {
    setEditing(h);
    setErrors({});
    setForm({
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
      description: h.description,
      is_optional: h.is_optional,
    });
  };
  const submit = () => {
    if (!form) return;
    const input = { ...form, end_date: form.end_date || form.start_date };
    const e = validateHoliday(input);
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate({ id: editing?.id ?? null, input });
  };

  const actions = (h: Holiday) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit ${h.title}`}
        tone="emerald"
        onPress={() => openEdit(h)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${h.title}`}
        tone="red"
        onPress={() => setDeleteTarget(h)}
      />
    </View>
  );

  const columns: Column<Holiday>[] = [
    {
      key: 'title',
      label: 'Holiday',
      sortKey: 'title',
      className: 'min-w-0 flex-1',
      render: (h) => (
        <Pressable onPress={() => openEdit(h)} accessibilityRole="button">
          <Text
            size="sm"
            weight="medium"
            numberOfLines={1}
            color={h.end_date < today ? 'mutedForeground' : 'foreground'}
            className="hover:underline"
          >
            {h.title}
          </Text>
          {h.description ? (
            <Text size="xs" color="mutedForeground" numberOfLines={1}>
              {h.description}
            </Text>
          ) : null}
        </Pressable>
      ),
    },
    {
      key: 'dates',
      label: 'Dates',
      sortKey: 'start',
      className: 'w-60',
      render: (h) => (
        <Text size="sm" color="mutedForeground" tabular numberOfLines={1}>
          {formatRange(h)}
        </Text>
      ),
    },
    {
      key: 'days',
      label: 'Days',
      sortKey: 'days',
      className: 'w-20',
      render: (h) => (
        <Text size="sm" tabular>
          {dayCount(h)}
        </Text>
      ),
    },
    { key: 'type', label: 'Type', className: 'w-32', render: (h) => <TypeCell h={h} /> },
    { key: 'actions', label: ' ', className: 'w-[88px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Holidays"
      titleAccessory={
        <Select
          label="Year"
          size="sm"
          value={year}
          onChange={setYear}
          options={yearOptions(all, new Date().getFullYear()).map((y) => ({
            value: y,
            label: String(y),
          }))}
        />
      }
      description={
        q.isPending
          ? 'Loading…'
          : `${plural(rows.length, 'holiday')} · ${plural(stats.daysOff, 'day')} off in ${year}`
      }
      actions={<Button label="Add holiday" icon={Plus} onPress={openAdd} testID="add-holiday" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load holidays"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <StatStrip>
            <Stat label="Holidays" value={stats.holidays} />
            <Stat label="Days off" value={stats.daysOff} />
            <Stat label="Upcoming" value={stats.upcoming} dot="bg-emerald-500" />
            <Stat label="Optional" value={stats.optional} dot="bg-amber-500" />
          </StatStrip>
          <DataTable
            testID="holidays"
            sort={sort}
            onSort={setSort}
            rows={rows}
            columns={columns}
            rowKey={(h) => h.id}
            loading={q.isPending}
            empty={`No holidays in ${year} yet.`}
            onRowPress={openEdit}
            renderMobile={(h) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {h.title}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {formatRange(h)} · {plural(dayCount(h), 'day')}
                  </Text>
                </View>
                <TypeCell h={h} />
              </View>
            )}
          />
          <HolidayCalendar holidays={all} year={year} today={today} onYear={setYear} />
        </>
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit holiday' : 'Add holiday'}
        testID="holiday-form"
        footer={
          <>
            {editing ? (
              <Button
                variant="ghost"
                label="Delete"
                icon={Trash2}
                className="mr-auto"
                onPress={() => {
                  setDeleteTarget(editing);
                  close();
                }}
              />
            ) : null}
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add holiday'}
              onPress={submit}
              disabled={save.isPending}
              testID="holiday-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            <Field label="Title" required error={errors.title}>
              <Input
                value={form.title}
                onChangeText={(title) => setForm({ ...form, title })}
                accessibilityLabel="Title"
                placeholder="e.g. Eid-ul-Fitr"
              />
            </Field>
            <FieldRow>
              <Field label="Start date" required error={errors.start_date}>
                <DateInput
                  label="Start date"
                  value={form.start_date}
                  invalid={!!errors.start_date}
                  onChange={(start_date) => setForm({ ...form, start_date })}
                />
              </Field>
              <Field label="End date" hint="Empty = same day" error={errors.end_date}>
                <DateInput
                  label="End date"
                  value={form.end_date}
                  invalid={!!errors.end_date}
                  onChange={(end_date) => setForm({ ...form, end_date })}
                />
              </Field>
            </FieldRow>
            <Field label="Description">
              <Input
                value={form.description}
                onChangeText={(description) => setForm({ ...form, description })}
                accessibilityLabel="Description"
              />
            </Field>
            <Checkbox
              boxed
              checked={form.is_optional}
              onChange={(is_optional) => setForm({ ...form, is_optional })}
              label="Optional"
              description="Date depends on the moon sighting."
            />
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete holiday"
        message={`Delete "${deleteTarget?.title ?? 'this holiday'}"? This cannot be undone.`}
      />
    </PageLayout>
  );
}
