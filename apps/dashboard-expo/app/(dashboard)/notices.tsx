/**
 * Notice, replicating dashboard/src/pages/Admin/Notice.tsx: "Notices" header with
 * "N notices · latest <date>", New notice, title search, the table (Title / Published /
 * actions: open, edit, delete) and the New/Edit dialog (Title, Publish date, PDF).
 * Live data: GET/POST/PUT/DELETE /api/notices/*; the PDF goes straight to R2 via a presigned URL.
 * The PDF comes from FilePicker (file input on web, document picker on native).
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import { ExternalLink, Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { openStoredFile } from '@/features/admin/open-file';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { formatDay } from '@/features/holidays/model';
import { filterNotices, noticeDay, noticeSummary } from '@/features/notices/model';
import { isPdf, type Notice, type NoticeInput, type PickedFile } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const PAGE = 50;

export default function NoticesScreen() {
  const { notices } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<TableSort | null>(null);
  const [form, setForm] = useState<NoticeInput | null>(null);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [errors, setErrors] = useState<{ title?: string; file?: string }>({});
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'notices'),
    queryFn: ({ signal }) => notices.list(signal),
    staleTime: 30_000,
  });
  const filtered = useMemo(
    () =>
      sortRows(filterNotices(q.data ?? [], search), sort, {
        title: (n) => n.title,
        date: (n) => noticeDay(n),
      }),
    [q.data, search, sort],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, totalPages);
  const rows = filtered.slice((current - 1) * PAGE, current * PAGE);

  const close = () => {
    setForm(null);
    setEditing(null);
    setErrors({});
  };
  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: NoticeInput }) =>
      v.id ? notices.update(v.id, v.input) : notices.create(v.input),
    invalidate: [['notices'], ['dashboard']],
    success: () => (editing ? 'Notice updated successfully' : 'Notice added successfully'),
    failure: editing ? 'Error updating notice' : 'Error adding notice',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => notices.remove(id),
    invalidate: [['notices'], ['dashboard']],
    success: 'Notice deleted successfully',
    failure: 'Error deleting notice',
    onSuccess: () => setDeleteTarget(null),
  });

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ title: '', created_at: '', file: null });
  };
  const openEdit = (n: Notice) => {
    setEditing(n);
    setErrors({});
    setForm({ title: n.title, created_at: noticeDay(n), file: null });
  };
  const pick = (file: PickedFile | null) => {
    if (!form) return;
    if (file && !isPdf(file)) {
      toast.error('Notice must be a PDF');
      return;
    }
    setForm({ ...form, file });
  };
  const submit = () => {
    if (!form) return;
    const e: typeof errors = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!editing && !form.file) e.file = 'Choose a PDF to publish';
    setErrors(e);
    if (!e.title && !e.file) save.mutate({ id: editing?.id ?? null, input: form });
  };
  const open = async (n: Notice) => {
    if (!(await openStoredFile(n.file ?? n.download_url))) toast.error('This notice has no file.');
  };

  const actions = (n: Notice) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={ExternalLink}
        label={`Open ${n.title}`}
        tone="blue"
        onPress={() => void open(n)}
      />
      <ActionButton
        icon={Pencil}
        label={`Edit ${n.title}`}
        tone="emerald"
        onPress={() => openEdit(n)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${n.title}`}
        tone="red"
        onPress={() => setDeleteTarget(n)}
      />
    </View>
  );
  const columns: Column<Notice>[] = [
    {
      key: 'title',
      label: 'Title',
      sortKey: 'title',
      className: 'min-w-0 flex-1',
      render: (n) => (
        <Pressable accessibilityRole="link" onPress={() => void open(n)}>
          <Text size="sm" weight="medium" numberOfLines={2} className="hover:underline">
            {n.title}
          </Text>
        </Pressable>
      ),
    },
    {
      key: 'date',
      label: 'Published',
      sortKey: 'date',
      className: 'w-40',
      render: (n) => (
        <Text size="sm" color="mutedForeground" tabular>
          {formatDay(noticeDay(n))}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Notices"
      description={q.isPending ? 'Loading…' : noticeSummary(q.data ?? [])}
      actions={<Button label="New notice" icon={Plus} onPress={openCreate} testID="new-notice" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load notices"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <SearchInput
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search titles…"
            label="Search notices"
            testID="notice-search"
          />
          <DataTable
            testID="notices"
            sort={sort}
            onSort={setSort}
            rows={rows}
            columns={columns}
            rowKey={(n) => n.id}
            loading={q.isPending}
            empty={search.trim() ? `No notices match “${search.trim()}”.` : 'No notices yet.'}
            onRowPress={openEdit}
            renderMobile={(n) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={2}>
                    {n.title}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {formatDay(noticeDay(n))}
                  </Text>
                </View>
                {actions(n)}
              </View>
            )}
          />
          <Pagination page={current} totalPages={totalPages} onPage={setPage} />
        </>
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit notice' : 'New notice'}
        testID="notice-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Publish notice'}
              onPress={submit}
              disabled={save.isPending}
              testID="notice-submit"
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
                placeholder="e.g. Annual Sports Day 2026 schedule"
                accessibilityLabel="Title"
              />
            </Field>
            <Field
              label="Publish date"
              hint={
                editing ? 'Leave empty to keep the current date.' : 'Optional. Defaults to today.'
              }
            >
              <DateInput
                label="Publish date"
                value={form.created_at}
                onChange={(created_at) => setForm({ ...form, created_at })}
              />
            </Field>
            <Field label="PDF" required={!editing} error={errors.file}>
              <FilePicker
                label="PDF"
                accept="application/pdf,.pdf"
                value={form.file}
                onChange={pick}
                currentLabel={editing ? 'Current file' : undefined}
                onOpenCurrent={editing ? () => void open(editing) : undefined}
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
        confirmLabel="Delete notice"
        message={`Delete "${deleteTarget?.title ?? 'this notice'}"? The PDF is removed from storage. This cannot be undone.`}
      />
    </PageLayout>
  );
}
