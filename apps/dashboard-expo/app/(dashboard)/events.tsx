/**
 * Events, replicating dashboard/src/pages/Admin/Events.tsx: "N events · N upcoming", New event,
 * Total / Upcoming / Past stats, the table (Event / Date / Location / actions) and the New/Edit
 * dialog (Title, Date, Location, Details, Photo, Attachment).
 * Live data: GET/POST/PUT/DELETE /api/events/*. Photos and attachments upload to R2 through a
 * presigned URL; picking them needs the file picker (web now, phones with the next native
 * build). Events themselves can be created and edited on phones.
 */
import { uploadLabel, useUploadPercent } from '@/hooks/useUploadPercent';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import { Icon } from '@/components/ui/Icon';
import {
  ExternalLink,
  MapPin,
  PartyPopper,
  Pencil,
  Plus,
  Trash2,
  XIcon,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { openStoredFile } from '@/features/admin/open-file';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import {
  EVENT_DETAILS_MAX,
  eventsFiltered,
  filterEvents,
  pageOf,
  splitEvents,
  validateEvent,
  type EventWhen,
} from '@/features/events/model';
import { formatDay, todayYmd } from '@/features/holidays/model';
import { fileUrl } from '@/features/student/components';
import type { EventInput, PickedFile, SchoolEvent } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const EMPTY: EventInput = {
  title: '',
  date: '',
  details: '',
  location: '',
  image: null,
  file: null,
};

function Thumb({ e }: { e: SchoolEvent }) {
  const url = fileUrl(e.image);
  return url ? (
    <Image source={{ uri: url }} accessibilityLabel="" className="bg-muted h-9 w-12 rounded" />
  ) : (
    <View className="bg-muted h-9 w-12 items-center justify-center rounded">
      <Icon icon={PartyPopper} size={16} color="mutedForeground" />
    </View>
  );
}

export default function EventsScreen() {
  const pct = useUploadPercent();
  const { events } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const today = todayYmd();
  const [form, setForm] = useState<EventInput | null>(null);
  const [editing, setEditing] = useState<SchoolEvent | null>(null);
  const [errors, setErrors] = useState<{ title?: string; date?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<SchoolEvent | null>(null);
  const [viewing, setViewing] = useState<SchoolEvent | null>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState<EventWhen[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'events'),
    queryFn: ({ signal }) => events.list(signal),
    staleTime: 30_000,
  });
  const { upcoming, past } = useMemo(() => splitEvents(q.data ?? [], today), [q.data, today]);
  const [sort, setSort] = useState<TableSort | null>(null);
  const filtered = eventsFiltered({ q: search, location, when });
  const rows = useMemo(
    () =>
      sortRows(filterEvents([...upcoming, ...past], { q: search, location, when }, today), sort, {
        title: (e) => e.title,
        date: (e) => e.date,
      }),
    [upcoming, past, sort, search, location, when, today],
  );
  const paged = pageOf(rows, page, limit);
  const clearFilters = () => {
    setSearch('');
    setLocation('');
    setWhen([]);
    setPage(1);
  };

  const close = () => {
    setForm(null);
    setEditing(null);
    setErrors({});
  };
  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: EventInput }) =>
      v.id ? events.update(v.id, v.input) : events.create(v.input),
    invalidate: [['events'], ['dashboard']],
    success: () => (editing ? 'Event updated successfully' : 'Event created successfully'),
    failure: editing ? 'Error updating event' : 'Error adding event',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => events.remove(id),
    invalidate: [['events'], ['dashboard']],
    success: 'Event deleted successfully',
    failure: 'Error deleting event',
    onSuccess: () => setDeleteTarget(null),
  });

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ ...EMPTY });
  };
  const openEdit = (e: SchoolEvent) => {
    setEditing(e);
    setErrors({});
    setForm({
      title: e.title,
      date: e.date,
      details: e.details,
      location: e.location,
      image: null,
      file: null,
    });
  };
  const submit = () => {
    if (!form) return;
    const e = validateEvent(form);
    setErrors(e);
    if (!e.title && !e.date) save.mutate({ id: editing?.id ?? null, input: form });
  };
  const pickImage = (image: PickedFile | null) => {
    if (!form) return;
    if (image && !image.type.startsWith('image/')) return toast.error('Choose an image file');
    setForm({ ...form, image });
  };

  const actions = (e: SchoolEvent) => (
    <View className="flex-row gap-0.5">
      {e.file ? (
        <ActionButton
          icon={ExternalLink}
          label={`Open attachment of ${e.title}`}
          tone="blue"
          onPress={() => void openStoredFile(e.file)}
        />
      ) : null}
      <ActionButton
        icon={Pencil}
        label={`Edit ${e.title}`}
        tone="emerald"
        onPress={() => openEdit(e)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${e.title}`}
        tone="red"
        onPress={() => setDeleteTarget(e)}
      />
    </View>
  );
  const columns: Column<SchoolEvent>[] = [
    {
      key: 'event',
      label: 'Event',
      sortKey: 'title',
      className: 'min-w-0 flex-1',
      render: (e) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => setViewing(e)}
          className="flex-row items-center gap-3"
        >
          <Thumb e={e} />
          <View className="min-w-0 flex-1">
            <Text
              size="sm"
              weight="medium"
              numberOfLines={1}
              color={e.date < today ? 'mutedForeground' : 'foreground'}
              className="hover:underline"
            >
              {e.title}
            </Text>
            {e.details ? (
              <Text size="xs" color="mutedForeground" numberOfLines={1}>
                {e.details}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      sortKey: 'date',
      className: 'w-36',
      render: (e) => (
        <View>
          <Text size="sm" color="mutedForeground" tabular>
            {formatDay(e.date)}
          </Text>
          <Text size="xs" color={e.date >= today ? 'primary' : 'mutedForeground'}>
            {e.date >= today ? 'Upcoming' : 'Past'}
          </Text>
        </View>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      className: 'w-48',
      render: (e) => (
        <Text size="sm" numberOfLines={1}>
          {e.location || '—'}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Events"
      description={
        q.isPending
          ? 'Loading…'
          : `${plural(q.data?.length ?? 0, 'event')} · ${upcoming.length.toLocaleString()} upcoming`
      }
      actions={<Button label="New event" icon={Plus} onPress={openCreate} testID="new-event" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load events"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          {(q.data?.length ?? 0) > 0 ? (
            <StatStrip className="sm:max-w-md">
              <Stat label="Total" value={q.data?.length ?? 0} />
              <Stat label="Upcoming" value={upcoming.length} dot="bg-emerald-500" />
              <Stat label="Past" value={past.length} dot="bg-slate-400" />
            </StatStrip>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search title or details"
              label="Search events"
            />
            <SearchInput
              value={location}
              onChangeText={(v) => {
                setLocation(v);
                setPage(1);
              }}
              placeholder="Location"
              label="Filter by location"
            />
            <MultiSelect
              label="When"
              allLabel="Upcoming & past"
              size="sm"
              value={when}
              options={[
                { value: 'upcoming' as EventWhen, label: 'Upcoming' },
                { value: 'past' as EventWhen, label: 'Past' },
              ]}
              onChange={(v) => {
                setWhen(v);
                setPage(1);
              }}
            />
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                icon={XIcon}
                label="Clear filters"
                onPress={clearFilters}
              />
            ) : null}
          </View>
          <DataTable
            testID="events"
            sort={sort}
            onSort={setSort}
            rows={paged.rows}
            columns={columns}
            rowKey={(e) => e.id}
            loading={q.isPending}
            empty={filtered ? 'No events match these filters.' : 'No events yet.'}
            onRowPress={setViewing}
            renderMobile={(e) => (
              <View className="flex-row items-center gap-3">
                <Thumb e={e} />
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {e.title}
                  </Text>
                  <View className="flex-row items-center gap-1">
                    <Text size="xs" color="mutedForeground" tabular>
                      {formatDay(e.date)}
                    </Text>
                    {e.location ? (
                      <>
                        <Icon icon={MapPin} size={12} color="mutedForeground" />
                        <Text
                          size="xs"
                          color="mutedForeground"
                          numberOfLines={1}
                          className="shrink"
                        >
                          {e.location}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>
              </View>
            )}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Select
              label="Rows per page"
              size="sm"
              value={limit}
              options={[25, 50, 100].map((n) => ({ value: n, label: `${n} / page` }))}
              onChange={(n) => {
                setLimit(n);
                setPage(1);
              }}
            />
            <Pagination page={paged.page} totalPages={paged.totalPages} onPage={setPage} />
          </View>
        </>
      )}

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.title ?? ''}
        description={viewing ? formatDay(viewing.date) : undefined}
        testID="event-details"
        footer={
          viewing ? (
            <>
              <Button
                variant="outline"
                icon={Trash2}
                label="Delete"
                onPress={() => {
                  setDeleteTarget(viewing);
                  setViewing(null);
                }}
              />
              <Button
                icon={Pencil}
                label="Edit event"
                onPress={() => {
                  openEdit(viewing);
                  setViewing(null);
                }}
              />
            </>
          ) : null
        }
      >
        {viewing ? (
          <View className="gap-3">
            {fileUrl(viewing.image) ? (
              <Image
                source={{ uri: fileUrl(viewing.image)! }}
                accessibilityLabel={viewing.title}
                resizeMode="cover"
                className="bg-muted h-48 w-full rounded-lg"
              />
            ) : null}
            <Text size="sm" color="mutedForeground">
              {viewing.date >= today ? 'Upcoming' : 'Past'}
              {viewing.location ? ` · ${viewing.location}` : ''}
            </Text>
            {viewing.details ? <Text size="sm">{viewing.details}</Text> : null}
            {viewing.file ? (
              <Button
                variant="outline"
                size="sm"
                icon={ExternalLink}
                label="Notice PDF"
                className="self-start"
                onPress={() => void openStoredFile(viewing.file)}
              />
            ) : null}
          </View>
        ) : null}
      </Dialog>

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit event' : 'New event'}
        testID="event-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={
                save.isPending
                  ? uploadLabel(pct, 'Saving…')
                  : editing
                    ? 'Save changes'
                    : 'Create event'
              }
              onPress={submit}
              disabled={save.isPending}
              testID="event-submit"
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
              />
            </Field>
            <FieldRow>
              <Field label="Date" required error={errors.date}>
                <DateInput
                  label="Date"
                  value={form.date}
                  invalid={!!errors.date}
                  onChange={(date) => setForm({ ...form, date })}
                />
              </Field>
              <Field label="Location" hint="Optional">
                <Input
                  value={form.location}
                  onChangeText={(location) => setForm({ ...form, location })}
                  accessibilityLabel="Location"
                />
              </Field>
            </FieldRow>
            <Field label="Details" hint={`Optional · ${form.details.length}/${EVENT_DETAILS_MAX}`}>
              <Input
                value={form.details}
                maxLength={EVENT_DETAILS_MAX}
                onChangeText={(details) => setForm({ ...form, details })}
                accessibilityLabel="Details"
                multiline
                numberOfLines={4}
                rows={4}
              />
            </Field>
            <Field label="Photo" hint="Optional">
              <FilePicker
                label="Photo"
                accept="image/*"
                value={form.image}
                onChange={pickImage}
                currentLabel={editing?.image ? 'Current photo' : undefined}
                onOpenCurrent={
                  editing?.image ? () => void openStoredFile(editing.image) : undefined
                }
              />
            </Field>
            <Field label="Attachment" hint="Optional (PDF or document)">
              <FilePicker
                label="Attachment"
                accept="application/pdf,.pdf,.doc,.docx"
                value={form.file}
                onChange={(file) => setForm({ ...form, file })}
                currentLabel={editing?.file ? 'Current attachment' : undefined}
                onOpenCurrent={editing?.file ? () => void openStoredFile(editing.file) : undefined}
              />
            </Field>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete event"
        message={`Delete "${deleteTarget?.title ?? 'this event'}"? Its photo and attachment are removed too. This cannot be undone.`}
      />
    </PageLayout>
  );
}
