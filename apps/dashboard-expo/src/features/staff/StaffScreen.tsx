/**
 * Staff List, replicating dashboard/src/pages/Admin/StaffList.tsx: "N staff", Add staff, the
 * Total / Designations / With photo strip, search + Designation filter, the table (Staff with
 * photo + address, Designation, Phone, Email, actions), the "Staff details" dialog and the
 * add / edit dialog validated with the shared staffFormSchema (the server runs the same one),
 * including the photo card (file picker on web, photo picker on native).
 * Live data: GET/POST/PUT/DELETE /api/staffs, photo via presigned upload + PUT/DELETE
 * /api/staffs/:id/image (admin only; the server re-checks the key belongs to this school).
 */
import { useQuery } from '@tanstack/react-query';
import { staffFormSchema } from '@school/shared-schemas';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Eye, Pencil, Plus, Trash2, Upload, XIcon } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { Stat, StatStrip } from '@/components/ui/StatStrip';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import {
  filterStaff,
  isImageFile,
  issuesToErrors,
  staffDefaults,
  staffDesignations,
  staffStats,
  toStaffInput,
  type StaffFormValues,
} from '@/features/staff/model';
import { pickFile } from '@/lib/files/pick-file';
import type { PickedFile, StaffInput, StaffRow } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

function Avatar({ s, size = 36 }: { s: StaffRow; size?: number }) {
  const url = fileUrl(s.image);
  const style = { width: size, height: size };
  return url ? (
    <Image
      source={{ uri: url }}
      accessibilityLabel=""
      style={style}
      className="bg-muted rounded-full"
    />
  ) : (
    <View style={style} className="bg-muted items-center justify-center rounded-full">
      <Text size="xs" weight="semibold" color="mutedForeground">
        {s.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function StaffCell({ s }: { s: StaffRow }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar s={s} />
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="medium" numberOfLines={1}>
          {s.name}
        </Text>
        <Text size="xs" color="mutedForeground" numberOfLines={1}>
          {s.address ?? '—'}
        </Text>
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row gap-3">
      <Text size="sm" color="mutedForeground" className="w-24">
        {label}
      </Text>
      <Text size="sm" className="min-w-0 flex-1">
        {value}
      </Text>
    </View>
  );
}

export function StaffScreen() {
  const { staff } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [designation, setDesignation] = useState('');
  const [sort, setSort] = useState<TableSort | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [detail, setDetail] = useState<StaffRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffRow | null>(null);
  const [photo, setPhoto] = useState<PickedFile | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'staff'),
    queryFn: ({ signal }) => staff.list(signal),
    staleTime: 30_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const rows = useMemo(
    () =>
      sortRows(filterStaff(all, { search: query, designation }), sort, {
        name: (s) => s.name,
        designation: (s) => s.designation,
      }),
    [all, query, designation, sort],
  );
  const stats = staffStats(all);
  const designations = staffDesignations(all);
  const filtered = Boolean(query.trim() || designation);

  const { control, handleSubmit, reset, setError } = useForm<StaffFormValues>({
    defaultValues: staffDefaults(),
  });

  const close = () => {
    setFormOpen(false);
    setEditing(null);
    setPhoto(null);
  };
  const save = useAdminMutation({
    mutationFn: async (v: { id: number | null; input: StaffInput; photo: PickedFile | null }) => {
      const id = v.id ?? (await staff.create(v.input))?.id ?? null;
      if (v.id) await staff.update(v.id, v.input);
      if (v.photo && id) await staff.uploadImage(id, v.photo);
    },
    invalidate: [['staff']],
    success: () => (editing ? 'Staff updated successfully.' : 'Staff added successfully.'),
    failure: editing ? 'Failed to update staff.' : 'Failed to add staff.',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => staff.remove(id),
    invalidate: [['staff']],
    success: 'Staff deleted successfully.',
    failure: 'Failed to delete staff.',
    onSuccess: () => {
      setDeleteTarget(null);
      setDetail(null);
    },
  });
  const removeImage = useAdminMutation({
    mutationFn: (id: number) => staff.removeImage(id),
    invalidate: [['staff']],
    success: 'Image removed.',
    failure: 'Failed to remove image.',
    onSuccess: () => setEditing((e) => (e ? { ...e, image: null } : e)),
  });

  const openAdd = () => {
    setEditing(null);
    setPhoto(null);
    reset(staffDefaults());
    setFormOpen(true);
  };
  const openEdit = (s: StaffRow) => {
    setDetail(null);
    setEditing(s);
    setPhoto(null);
    reset(staffDefaults(s));
    setFormOpen(true);
  };
  const submit = handleSubmit((values) => {
    const parsed = staffFormSchema.safeParse(values);
    if (!parsed.success) {
      const errors = issuesToErrors(parsed.error.issues);
      for (const [k, message] of Object.entries(errors)) {
        setError(k as keyof StaffFormValues, { message });
      }
      return;
    }
    save.mutate({ id: editing?.id ?? null, input: toStaffInput(parsed.data), photo });
  });
  const choosePhoto = async () => {
    const f = await pickFile('image/*');
    if (!f) return;
    if (!isImageFile(f.type)) {
      toast.error('Photo must be an image');
      return;
    }
    setPhoto(f);
  };

  const actions = (s: StaffRow) => (
    <View className="flex-row gap-0.5">
      <ActionButton icon={Eye} label={`View ${s.name}`} tone="blue" onPress={() => setDetail(s)} />
      <ActionButton
        icon={Pencil}
        label={`Edit ${s.name}`}
        tone="emerald"
        onPress={() => openEdit(s)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${s.name}`}
        tone="red"
        onPress={() => setDeleteTarget(s)}
      />
    </View>
  );
  const columns: Column<StaffRow>[] = [
    {
      key: 'staff',
      label: 'Staff',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (s) => <StaffCell s={s} />,
    },
    {
      key: 'designation',
      label: 'Designation',
      sortKey: 'designation',
      className: 'w-44',
      render: (s) => (
        <Text size="sm" numberOfLines={1}>
          {s.designation ?? '—'}
        </Text>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      className: 'w-36',
      render: (s) => (
        <Text size="sm" tabular>
          {s.phone}
        </Text>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      className: 'w-56',
      render: (s) => (
        <Text size="sm" numberOfLines={1}>
          {s.email ?? '—'}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  const currentPhoto = photo ? null : fileUrl(editing?.image);

  return (
    <PageLayout
      title="Staff List"
      description={
        q.isPending
          ? 'Loading…'
          : filtered
            ? `${rows.length.toLocaleString()} of ${plural(all.length, 'staff member')}`
            : plural(all.length, 'staff member')
      }
      actions={<Button label="Add staff" icon={Plus} onPress={openAdd} testID="add-staff" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load staff"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <StatStrip>
            <Stat label="Total" value={stats.total} />
            <Stat label="Designations" value={stats.designations} />
            <Stat label="With photo" value={stats.withPhoto} />
          </StatStrip>
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="min-w-[240px] flex-1">
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, phone or email"
                label="Search staff"
                testID="staff-search"
              />
            </View>
            <Select
              label="Designation"
              value={designation}
              onChange={setDesignation}
              options={[
                { value: '', label: 'All designations' },
                ...designations.map((d) => ({ value: d, label: d })),
              ]}
              className="w-48"
            />
          </View>
          <DataTable
            testID="staff"
            sort={sort}
            onSort={setSort}
            rows={rows}
            columns={columns}
            rowKey={(s) => s.id}
            loading={q.isPending}
            empty={filtered ? 'No staff match these filters.' : 'No staff yet.'}
            onRowPress={setDetail}
            renderMobile={(s) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <StaffCell s={s} />
                </View>
                <View className="items-end">
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {s.designation ?? '—'}
                  </Text>
                  <Text size="sm" tabular>
                    {s.phone}
                  </Text>
                </View>
              </View>
            )}
          />
        </>
      )}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title="Staff details"
        testID="staff-details"
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                label="Delete"
                icon={Trash2}
                onPress={() => setDeleteTarget(detail)}
              />
              <Button label="Edit staff" icon={Pencil} onPress={() => openEdit(detail)} />
            </>
          ) : null
        }
      >
        {detail ? (
          <View className="gap-4">
            <View className="flex-row items-center gap-4">
              <Avatar s={detail} size={64} />
              <View className="min-w-0 flex-1">
                <Text size="base" weight="semibold">
                  {detail.name}
                </Text>
                <Text size="sm" color="mutedForeground">
                  {detail.designation ?? '—'}
                </Text>
              </View>
            </View>
            <View className="gap-2">
              <Row label="Phone" value={detail.phone} />
              <Row label="Email" value={detail.email} />
              <Row label="Address" value={detail.address} />
            </View>
          </View>
        ) : null}
      </Dialog>

      <Dialog
        open={formOpen}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit staff' : 'Add staff'}
        size="lg"
        testID="staff-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add staff'}
              onPress={() => void submit()}
              disabled={save.isPending}
              testID="staff-submit"
            />
          </>
        }
      >
        <FieldRow>
          <TextField
            control={control}
            name="name"
            label="Name"
            required
            placeholder="Enter staff name"
            autoCapitalize="words"
          />
          <TextField
            control={control}
            name="designation"
            label="Designation"
            placeholder="Enter designation"
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
          <TextField
            control={control}
            name="email"
            label="Email"
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </FieldRow>
        <TextField control={control} name="address" label="Address" placeholder="Enter address" />
        <Field label="Photo">
          <View className="border-border flex-row flex-wrap items-center gap-3 rounded-lg border p-3">
            {photo || currentPhoto ? (
              <>
                {currentPhoto ? (
                  <Image
                    source={{ uri: currentPhoto }}
                    accessibilityLabel=""
                    className="bg-muted h-12 w-12 rounded-full"
                  />
                ) : null}
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {photo ? photo.name : 'Current photo'}
                  </Text>
                  <Text size="xs" color="mutedForeground">
                    {photo
                      ? `${(photo.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                      : 'Shown on the public site'}
                  </Text>
                </View>
                {photo ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XIcon}
                    label="Remove"
                    onPress={() => setPhoto(null)}
                  />
                ) : editing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={XIcon}
                    label="Remove current"
                    disabled={removeImage.isPending}
                    onPress={() => removeImage.mutate(editing.id)}
                  />
                ) : null}
              </>
            ) : (
              <Text size="sm" color="mutedForeground" className="flex-1">
                No photo
              </Text>
            )}
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              label={photo || currentPhoto ? 'Change' : 'Choose photo'}
              onPress={() => void choosePhoto()}
              testID="staff-photo"
            />
          </View>
        </Field>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete staff"
        message={`Delete ${deleteTarget?.name ?? 'this staff member'}? This cannot be undone.`}
      />
    </PageLayout>
  );
}
