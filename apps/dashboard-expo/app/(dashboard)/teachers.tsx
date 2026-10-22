/**
 * Teacher List, replicating dashboard/src/pages/Admin/TeacherList.tsx: "N teachers", Add
 * teacher, search, the table (Teacher with photo + designation / Email / Phone / actions) and
 * the add/edit dialog (Name, Email, Phone, Designation, Address) validated with the shared
 * teacherFormSchema, the same schema the server runs.
 * Row press / the eye opens "Teacher details" (photo, designation, contact, address, signature;
 * Edit / Delete). Rows can be selected (page checkbox) for Rotate passwords: POST
 * /api/teachers/password-rotations returns an .xlsx with the new credentials (saved / shared) and
 * the server also emails it to the head teacher.
 * Live data: GET/POST/PUT/DELETE /api/teachers. The form's Photo and Signature fields upload after
 * the teacher is saved (POST /api/teachers/{image,signature}/upload-url, presigned PUT, PUT
 * /:id/{image,signature}; DELETE to remove), like the web uploadToR2. The web has no teacher
 * Excel import.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { teacherFormSchema } from '@school/shared-schemas';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import type { TableSort } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import { Eye, KeyRound, Pencil, Plus, Trash2, XIcon } from '@/components/ui/icons';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { PageSizeSelect } from '@/components/ui/PageSizeSelect';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { openStoredFile } from '@/features/admin/open-file';
import { pageState, retainIds, sameIds, toggleId, togglePage } from '@/features/admin/selection';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import {
  TEACHER_FETCH_LIMIT,
  teacherDefaults,
  designationChoices,
  teacherListView,
  teacherStats,
  toTeacherInput,
  type TeacherFormValues,
  type TeacherSortKey,
} from '@/features/teachers/form';
import { useDebounced } from '@/hooks/useDebounced';
import { saveFile, XLSX_MIME } from '@/lib/files/save-file';
import {
  checkTeacherFile,
  type PickedFile,
  type TeacherFileKind,
  type TeacherRow,
} from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

function Avatar({ t }: { t: TeacherRow }) {
  const url = fileUrl(t.image);
  return url ? (
    <Image source={{ uri: url }} accessibilityLabel="" className="bg-muted h-9 w-9 rounded-full" />
  ) : (
    <View className="bg-muted h-9 w-9 items-center justify-center rounded-full">
      <Text size="xs" weight="semibold" color="mutedForeground">
        {t.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <View className="border-border flex-row justify-between gap-4 border-b py-2">
      <Text size="sm" color="mutedForeground">
        {label}
      </Text>
      <Text size="sm" weight="medium" className="shrink text-right" selectable>
        {value || '—'}
      </Text>
    </View>
  );
}

function TeacherDetails({ t }: { t: TeacherRow }) {
  const photo = fileUrl(t.image);
  const signature = fileUrl(t.signature);
  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-4">
        {photo ? (
          <Image
            source={{ uri: photo }}
            accessibilityLabel={`Photo of ${t.name}`}
            className="bg-muted h-20 w-20 rounded-full"
          />
        ) : (
          <View className="bg-muted h-20 w-20 items-center justify-center rounded-full">
            <Text size="xl" weight="semibold" color="mutedForeground">
              {t.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text size="lg" weight="semibold">
            {t.name}
          </Text>
          <Text size="sm" color="mutedForeground">
            {t.designation ?? 'No designation'}
          </Text>
        </View>
      </View>
      <View>
        <Detail label="Email" value={t.email} />
        <Detail label="Phone" value={t.phone} />
        <Detail label="Address" value={t.address} />
      </View>
      <View className="gap-2">
        <Text size="xs" weight="semibold" caps color="mutedForeground" className="tracking-wider">
          Signature
        </Text>
        {signature ? (
          <Image
            source={{ uri: signature }}
            accessibilityLabel={`Signature of ${t.name}`}
            resizeMode="contain"
            className="border-border h-16 w-48 rounded-md border bg-white"
          />
        ) : (
          <Text size="sm" color="mutedForeground">
            No signature uploaded.
          </Text>
        )}
      </View>
    </View>
  );
}

function TeacherCell({ t }: { t: TeacherRow }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar t={t} />
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="medium" numberOfLines={1}>
          {t.name}
        </Text>
        <Text size="xs" color="mutedForeground" numberOfLines={1}>
          {t.designation ?? '—'}
        </Text>
      </View>
    </View>
  );
}

export default function TeachersScreen() {
  const { teachers, teacherSelf } = useApi();
  const toast = useToast();
  const [photo, setPhoto] = useState<PickedFile | null>(null);
  const [signature, setSignature] = useState<PickedFile | null>(null);
  const { resolution } = useTenant();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [designations, setDesignations] = useState<string[]>([]);
  const [emailQuery, setEmailQuery] = useState('');
  const search = useDebounced(query.trim(), 300);
  const [sort, setSort] = useState<TableSort<TeacherSortKey> | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeacherRow | null>(null);
  const [viewing, setViewing] = useState<TeacherRow | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [rotateOpen, setRotateOpen] = useState(false);

  useEffect(() => setPage(1), [search, sort, designations, emailQuery, limit]);

  // Like the web: one request for the first 200, then search / sort / paging in memory.
  const list = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'teachers', { limit: TEACHER_FETCH_LIMIT }),
    queryFn: ({ signal }) => teachers.list({ page: 1, limit: TEACHER_FETCH_LIMIT }, signal),
    staleTime: 30_000,
  });

  const { control, handleSubmit, reset } = useForm<TeacherFormValues>({
    resolver: zodResolver(teacherFormSchema),
    defaultValues: teacherDefaults(),
    mode: 'onBlur',
  });

  const close = () => {
    setFormOpen(false);
    setEditing(null);
    setPhoto(null);
    setSignature(null);
  };
  const save = useAdminMutation({
    mutationFn: async (v: {
      id: number | null;
      values: TeacherFormValues;
      photo: PickedFile | null;
      signature: PickedFile | null;
    }) => {
      let id = v.id;
      if (id) await teachers.update(id, toTeacherInput(v.values));
      else id = (await teachers.create(toTeacherInput(v.values)))?.id ?? null;
      // Files go after the row exists (they need its id); a failed upload keeps the teacher.
      const failed: string[] = [];
      if (id && v.photo)
        await teacherSelf.uploadFile('image', id, v.photo).catch(() => failed.push('photo'));
      if (id && v.signature)
        await teacherSelf
          .uploadFile('signature', id, v.signature)
          .catch(() => failed.push('signature'));
      if (failed.length)
        toast.error(`Saved, but the ${failed.join(' and ')} didn't upload. Try again.`);
    },
    invalidate: [['teachers'], ['dashboard']],
    success: () => (editing ? 'Teacher updated successfully.' : 'Teacher added successfully.'),
    failure: editing
      ? 'An error occurred while updating the teacher.'
      : 'An error occurred while adding the teacher.',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => teachers.remove(id),
    invalidate: [['teachers'], ['dashboard']],
    success: 'Teacher deleted successfully.',
    failure: 'Failed to delete teacher.',
    onSuccess: () => setDeleteTarget(null),
  });

  const openAdd = () => {
    setEditing(null);
    reset(teacherDefaults());
    setFormOpen(true);
  };
  const openEdit = (t: TeacherRow) => {
    setEditing(t);
    reset(teacherDefaults(t));
    setFormOpen(true);
  };
  const submit = handleSubmit((values) =>
    save.mutate({ id: editing?.id ?? null, values, photo, signature }),
  );
  const pickTeacherFile = (kind: TeacherFileKind, f: PickedFile | null) => {
    if (f) {
      const problem = checkTeacherFile(kind, f);
      if (problem) {
        toast.error(problem);
        return;
      }
    }
    (kind === 'image' ? setPhoto : setSignature)(f);
  };
  const removeFile = useAdminMutation({
    mutationFn: async (v: { id: number; kind: TeacherFileKind }) => {
      await (v.kind === 'image'
        ? teacherSelf.removeImage(v.id)
        : teacherSelf.removeSignature(v.id));
      return v.kind;
    },
    invalidate: [['teachers']],
    success: (kind) => (kind === 'image' ? 'Photo removed.' : 'Signature removed.'),
    failure: 'Failed to remove the file.',
    onSuccess: (kind) =>
      setEditing((t) => (t ? { ...t, [kind === 'image' ? 'image' : 'signature']: null } : t)),
  });

  const view = useMemo(
    () => teacherListView(list.data?.rows ?? [], search, sort, designations, emailQuery),
    [list.data, search, sort, designations, emailQuery],
  );
  const totalPages = Math.max(1, Math.ceil(view.length / limit));
  const current = Math.min(page, totalPages);
  const rows = useMemo(
    () => view.slice((current - 1) * limit, current * limit),
    [view, current, limit],
  );
  const meta = list.data?.meta;
  const visibleIds = useMemo(() => rows.map((t) => t.id), [rows]);
  useEffect(() => {
    setSelected((prev) => {
      const next = retainIds(prev, visibleIds);
      return sameIds(prev, next) ? prev : next;
    });
  }, [visibleIds]);
  const head = pageState(selected, visibleIds);
  const rotate = useAdminMutation({
    mutationFn: async () =>
      saveFile(await teachers.rotatePasswords([...selected]), 'rotated_passwords.xlsx', XLSX_MIME),
    invalidate: [],
    success: (r) =>
      r === 'saved'
        ? 'Passwords rotated successfully. Excel downloaded.'
        : 'Passwords rotated, but this device could not save the sheet.',
    failure: 'Failed to rotate passwords. Please try again.',
    onSuccess: () => {
      setRotateOpen(false);
      setSelected(new Set());
    },
  });
  const check = (t: TeacherRow) => (
    <Checkbox
      checked={selected.has(t.id)}
      onChange={() => setSelected(toggleId(selected, t.id))}
      label=""
      testID={`select-teacher-${t.id}`}
    />
  );
  const actions = (t: TeacherRow) => (
    <View className="flex-row gap-0.5">
      <ActionButton icon={Eye} label={`View ${t.name}`} tone="blue" onPress={() => setViewing(t)} />
      <ActionButton
        icon={Pencil}
        label={`Edit ${t.name}`}
        tone="emerald"
        onPress={() => openEdit(t)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${t.name}`}
        tone="red"
        onPress={() => setDeleteTarget(t)}
      />
    </View>
  );
  const columns: Column<TeacherRow>[] = [
    { key: 'select', label: ' ', className: 'w-10', render: check },
    {
      key: 'teacher',
      label: 'Teacher',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (t) => <TeacherCell t={t} />,
    },
    {
      key: 'designation',
      label: 'Designation',
      sortKey: 'designation',
      className: 'w-48',
      render: (t) => (
        <Text size="sm" numberOfLines={1}>
          {t.designation ?? '—'}
        </Text>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortKey: 'email',
      className: 'w-64',
      render: (t) => (
        <Text size="sm" numberOfLines={1}>
          {t.email}
        </Text>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      className: 'w-36',
      render: (t) => (
        <Text size="sm" tabular>
          {t.phone}
        </Text>
      ),
    },
    {
      key: 'signature',
      label: 'Signature',
      className: 'w-24',
      render: (t) => (
        <Text size="sm" color={t.signature ? undefined : 'mutedForeground'}>
          {t.signature ? 'Added' : '—'}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Teacher List"
      description={
        !meta
          ? 'Loading…'
          : [
              search
                ? `${view.length} of ${plural(meta.total, 'teacher')}`
                : plural(meta.total, 'teacher'),
              meta.total > TEACHER_FETCH_LIMIT ? `first ${TEACHER_FETCH_LIMIT} loaded` : null,
            ]
              .filter(Boolean)
              .join(' · ')
      }
      actions={<Button label="Add teacher" icon={Plus} onPress={openAdd} testID="add-teacher" />}
      onRefresh={() => void list.refetch()}
      refreshing={list.isRefetching}
      footer={
        selected.size > 0 ? (
          <ActionBar
            label={`${plural(selected.size, 'teacher')} selected`}
            onClear={() => setSelected(new Set())}
            testID="teachers-bulk-bar"
          >
            <Button
              variant="outline"
              size="sm"
              icon={KeyRound}
              label={rotate.isPending ? 'Rotating…' : 'Rotate passwords'}
              disabled={rotate.isPending}
              onPress={() => setRotateOpen(true)}
              testID="teachers-rotate"
            />
          </ActionBar>
        ) : null
      }
    >
      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load teachers"
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-3">
            <View className="min-w-[240px] flex-1">
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, email, phone or designation"
                label="Search teachers"
                testID="teacher-search"
              />
            </View>
            <MultiSelect
              label="Designation"
              allLabel="All designations"
              value={designations}
              onChange={setDesignations}
              options={designationChoices(list.data?.rows ?? []).map((d) => ({
                value: d,
                label: d,
              }))}
              className="w-48"
              testID="teacher-designation-filter"
            />
            <View className="w-48">
              <SearchInput
                value={emailQuery}
                onChangeText={setEmailQuery}
                placeholder="Filter by email"
                label="Filter teachers by email"
              />
            </View>
            {search || designations.length || emailQuery.trim() ? (
              <Button
                variant="ghost"
                size="sm"
                icon={XIcon}
                label="Clear filters"
                onPress={() => {
                  setQuery('');
                  setEmailQuery('');
                  setDesignations([]);
                }}
              />
            ) : null}
            <Checkbox
              checked={head.all}
              onChange={() => setSelected(togglePage(selected, visibleIds))}
              label="Select page"
              disabled={visibleIds.length === 0}
              testID="teachers-select-page"
            />
          </View>
          {list.data && list.data.rows.length > 0 ? (
            <StatStrip className="sm:max-w-md">
              <Stat label="Total" value={teacherStats(list.data.rows).total} />
              <Stat
                label="With photo"
                value={teacherStats(list.data.rows).withPhoto}
                dot="bg-emerald-500"
              />
              <Stat
                label="With signature"
                value={teacherStats(list.data.rows).withSignature}
                dot="bg-sky-500"
              />
            </StatStrip>
          ) : null}
          <DataTable
            testID="teachers"
            rows={rows}
            columns={columns}
            rowKey={(t) => t.id}
            loading={list.isPending}
            sort={sort}
            onSort={(next) => setSort(next as TableSort<TeacherSortKey> | null)}
            empty={
              search
                ? `No teachers match “${search}”.`
                : designations.length
                  ? 'No teachers match these filters.'
                  : 'No teachers yet.'
            }
            onRowPress={setViewing}
            renderMobile={(t) => (
              <View className="flex-row items-center gap-3">
                {check(t)}
                <View className="min-w-0 flex-1">
                  <TeacherCell t={t} />
                </View>
                <Text size="xs" color="mutedForeground" tabular>
                  {t.phone}
                </Text>
              </View>
            )}
          />
          {meta ? (
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <PageSizeSelect value={limit} onChange={setLimit} />
              <Pagination
                page={current}
                totalPages={totalPages}
                onPage={setPage}
                busy={list.isFetching}
              />
            </View>
          ) : null}
        </>
      )}

      <Dialog
        open={formOpen}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit teacher' : 'Add teacher'}
        description={
          editing ? undefined : 'A password is generated and emailed to the head teacher.'
        }
        testID="teacher-form"
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
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add teacher'}
              onPress={() => void submit()}
              disabled={save.isPending}
              testID="teacher-submit"
            />
          </>
        }
      >
        <FieldRow>
          <TextField control={control} name="name" label="Name" required autoCapitalize="words" />
          <TextField
            control={control}
            name="email"
            label="Email"
            required
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextField
            control={control}
            name="phone"
            label="Phone"
            required
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            maxLength={11}
          />
          <Controller
            control={control}
            name="designation"
            render={({ field, fieldState }) => (
              <Field label="Designation" required error={fieldState.error?.message}>
                <Select
                  label="Designation"
                  value={field.value || null}
                  placeholder="Select designation"
                  options={designationChoices([
                    ...(list.data?.rows ?? []),
                    ...(field.value ? [{ designation: field.value } as TeacherRow] : []),
                  ]).map((d) => ({ value: d, label: d }))}
                  onChange={field.onChange}
                />
              </Field>
            )}
          />
        </FieldRow>
        <TextField control={control} name="address" label="Address" required />
        <FieldRow>
          <Field label="Photo" hint="Image, up to 2 MB.">
            <FilePicker
              accept="image/*"
              label="Photo"
              value={photo}
              onChange={(f) => pickTeacherFile('image', f)}
              currentLabel={editing?.image ? 'Current photo' : undefined}
              onOpenCurrent={editing?.image ? () => void openStoredFile(editing.image) : undefined}
              disabled={save.isPending}
            />
            {editing?.image && !photo ? (
              <Button
                variant="link"
                size="sm"
                label="Remove photo"
                disabled={removeFile.isPending}
                onPress={() => removeFile.mutate({ id: editing.id, kind: 'image' })}
                className="h-auto self-start px-0"
              />
            ) : null}
          </Field>
          <Field label="Signature" hint="Image, up to 1 MB.">
            <FilePicker
              accept="image/*"
              label="Signature"
              value={signature}
              onChange={(f) => pickTeacherFile('signature', f)}
              currentLabel={editing?.signature ? 'Current signature' : undefined}
              onOpenCurrent={
                editing?.signature ? () => void openStoredFile(editing.signature) : undefined
              }
              disabled={save.isPending}
            />
            {editing?.signature && !signature ? (
              <Button
                variant="link"
                size="sm"
                label="Remove signature"
                disabled={removeFile.isPending}
                onPress={() => removeFile.mutate({ id: editing.id, kind: 'signature' })}
                className="h-auto self-start px-0"
              />
            ) : null}
          </Field>
        </FieldRow>
      </Dialog>

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Teacher details"
        testID="teacher-details"
        footer={
          viewing ? (
            <>
              <Button
                variant="outline"
                label="Delete"
                icon={Trash2}
                onPress={() => {
                  setDeleteTarget(viewing);
                  setViewing(null);
                }}
              />
              <Button
                label="Edit"
                icon={Pencil}
                onPress={() => {
                  const t = viewing;
                  setViewing(null);
                  openEdit(t);
                }}
              />
            </>
          ) : null
        }
      >
        {viewing ? <TeacherDetails t={viewing} /> : null}
      </Dialog>

      <ConfirmDialog
        open={rotateOpen}
        onClose={() => setRotateOpen(false)}
        busy={rotate.isPending}
        tone="default"
        onConfirm={() => rotate.mutate(undefined)}
        confirmLabel="Rotate passwords"
        message={`This will generate new passwords for ${plural(selected.size, 'teacher')}. An Excel file with the new credentials downloads here and is also emailed to the headmaster. Old passwords stop working.`}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete teacher"
        message={`Delete ${deleteTarget?.name ?? 'this teacher'}? This cannot be undone.`}
      />
    </PageLayout>
  );
}
