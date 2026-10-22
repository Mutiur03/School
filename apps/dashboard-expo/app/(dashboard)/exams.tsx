/**
 * Exam setup, replicating dashboard/src/pages/Admin/ExamPDFRoutine.tsx (+ exam-form-dialog,
 * exam-session-rail, exam-workbench-card): session year, status / class / search filters,
 * "N exams · N published · N with routine PDF", the missing year-end alert, the exam table with
 * publish / hide results, edit and delete, and the add / edit dialog (exam type, session year,
 * classes, dates).
 * Live data: GET /api/exams/getExams, /api/exam-types/assigned; POST addExam; PUT updateExam,
 * updateVisibility; DELETE deleteExam; routine PDF via GET presigned-url, POST
 * uploadRoutinePDF/:id, DELETE removeRoutinePDF/:id (file / document picker on every platform).
 */
import { saveFile } from '@/lib/files/save-file';
import { pdfFileName } from '@/lib/files/pdf-name';
import { fileUrl } from '@/features/student/components';
import { uploadLabel, useUploadPercent } from '@/hooks/useUploadPercent';
import { createExamSchema } from '@school/shared-schemas';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScrollView } from '@/components/ui/ScrollView';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { PickFilesButton } from '@/components/ui/FilePicker';
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
  XIcon,
} from '@/components/ui/icons';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState, Notice } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { openStoredFile } from '@/features/admin/open-file';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import {
  EXAM_STATUS_OPTIONS,
  classList,
  emptyExamForm,
  examFormFrom,
  examSummary,
  examYearOptions,
  filterExams,
  formatExamRange,
  formatYmd,
  toExamInput,
  toggleLevel,
  typeLabel,
  validateExamForm,
  type ExamFormErrors,
  type ExamFormValues,
  type ExamStatusFilter,
} from '@/features/exams/model';
import {
  EXAM_CLASSES,
  examsOfYear,
  isQueueActive,
  yearEndGaps,
  type Exam,
  type ExamInput,
  type PickedFile,
} from '@/lib/api';
import { examBody } from '@/lib/api/exams';
import { MarksheetGenPanel, useMarksheetStatus } from '@/features/results/MarksheetGenPanel';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const CURRENT_YEAR = new Date().getFullYear();

function StatusCell({ e }: { e: Exam }) {
  return (
    <View className="flex-row flex-wrap items-center gap-1">
      <Badge
        label={e.visible ? 'Published' : 'Draft'}
        variant={e.visible ? 'default' : 'secondary'}
      />
      {e.is_year_end ? <Badge label="Year end" variant="outline" /> : null}
    </View>
  );
}

/** Web exam-workbench-card: compact progress on published exams, a note while a hidden one drains. */
function ExamGenStatus({ e }: { e: Exam }) {
  const status = useMarksheetStatus(e.id).data;
  if (e.visible) return <MarksheetGenPanel status={status} compact testID={`exam-gen-${e.id}`} />;
  return isQueueActive(status) ? (
    <Text size="xs" color="mutedForeground" className="mt-1.5">
      Finishing background jobs…
    </Text>
  ) : null;
}

export default function ExamsScreen() {
  const pct = useUploadPercent();
  const { exams } = useApi();
  const { resolution } = useTenant();
  const [year, setYear] = useState(CURRENT_YEAR);
  const [status, setStatus] = useState<ExamStatusFilter>('all');
  const [cls, setCls] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<ExamFormValues | null>(null);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [errors, setErrors] = useState<ExamFormErrors>({});
  const [deleteTarget, setDeleteTarget] = useState<Exam | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'exams'),
    queryFn: ({ signal }) => exams.list(signal),
    staleTime: 60_000,
  });
  const typesQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'exam-types'),
    queryFn: ({ signal }) => exams.types(signal),
    staleTime: 5 * 60_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const yearExams = useMemo(() => examsOfYear(all, year), [all, year]);
  const rows = filterExams(yearExams, { status, cls, search });
  const summary = examSummary(yearExams);
  const gaps = yearEndGaps(yearExams);
  const types = typesQ.data ?? [];

  const close = () => {
    setForm(null);
    setEditing(null);
    setErrors({});
  };
  const invalidate = [['exams'], ['class-marks'], ['dashboard'], ['marksheet-gen-status']] as const;
  const save = useAdminMutation({
    mutationFn: (v: { id: number | null; input: ExamInput }) =>
      v.id ? exams.update(v.id, v.input) : exams.create(v.input),
    invalidate,
    success: () => (editing ? 'Exam updated successfully' : 'Exam added successfully'),
    failure: editing ? 'Error updating exam' : 'Error adding exam',
    onSuccess: close,
  });
  const visibility = useAdminMutation({
    mutationFn: async (v: { id: number; visible: boolean }) => ({
      visible: v.visible,
      ...(await exams.setVisibility(v.id, v.visible)),
    }),
    invalidate,
    success: (r) =>
      r.visible
        ? `Results published${r.queued > 0 ? ` · ${plural(r.queued, 'marksheet')} queued` : ''}`
        : 'Results hidden',
    failure: 'Error updating result visibility',
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => exams.remove(id),
    invalidate,
    success: 'Exam deleted successfully',
    failure: 'Error deleting exam',
    onSuccess: () => setDeleteTarget(null),
  });

  const toast = useToast();
  const [routineRemove, setRoutineRemove] = useState<Exam | null>(null);
  const routineUpload = useAdminMutation({
    mutationFn: (v: { id: number; file: PickedFile }) => exams.uploadRoutine(v.id, v.file),
    invalidate,
    success: 'Routine PDF uploaded',
    failure: 'PDF upload failed',
  });
  const routineDelete = useAdminMutation({
    mutationFn: (id: number) => exams.removeRoutine(id),
    invalidate,
    success: 'Routine PDF removed',
    failure: 'Could not remove PDF',
    onSuccess: () => setRoutineRemove(null),
  });
  const pickRoutine = (e: Exam, files: PickedFile[]) => {
    const f = files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') {
      toast.error('Routine must be a PDF');
      return;
    }
    routineUpload.mutate({ id: e.id, file: f });
  };
  const routineBusy = (e: Exam) =>
    (routineUpload.isPending && routineUpload.variables?.id === e.id) ||
    (routineDelete.isPending && routineDelete.variables === e.id);
  const downloadRoutine = async (e: Exam) => {
    const url = fileUrl(e.routine);
    if (!url) return toast.error('No file stored.');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const r = await saveFile(
        await res.arrayBuffer(),
        pdfFileName(['routine', e.exam_name, e.exam_year]),
        'application/pdf',
      );
      if (r === 'unavailable') toast.error("This device can't save the file.");
    } catch {
      toast.error('Failed to download the routine.');
    }
  };
  const routineCell = (e: Exam) => (
    <View className="flex-row items-center gap-0.5">
      {e.routine ? (
        <>
          <ActionButton
            icon={ExternalLink}
            label={`Open routine of ${e.exam_name}`}
            tone="blue"
            onPress={() =>
              void openStoredFile(e.routine).then((ok) => ok || toast.error('No file stored.'))
            }
          />
          <ActionButton
            icon={Download}
            label={`Download routine of ${e.exam_name}`}
            tone="blue"
            disabled={routineBusy(e)}
            onPress={() => void downloadRoutine(e)}
          />
          <ActionButton
            icon={XIcon}
            label={`Remove routine of ${e.exam_name}`}
            tone="red"
            disabled={routineBusy(e)}
            onPress={() => setRoutineRemove(e)}
          />
        </>
      ) : null}
      <PickFilesButton
        accept="application/pdf,.pdf"
        variant="outline"
        size="sm"
        label={routineBusy(e) ? uploadLabel(pct) : e.routine ? 'Replace' : 'Upload'}
        disabled={routineBusy(e)}
        onPick={(files) => pickRoutine(e, files)}
        testID={`exam-routine-${e.id}`}
      />
    </View>
  );

  const openAdd = () => {
    setEditing(null);
    setErrors({});
    const def = emptyExamForm(year);
    if (types.length === 1) def.exam_type_id = types[0]!.id;
    setForm(def);
  };
  const openEdit = (e: Exam) => {
    setEditing(e);
    setErrors({});
    setForm(examFormFrom(e));
  };
  const submit = () => {
    if (!form) return;
    const e = validateExamForm(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    const input = toExamInput(form);
    // Same schema the server validates with; a mismatch here is a bug, not user error.
    const parsed = createExamSchema.safeParse(examBody(input));
    if (!parsed.success) {
      setErrors({ exam_type_id: parsed.error.issues[0]?.message ?? 'Invalid exam' });
      return;
    }
    save.mutate({ id: editing?.id ?? null, input });
  };
  const toggleVisible = (e: Exam) => visibility.mutate({ id: e.id, visible: !e.visible });

  const actions = (e: Exam) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={e.visible ? EyeOff : Eye}
        label={e.visible ? `Hide results of ${e.exam_name}` : `Publish results of ${e.exam_name}`}
        tone="blue"
        onPress={() => toggleVisible(e)}
      />
      <ActionButton
        icon={Pencil}
        label={`Edit ${e.exam_name}`}
        tone="emerald"
        onPress={() => openEdit(e)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${e.exam_name}`}
        tone="red"
        onPress={() => setDeleteTarget(e)}
      />
    </View>
  );

  const columns: Column<Exam>[] = [
    {
      key: 'name',
      label: 'Exam',
      className: 'min-w-0 flex-1',
      render: (e) => (
        <Pressable onPress={() => openEdit(e)} accessibilityRole="button">
          <Text size="sm" weight="medium" numberOfLines={1} className="hover:underline">
            {e.exam_name}
          </Text>
          <Text size="xs" color="mutedForeground" numberOfLines={1}>
            {classList(e.levels)}
          </Text>
        </Pressable>
      ),
    },
    {
      key: 'dates',
      label: 'Exam dates',
      className: 'w-56',
      render: (e) => (
        <Text size="sm" color="mutedForeground" tabular numberOfLines={1}>
          {formatExamRange(e)}
        </Text>
      ),
    },
    {
      key: 'result',
      label: 'Result',
      className: 'w-32',
      render: (e) => (
        <View>
          <Text size="sm" color="mutedForeground" tabular numberOfLines={1}>
            {formatYmd(e.result_date)}
          </Text>
          {e.return_date ? (
            <Text size="xs" color="mutedForeground" tabular numberOfLines={1}>
              {`Return ${formatYmd(e.return_date)}`}
            </Text>
          ) : null}
        </View>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-48',
      render: (e) => (
        <View>
          <StatusCell e={e} />
          <ExamGenStatus e={e} />
        </View>
      ),
    },
    { key: 'routine', label: 'Routine PDF', className: 'w-[168px]', render: routineCell },
    { key: 'actions', label: ' ', className: 'w-[120px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="Exams"
      titleAccessory={
        <Select
          label="Session"
          size="sm"
          value={year}
          onChange={setYear}
          options={examYearOptions(all, CURRENT_YEAR).map((y) => ({ value: y, label: String(y) }))}
        />
      }
      description={
        q.isPending
          ? 'Loading…'
          : `${plural(summary.total, 'exam')} · ${summary.published.toLocaleString()} published · ${summary.routines.toLocaleString()} with routine PDF`
      }
      actions={<Button label="Add exam" icon={Plus} onPress={openAdd} testID="add-exam" />}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load exams"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          {gaps.length > 0 ? (
            <Notice title="Missing year-end exam">
              {`${classList(gaps)} ${gaps.length === 1 ? 'has' : 'have'} exams in ${year} but no year-end exam. Pass/fail and promotion need one.`}
            </Notice>
          ) : null}
          {yearExams.length > 0 ? (
            <View className="gap-2" testID="exam-session-rail">
              <Text size="xs" weight="medium" caps color="mutedForeground">
                {`Session calendar · ${plural(yearExams.length, 'exam')}`}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-2"
              >
                {[...yearExams]
                  .sort((x, y) => x.start_date.localeCompare(y.start_date))
                  .map((x) => (
                    <Pressable
                      key={x.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${x.exam_name}`}
                      onPress={() => openEdit(x)}
                      className={cn(
                        'min-w-40 max-w-52 rounded-md border px-3 py-2',
                        x.is_year_end
                          ? 'border-primary/40 bg-primary/5'
                          : x.visible
                            ? 'border-emerald-500/30 bg-emerald-500/5'
                            : 'border-border bg-card',
                      )}
                    >
                      <Text size="xs" color="mutedForeground" tabular>
                        {formatExamRange(x)}
                      </Text>
                      <Text size="sm" weight="medium" numberOfLines={1}>
                        {x.exam_name}
                      </Text>
                      <Text size="xs" color="mutedForeground">
                        {`${x.visible ? 'Published' : 'Draft'}${x.is_year_end ? ' · Year end' : ''}`}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
            </View>
          ) : null}
          <View className="flex-row flex-wrap items-center gap-2">
            <Select
              label="Status"
              size="sm"
              value={status}
              options={EXAM_STATUS_OPTIONS}
              onChange={setStatus}
            />
            <Select
              label="Class"
              size="sm"
              value={cls ?? 0}
              options={[
                { value: 0, label: 'All classes' },
                ...EXAM_CLASSES.map((c) => ({ value: c as number, label: `Class ${c}` })),
              ]}
              onChange={(c) => setCls(c || null)}
            />
            <View className="min-w-[200px] flex-1">
              <SearchInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search exams…"
                label="Search exams"
              />
            </View>
            {status !== 'all' || cls !== null || search.trim() ? (
              <Button
                variant="ghost"
                size="sm"
                icon={XIcon}
                label="Clear filters"
                onPress={() => {
                  setStatus('all');
                  setCls(null);
                  setSearch('');
                }}
              />
            ) : null}
          </View>
          <DataTable
            testID="exams"
            rows={rows}
            columns={columns}
            rowKey={(e) => e.id}
            loading={q.isPending}
            empty={
              yearExams.length === 0 ? `No exams in ${year} yet.` : 'No exams match these filters.'
            }
            onRowPress={openEdit}
            renderMobile={(e) => (
              <View className="gap-1.5">
                <View className="flex-row items-center gap-2">
                  <Text size="sm" weight="medium" numberOfLines={1} className="min-w-0 flex-1">
                    {e.exam_name}
                  </Text>
                  <StatusCell e={e} />
                </View>
                <Text size="xs" color="mutedForeground" tabular>
                  {formatExamRange(e)} · Result {formatYmd(e.result_date)}
                  {e.return_date ? ` · Return ${formatYmd(e.return_date)}` : ''}
                </Text>
                <ExamGenStatus e={e} />
                <View className="flex-row items-center justify-between">
                  <Text
                    size="xs"
                    color="mutedForeground"
                    numberOfLines={1}
                    className="min-w-0 flex-1"
                  >
                    {classList(e.levels)}
                  </Text>
                  {actions(e)}
                </View>
                <View className="flex-row items-center justify-between">
                  <Text size="xs" color="mutedForeground">
                    {e.routine ? 'Routine PDF uploaded' : 'No routine PDF'}
                  </Text>
                  {routineCell(e)}
                </View>
              </View>
            )}
          />
        </>
      )}

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : close())}
        title={editing ? 'Edit exam' : 'Add exam'}
        testID="exam-form"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={close} disabled={save.isPending} />
            <Button
              label={save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add exam'}
              onPress={submit}
              disabled={save.isPending}
              testID="exam-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            <FieldRow>
              <Field label="Exam type" required error={errors.exam_type_id}>
                <Select
                  label="Exam type"
                  value={form.exam_type_id}
                  placeholder={
                    typesQ.isPending
                      ? 'Loading…'
                      : types.length
                        ? 'Select type'
                        : 'No exam types assigned'
                  }
                  disabled={types.length === 0}
                  options={types.map((t) => ({ value: t.id, label: typeLabel(t) }))}
                  onChange={(exam_type_id) => setForm({ ...form, exam_type_id })}
                  testID="exam-type"
                />
              </Field>
              <Field label="Session year" required error={errors.exam_year}>
                <Select
                  label="Session year"
                  value={form.exam_year}
                  options={examYearOptions(all, CURRENT_YEAR).map((y) => ({
                    value: y,
                    label: String(y),
                  }))}
                  onChange={(exam_year) => setForm({ ...form, exam_year })}
                />
              </Field>
            </FieldRow>
            <Field label="Classes" required error={errors.levels}>
              <View className="flex-row flex-wrap gap-x-5 gap-y-2">
                {EXAM_CLASSES.map((c) => (
                  <Checkbox
                    key={c}
                    label={`Class ${c}`}
                    checked={form.levels.includes(c)}
                    onChange={() => setForm({ ...form, levels: toggleLevel(form.levels, c) })}
                    testID={`exam-class-${c}`}
                  />
                ))}
              </View>
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
              <Field label="End date" required error={errors.end_date}>
                <DateInput
                  label="End date"
                  value={form.end_date}
                  invalid={!!errors.end_date}
                  onChange={(end_date) => setForm({ ...form, end_date })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Result date" required error={errors.result_date}>
                <DateInput
                  label="Result date"
                  value={form.result_date}
                  invalid={!!errors.result_date}
                  onChange={(result_date) => setForm({ ...form, result_date })}
                />
              </Field>
              <Field label="Marksheet return date" hint="Optional" error={errors.return_date}>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <DateInput
                      label="Marksheet return date"
                      value={form.return_date}
                      invalid={!!errors.return_date}
                      onChange={(return_date) => setForm({ ...form, return_date })}
                    />
                  </View>
                  {form.return_date ? (
                    <Button
                      variant="outline"
                      size="sm"
                      label="Clear"
                      onPress={() => setForm({ ...form, return_date: '' })}
                    />
                  ) : null}
                </View>
              </Field>
            </FieldRow>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete exam"
        message={`Delete “${deleteTarget?.exam_name ?? 'this exam'}”? Marks and cached marksheets for this exam are removed.`}
      />
      <ConfirmDialog
        open={routineRemove !== null}
        onClose={() => setRoutineRemove(null)}
        busy={routineDelete.isPending}
        onConfirm={() => routineRemove && routineDelete.mutate(routineRemove.id)}
        confirmLabel="Remove PDF"
        message={`Remove the routine PDF of ${routineRemove?.exam_name ?? 'this exam'}?`}
      />
    </PageLayout>
  );
}
