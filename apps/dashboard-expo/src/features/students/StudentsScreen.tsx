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
import {
  RELIGION,
  VALID_GROUPS,
  sentenceCaseAddressInput,
  studentFormSchema,
} from '@school/shared-schemas';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import type { TableSort } from '@/components/ui/table-sort';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow, FormSection } from '@/components/ui/Field';
import {
  Award,
  CalendarDays,
  Eye,
  FileSpreadsheet,
  KeyRound,
  Layers,
  Pencil,
  Plus,
  RotateCw,
  Trash2,
  User,
  UserMinus,
  XIcon,
} from '@/components/ui/icons';
import { PickFilesButton } from '@/components/ui/FilePicker';
import { Pagination } from '@/components/ui/Pagination';
import { PageSizeSelect } from '@/components/ui/PageSizeSelect';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage, plural } from '@/features/admin/errors';
import { pageState, retainIds, sameIds, toggleId, togglePage } from '@/features/admin/selection';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import { StudentAttendancePanel } from './StudentAttendancePanel';
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
import { useBreakpoint } from '@/hooks/useBreakpoint';
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
  onPhoto,
  photoBusy,
  newPhoto,
  onNewPhoto,
}: {
  open: boolean;
  editing: StudentRow | null;
  /** Edit only: upload or remove the photo at once (a new student has no id yet). */
  onPhoto?: (file: PickedFile | null) => void;
  photoBusy?: boolean;
  /** Add only: the photo saved right after the student is created. */
  newPhoto?: PickedFile | null;
  onNewPhoto?: (file: PickedFile | null) => void;
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
        {!editing && onNewPhoto ? (
          <View className="flex-row flex-wrap items-center gap-2" testID="student-form-new-photo">
            <PickFilesButton
              accept="image/*"
              variant="outline"
              size="sm"
              label={newPhoto ? 'Change photo' : 'Add photo (optional)'}
              disabled={busy}
              onPick={(files) => files[0] && onNewPhoto(files[0])}
            />
            {newPhoto ? (
              <>
                <Text size="xs" color="mutedForeground" numberOfLines={1} className="max-w-48">
                  {newPhoto.name}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  label="Remove"
                  disabled={busy}
                  onPress={() => onNewPhoto(null)}
                />
              </>
            ) : null}
          </View>
        ) : null}
        {editing && onPhoto ? (
          <View className="flex-row flex-wrap items-center gap-2" testID="student-form-photo">
            <PickFilesButton
              accept="image/*"
              variant="outline"
              size="sm"
              label={photoBusy ? 'Saving…' : editing.image ? 'Change photo' : 'Upload photo'}
              disabled={photoBusy}
              onPick={(files) => files[0] && onPhoto(files[0])}
            />
            {editing.image ? (
              <Button
                variant="ghost"
                size="sm"
                label="Remove photo"
                disabled={photoBusy}
                onPress={() => onPhoto(null)}
              />
            ) : null}
          </View>
        ) : null}
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
          <TextField
            control={control}
            name="village"
            label="Village"
            transform={(t) => sentenceCaseAddressInput(t, false)}
          />
          <TextField
            control={control}
            name="post_office"
            label="Post office"
            transform={(t) => sentenceCaseAddressInput(t, false)}
          />
          <TextField
            control={control}
            name="upazila"
            label="Upazila"
            transform={(t) => sentenceCaseAddressInput(t, false)}
          />
          <TextField
            control={control}
            name="district"
            label="District"
            transform={(t) => sentenceCaseAddressInput(t, false)}
          />
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
  const mobile = useBreakpoint() === 'mobile';
  const toast = useToast();
  const [year, setYear] = useState(THIS_YEAR);
  const [levels, setLevels] = useState<number[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);
  const [newPhoto, setNewPhoto] = useState<PickedFile | null>(null);
  const [roll, setRoll] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(query.trim(), 300);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentRow | null>(null);
  const [viewing, setViewing] = useState<StudentRow | null>(null);
  const [viewTab, setViewTab] = useState<'profile' | 'attendance'>('profile');
  const openView = (s: StudentRow) => {
    setViewTab('profile');
    setViewing(s);
  };
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

  useEffect(() => setPage(1), [search, year, levels, sections, groups, roll, limit, sort, fourth]);

  const params = {
    year,
    page,
    limit,
    search: search || undefined,
    levels: levels.length ? levels : undefined,
    sections: sections.length ? sections : undefined,
    groups: groups.length ? groups : undefined,
    roll: Number(roll) > 0 ? Number(roll) : undefined,
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
    setNewPhoto(null);
  };
  const save = useAdminMutation({
    mutationFn: async (values: StudentFormValues) => {
      const { personal, academic } = toStudentPayload(values);
      if (editing) {
        await students.update(editing, personal, academic);
        return null;
      }
      const created = await students.create({ ...personal, ...academic });
      if (newPhoto && created.created > 0) {
        // The create call returns no id: find the new student by class, section and roll.
        try {
          const found = await students.list({
            year: new Date().getFullYear(),
            levels: [Number(academic.class)],
            sections: [academic.section],
            roll: Number(academic.roll),
            search: personal.name,
            limit: 5,
          });
          const row = found.rows.find((r) => r.name === personal.name) ?? found.rows[0];
          if (!row) throw new Error('not found');
          await students.uploadImage(row.id, newPhoto);
        } catch {
          toast.error(
            'Student added, but the photo was not saved. Add it from the student details.',
          );
        }
      }
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
    onSuccess: (r) => {
      setViewing((s) => (s && s.id === r.id ? { ...s, image: r.image } : s));
      setEditing((s) => (s && s.id === r.id ? { ...s, image: r.image } : s));
    },
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
  const filtered =
    Boolean(search) ||
    levels.length > 0 ||
    sections.length > 0 ||
    groups.length > 0 ||
    roll !== '' ||
    fourth.length > 0;
  const clearFilters = () => {
    setQuery('');
    setLevels([]);
    setSections([]);
    setGroups([]);
    setRoll('');
    setFourth([]);
  };
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
  const summary = [
    count,
    meta?.stipendCount != null ? `${meta.stipendCount.toLocaleString()} on stipend` : null,
    readOnly && meta ? 'read only' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (s: StudentRow) => {
    setViewing(null);
    setEditing(s);
    setFormOpen(true);
  };
  const viewAction = (s: StudentRow) => (
    <ActionButton icon={Eye} label={`View ${s.name}`} tone="blue" onPress={() => openView(s)} />
  );
  const actions = (s: StudentRow) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Pencil}
        label={`Edit ${s.name}`}
        tone="emerald"
        onPress={() => openEdit(s)}
      />
      <ActionButton icon={Eye} label={`View ${s.name}`} tone="blue" onPress={() => openView(s)} />
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
    className: 'w-12',
    header: (
      <Checkbox
        checked={allMatching || head.all}
        onChange={() => {
          if (allMatching) clearSelection();
          else setSelected(togglePage(selected, visibleIds));
        }}
        label=""
        accessibilityLabel="Select all students on this page"
        disabled={visibleIds.length === 0}
        testID="select-page"
      />
    ),
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
    {
      key: 'actions',
      label: ' ',
      className: readOnly ? 'w-[64px]' : 'w-[120px]',
      align: 'right' as const,
      render: readOnly ? viewAction : actions,
    },
  ];

  const classOptions = (meta?.availableClasses ?? []).map((c) => ({
    value: c,
    label: `Class ${c}`,
  }));
  const sectionOptions = (meta?.availableSections ?? []).map((s) => ({
    value: s,
    label: `Section ${s}`,
  }));

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
            <MultiSelect
              label="Class"
              allLabel="All classes"
              value={levels}
              onChange={setLevels}
              options={classOptions}
              className="w-36"
              testID="student-class-filter"
            />
            <MultiSelect
              label="Section"
              allLabel="All sections"
              value={sections}
              onChange={setSections}
              options={sectionOptions}
              className="w-36"
              testID="student-section-filter"
            />
            <MultiSelect
              label="Group"
              allLabel="All groups"
              value={groups}
              onChange={setGroups}
              options={VALID_GROUPS.map((g) => ({ value: g as string, label: g }))}
              className="w-36"
              testID="student-group-filter"
            />
            <Input
              value={roll}
              onChangeText={(t) => setRoll(t.replace(/\D/g, '').slice(0, 6))}
              placeholder="Roll"
              keyboardType="number-pad"
              accessibilityLabel="Filter by roll"
              className="w-24"
              testID="student-roll-filter"
            />
            {filtered ? (
              <Button
                variant="ghost"
                size="sm"
                icon={XIcon}
                label="Clear filters"
                onPress={clearFilters}
                testID="student-clear-filters"
              />
            ) : null}
            <MultiSelect
              label="4th subject"
              allLabel="Any 4th subject"
              value={fourth}
              onChange={setFourth}
              options={fourthFilterOptions(meta?.availableFourthSubjects ?? [])}
              className="w-44"
              testID="student-fourth-filter"
            />
            {readOnly || !mobile ? null : (
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
            onRowPress={openView}
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
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <PageSizeSelect value={limit} onChange={setLimit} sizes={[25, 50, 100, 200]} />
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                onPage={setPage}
                busy={list.isFetching}
              />
            </View>
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
        {viewing ? (
          <View className="mb-4">
            <Tabs
              testID="student-details-tab"
              value={viewTab}
              onChange={setViewTab}
              tabs={[
                { id: 'profile', label: 'Profile', icon: User },
                { id: 'attendance', label: 'Attendance', icon: CalendarDays },
              ]}
            />
          </View>
        ) : null}
        {viewing && viewTab === 'attendance' ? (
          <StudentAttendancePanel key={viewing.id} studentId={viewing.id} initialYear={year} />
        ) : null}
        {viewing && viewTab === 'profile' && !readOnly ? (
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
        {viewing && viewTab === 'profile' ? (
          <View className="mb-4 flex-row items-center gap-3">
            {fileUrl(viewing.image) ? (
              <Image
                source={{ uri: fileUrl(viewing.image)! }}
                accessibilityLabel={`Photo of ${viewing.name}`}
                resizeMode="cover"
                className="bg-muted aspect-[7/9] w-24 rounded-lg"
              />
            ) : null}
            <View className="min-w-0 flex-1 flex-row flex-wrap gap-1.5">
              {[
                `Class ${viewing.class}`,
                `Section ${viewing.section}`,
                `Roll ${viewing.roll}`,
                viewing.group,
                viewing.has_stipend ? 'Stipend' : null,
                viewing.available ? 'Active' : 'Inactive',
              ]
                .filter((x): x is string => !!x)
                .map((label) => (
                  <Badge
                    key={label}
                    label={label}
                    variant={label === 'Inactive' ? 'destructive' : 'secondary'}
                  />
                ))}
            </View>
          </View>
        ) : null}
        {viewing && viewTab === 'profile' ? (
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
        onPhoto={(file) => editing && photo.mutate({ id: editing.id, file })}
        photoBusy={photo.isPending}
        newPhoto={newPhoto}
        onNewPhoto={setNewPhoto}
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
        guide={{
          notes: [
            'dob uses DD/MM/YYYY.',
            'Phone numbers are 11 digits starting with 01.',
            'has_stipend is Yes or No.',
            'group is Science, Commerce or Humanities (class 9–10 only).',
          ],
        }}
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
