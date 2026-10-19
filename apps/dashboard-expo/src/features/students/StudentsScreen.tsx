/**
 * Student List, replicating dashboard/src/pages/Admin/StudentList.tsx: title with Session
 * selector, "N students" summary, Add student, search + Class / Section filters, the table
 * (photo, name + father's name, Roll, Class, Section, actions), a details view and the add/edit
 * dialog (Personal / Academic / Address sections, Receives stipend) validated with the shared
 * studentFormSchema. Phones get stacked rows.
 * Live data: GET /api/students; add = POST /api/students/bulk (one row; the returned login sheet
 * is saved/shared), edit = PUT /api/students/:id + PATCH /api/enrollments/:id, delete = DELETE.
 * Bulk select (page, or "all N matching") with Rotate passwords (POST /api/students/
 * password-rotations, the .xlsx is saved / shared) and Delete (DELETE /api/students). The details
 * dialog adds Generate certificate (POST /:id/testimonials, a PDF) and Give TC / Reactivate
 * (POST /:id/tc | /:id/reactivate, JSON status changes).
 * Classes 9–10 add Group and 4th subject columns: a per-row 4th-subject select (PATCH
 * /api/marks/students/:id/fourth-subject), a 4th-subject filter, and "Bulk 4th subject" for a
 * whole class + group (PATCH /api/marks/fourth-subjects, behind a confirm). Column headers sort on
 * the server (sort / order), like the web's ColumnHeaderMenu.
 *
 * `readOnly` is the teacher's "Students' Info" (web: <StudentList readOnly />): same list,
 * filters and details, no add / edit / delete. GET /api/students returns the whole year's
 * roster to teachers (server design), so nothing here narrows it.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as shared from '@school/shared-schemas';
import { RELIGION, VALID_GROUPS, studentFormSchema } from '@school/shared-schemas';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { MultiSelect } from '@/components/ui/MultiSelect';
import type { TableSort } from '@/components/ui/table-sort';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow, FormSection } from '@/components/ui/Field';
import {
  Award,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  UserMinus,
} from '@/components/ui/icons';
import { PickFilesButton } from '@/components/ui/FilePicker';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { pageState, retainIds, sameIds, toggleId, togglePage } from '@/features/admin/selection';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import {
  STUDENT_CLASSES,
  addedMessage,
  importedMessage,
  credentialsFileName,
  needsGroup,
  studentDefaults,
  toStudentPayload,
  type StudentFormValues,
} from '@/features/students/form';
import { useDebounced } from '@/hooks/useDebounced';
import { openPdf } from '@/lib/files/open-pdf';
import { pdfFileName } from '@/lib/files/pdf-name';
import { saveFile, XLSX_MIME } from '@/lib/files/save-file';
import { ImportDialog } from '@/features/import/ImportDialog';
import {
  parseStudentSheet,
  STUDENT_REQUIRED_COLUMNS,
  STUDENT_TEMPLATE_COLUMNS,
  STUDENT_TEMPLATE_ROWS,
  type StudentImportRow,
} from '@/features/import/models';
import {
  BULK_CLEAR,
  bulkFourthDone,
  bulkFourthMessage,
  fourthFilterOptions,
  fourthFilterParam,
  fourthSubjectChoices,
  hasFourthSubject,
} from '@/features/students/fourth-subject';
import type { PickedFile, StudentRow, StudentSortKey, Subject } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR + 1, THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2, THIS_YEAR - 3];
const PAGE_SIZE = 50;
const ALL = 'all';

function Avatar({ s }: { s: StudentRow }) {
  const url = fileUrl(s.image);
  return url ? (
    <Image source={{ uri: url }} accessibilityLabel="" className="bg-muted h-9 w-7 rounded" />
  ) : (
    <View className="bg-muted h-9 w-7 items-center justify-center rounded">
      <Text size="xs" weight="semibold" color="mutedForeground">
        {s.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function StudentCell({ s }: { s: StudentRow }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar s={s} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text size="sm" weight="medium" numberOfLines={1} className="shrink">
            {s.name}
          </Text>
          {s.available ? null : <StatusBadge status="inactive" />}
        </View>
        <Text size="xs" color="mutedForeground" numberOfLines={1}>
          {s.father_name}
        </Text>
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View className="min-w-[45%] flex-1 gap-0.5">
      <Text size="xs" color="mutedForeground">
        {label}
      </Text>
      <Text size="sm">{value || '—'}</Text>
    </View>
  );
}

function StudentForm({
  open,
  editing,
  sections,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  editing: StudentRow | null;
  sections: readonly string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: StudentFormValues) => void;
}) {
  const { control, handleSubmit, reset, setValue } = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: studentDefaults(editing),
    mode: 'onBlur',
  });
  useEffect(() => {
    if (open) reset(studentDefaults(editing));
  }, [open, editing, reset]);
  const cls = useWatch({ control, name: 'class' });
  useEffect(() => {
    if (!needsGroup(cls)) setValue('group', '');
  }, [cls, setValue]);

  return (
    <Dialog
      open={open}
      onClose={() => (busy ? undefined : onClose())}
      title={editing ? `Edit ${editing.name}` : 'Add student'}
      size="xl"
      testID="student-form"
      footer={
        <>
          <Text size="xs" color="mutedForeground" className="mr-auto">
            <Text color="destructive">*</Text> required
          </Text>
          <Button variant="outline" label="Cancel" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? 'Saving…' : editing ? 'Save changes' : 'Add student'}
            onPress={() => void handleSubmit(onSubmit)()}
            disabled={busy}
            testID="student-submit"
          />
        </>
      }
    >
      <FormSection title="Personal">
        <FieldRow>
          <TextField
            control={control}
            name="name"
            label="Name"
            required
            placeholder="Full name"
            autoCapitalize="words"
          />
          <Controller
            control={control}
            name="dob"
            render={({ field, fieldState }) => (
              <Field label="Date of birth" required error={fieldState.error?.message}>
                <DateInput
                  label="Date of birth"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!fieldState.error}
                />
              </Field>
            )}
          />
          <TextField
            control={control}
            name="father_name"
            label="Father's name"
            required
            autoCapitalize="words"
          />
          <TextField
            control={control}
            name="father_phone"
            label="Father's phone"
            required
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            maxLength={11}
          />
          <TextField
            control={control}
            name="mother_name"
            label="Mother's name"
            required
            autoCapitalize="words"
          />
          <TextField
            control={control}
            name="mother_phone"
            label="Mother's phone"
            keyboardType="phone-pad"
            placeholder="01XXXXXXXXX"
            maxLength={11}
          />
          <Controller
            control={control}
            name="religion"
            render={({ field, fieldState }) => (
              <Field label="Religion" required error={fieldState.error?.message}>
                <Select
                  label="Religion"
                  value={field.value}
                  invalid={!!fieldState.error}
                  onChange={field.onChange}
                  options={RELIGION.map((r) => ({ value: r, label: r }))}
                />
              </Field>
            )}
          />
        </FieldRow>
      </FormSection>

      <FormSection title="Academic">
        <FieldRow cols={4}>
          <Controller
            control={control}
            name="class"
            render={({ field, fieldState }) => (
              <Field label="Class" required error={fieldState.error?.message}>
                <Select
                  label="Class"
                  value={field.value}
                  invalid={!!fieldState.error}
                  onChange={field.onChange}
                  options={STUDENT_CLASSES.map((c) => ({ value: String(c), label: `Class ${c}` }))}
                />
              </Field>
            )}
          />
          <TextField
            control={control}
            name="section"
            label="Section"
            required
            placeholder={sections[0] ?? 'A'}
            maxLength={1}
            autoCapitalize="characters"
            transform={(t) => t.toUpperCase()}
          />
          <TextField
            control={control}
            name="roll"
            label="Roll"
            required
            keyboardType="number-pad"
            maxLength={6}
          />
          {needsGroup(cls) ? (
            <Controller
              control={control}
              name="group"
              render={({ field, fieldState }) => (
                <Field label="Group" required error={fieldState.error?.message}>
                  <Select
                    label="Group"
                    value={field.value}
                    invalid={!!fieldState.error}
                    onChange={field.onChange}
                    options={VALID_GROUPS.map((g) => ({ value: g, label: g }))}
                  />
                </Field>
              )}
            />
          ) : null}
        </FieldRow>
      </FormSection>

      <FormSection title="Address">
        <FieldRow>
          <TextField control={control} name="village" label="Village" />
          <TextField control={control} name="post_office" label="Post office" />
          <TextField control={control} name="upazila" label="Upazila" />
          <TextField control={control} name="district" label="District" />
        </FieldRow>
      </FormSection>

      <Controller
        control={control}
        name="has_stipend"
        render={({ field }) => (
          <Checkbox checked={field.value} onChange={field.onChange} label="Receives stipend" />
        )}
      />
    </Dialog>
  );
}

export function StudentsScreen({ readOnly = false }: { readOnly?: boolean }) {
  const { students, subjects } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [year, setYear] = useState(THIS_YEAR);
  const [level, setLevel] = useState<string>(ALL);
  const [section, setSection] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(query.trim(), 300);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [viewing, setViewing] = useState<StudentRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudentRow | null>(null);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [bulk, setBulk] = useState<'delete' | 'rotate' | null>(null);
  const [tcTarget, setTcTarget] = useState<StudentRow | null>(null);
  const [sort, setSort] = useState<TableSort<StudentSortKey> | null>(null);
  const [fourth, setFourth] = useState<string[]>([]);
  const [bulkFourth, setBulkFourth] = useState<{
    cls: '' | '9' | '10';
    group: string;
    subject: string;
  } | null>(null);
  const [bulkFourthConfirm, setBulkFourthConfirm] = useState(false);

  useEffect(() => setPage(1), [search, year, level, section, sort, fourth]);

  const params = {
    year,
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    levels: level === ALL ? undefined : [Number(level)],
    sections: section === ALL ? undefined : [section],
    fourthSubjects: fourth.length ? fourthFilterParam(fourth) : undefined,
    sort: sort?.key,
    order: sort?.order,
  };
  const list = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'students', params),
    queryFn: ({ signal }) => students.list(params, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const save = useAdminMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { personal, academic } = toStudentPayload(values);
      if (editing) {
        await students.update(editing, personal, academic);
        return null;
      }
      const created = await students.create({ ...personal, ...academic });
      if (created.created > 0) {
        await saveFile(created.credentials, credentialsFileName(), XLSX_MIME).catch(() =>
          toast.error("Couldn't save the login sheet. Rotate the password from the web dashboard."),
        );
      }
      return created;
    },
    invalidate: [['students'], ['dashboard']],
    success: (r) => (r ? addedMessage(r.created, r.requested) : 'Student updated successfully.'),
    failure: 'An error occurred',
    onSuccess: close,
  });
  const [importOpen, setImportOpen] = useState(false);
  const importRows = useAdminMutation({
    mutationFn: async (rows: StudentImportRow[]) => {
      const created = await students.createMany(rows);
      if (created.created > 0) {
        await saveFile(created.credentials, credentialsFileName(), XLSX_MIME).catch(() =>
          toast.error("Couldn't save the login sheet. Rotate the passwords to get new ones."),
        );
      }
      return created;
    },
    invalidate: [['students'], ['dashboard']],
    success: (r) => importedMessage(r.created, r.requested),
    failure: 'Failed to upload students.',
    onSuccess: () => setImportOpen(false),
  });
  const photo = useAdminMutation({
    mutationFn: async (v: { id: number; file: PickedFile | null }) => {
      if (v.file) return { id: v.id, image: await students.uploadImage(v.id, v.file) };
      await students.removeImage(v.id);
      return { id: v.id, image: null };
    },
    invalidate: [['students']],
    success: (r) => (r.image ? 'Photo uploaded.' : 'Photo removed.'),
    failure: 'Failed to update the photo.',
    onSuccess: (r) => setViewing((s) => (s && s.id === r.id ? { ...s, image: r.image } : s)),
  });
  const subjectsQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'subjects'),
    queryFn: ({ signal }) => subjects.list(signal),
    staleTime: 5 * 60_000,
  });
  const allSubjects: Subject[] = subjectsQ.data ?? [];
  const subjectName = (id: number | null) =>
    id ? (allSubjects.find((x) => x.id === id)?.name ?? `Subject #${id}`) : '—';
  const setFourthSubject = useAdminMutation({
    mutationFn: async (v: { id: number; subjectId: number | null }) => {
      await students.setFourthSubject(v.id, year, v.subjectId);
      return v;
    },
    invalidate: [['students'], ['marks'], ['results']],
    success: '4th subject updated successfully',
    failure: 'Failed to update 4th subject',
    onSuccess: (v) =>
      setViewing((s) => (s && s.id === v.id ? { ...s, fourth_subject_id: v.subjectId } : s)),
  });
  const bulkFourthChoices = bulkFourth?.cls
    ? fourthSubjectChoices(allSubjects, Number(bulkFourth.cls), bulkFourth.group || null, year)
    : [];
  const bulkFourthName =
    bulkFourth?.subject === BULK_CLEAR
      ? null
      : (bulkFourthChoices.find((x) => String(x.id) === bulkFourth?.subject)?.name ?? 'selected');
  const applyBulkFourth = useAdminMutation({
    mutationFn: async () => {
      if (!bulkFourth?.cls || !bulkFourth.group || !bulkFourth.subject) return 0;
      return students.setFourthSubjectForGroup({
        class: bulkFourth.cls === '9' ? 9 : 10,
        year,
        group: bulkFourth.group,
        subjectId: bulkFourth.subject === BULK_CLEAR ? null : Number(bulkFourth.subject),
      });
    },
    invalidate: [['students'], ['marks'], ['results']],
    success: (n) => bulkFourthDone(n),
    failure: 'Failed to bulk-update 4th subject',
    onSuccess: () => {
      setBulkFourthConfirm(false);
      setBulkFourth(null);
    },
  });
  const remove = useAdminMutation({
    mutationFn: (id: number) => students.remove(id),
    invalidate: [['students'], ['dashboard']],
    success: 'Student deleted successfully.',
    failure: 'Failed to delete student.',
    onSuccess: () => setDeleteTarget(null),
  });

  const rows = useMemo(() => list.data?.rows ?? [], [list.data]);
  const meta = list.data?.meta;
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows]);
  // Like the web page: selections that left the list are dropped; "all matching" resets.
  useEffect(() => {
    setAllMatching(false);
    setSelected((prev) => {
      const next = retainIds(prev, visibleIds);
      return sameIds(prev, next) ? prev : next;
    });
  }, [visibleIds]);
  const head = pageState(selected, visibleIds);
  const selectedCount = allMatching ? (meta?.filtered ?? 0) : selected.size;
  const clearSelection = () => {
    setSelected(new Set());
    setAllMatching(false);
  };
  /** Every id matching the current filters (pages of 200), or the explicit selection. */
  const bulkIds = async (): Promise<number[]> => {
    if (!allMatching) return [...selected];
    const ids: number[] = [];
    for (let p = 1; ; p++) {
      const r = await students.list({ ...params, page: p, limit: 200 });
      ids.push(...r.rows.map((x) => x.id));
      if (p >= r.meta.totalPages) return ids;
    }
  };
  const bulkDelete = useAdminMutation({
    mutationFn: async () => students.removeMany(await bulkIds()),
    invalidate: [['students'], ['dashboard']],
    success: (n) => `Deleted ${plural(n, 'student')} successfully`,
    failure: 'Failed to delete selected students. Please try again.',
    onSuccess: () => {
      setBulk(null);
      clearSelection();
    },
  });
  const bulkRotate = useAdminMutation({
    mutationFn: async () => {
      const sheet = await students.rotatePasswords(await bulkIds());
      const saved = await saveFile(sheet, 'rotated_passwords.xlsx', XLSX_MIME);
      return saved;
    },
    invalidate: [['students']],
    success: (r) =>
      r === 'saved'
        ? 'Passwords rotated successfully. Excel downloaded.'
        : 'Passwords rotated, but this device could not save the sheet.',
    failure: 'Failed to rotate passwords. Please try again.',
    onSuccess: () => {
      setBulk(null);
      clearSelection();
    },
  });
  const tc = useAdminMutation({
    mutationFn: (id: number) => students.issueTc(id),
    invalidate: [['students'], ['alumni'], ['dashboard']],
    success: 'Transfer Certificate issued successfully.',
    failure: 'Failed to issue Transfer Certificate',
    onSuccess: () => setTcTarget(null),
  });
  const reactivate = useAdminMutation({
    mutationFn: (id: number) => students.reactivate(id),
    invalidate: [['students'], ['alumni'], ['dashboard']],
    success: 'Student reactivated successfully.',
    failure: 'Failed to reactivate student',
    onSuccess: () => setViewing(null),
  });
  const [certBusy, setCertBusy] = useState(false);
  const certificate = async (s: StudentRow) => {
    setCertBusy(true);
    try {
      const r = await openPdf(
        () => students.testimonial(s.id),
        pdfFileName(['certificate', s.name]),
      );
      if (r === 'opened') toast.success('Certificate opened.');
      else toast.error('This device cannot open the certificate.');
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Failed to generate Certificate'));
    } finally {
      setCertBusy(false);
    }
  };
  const filtered = Boolean(search) || level !== ALL || section !== ALL || fourth.length > 0;
  const showSenior = rows.some((r) => r.class >= 9);
  const fourthCell = (s: StudentRow) => {
    if (!hasFourthSubject(s.class))
      return (
        <Text size="sm" color="mutedForeground">
          —
        </Text>
      );
    if (readOnly)
      return (
        <Text size="sm" numberOfLines={1}>
          {subjectName(s.fourth_subject_id)}
        </Text>
      );
    return (
      <Select
        label={`4th subject for ${s.name}`}
        size="sm"
        value={s.fourth_subject_id ?? 0}
        disabled={setFourthSubject.isPending && setFourthSubject.variables?.id === s.id}
        onChange={(v) => setFourthSubject.mutate({ id: s.id, subjectId: v || null })}
        options={[
          { value: 0, label: 'None' },
          ...fourthSubjectChoices(allSubjects, s.class, s.group, year).map((x) => ({
            value: x.id,
            label: x.name,
          })),
        ]}
        testID={`fourth-${s.id}`}
      />
    );
  };
  const count = !meta
    ? 'Loading…'
    : filtered
      ? `${meta.filtered.toLocaleString()} of ${plural(meta.total, 'student')}`
      : plural(meta.total, 'student');
  const summary = readOnly && meta ? `${count} · read only` : count;

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: StudentRow) => {
    setViewing(null);
    setEditing(s);
    setFormOpen(true);
  };
  const actions = (s: StudentRow) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit ${s.name}`}
        tone="emerald"
        onPress={() => openEdit(s)}
      />
      <ActionButton icon={Eye} label={`View ${s.name}`} tone="blue" onPress={() => setViewing(s)} />
      <ActionButton
        icon={Trash2}
        label={`Delete ${s.name}`}
        tone="red"
        onPress={() => setDeleteTarget(s)}
      />
    </View>
  );
  const selectColumn: Column<StudentRow> = {
    key: 'select',
    label: ' ',
    className: 'w-10',
    render: (s) => (
      <Checkbox
        checked={allMatching || selected.has(s.id)}
        onChange={() => {
          setAllMatching(false);
          setSelected(toggleId(selected, s.id));
        }}
        label=""
        testID={`select-student-${s.id}`}
      />
    ),
  };
  const columns: Column<StudentRow>[] = [
    ...(readOnly ? [] : [selectColumn]),
    {
      key: 'student',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (s) => <StudentCell s={s} />,
    },
    {
      key: 'roll',
      label: 'Roll',
      sortKey: 'roll',
      className: 'w-24',
      render: (s) => (
        <Text size="sm" tabular>
          {s.roll}
        </Text>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      sortKey: 'class',
      className: 'w-24',
      render: (s) => (
        <Text size="sm" tabular>
          {s.class}
        </Text>
      ),
    },
    {
      key: 'section',
      label: 'Section',
      sortKey: 'section',
      className: 'w-24',
      render: (s) => <Text size="sm">{s.section}</Text>,
    },
    ...(showSenior
      ? [
          {
            key: 'group',
            label: 'Group',
            sortKey: 'group',
            className: 'w-32',
            render: (s: StudentRow) => <Text size="sm">{s.group ?? '—'}</Text>,
          },
          {
            key: 'fourth',
            label: '4th subject',
            sortKey: 'fourth',
            className: 'w-48',
            render: fourthCell,
          },
        ]
      : []),
    ...(readOnly
      ? []
      : [
          {
            key: 'actions',
            label: ' ',
            className: 'w-[120px]',
            align: 'right' as const,
            render: actions,
          },
        ]),
  ];

  const classOptions = [
    { value: ALL, label: 'All classes' },
    ...(meta?.availableClasses ?? []).map((c) => ({ value: String(c), label: `Class ${c}` })),
  ];
  const sectionOptions = [
    { value: ALL, label: 'All sections' },
    ...(meta?.availableSections ?? []).map((s) => ({ value: s, label: `Section ${s}` })),
  ];

  return (
    <PageLayout
      title="Student List"
      titleAccessory={
        <Select
          label="Session year"
          size="sm"
          value={year}
          onChange={setYear}
          options={YEARS.map((y) => ({ value: y, label: `Session ${y}` }))}
        />
      }
      description={summary}
      actions={
        readOnly ? undefined : (
          <>
            <Button
              variant="outline"
              label="Import Excel"
              icon={FileSpreadsheet}
              onPress={() => setImportOpen(true)}
              testID="import-students"
            />
            <Button
              variant="outline"
              label="Bulk 4th subject"
              icon={Layers}
              onPress={() => setBulkFourth({ cls: '', group: '', subject: '' })}
              testID="bulk-fourth"
            />
            <Button label="Add student" icon={Plus} onPress={openAdd} testID="add-student" />
          </>
        )
      }
      onRefresh={() => void list.refetch()}
      refreshing={list.isRefetching}
      footer={
        readOnly ? undefined : selectedCount > 0 ? (
          <ActionBar
            label={`${plural(selectedCount, 'student')} selected`}
            onClear={clearSelection}
            detail={
              head.all && !allMatching && meta && meta.filtered > rows.length ? (
                <Button
                  variant="link"
                  size="sm"
                  label={`Select all ${meta.filtered.toLocaleString()} matching`}
                  onPress={() => setAllMatching(true)}
                  className="h-auto px-0"
                  testID="select-all-matching"
                />
              ) : null
            }
            testID="students-bulk-bar"
          >
            <Button
              variant="outline"
              size="sm"
              icon={KeyRound}
              label={bulkRotate.isPending ? 'Rotating…' : 'Rotate passwords'}
              disabled={bulkRotate.isPending}
              onPress={() => setBulk('rotate')}
              testID="bulk-rotate"
            />
            <Button
              variant="outline"
              size="sm"
              icon={Trash2}
              label={bulkDelete.isPending ? 'Deleting…' : 'Delete'}
              disabled={bulkDelete.isPending}
              onPress={() => setBulk('delete')}
              testID="bulk-delete"
            />
          </ActionBar>
        ) : null
      }
    >
      {list.isError && !list.data ? (
        <ErrorState
          title="Couldn't load students"
          message={list.error.message}
          onRetry={() => void list.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="min-w-[240px] flex-1">
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name, father's name or roll"
                label="Search students"
                testID="student-search"
              />
            </View>
            <Select
              label="Class"
              value={level}
              onChange={setLevel}
              options={classOptions}
              className="w-36"
            />
            <Select
              label="Section"
              value={section}
              onChange={setSection}
              options={sectionOptions}
              className="w-36"
            />
            <MultiSelect
              label="4th subject"
              allLabel="Any 4th subject"
              value={fourth}
              onChange={setFourth}
              options={fourthFilterOptions(meta?.availableFourthSubjects ?? [])}
              className="w-44"
              testID="student-fourth-filter"
            />
            {readOnly ? null : (
              <Checkbox
                checked={allMatching || head.all}
                onChange={() => {
                  if (allMatching) clearSelection();
                  else setSelected(togglePage(selected, visibleIds));
                }}
                label="Select page"
                disabled={visibleIds.length === 0}
                testID="select-page"
              />
            )}
          </View>
          <DataTable
            testID="students"
            rows={rows}
            columns={columns}
            rowKey={(s) => s.enrollment_id ?? s.id}
            loading={list.isPending}
            sort={sort}
            onSort={(next) => setSort(next as TableSort<StudentSortKey> | null)}
            empty={
              search
                ? `No students match “${search}”.`
                : filtered
                  ? 'No students match these filters.'
                  : `No students in session ${year} yet.`
            }
            onRowPress={setViewing}
            renderMobile={(s) => (
              <View className="flex-row items-center gap-3">
                {readOnly ? null : (
                  <Checkbox
                    checked={allMatching || selected.has(s.id)}
                    onChange={() => {
                      setAllMatching(false);
                      setSelected(toggleId(selected, s.id));
                    }}
                    label=""
                  />
                )}
                <View className="min-w-0 flex-1">
                  <StudentCell s={s} />
                </View>
                <View className="items-end">
                  <Text size="xs" color="mutedForeground" tabular>
                    Class {s.class} · {s.section}
                  </Text>
                  <Text size="sm" weight="medium" tabular>
                    Roll {s.roll}
                  </Text>
                </View>
              </View>
            )}
          />
          {meta ? (
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              onPage={setPage}
              busy={list.isFetching}
            />
          ) : null}
        </>
      )}

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ''}
        description={
          viewing
            ? `Class ${viewing.class} · Section ${viewing.section} · Roll ${viewing.roll}`
            : undefined
        }
        testID="student-details"
        footer={
          viewing && readOnly ? (
            <Button variant="outline" label="Close" onPress={() => setViewing(null)} />
          ) : viewing ? (
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
                variant="outline"
                icon={Award}
                label={certBusy ? 'Generating…' : 'Generate certificate'}
                disabled={certBusy}
                onPress={() => void certificate(viewing)}
                testID="student-certificate"
              />
              {viewing.available ? (
                <Button
                  variant="outline"
                  icon={UserMinus}
                  label="Give TC"
                  disabled={tc.isPending}
                  onPress={() => {
                    setTcTarget(viewing);
                    setViewing(null);
                  }}
                  testID="student-tc"
                />
              ) : (
                <Button
                  variant="outline"
                  icon={RotateCw}
                  label={reactivate.isPending ? 'Reactivating…' : 'Reactivate'}
                  disabled={reactivate.isPending}
                  onPress={() => reactivate.mutate(viewing.id)}
                  testID="student-reactivate"
                />
              )}
              <Button label="Edit" icon={Pencil} onPress={() => openEdit(viewing)} />
            </>
          ) : null
        }
      >
        {viewing && !readOnly ? (
          <View className="mb-4 flex-row flex-wrap items-center gap-2">
            <PickFilesButton
              accept="image/*"
              variant="outline"
              size="sm"
              label={photo.isPending ? 'Saving…' : viewing.image ? 'Change photo' : 'Upload photo'}
              disabled={photo.isPending}
              onPick={(files) => files[0] && photo.mutate({ id: viewing.id, file: files[0] })}
              testID="student-photo"
            />
            {viewing.image ? (
              <Button
                variant="ghost"
                size="sm"
                label="Remove photo"
                disabled={photo.isPending}
                onPress={() => photo.mutate({ id: viewing.id, file: null })}
              />
            ) : null}
          </View>
        ) : null}
        {viewing ? (
          <View className="flex-row flex-wrap gap-4">
            <Detail label="Login ID" value={viewing.login_id} />
            <Detail label="Date of birth" value={viewing.dob} />
            <Detail label="Father's name" value={viewing.father_name} />
            <Detail label="Father's phone" value={viewing.father_phone} />
            <Detail label="Mother's name" value={viewing.mother_name} />
            <Detail label="Mother's phone" value={viewing.mother_phone} />
            <Detail label="Religion" value={viewing.religion} />
            <Detail label="Group" value={viewing.group} />
            {hasFourthSubject(viewing.class) ? (
              readOnly ? (
                <Detail label="4th subject" value={subjectName(viewing.fourth_subject_id)} />
              ) : (
                <View className="min-w-[45%] flex-1 gap-0.5">
                  <Text size="xs" color="mutedForeground">
                    4th subject
                  </Text>
                  {fourthCell(viewing)}
                </View>
              )
            ) : null}
            <Detail
              label="Address"
              value={[viewing.village, viewing.post_office, viewing.upazila, viewing.district]
                .filter(Boolean)
                .join(', ')}
            />
            <Detail label="Stipend" value={viewing.has_stipend ? 'Yes' : 'No'} />
            <Detail label="Status" value={viewing.available ? 'Active' : 'Inactive'} />
          </View>
        ) : null}
      </Dialog>

      <StudentForm
        open={formOpen && !readOnly}
        editing={editing}
        sections={meta?.availableSections ?? []}
        busy={save.isPending}
        onClose={close}
        onSubmit={(v) => save.mutate(v)}
      />

      <ConfirmDialog
        open={deleteTarget !== null && !readOnly}
        onClose={() => setDeleteTarget(null)}
        busy={remove.isPending}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        confirmLabel="Delete student"
        message={`Delete ${deleteTarget?.name ?? 'this student'}? This cannot be undone.`}
      />
      <ConfirmDialog
        open={bulk === 'delete' && !readOnly}
        onClose={() => setBulk(null)}
        busy={bulkDelete.isPending}
        onConfirm={() => bulkDelete.mutate(undefined)}
        confirmLabel="Delete students"
        message={`This will permanently delete ${plural(selectedCount, 'student')}. This cannot be undone.`}
      />
      <ConfirmDialog
        open={bulk === 'rotate' && !readOnly}
        onClose={() => setBulk(null)}
        busy={bulkRotate.isPending}
        tone="default"
        onConfirm={() => bulkRotate.mutate(undefined)}
        confirmLabel="Rotate passwords"
        message={`This will generate new passwords for ${plural(selectedCount, 'student')} and download an Excel file with the new credentials. Old passwords stop working.`}
      />
      <ConfirmDialog
        open={tcTarget !== null && !readOnly}
        onClose={() => setTcTarget(null)}
        busy={tc.isPending}
        onConfirm={() => tcTarget && tc.mutate(tcTarget.id)}
        confirmLabel="Issue TC"
        message={`Issue a Transfer Certificate to ${tcTarget?.name ?? 'this student'}? They will be marked inactive and removed from active student lists.`}
      />
      <Dialog
        open={bulkFourth !== null && !readOnly && !bulkFourthConfirm}
        onClose={() => setBulkFourth(null)}
        title="Bulk update 4th subject"
        description={`Applies to every student in one class and group for session ${year}.`}
        testID="bulk-fourth-dialog"
        footer={
          <>
            <Button variant="outline" label="Cancel" onPress={() => setBulkFourth(null)} />
            <Button
              label="Apply to all"
              disabled={!bulkFourth?.cls || !bulkFourth.group || !bulkFourth.subject}
              onPress={() => setBulkFourthConfirm(true)}
              testID="bulk-fourth-apply"
            />
          </>
        }
      >
        {bulkFourth ? (
          <View className="gap-4">
            <FieldRow>
              <Field label="Class" required>
                <Select
                  label="Class"
                  placeholder="Select class"
                  value={bulkFourth.cls || null}
                  onChange={(cls) => setBulkFourth({ ...bulkFourth, cls, subject: '' })}
                  options={[
                    { value: '9' as const, label: 'Class 9' },
                    { value: '10' as const, label: 'Class 10' },
                  ]}
                  testID="bulk-fourth-class"
                />
              </Field>
              <Field label="Group" required>
                <Select
                  label="Group"
                  placeholder="Select group"
                  value={bulkFourth.group || null}
                  onChange={(group) => setBulkFourth({ ...bulkFourth, group, subject: '' })}
                  options={VALID_GROUPS.map((g) => ({ value: g, label: g }))}
                  testID="bulk-fourth-group"
                />
              </Field>
            </FieldRow>
            <Field
              label="4th subject"
              required
              hint={
                bulkFourth.cls && bulkFourth.group && bulkFourthChoices.length === 0
                  ? `No optional subjects for Class ${bulkFourth.cls} ${bulkFourth.group} in ${year}.`
                  : undefined
              }
            >
              <Select
                label="4th subject"
                placeholder={
                  bulkFourth.cls && bulkFourth.group
                    ? 'Select subject'
                    : 'Pick class and group first'
                }
                disabled={!bulkFourth.cls || !bulkFourth.group}
                value={bulkFourth.subject || null}
                onChange={(subject) => setBulkFourth({ ...bulkFourth, subject })}
                options={[
                  { value: BULK_CLEAR, label: 'None (clear)' },
                  ...bulkFourthChoices.map((x) => ({
                    value: String(x.id),
                    label: x.group ? `${x.name} (${x.group})` : x.name,
                  })),
                ]}
                testID="bulk-fourth-subject"
              />
            </Field>
          </View>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={bulkFourthConfirm && bulkFourth !== null && !readOnly}
        onClose={() => setBulkFourthConfirm(false)}
        busy={applyBulkFourth.isPending}
        tone="default"
        onConfirm={() => applyBulkFourth.mutate(undefined)}
        confirmLabel="Apply to all"
        message={
          bulkFourth?.cls
            ? bulkFourthMessage(Number(bulkFourth.cls), bulkFourth.group, year, bulkFourthName)
            : ''
        }
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import students from Excel"
        noun="student"
        requiredColumns={STUDENT_REQUIRED_COLUMNS}
        template={{
          fileName: 'student_upload_demo.xlsx',
          sheet: 'Students',
          rows: [[...STUDENT_TEMPLATE_COLUMNS], ...STUDENT_TEMPLATE_ROWS],
        }}
        parse={(rows) => parseStudentSheet(rows, shared)}
        onUpload={(rows) => importRows.mutate(rows)}
        busy={importRows.isPending}
        testID="student-import"
      />
    </PageLayout>
  );
}
