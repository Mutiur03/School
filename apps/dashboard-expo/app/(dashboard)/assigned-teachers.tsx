/**
 * Class teachers, replicating dashboard/src/pages/Admin/AddLevel.tsx: title + academic year,
 * "N assignments in YYYY · N teachers", Assign teacher, the Class / Section / Teacher table with
 * edit / remove, and the assign / update dialog (class, section, teacher).
 * Live data: GET /api/levels, /api/teachers?limit=100; POST /api/levels; PATCH /api/levels/:id;
 * DELETE /api/levels/:id. The school comes from the session; the client never sends a school id.
 */
import { levelFormSchema } from '@school/shared-schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { sortRows, type TableSort } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Pencil, Plus, Trash2 } from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { duplicateLevel, filterLevels, levelYearOptions } from '@/features/levels/model';
import { LEVEL_CLASSES, LEVEL_SECTIONS, type Level, type LevelInput } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const CURRENT_YEAR = new Date().getFullYear();

interface FormState {
  class_name: number | null;
  section: string;
  teacher_id: number | null;
}
type FormErrors = Partial<Record<keyof FormState, string>>;

export default function AssignedTeachersScreen() {
  const { levels, teachers } = useApi();
  const { resolution } = useTenant();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [cls, setCls] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<Level | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Level | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'levels'),
    queryFn: ({ signal }) => levels.list(signal),
    staleTime: 60_000,
  });
  const teachersQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'teachers', 'options'),
    queryFn: ({ signal }) => teachers.list({ page: 1, limit: 100 }, signal),
    staleTime: 5 * 60_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const yearCount = all.filter((l) => l.year === year).length;
  const [sort, setSort] = useState<TableSort | null>(null);
  const rows = sortRows(filterLevels(all, { year, cls: cls || null, search }), sort, {
    class: (l) => `${String(l.class_name).padStart(2, '0')}-${l.section}`,
    teacher: (l) => l.teacher_name,
  });
  const teacherOptions = (teachersQ.data?.rows ?? []).map((t) => ({ value: t.id, label: t.name }));

  const close = () => {
    setForm(null);
    setEditing(null);
    setErrors({});
  };
  const invalidate = [['levels'], ['dashboard']] as const;
  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: LevelInput }) =>
      v.id ? levels.update(v.id, v.input) : levels.create(v.input),
    invalidate,
    success: () =>
      editing ? 'Assignment updated successfully' : 'Class teacher assigned successfully',
    failure: editing ? 'Failed to update assignment' : 'Failed to assign teacher',
    onSuccess: close,
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => levels.remove(id),
    invalidate,
    success: 'Assignment deleted successfully',
    failure: 'Failed to delete assignment',
    onSuccess: () => setDeleteTarget(null),
  });

  const openAdd = () => {
    setEditing(null);
    setErrors({});
    setForm({ class_name: null, section: '', teacher_id: null });
  };
  const openEdit = (l: Level) => {
    setEditing(l);
    setErrors({});
    setForm({ class_name: l.class_name, section: l.section, teacher_id: l.teacher_id });
  };
  const submit = () => {
    if (!form) return;
    const values = {
      class_name: form.class_name ?? 0,
      section: form.section,
      year,
      teacher_id: form.teacher_id ?? 0,
    };
    const parsed = levelFormSchema.safeParse(values);
    const e: FormErrors = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const k = i.path[0] as keyof FormState;
        if (k in values && !e[k]) e[k] = i.message;
      }
    } else {
      const dup = duplicateLevel(all, values, editing?.id ?? null);
      if (dup)
        e.section = `Class ${dup.class_name} Section ${dup.section} already has ${dup.teacher_name}`;
    }
    setErrors(e);
    if (Object.keys(e).length === 0) save.mutate({ id: editing?.id ?? null, input: values });
  };

  const actions = (l: Level) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit Class ${l.class_name} Section ${l.section}`}
        tone="emerald"
        onPress={() => openEdit(l)}
      />
      <ActionButton
        icon={Trash2}
        label={`Remove Class ${l.class_name} Section ${l.section}`}
        tone="red"
        onPress={() => setDeleteTarget(l)}
      />
    </View>
  );
  const teacherCell = (l: Level) =>
    l.teacher_name ? (
      <Text size="sm" numberOfLines={1}>
        {l.teacher_name}
      </Text>
    ) : (
      <Text size="sm" color="mutedForeground">
        —
      </Text>
    );

  const columns: Column<Level>[] = [
    {
      key: 'class',
      label: 'Class',
      sortKey: 'class',
      className: 'w-32',
      render: (l) => (
        <Text size="sm" weight="medium">
          Class {l.class_name}
        </Text>
      ),
    },
    {
      key: 'section',
      label: 'Section',
      className: 'w-32',
      render: (l) => <Text size="sm">{l.section}</Text>,
    },
    {
      key: 'teacher',
      label: 'Teacher',
      sortKey: 'teacher',
      className: 'min-w-0 flex-1',
      render: teacherCell,
    },
    { key: 'actions', label: ' ', className: 'w-[88px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Class Teachers"
      titleAccessory={
        <Select
          label="Academic year"
          size="sm"
          value={year}
          onChange={setYear}
          options={levelYearOptions(CURRENT_YEAR).map((y) => ({ value: y, label: String(y) }))}
        />
      }
      description={
        q.isPending || teachersQ.isPending
          ? 'Loading…'
          : `${plural(yearCount, 'assignment')} in ${year} · ${plural(teachersQ.data?.meta.total ?? teacherOptions.length, 'teacher')}`
      }
      actions={
        <Button label="Assign teacher" icon={Plus} onPress={openAdd} testID="assign-teacher" />
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load assignments"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <Select
              label="Class"
              size="sm"
              value={cls}
              options={[
                { value: 0, label: 'All classes' },
                ...LEVEL_CLASSES.map((c) => ({ value: c as number, label: `Class ${c}` })),
              ]}
              onChange={setCls}
            />
            <View className="min-w-[200px] flex-1">
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Teacher or class…"
                label="Search assignments"
              />
            </View>
          </View>
          <DataTable
            testID="levels"
            sort={sort}
            onSort={setSort}
            rows={rows}
            columns={columns}
            rowKey={(l) => l.id}
            loading={q.isPending}
            empty={
              yearCount === 0
                ? `No class teachers assigned for ${year} yet.`
                : 'No assignments match these filters.'
            }
            onRowPress={openEdit}
            renderMobile={(l) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium">
                    Class {l.class_name} · Section {l.section}
                  </Text>
                  {teacherCell(l)}
                </View>
                {actions(l)}
              </View>
            )}
          />
        </>
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : close())}
        title={`${editing ? 'Update class teacher' : 'Assign class teacher'} · ${year}`}
        testID="level-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={
                save.isPending
                  ? editing
                    ? 'Updating…'
                    : 'Assigning…'
                  : editing
                    ? 'Update assignment'
                    : 'Assign teacher'
              }
              onPress={submit}
              disabled={save.isPending}
              testID="level-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            <FieldRow>
              <Field label="Class" required error={errors.class_name}>
                <Select
                  label="Class"
                  value={form.class_name}
                  placeholder="Select class"
                  options={LEVEL_CLASSES.map((c) => ({ value: c as number, label: `Class ${c}` }))}
                  onChange={(class_name) => setForm({ ...form, class_name })}
                />
              </Field>
              <Field label="Section" required error={errors.section}>
                <Select
                  label="Section"
                  value={form.section || null}
                  placeholder="Select section"
                  options={LEVEL_SECTIONS.map((s) => ({
                    value: s as string,
                    label: `Section ${s}`,
                  }))}
                  onChange={(section) => setForm({ ...form, section })}
                />
              </Field>
            </FieldRow>
            <Field label="Teacher" required error={errors.teacher_id}>
              <Select
                label="Teacher"
                value={form.teacher_id}
                placeholder={teachersQ.isPending ? 'Loading teachers…' : 'Choose teacher'}
                options={teacherOptions}
                onChange={(teacher_id) => setForm({ ...form, teacher_id })}
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
        confirmLabel="Remove"
        message={`Are you sure you want to remove ${deleteTarget?.teacher_name ?? 'this teacher'} from Class ${deleteTarget?.class_name ?? ''} Section ${deleteTarget?.section ?? ''}?`}
      />
    </PageLayout>
  );
}
