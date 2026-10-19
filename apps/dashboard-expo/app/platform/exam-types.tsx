/**
 * Exam types, ported from dashboard/src/pages/SuperAdmin/ExamTypes.tsx: the global catalog
 * (search, Year end / New schools flags, "N schools · N exam instances", Edit, Delete only when
 * unused), the schools list with assigned counts, and the three dialogs (type form, a school's
 * types, in use). Endpoints: GET/POST/PUT/DELETE /api/exam-types, PUT /api/exam-types/school/:id.
 *
 * Tenant-affecting writes are confirmed and single-flight: editing a type (renames it and may
 * cascade year-end to open exams in every school), deleting it, and changing a school's types.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import {
  assignedTypeIds,
  cascadeMessage,
  classLabel,
  emptyTypeForm,
  examTypePayload,
  filterByName,
  schoolTypesDiff,
  typeCountBySchool,
  typeToForm,
  type ExamTypeForm,
} from '@/features/platform/model';
import { platformSchemas } from '@/features/platform/schemas';
import {
  SchoolLogo,
  useConfirmGate,
  usePlatformKey,
  usePlatformSchools,
} from '@/features/platform/ui';
import { useMinWidth } from '@/hooks/useBreakpoint';
import type { PlatformExamType, PlatformSchool } from '@/lib/api';
import { cn } from '@/lib/utils';
import { usePlatformApi } from '@/session/ApiProvider';

function TypeFlags({ type }: { type: PlatformExamType }) {
  if (!type.is_year_end && !type.assign_to_new_schools) return null;
  return (
    <View className="flex-row flex-wrap gap-1">
      {type.is_year_end ? <Badge label="Year end" /> : null}
      {type.assign_to_new_schools ? <Badge label="New schools" variant="outline" /> : null}
    </View>
  );
}

export default function PlatformExamTypesScreen() {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const queryClient = useQueryClient();
  const toast = useToast();
  const wide = useMinWidth('lg');
  const { ask, dialog: confirmDialog, gate } = useConfirmGate();
  const createFlight = useSingleFlight();

  const typesQ = useQuery({
    queryKey: key('exam-types'),
    queryFn: ({ signal }) => platform.listExamTypes(signal),
    staleTime: 30_000,
  });
  const schoolsQ = usePlatformSchools();
  const types = useMemo(() => typesQ.data ?? [], [typesQ.data]);
  const schools = useMemo(() => schoolsQ.data ?? [], [schoolsQ.data]);

  const [typeQuery, setTypeQuery] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [typeForm, setTypeForm] = useState<ExamTypeForm | null>(null);
  const [editing, setEditing] = useState<PlatformExamType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openSchool, setOpenSchool] = useState<PlatformSchool | null>(null);
  const [schoolTypeIds, setSchoolTypeIds] = useState<number[]>([]);
  const [schoolTypeQuery, setSchoolTypeQuery] = useState('');
  const [usedBy, setUsedBy] = useState<PlatformExamType | null>(null);

  const visibleTypes = useMemo(
    () => filterByName(types, typeQuery, (t) => [t.name]),
    [types, typeQuery],
  );
  const visibleSchools = useMemo(
    () => filterByName(schools, schoolQuery, (s) => [s.name, s.shortName ?? '']),
    [schools, schoolQuery],
  );
  const dialogTypes = useMemo(
    () => filterByName(types, schoolTypeQuery, (t) => [t.name]),
    [types, schoolTypeQuery],
  );
  const counts = useMemo(() => typeCountBySchool(types), [types]);
  const loading = typesQ.isLoading || schoolsQ.isLoading;
  const loadError = typesQ.isError || schoolsQ.isError;
  const refresh = () => {
    void typesQ.refetch();
    void schoolsQ.refetch();
  };
  const reload = () => queryClient.invalidateQueries({ queryKey: key('exam-types') });

  const closeTypeForm = () => {
    if (gate.busy || creating) return;
    setTypeForm(null);
    setEditing(null);
    setFormError(null);
  };
  const startCreate = () => {
    setEditing(null);
    setFormError(null);
    setTypeForm(emptyTypeForm());
  };
  const startEdit = (t: PlatformExamType) => {
    setEditing(t);
    setFormError(null);
    setTypeForm(typeToForm(t));
  };

  const submitType = () => {
    if (!typeForm) return;
    const built = examTypePayload(typeForm, platformSchemas);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    setFormError(null);
    if (!editing) {
      // Additive: a new catalog entry changes no existing school exam. Still single-flight.
      void createFlight.run(async () => {
        setCreating(true);
        try {
          await platform.createExamType(built.value);
          toast.success('Exam type created');
          setTypeForm(null);
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Could not save exam type'));
        } finally {
          setCreating(false);
        }
      });
      return;
    }
    const target = editing;
    const schoolsUsing = target.school_ids.length;
    const yearEndChanged = target.is_year_end !== built.value.is_year_end;
    ask(
      {
        title: `Save "${target.name}"?`,
        message: `${plural(schoolsUsing, 'school')} use this type.${
          yearEndChanged
            ? ' Changing year-end updates their open exams automatically (frozen or overlapping ones are skipped).'
            : ' Their exam pages show the new name and order.'
        }`,
        confirmLabel: 'Save type',
        tone: yearEndChanged ? 'destructive' : 'default',
      },
      async () => {
        try {
          const cascade = await platform.updateExamType(target.id, built.value);
          toast.success(cascadeMessage(cascade));
          setTypeForm(null);
          setEditing(null);
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Could not save exam type'));
        }
      },
    );
  };

  const deleteType = (t: PlatformExamType) => {
    if (t.exam_count > 0) return;
    ask(
      {
        title: 'Delete exam type?',
        message: `Delete “${t.name}”? ${plural(t.school_ids.length, 'school')} lose this option.`,
        confirmLabel: 'Delete',
        tone: 'destructive',
      },
      async () => {
        try {
          await platform.deleteExamType(t.id);
          toast.success('Exam type deleted');
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Could not delete exam type'));
        }
      },
    );
  };

  const openSchoolTypes = (s: PlatformSchool) => {
    setOpenSchool(s);
    setSchoolTypeIds(assignedTypeIds(types, s.id));
    setSchoolTypeQuery('');
  };
  const closeSchoolTypes = () => {
    if (!gate.busy) setOpenSchool(null);
  };
  const saveSchoolTypes = () => {
    if (!openSchool) return;
    const school = openSchool;
    const ids = [...schoolTypeIds];
    const diff = schoolTypesDiff(assignedTypeIds(types, school.id), ids);
    if (!diff.added.length && !diff.removed.length) {
      setOpenSchool(null);
      return;
    }
    ask(
      {
        title: `Update exam types for ${school.name}?`,
        message: `${diff.added.length} added, ${diff.removed.length} removed. Unchecking a type does not delete exams already created.`,
        confirmLabel: 'Save types',
        tone: diff.removed.length ? 'destructive' : 'default',
      },
      async () => {
        try {
          await platform.setSchoolExamTypes(school.id, ids);
          toast.success(`Exam types updated for ${school.name}`);
          setOpenSchool(null);
          await reload();
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Could not update school exam types'));
        }
      },
    );
  };

  const typesCard = (
    <SectionCard
      title="Exam types"
      description={`${types.length} in catalog`}
      icon={<Icon icon={ClipboardList} size={20} color="primary" />}
    >
      <SearchInput
        value={typeQuery}
        onChangeText={setTypeQuery}
        placeholder="Search types…"
        label="Search types"
      />
      {loading ? (
        <LoadingState label="Loading exam types…" />
      ) : loadError ? (
        <EmptyState message="Exam types could not be loaded." />
      ) : visibleTypes.length === 0 ? (
        <EmptyState
          message={
            types.length === 0
              ? 'No exam types yet. Create the first type.'
              : 'No types match that search.'
          }
        />
      ) : (
        <View className="border-border mt-3 rounded-lg border" testID="platform-exam-types">
          {visibleTypes.map((t, i) => {
            const canDelete = t.exam_count === 0;
            return (
              <View
                key={t.id}
                className={cn(
                  'gap-3 p-4 sm:flex-row sm:items-start sm:justify-between',
                  i > 0 && 'border-border border-t',
                )}
              >
                <View className="min-w-0 flex-1 gap-1.5">
                  <Text weight="medium">{t.name}</Text>
                  <TypeFlags type={t} />
                  <View className="flex-row flex-wrap items-center">
                    <Text size="xs" color="mutedForeground" tabular>
                      {plural(t.school_ids.length, 'school')} ·{' '}
                    </Text>
                    {t.exam_count > 0 ? (
                      <Pressable accessibilityRole="button" onPress={() => setUsedBy(t)}>
                        <Text size="xs" color="primary" tabular className="hover:underline">
                          {plural(t.exam_count, 'exam instance')}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text size="xs" color="mutedForeground">
                        0 exam instances
                      </Text>
                    )}
                  </View>
                </View>
                <View className="flex-row gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Pencil}
                    label="Edit"
                    onPress={() => startEdit(t)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    label="Delete"
                    disabled={!canDelete || gate.busy}
                    accessibilityHint={
                      canDelete ? `Delete ${t.name}` : `Used by ${plural(t.exam_count, 'exam')}`
                    }
                    onPress={() => deleteType(t)}
                  />
                </View>
              </View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );

  const schoolsCard = (
    <SectionCard
      title="Schools"
      description="Assign catalog types per tenant"
      icon={<Icon icon={Building2} size={20} color="primary" />}
    >
      <SearchInput
        value={schoolQuery}
        onChangeText={setSchoolQuery}
        placeholder="Search schools…"
        label="Search schools"
      />
      {loading ? (
        <LoadingState label="Loading schools…" />
      ) : loadError ? (
        <EmptyState message="Schools could not be loaded." />
      ) : visibleSchools.length === 0 ? (
        <EmptyState
          message={schools.length === 0 ? 'No schools yet.' : 'No schools match that search.'}
        />
      ) : (
        <View className="mt-3 gap-2">
          {visibleSchools.map((s) => {
            const count = counts.get(s.id) ?? 0;
            const isOpen = openSchool?.id === s.id;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityLabel={`Exam types for ${s.name}`}
                onPress={() => openSchoolTypes(s)}
                className={cn(
                  'flex-row items-center gap-3 rounded-lg border p-3',
                  isOpen ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                )}
              >
                <SchoolLogo logo={s.logo} />
                <View className="min-w-0 flex-1">
                  <Text weight="medium" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text size="xs" color="mutedForeground" numberOfLines={1}>
                    {s.shortName ? `${s.shortName} · ` : ''}
                    {plural(count, 'type')} assigned
                  </Text>
                </View>
                <Icon icon={ChevronRight} size={16} color="mutedForeground" />
              </Pressable>
            );
          })}
        </View>
      )}
    </SectionCard>
  );

  return (
    <PageLayout
      title="Exam types"
      description="Global catalog and which types each school can create."
      onRefresh={refresh}
      refreshing={typesQ.isRefetching}
      actions={
        <>
          <Button
            variant="outline"
            icon={RefreshCw}
            label="Refresh"
            disabled={typesQ.isFetching}
            onPress={refresh}
          />
          <Button icon={Plus} label="Create type" disabled={loading} onPress={startCreate} />
        </>
      }
    >
      {loadError ? (
        <ErrorState
          title="Could not load exam data"
          message="Check your connection and try again."
          onRetry={refresh}
        />
      ) : null}
      {wide ? (
        <View className="flex-row items-start gap-6">
          <View className="min-w-0 flex-[7]">{typesCard}</View>
          <View className="min-w-0 flex-[5]">{schoolsCard}</View>
        </View>
      ) : (
        <>
          {typesCard}
          {schoolsCard}
        </>
      )}

      <Dialog
        open={!!typeForm}
        onClose={closeTypeForm}
        title={editing ? 'Edit exam type' : 'Create exam type'}
        description="Year-end types drive pass/fail and promotion. Changing year-end updates open school exams automatically (frozen or overlapping ones are skipped)."
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              disabled={creating || gate.busy}
              onPress={closeTypeForm}
            />
            <Button
              testID="exam-type-save"
              label={creating || gate.busy ? 'Saving…' : editing ? 'Save type' : 'Create type'}
              disabled={creating || gate.busy}
              onPress={submitType}
            />
          </>
        }
      >
        {typeForm ? (
          <View className="gap-4">
            <FieldRow>
              <Field label="Name" required error={formError ?? undefined}>
                <Input
                  value={typeForm.name}
                  maxLength={100}
                  autoCorrect={false}
                  accessibilityLabel="Name"
                  onChangeText={(name) => setTypeForm({ ...typeForm, name })}
                />
              </Field>
              <Field label="Sort order">
                <Input
                  value={typeForm.sort_order}
                  keyboardType="number-pad"
                  accessibilityLabel="Sort order"
                  onChangeText={(v) =>
                    setTypeForm({ ...typeForm, sort_order: v.replace(/[^\d]/g, '') })
                  }
                />
              </Field>
            </FieldRow>
            <View className="border-border gap-3 rounded-md border p-3">
              <Checkbox
                checked={typeForm.is_year_end}
                onChange={(is_year_end) => setTypeForm({ ...typeForm, is_year_end })}
                label="Year-end official result"
                description="Only this exam's marks count for GPA, merit, and promotion."
              />
              <Checkbox
                checked={typeForm.assign_to_new_schools}
                onChange={(assign_to_new_schools) =>
                  setTypeForm({ ...typeForm, assign_to_new_schools })
                }
                label="Assign to new schools"
                description="Auto-enable when a new tenant is created."
              />
            </View>
          </View>
        ) : null}
      </Dialog>

      <Dialog
        open={!!openSchool}
        onClose={closeSchoolTypes}
        title={openSchool ? `Exam types · ${openSchool.name}` : 'Exam types'}
        description="Choose which catalog types this school can create. Unchecking a type does not delete exams already created."
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              disabled={gate.busy}
              onPress={closeSchoolTypes}
            />
            <Button
              label={gate.busy ? 'Saving…' : 'Save types'}
              disabled={gate.busy || types.length === 0 || loading}
              onPress={saveSchoolTypes}
            />
          </>
        }
      >
        <View className="gap-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text size="xs" color="mutedForeground" tabular>
              {schoolTypeIds.length} of {types.length} selected
            </Text>
            <View className="flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                label="All"
                onPress={() => setSchoolTypeIds(types.map((t) => t.id))}
              />
              <Button
                variant="outline"
                size="sm"
                label="None"
                onPress={() => setSchoolTypeIds([])}
              />
            </View>
          </View>
          <SearchInput
            value={schoolTypeQuery}
            onChangeText={setSchoolTypeQuery}
            placeholder="Search types…"
            label="Search types"
          />
          <View className="border-border max-h-64 gap-1 rounded-md border p-2">
            {dialogTypes.length === 0 ? (
              <Text size="sm" color="mutedForeground" className="py-6 text-center">
                {types.length === 0 ? 'Create an exam type first.' : 'No types match that search.'}
              </Text>
            ) : (
              dialogTypes.map((t) => (
                <View key={t.id} className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Checkbox
                      checked={schoolTypeIds.includes(t.id)}
                      onChange={(on) =>
                        setSchoolTypeIds((prev) =>
                          on ? [...prev, t.id] : prev.filter((id) => id !== t.id),
                        )
                      }
                      label={t.name}
                    />
                  </View>
                  {t.is_year_end ? <Badge label="Year end" variant="outline" /> : null}
                </View>
              ))
            )}
          </View>
        </View>
      </Dialog>

      <Dialog
        open={!!usedBy}
        onClose={() => setUsedBy(null)}
        title={usedBy ? `In use · ${usedBy.name}` : 'In use'}
        description="School exam instances using this type. Remove them in the school admin panel before deleting the catalog entry."
        footer={<Button variant="outline" label="Close" onPress={() => setUsedBy(null)} />}
      >
        <View className="border-border rounded-md border">
          {(usedBy?.used_by ?? []).length === 0 ? (
            <Text size="sm" color="mutedForeground" className="px-4 py-8 text-center">
              No exams use this type.
            </Text>
          ) : (
            (usedBy?.used_by ?? []).map((row, i) => (
              <View
                key={`${row.school_id}-${row.exam_year}-${i}`}
                className={cn('px-4 py-3', i > 0 && 'border-border border-t')}
              >
                <Text size="sm" weight="medium" numberOfLines={1}>
                  {row.school_name}
                </Text>
                <Text size="xs" color="mutedForeground" numberOfLines={1}>
                  {row.exam_year} · {classLabel(row.levels)}
                </Text>
              </View>
            ))
          )}
        </View>
      </Dialog>
      {confirmDialog}
    </PageLayout>
  );
}
