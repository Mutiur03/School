/**
 * Subjects, replicating dashboard/src/pages/Admin/NewSubject.tsx: Year selector, "N subjects ·
 * N main · N papers", Add subject, class filter, the subject table in exam order (papers under
 * their main subject) and the add/edit dialog (name, class, marks, type, parent, priority,
 * assessment, marking scheme with CQ/MCQ/Practical breakdown, group for classes 9-10). Values are
 * checked with the shared subjectFormSchema, the schema the server validates with. An empty year
 * can be cloned from the previous one (POST /api/sub/clone).
 * Live data: GET /api/sub/getSubjects (all years, filtered here), add/update/delete/clone.
 * Not ported yet: Excel import.
 */
import { useQuery } from '@tanstack/react-query';
import * as shared from '@school/shared-schemas';
import { VALID_GROUPS, subjectFormSchema } from '@school/shared-schemas';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Chip } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow, FormSection } from '@/components/ui/Field';
import { Copy, FileSpreadsheet, Pencil, Plus, Trash2, XIcon } from '@/components/ui/icons';
import { pageOf } from '@/features/events/model';
import { ImportDialog } from '@/features/import/ImportDialog';
import { filterSubjects, markParts, subjectsFiltered } from '@/features/subjects/model';
import {
  parseSubjectSheet,
  SUBJECT_REQUIRED_COLUMNS,
  SUBJECT_TEMPLATE_COLUMNS,
  SUBJECT_TEMPLATE_ROWS,
  type SubjectImportRow,
} from '@/features/import/models';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Segmented, Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import {
  SUBJECT_TYPE_LABEL,
  breakdownTotals,
  issuesToErrors,
  subjectDefaults,
  toSubjectInput,
  type SubjectFormValues,
} from '@/features/subjects/form';
import { isApiError, orderSubjects, type Subject, type SubjectType } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const THIS_YEAR = new Date().getFullYear();
const CLASSES = [6, 7, 8, 9, 10];
const ALL = 0;

const TYPE_TONE: Record<SubjectType, 'blue' | 'emerald' | 'muted'> = {
  main: 'blue',
  single: 'emerald',
  paper: 'muted',
};
const TYPE_SHORT: Record<SubjectType, string> = { main: 'Main', single: 'Single', paper: 'Paper' };

function SelectField({
  control,
  name,
  label,
  required,
  options,
}: {
  control: Control<SubjectFormValues>;
  name: keyof SubjectFormValues;
  label: string;
  required?: boolean;
  options: { value: string; label: string }[];
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} error={fieldState.error?.message}>
          <Select
            label={label}
            value={String(field.value)}
            invalid={!!fieldState.error}
            onChange={field.onChange}
            options={options}
          />
        </Field>
      )}
    />
  );
}

function SubjectForm({
  control,
  subjects,
}: {
  control: Control<SubjectFormValues>;
  subjects: readonly Subject[];
}) {
  const v = useWatch({ control }) as SubjectFormValues;
  const cls = Number(v.class);
  const isMain = v.subject_type === 'main';
  const breakdown = v.marking_scheme === 'BREAKDOWN' && !isMain;
  const totals = breakdownTotals(v);
  const parents = subjects.filter((s) => s.subject_type === 'main' && s.class === cls);
  return (
    <>
      <FieldRow>
        <TextField
          control={control}
          name="name"
          label="Subject name"
          required
          placeholder="e.g. Mathematics"
        />
        <SelectField
          control={control}
          name="class"
          label="Class"
          required
          options={CLASSES.map((c) => ({ value: String(c), label: `Class ${c}` }))}
        />
      </FieldRow>
      <FieldRow cols={3}>
        <SelectField
          control={control}
          name="subject_type"
          label="Subject type"
          required
          options={(['single', 'main', 'paper'] as const).map((t) => ({
            value: t,
            label: SUBJECT_TYPE_LABEL[t],
          }))}
        />
        {v.subject_type === 'paper' ? (
          <SelectField
            control={control}
            name="parent_id"
            label="Parent subject"
            required
            options={parents.map((p) => ({ value: String(p.id), label: p.name }))}
          />
        ) : null}
        <TextField
          control={control}
          name="priority"
          label="Priority (sort order)"
          keyboardType="number-pad"
          placeholder="e.g. 10"
        />
      </FieldRow>
      <FieldRow>
        <TextField
          control={control}
          name="full_mark"
          label="Full mark"
          required={!isMain}
          keyboardType="number-pad"
          editable={!isMain && !breakdown}
          placeholder={
            isMain ? 'Auto-calculated' : breakdown ? String(totals.full || '') : 'e.g. 100'
          }
          hint={
            isMain
              ? 'Calculated from its papers'
              : breakdown
                ? 'Sum of CQ + MCQ + Practical'
                : undefined
          }
        />
        <TextField
          control={control}
          name="pass_mark"
          label="Pass mark"
          required={v.assessment_type === 'exam' && !isMain}
          keyboardType="number-pad"
          editable={!breakdown && !isMain}
          placeholder={v.assessment_type === 'continuous' ? 'Optional for CAS' : 'e.g. 33'}
        />
      </FieldRow>
      <Controller
        control={control}
        name="assessment_type"
        render={({ field }) => (
          <Field label="Assessment type">
            <Segmented
              label="Assessment type"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: 'exam', label: 'Exam based' },
                { value: 'continuous', label: 'Continuous' },
              ]}
            />
          </Field>
        )}
      />
      {!isMain ? (
        <Controller
          control={control}
          name="marking_scheme"
          render={({ field }) => (
            <Field label="Marking entry scheme" required>
              <Segmented
                label="Marking entry scheme"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'TOTAL', label: 'Total marks only' },
                  { value: 'BREAKDOWN', label: 'Breakdown (CQ, MCQ, Practical)' },
                ]}
              />
            </Field>
          )}
        />
      ) : null}
      {breakdown ? (
        <View className="border-primary/30 bg-primary/5 gap-3 rounded-lg border p-4">
          <FormSection title="Mark breakdown">
            <FieldRow cols={3}>
              <TextField control={control} name="cq_mark" label="CQ" keyboardType="number-pad" />
              <TextField control={control} name="mcq_mark" label="MCQ" keyboardType="number-pad" />
              <TextField
                control={control}
                name="practical_mark"
                label="Practical"
                keyboardType="number-pad"
              />
            </FieldRow>
            <FieldRow cols={3}>
              <TextField
                control={control}
                name="cq_pass_mark"
                label="CQ pass"
                keyboardType="number-pad"
              />
              <TextField
                control={control}
                name="mcq_pass_mark"
                label="MCQ pass"
                keyboardType="number-pad"
              />
              <TextField
                control={control}
                name="practical_pass_mark"
                label="Practical pass"
                keyboardType="number-pad"
              />
            </FieldRow>
            <Text size="xs" color="mutedForeground" tabular>
              Full mark {totals.full} · pass mark {totals.pass}
            </Text>
          </FormSection>
        </View>
      ) : null}
      {cls >= 9 ? (
        <SelectField
          control={control}
          name="group"
          label="Group"
          options={[
            { value: '', label: 'General (all groups)' },
            ...VALID_GROUPS.map((g) => ({ value: g, label: g })),
          ]}
        />
      ) : (
        <Text size="xs" color="mutedForeground">
          Group: not required for class 6–8.
        </Text>
      )}
    </>
  );
}

function Detail({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <View className="min-w-[40%] flex-1 gap-0.5">
      <Text size="xs" color="mutedForeground" weight="medium">
        {label}
      </Text>
      <Text size={big ? 'xl' : 'sm'} weight={big ? 'semibold' : 'regular'} tabular>
        {value}
      </Text>
    </View>
  );
}

export default function SubjectsScreen() {
  const { subjects } = useApi();
  const { resolution } = useTenant();
  const [year, setYear] = useState(THIS_YEAR);
  const [level, setLevel] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [viewing, setViewing] = useState<Subject | null>(null);
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [types, setTypes] = useState<SubjectType[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'subjects'),
    queryFn: ({ signal }) => subjects.list(signal),
    staleTime: 60_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const yearSubjects = useMemo(() => all.filter((s) => s.year === year), [all, year]);
  const filters = { q: search, groups, types };
  const filtered = subjectsFiltered(filters) || level !== ALL;
  const rows = useMemo(
    () =>
      orderSubjects(
        filterSubjects(
          level === ALL ? yearSubjects : yearSubjects.filter((s) => s.class === level),
          { q: search, groups, types },
        ),
      ),
    [yearSubjects, level, search, groups, types],
  );
  const paged = pageOf(rows, page, limit);
  const clearFilters = () => {
    setLevel(ALL);
    setSearch('');
    setGroups([]);
    setTypes([]);
    setPage(1);
  };
  const names = useMemo(() => new Map(all.map((s) => [s.id, s.name])), [all]);
  const years = useMemo(() => {
    const ys = new Set([THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, ...all.map((s) => s.year)]);
    return [...ys].filter((y) => y > 1999).sort((a, b) => b - a);
  }, [all]);
  const previousYear = useMemo(
    () => [...new Set(all.map((s) => s.year))].filter((y) => y < year).sort((a, b) => b - a)[0],
    [all, year],
  );

  const { control, reset, getValues, setError, clearErrors } = useForm<SubjectFormValues>({
    defaultValues: subjectDefaults(),
  });

  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const save = useAdminMutation({
    mutationFn: (v: {
      id: number | null;
      input: ReturnType<typeof toSubjectInput>;
      oldParent: number | null;
    }) => (v.id ? subjects.update(v.id, v.input, v.oldParent) : subjects.create(v.input)),
    invalidate: [['subjects']],
    success: () => (editing ? 'Subject updated successfully' : 'Subjects added successfully'),
    failure: editing ? 'Error updating subject' : 'Error adding subjects',
    onSuccess: close,
    // Mark the fields the server rejected, like the web form.
    onError: (e) => {
      if (!isApiError(e)) return;
      for (const d of e.details as { path?: unknown; message?: unknown }[]) {
        const field = Array.isArray(d.path) ? d.path[d.path.length - 1] : null;
        if (
          typeof field === 'string' &&
          typeof d.message === 'string' &&
          field in subjectDefaults()
        ) {
          setError(field as keyof SubjectFormValues, { type: 'server', message: d.message });
        }
      }
    },
  });
  const [importOpen, setImportOpen] = useState(false);
  const importRows = useAdminMutation({
    mutationFn: (rows: SubjectImportRow[]) => subjects.createMany(rows),
    invalidate: [['subjects']],
    success: 'Subjects added successfully',
    failure: 'Error adding subjects',
    onSuccess: () => setImportOpen(false),
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => subjects.remove(id),
    invalidate: [['subjects']],
    success: 'Subject deleted successfully',
    failure: 'Error deleting subject',
    onSuccess: () => setDeleteTarget(null),
  });
  const clone = useAdminMutation({
    mutationFn: (v: { from: number; to: number }) => subjects.clone(v.from, v.to),
    invalidate: [['subjects']],
    success: 'Subjects cloned successfully',
    failure: 'Error cloning subjects',
    onSuccess: () => setCloneOpen(false),
  });

  const openAdd = () => {
    setEditing(null);
    reset(subjectDefaults(null, level === ALL ? undefined : level));
    setFormOpen(true);
  };
  const openEdit = (s: Subject) => {
    setEditing(s);
    reset(subjectDefaults(s));
    setFormOpen(true);
  };
  const submit = () => {
    clearErrors();
    const input = toSubjectInput(getValues(), year);
    const parsed = subjectFormSchema.safeParse(input);
    if (!parsed.success) {
      const errs = issuesToErrors(parsed.error.issues);
      for (const [k, message] of Object.entries(errs)) {
        setError(k as keyof SubjectFormValues, { type: 'schema', message });
      }
      return;
    }
    save.mutate({ id: editing?.id ?? null, input, oldParent: editing?.parent_id ?? null });
  };

  const counts = {
    main: yearSubjects.filter((s) => s.subject_type === 'main').length,
    paper: yearSubjects.filter((s) => s.subject_type === 'paper').length,
  };
  const marks = (s: Subject) =>
    s.marking_scheme === 'BREAKDOWN'
      ? `${s.full_mark} (${[s.cq_mark && `CQ ${s.cq_mark}`, s.mcq_mark && `MCQ ${s.mcq_mark}`, s.practical_mark && `Pr ${s.practical_mark}`].filter(Boolean).join(' · ')})`
      : String(s.full_mark);

  const actions = (s: Subject) => (
    <View className="flex-row gap-0.5">
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
  const columns: Column<Subject>[] = [
    {
      key: 'name',
      label: 'Subject',
      className: 'min-w-0 flex-1',
      render: (s) => (
        <View className={cn(s.subject_type === 'paper' && 'pl-5')}>
          <View className="flex-row items-center gap-2">
            <Text
              size="sm"
              weight={s.subject_type === 'paper' ? 'regular' : 'medium'}
              numberOfLines={1}
              className="shrink"
            >
              {s.name}
            </Text>
            {s.assessment_type === 'continuous' ? <Chip label="CAS" tone="muted" /> : null}
          </View>
          {s.group ? (
            <Text size="xs" color="mutedForeground">
              {s.group}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      className: 'w-20',
      render: (s) => (
        <Text size="sm" tabular>
          {s.class}
        </Text>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      className: 'w-24',
      render: (s) => <Chip label={TYPE_SHORT[s.subject_type]} tone={TYPE_TONE[s.subject_type]} />,
    },
    {
      key: 'full',
      label: 'Full',
      className: 'w-48',
      render: (s) => (
        <Text size="sm" tabular numberOfLines={1}>
          {marks(s)}
        </Text>
      ),
    },
    {
      key: 'pass',
      label: 'Pass',
      className: 'w-20',
      render: (s) => (
        <Text size="sm" tabular>
          {s.pass_mark}
        </Text>
      ),
    },
    {
      key: 'assess',
      label: 'Assessment',
      className: 'w-32',
      render: (s) => <Text size="sm">{s.assessment_type === 'exam' ? 'Exam' : 'Continuous'}</Text>,
    },
    {
      key: 'priority',
      label: 'Order',
      className: 'w-20',
      render: (s) => (
        <Text size="sm" tabular>
          {s.priority}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[88px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Subjects"
      titleAccessory={
        <Select
          label="Year"
          size="sm"
          value={year}
          onChange={setYear}
          options={years.map((y) => ({ value: y, label: String(y) }))}
        />
      }
      description={
        q.isPending
          ? 'Loading…'
          : `${plural(yearSubjects.length, 'subject')} · ${counts.main} main · ${plural(counts.paper, 'paper')}`
      }
      actions={
        <>
          {previousYear && yearSubjects.length === 0 && !q.isPending ? (
            <Button
              variant="outline"
              icon={Copy}
              label={`Copy from ${previousYear}`}
              onPress={() => setCloneOpen(true)}
            />
          ) : null}
          <Button
            variant="outline"
            icon={FileSpreadsheet}
            label="Import Excel"
            onPress={() => setImportOpen(true)}
            testID="import-subjects"
          />
          <Button label="Add subject" icon={Plus} onPress={openAdd} testID="add-subject" />
        </>
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load subjects"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <SearchInput
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search subject name"
              label="Search subjects"
            />
            <Select
              label="Class"
              value={level}
              onChange={(v) => {
                setLevel(v);
                setPage(1);
              }}
              className="w-40"
              options={[
                { value: ALL, label: 'All classes' },
                ...CLASSES.map((c) => ({ value: c, label: `Class ${c}` })),
              ]}
            />
            <MultiSelect
              label="Group"
              allLabel="All groups"
              size="sm"
              value={groups}
              options={['General', ...VALID_GROUPS].map((g) => ({ value: g as string, label: g }))}
              onChange={(v) => {
                setGroups(v);
                setPage(1);
              }}
            />
            <MultiSelect
              label="Type"
              allLabel="All types"
              size="sm"
              value={types}
              options={(['main', 'paper', 'single'] as SubjectType[]).map((t) => ({
                value: t,
                label: TYPE_SHORT[t],
              }))}
              onChange={(v) => {
                setTypes(v);
                setPage(1);
              }}
            />
            {filtered ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={XIcon}
                  label="Clear filters"
                  onPress={clearFilters}
                />
                <Text size="sm" color="mutedForeground" tabular>
                  {rows.length} shown
                </Text>
              </>
            ) : null}
          </View>
          <DataTable
            testID="subjects"
            rows={paged.rows}
            columns={columns}
            rowKey={(s) => s.id}
            loading={q.isPending}
            empty={
              filtered
                ? 'No subjects match these filters.'
                : `No subjects for ${level === ALL ? '' : `class ${level} in `}${year} yet.`
            }
            onRowPress={setViewing}
            renderMobile={(s) => (
              <View
                className={cn('flex-row items-center gap-3', s.subject_type === 'paper' && 'pl-4')}
              >
                <View className="min-w-0 flex-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    Class {s.class} · {s.full_mark}/{s.pass_mark}
                    {s.parent_id ? ` · ${names.get(s.parent_id) ?? ''}` : ''}
                  </Text>
                </View>
                <Chip label={TYPE_SHORT[s.subject_type]} tone={TYPE_TONE[s.subject_type]} />
              </View>
            )}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Select
              label="Rows per page"
              size="sm"
              value={limit}
              options={[50, 100, 200].map((n) => ({ value: n, label: `${n} / page` }))}
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
        title="Subject details"
        testID="subject-details"
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
                label="Edit subject"
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
          <View className="gap-4">
            <View>
              <View className="flex-row items-center gap-2">
                <Text size="lg" weight="semibold">
                  {viewing.name}
                </Text>
                {viewing.assessment_type === 'continuous' ? (
                  <Chip label="CAS" tone="muted" />
                ) : null}
              </View>
              <Text size="sm" color="mutedForeground" tabular>
                {`Class ${viewing.class} · ${viewing.group || 'General'} · Session ${viewing.year}`}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-x-6 gap-y-3">
              <Detail label="Type" value={TYPE_SHORT[viewing.subject_type]} />
              <Detail
                label="Parent subject"
                value={viewing.parent_id ? (names.get(viewing.parent_id) ?? '—') : '—'}
              />
              <Detail label="Full mark" value={String(viewing.full_mark)} big />
              <Detail label="Pass mark" value={String(viewing.pass_mark)} big />
              <Detail
                label="Assessment"
                value={viewing.assessment_type === 'continuous' ? 'Continuous' : 'Exam based'}
              />
              <Detail
                label="Marking scheme"
                value={viewing.marking_scheme === 'BREAKDOWN' ? 'Breakdown' : 'Total only'}
              />
              <Detail label="Order" value={String(viewing.priority)} />
            </View>
            <View className="gap-2">
              <Text size="sm" weight="semibold">
                Marks distribution
              </Text>
              <View className="border-border overflow-hidden rounded-lg border">
                <View className="bg-muted flex-row px-3 py-1.5">
                  <Text size="xs" weight="semibold" className="flex-1">
                    Part
                  </Text>
                  <Text size="xs" weight="semibold" className="w-16 text-right">
                    Mark
                  </Text>
                  <Text size="xs" weight="semibold" className="w-16 text-right">
                    Pass
                  </Text>
                </View>
                {markParts(viewing).map((p) => (
                  <View key={p.label} className="border-border flex-row border-t px-3 py-1.5">
                    <Text size="sm" className="flex-1">
                      {p.label}
                    </Text>
                    <Text size="sm" tabular className="w-16 text-right">
                      {p.mark ?? '—'}
                    </Text>
                    <Text size="sm" tabular className="w-16 text-right">
                      {p.pass ?? '—'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </Dialog>

      <Dialog
        open={formOpen}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? `Edit ${editing.name}` : `Add subject · ${year}`}
        size="xl"
        testID="subject-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add subject'}
              onPress={submit}
              disabled={save.isPending}
              testID="subject-submit"
            />
          </>
        }
      >
        <SubjectForm control={control} subjects={yearSubjects} />
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete subject"
        message={`Delete ${deleteTarget?.name ?? 'this subject'}? Marks entered for it may be lost. This cannot be undone.`}
      />
      <ConfirmDialog
        open={cloneOpen}
        title={`Copy subjects to ${year}?`}
        onClose={() => setCloneOpen(false)}
        busy={clone.isPending}
        tone="default"
        onConfirm={() => previousYear && clone.mutate({ from: previousYear, to: year })}
        confirmLabel={`Copy from ${previousYear ?? ''}`}
        message={`Every subject of ${previousYear ?? 'the previous year'} (with its papers and marks setup) is copied into ${year}.`}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import subjects from Excel"
        noun="subject"
        requiredColumns={SUBJECT_REQUIRED_COLUMNS}
        guide={{
          descriptions: {
            name: 'The full title of the subject (e.g. Mathematics, Physics).',
            class: 'Only numeric values between 6 and 10 are accepted.',
            full_mark: 'Total assignable marks for the subject.',
            pass_mark: 'Minimum marks required to pass (required for exam subjects).',
            group: 'Optional. Science/Humanities/Commerce (common for all if empty).',
            year: 'Four-digit academic year.',
            assessment_type: 'exam or continuous.',
            priority: 'Sort order; 0 or higher.',
            marking_scheme: 'Optional. TOTAL or BREAKDOWN. Defaults to TOTAL.',
          },
          notes: [
            'Optional cq_mark, mcq_mark and practical_mark (and their pass marks) can be added as columns for automatic breakdown.',
          ],
        }}
        template={{
          fileName: 'demo_subjects.xlsx',
          sheet: 'Subjects',
          rows: [[...SUBJECT_TEMPLATE_COLUMNS], ...SUBJECT_TEMPLATE_ROWS(year)],
        }}
        parse={(rows) => parseSubjectSheet(rows, all, shared)}
        onUpload={(rows) => importRows.mutate(rows)}
        busy={importRows.isPending}
        testID="subject-import"
      />
    </PageLayout>
  );
}
