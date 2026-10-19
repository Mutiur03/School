/**
 * Class 6 / 8 / 9 and Junior Scholarship registrations, replicating
 * dashboard/src/pages/Admin/ClassRegForm.tsx (one screen, four variants): a Registrations tab
 * (server-paged list with search, Status / Section filters, sort, details, PDF, approve / mark
 * pending, delete, server-built Excel / photos exports) and a Settings tab (per-year settings:
 * open switch, section roll ranges, notice PDF, instructions, classmates list).
 * Live data: /api/reg/<variant>, /api/reg/<variant>/form/* (src/lib/api/registration.ts).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm, useWatch, type Control } from 'react-hook-form';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { headerSortValue, parseSortValue, withSortOption } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow, FormSection } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Settings,
  Trash2,
  XIcon,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Tabs } from '@/components/ui/Tabs';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { openStoredFile } from '@/features/admin/open-file';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import { useDebounced } from '@/hooks/useDebounced';
import { pdfFileName } from '@/lib/files/pdf-name';
import { XLSX_MIME } from '@/lib/files/save-file';
import {
  isPdf,
  REG_CONFIG,
  type PickedFile,
  type RegConfig,
  type RegListParams,
  type RegSettingsInput,
  type RegSort,
  type RegStatus,
  type RegVariant,
  type Registration,
} from '@/lib/api';
import { useLeaveGuard } from '@/navigation/LeaveGuard';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { registrationSections } from './admission-model';
import { datedName, dayOf, fileNameOf, regYearOptions } from './model';
import { regFormValues, regSettingsFormSchema } from './registration-model';
import { DetailGrid, useFileTasks, ZIP_MIME } from './ui';

type Tab = 'registrations' | 'settings';
const SORT_KEYS = ['name', 'section', 'roll', 'status', 'date'] as const;
const SORT_LABELS: Record<string, string> = {
  name: 'Name',
  section: 'Section',
  roll: 'Roll',
  status: 'Status',
  date: 'Submitted',
};
const SORTS: { value: string; label: string }[] = [
  { value: '', label: 'Default order' },
  { value: 'roll:asc', label: 'Roll' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'section:asc', label: 'Section' },
  { value: 'date:desc', label: 'Newest first' },
  { value: 'status:asc', label: 'Status' },
];

export function RegistrationScreen({ variant }: { variant: RegVariant }) {
  const cfg = REG_CONFIG[variant];
  const { registration } = useApi();
  const { resolution } = useTenant();
  const [tab, setTab] = useState<Tab>('registrations');
  const [listYear, setListYear] = useState<string | null>(null);
  const [settingsYear, setSettingsYear] = useState<string | null>(null);

  // Latest settings (no year): the default year for both tabs, as on the web.
  const latest = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'registration', variant, 'settings', 'latest'),
    queryFn: ({ signal }) => registration.settings(cfg, null, signal),
  });
  const baseYear = latest.data?.year ?? new Date().getFullYear();
  const year = listYear ?? String(baseYear);
  const sYear = settingsYear ?? String(baseYear);

  return (
    <PageLayout
      title={cfg.title}
      titleAccessory={
        tab === 'registrations' ? (
          <Select
            label={cfg.yearLabel}
            size="sm"
            value={year}
            options={regYearOptions(baseYear, [year]).map((y) => ({
              value: String(y),
              label: cfg.yearText(y),
            }))}
            onChange={setListYear}
            testID="reg-year"
          />
        ) : null
      }
    >
      <Tabs
        tabs={[
          { id: 'registrations', label: 'Registrations', icon: ClipboardList },
          { id: 'settings', label: 'Settings', icon: Settings },
        ]}
        value={tab}
        onChange={setTab}
      />
      {latest.isPending ? (
        <Skeleton height={240} />
      ) : tab === 'registrations' ? (
        <RegistrationList cfg={cfg} year={year} />
      ) : (
        <RegistrationSettingsCard
          cfg={cfg}
          year={sYear}
          baseYear={baseYear}
          onYear={setSettingsYear}
          onUseLatest={() => setSettingsYear(null)}
        />
      )}
    </PageLayout>
  );
}

function RegistrationList({ cfg, year }: { cfg: RegConfig; year: string }) {
  const { registration } = useApi();
  const { resolution } = useTenant();
  const files = useFileTasks();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RegStatus[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [sort, setSort] = useState('');
  const [detail, setDetail] = useState<Registration | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Registration | null>(null);
  const dSearch = useDebounced(search, 300);
  useEffect(() => setPage(1), [year]);

  const [sortKey, order] = sort
    ? (sort.split(':') as [RegSort, 'asc' | 'desc'])
    : [undefined, undefined];
  const filters: Omit<RegListParams, 'page' | 'limit'> = {
    year,
    status,
    sections,
    search: dSearch,
    sort: sortKey,
    order,
  };
  const params: RegListParams = { ...filters, page, limit };
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'registration', cfg.variant, 'list', params),
    queryFn: ({ signal }) => registration.list(cfg, params, signal),
    placeholderData: keepPreviousData,
  });
  const meta = q.data?.meta;
  const filtersActive = !!(search.trim() || status.length || sections.length);
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const setRegStatus = useAdminMutation({
    mutationFn: async (v: { reg: Registration; status: RegStatus }) => {
      await registration.setStatus(cfg, v.reg.id, v.status);
      return v.status;
    },
    invalidate: [['registration', cfg.variant, 'list']],
    success: (s) => (s === 'approved' ? 'Registration approved' : 'Marked as pending'),
    failure: 'Failed to update status',
    onSuccess: (s) => setDetail((d) => (d ? { ...d, status: s } : d)),
  });
  const remove = useAdminMutation({
    mutationFn: (id: string) => registration.remove(cfg, id),
    invalidate: [['registration', cfg.variant, 'list']],
    success: 'Registration deleted',
    failure: 'Failed to delete registration',
    onSuccess: () => {
      setDeleteTarget(null);
      setDetail(null);
    },
  });

  const pdfName = (r: Registration) =>
    pdfFileName([cfg.pdfPrefix.replace(/_$/, ''), r.name, r.section, r.roll]);
  const previewPdf = (r: Registration) =>
    files.pdf(`pdf-${r.id}`, () => registration.pdf(cfg, r.id), pdfName(r), 'Failed to open PDF');
  const downloadPdf = (r: Registration) =>
    files.save(
      `dl-${r.id}`,
      () => registration.pdf(cfg, r.id),
      pdfName(r),
      'application/pdf',
      'Failed to download PDF',
    );
  const exportFile = (kind: 'sheet' | 'photos') =>
    files.save(
      kind,
      () => registration.export(cfg, kind, filters),
      kind === 'sheet'
        ? datedName(`${cfg.exportPrefix}Registrations_${year}_`, 'xlsx')
        : `${cfg.exportPrefix}Photos_${year}.zip`,
      kind === 'sheet' ? XLSX_MIME : ZIP_MIME,
      kind === 'sheet' ? 'Failed to export excel sheet' : 'Failed to export photos',
    );
  const toggle = (r: Registration) =>
    setRegStatus.mutate({ reg: r, status: r.status === 'pending' ? 'approved' : 'pending' });
  const statusKind = (s: string) => (s === 'approved' ? 'approved' : 'pending');

  const actions = (r: Registration) => (
    <View className="flex-row gap-0.5">
      <ActionButton icon={Eye} label={`View ${r.name}`} tone="blue" onPress={() => setDetail(r)} />
      <ActionButton
        icon={FileText}
        label={`Preview PDF of ${r.name}`}
        tone="blue"
        onPress={() => previewPdf(r)}
      />
      <ActionButton
        icon={r.status === 'pending' ? CheckCircle2 : Clock}
        label={r.status === 'pending' ? `Approve ${r.name}` : `Mark ${r.name} as pending`}
        tone="emerald"
        onPress={() => toggle(r)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${r.name}`}
        tone="red"
        onPress={() => setDeleteTarget(r)}
      />
    </View>
  );
  const student = (r: Registration) => {
    const photo = fileUrl(r.photo);
    return (
      <View className="flex-row items-center gap-3">
        {photo ? (
          <Image source={{ uri: photo }} className="bg-muted h-9 w-9 rounded-full" />
        ) : (
          <View className="bg-primary/10 h-9 w-9 items-center justify-center rounded-full">
            <Text size="sm" weight="semibold" className="text-primary">
              {(r.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text size="sm" weight="medium" numberOfLines={1}>
            {r.name || 'Unnamed'}
          </Text>
          {r.nameBn ? (
            <Text size="xs" color="mutedForeground" numberOfLines={1}>
              {r.nameBn}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };
  const columns: Column<Registration>[] = [
    {
      key: 'student',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: student,
    },
    {
      key: 'section',
      label: 'Section',
      sortKey: 'section',
      className: 'w-24',
      render: (r) => <Text size="sm">{r.section || '—'}</Text>,
    },
    {
      key: 'roll',
      label: 'Roll',
      sortKey: 'roll',
      className: 'w-20',
      render: (r) => (
        <Text size="sm" tabular>
          {r.roll || '—'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      className: 'w-28',
      render: (r) => <StatusBadge status={statusKind(r.status)} />,
    },
    {
      key: 'date',
      label: 'Submitted',
      sortKey: 'date',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground" tabular>
          {dayOf(r.submitted)}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[150px]', align: 'right', render: actions },
  ];
  const summary = meta
    ? [
        plural(meta.total, 'registration'),
        meta.pending ? `${meta.pending.toLocaleString()} pending` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Loading…';

  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text size="sm" color="mutedForeground" tabular>
          {summary}
        </Text>
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            label={files.busy === 'sheet' ? 'Preparing…' : 'Excel sheet'}
            onPress={() => exportFile('sheet')}
            disabled={!!files.busy}
            testID="reg-export-sheet"
          />
          <Button
            variant="outline"
            size="sm"
            icon={Download}
            label={files.busy === 'photos' ? 'Preparing…' : 'Photos (ZIP)'}
            onPress={() => exportFile('photos')}
            disabled={!!files.busy}
          />
        </View>
      </View>
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChangeText={reset(setSearch)}
            placeholder="Name, roll, birth reg…"
            label="Search registrations"
            testID="reg-search"
          />
        </View>
        <MultiSelect
          label="Section"
          size="sm"
          value={sections}
          options={['A', 'B'].map((s) => ({ value: s, label: `Section ${s}` }))}
          onChange={reset(setSections)}
          allLabel="All sections"
          testID="reg-section"
        />
        <MultiSelect
          label="Status"
          size="sm"
          value={status}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
          ]}
          onChange={reset(setStatus)}
          allLabel="Any status"
          testID="reg-status"
        />
        <Select
          label="Sort"
          size="sm"
          value={sort}
          options={withSortOption(SORTS, sort, SORT_LABELS)}
          onChange={reset(setSort)}
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            icon={XIcon}
            label="Clear filters"
            onPress={() => {
              setSearch('');
              setStatus([]);
              setSections([]);
              setPage(1);
            }}
          />
        ) : null}
      </View>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load registrations"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="registrations"
            sort={parseSortValue(sort, SORT_KEYS)}
            onSort={(next) => reset(setSort)(headerSortValue(next, sort, ''))}
            rows={q.data?.rows ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            loading={q.isPending}
            empty={
              filtersActive
                ? 'No registrations match these filters.'
                : `No registrations for ${cfg.yearText(year)} yet.`
            }
            onRowPress={setDetail}
            renderMobile={(r) => (
              <View className="gap-2">
                {student(r)}
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <StatusBadge status={statusKind(r.status)} />
                    <Text size="xs" color="mutedForeground" tabular>
                      {[r.section && `Sec ${r.section}`, r.roll && `Roll ${r.roll}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  {actions(r)}
                </View>
              </View>
            )}
          />
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Select
              label="Rows per page"
              size="sm"
              value={limit}
              options={[50, 100, 200].map((n) => ({ value: n, label: `${n} / page` }))}
              onChange={reset(setLimit)}
            />
            <Pagination
              page={page}
              totalPages={meta?.totalPages ?? 1}
              onPage={setPage}
              busy={q.isFetching}
            />
          </View>
        </>
      )}
      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.name || 'Registration'}
        description={
          detail
            ? [
                detail.section && `Section ${detail.section}`,
                detail.roll && `Roll ${detail.roll}`,
                dayOf(detail.submitted),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        size="xl"
        testID="reg-detail"
        footer={
          detail ? (
            <>
              <Button
                variant="outline"
                icon={FileText}
                label="Preview PDF"
                onPress={() => previewPdf(detail)}
              />
              <Button
                variant="outline"
                icon={Download}
                label="Download PDF"
                onPress={() => downloadPdf(detail)}
              />
              <Button
                variant={detail.status === 'pending' ? 'default' : 'outline'}
                icon={detail.status === 'pending' ? CheckCircle2 : Clock}
                label={
                  setRegStatus.isPending
                    ? 'Saving…'
                    : detail.status === 'pending'
                      ? 'Approve'
                      : 'Mark as pending'
                }
                onPress={() => toggle(detail)}
                disabled={setRegStatus.isPending}
              />
            </>
          ) : null
        }
      >
        {detail ? (
          <>
            <View className="flex-row items-center gap-3">
              {fileUrl(detail.photo) ? (
                <Image
                  source={{ uri: fileUrl(detail.photo)! }}
                  className="bg-muted h-20 w-16 rounded-md"
                />
              ) : null}
              <StatusBadge status={statusKind(detail.status)} />
            </View>
            {registrationSections(cfg.variant, detail.fields).map(([title, items]) => (
              <View key={title} className="gap-2">
                <Text size="sm" weight="semibold">
                  {title}
                </Text>
                <DetailGrid items={items} />
              </View>
            ))}
          </>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete registration?"
        message={`Delete the registration of ${deleteTarget?.name || 'this student'}? This cannot be undone.`}
        confirmLabel="Delete registration"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </>
  );
}

function Area({
  control,
  name,
  label,
  hint,
  placeholder,
}: {
  control: Control<RegSettingsInput>;
  name: 'instruction_for_a' | 'instruction_for_b' | 'attachment_instruction' | 'classmates';
  label: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={fieldState.error?.message}>
          <Input
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            accessibilityLabel={label}
            placeholder={placeholder}
            multiline
            numberOfLines={4}
            rows={4}
          />
        </Field>
      )}
    />
  );
}

function RegistrationSettingsCard({
  cfg,
  year,
  baseYear,
  onYear,
  onUseLatest,
}: {
  cfg: RegConfig;
  year: string;
  baseYear: number;
  onYear: (y: string) => void;
  onUseLatest: () => void;
}) {
  const { registration } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [notice, setNotice] = useState<PickedFile | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'registration', cfg.variant, 'settings', year),
    queryFn: ({ signal }) => registration.settings(cfg, year, signal),
  });
  const { control, handleSubmit, reset, formState } = useForm<RegSettingsInput>({
    resolver: zodResolver(regSettingsFormSchema),
    defaultValues: regFormValues(q.data, year),
    mode: 'onBlur',
  });
  useEffect(() => {
    if (q.data) reset(regFormValues(q.data, year));
    setNotice(null);
  }, [q.data, year, reset]);
  const source = useWatch({ control, name: 'classmates_source' });
  const dirty = formState.isDirty || notice !== null;
  useLeaveGuard(dirty, {
    title: 'Leave without saving?',
    message: 'Your registration settings changes have not been saved.',
  });
  const exists = !!q.data?.exists;

  const save = useAdminMutation({
    mutationFn: (v: RegSettingsInput) =>
      // Save under the year being edited (the year field is the header picker).
      registration.saveSettings(cfg, { ...v, year }, notice, q.data?.notice ?? null),
    invalidate: [['registration', cfg.variant, 'settings']],
    success: () => (exists ? 'Settings saved' : 'Settings created'),
    failure: 'Failed to save settings',
    onSuccess: () => setNotice(null),
  });
  const removeNotice = useAdminMutation({
    mutationFn: () => registration.removeNotice(cfg, year),
    invalidate: [['registration', cfg.variant, 'settings']],
    success: 'Notice deleted successfully',
    failure: 'Failed to delete notice',
    onSuccess: () => setRemoveOpen(false),
  });
  const pick = (f: PickedFile | null) => {
    if (f && !isPdf(f)) {
      toast.error('Notice must be a PDF');
      return;
    }
    setNotice(f);
  };
  const submit = () =>
    void handleSubmit(
      (v) => save.mutate(v),
      () => toast.error('Fix the highlighted fields'),
    )();

  return (
    <SectionCard
      title="Registration settings"
      description={cfg.settingsDesc}
      headerAction={
        <View className="flex-row items-center gap-2">
          <Select
            label={cfg.yearLabel}
            size="sm"
            value={year}
            options={regYearOptions(baseYear, [year], true).map((y) => ({
              value: String(y),
              label: cfg.yearText(y),
            }))}
            onChange={onYear}
            testID="reg-settings-year"
          />
          {year !== String(baseYear) ? (
            <Button variant="ghost" size="sm" label="Use latest" onPress={onUseLatest} />
          ) : null}
        </View>
      }
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load settings"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={240} />
      ) : (
        <View className="gap-6">
          {!exists ? (
            <Text size="sm" color="mutedForeground">
              {`No settings for ${cfg.yearText(year)} yet. Fill in the fields and create them.`}
            </Text>
          ) : null}
          <Controller
            control={control}
            name="reg_open"
            render={({ field }) => (
              <Checkbox
                boxed
                checked={field.value}
                onChange={field.onChange}
                label="Accept registrations"
                description="Students can submit the form while this is on."
                testID="reg-open"
              />
            )}
          />
          <FormSection title="Sections">
            <FieldRow>
              <TextField
                control={control}
                name="a_sec_roll"
                label="Section A roll range"
                placeholder="01-50"
              />
              <TextField
                control={control}
                name="b_sec_roll"
                label="Section B roll range"
                placeholder="51-100"
              />
            </FieldRow>
          </FormSection>
          <FormSection title="Notice">
            {q.data?.notice ? (
              <View className="flex-row flex-wrap items-center gap-2">
                <Text size="sm" className="min-w-0 flex-1" numberOfLines={1}>
                  {fileNameOf(q.data.notice)}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Trash2}
                  label="Remove"
                  onPress={() => setRemoveOpen(true)}
                />
              </View>
            ) : null}
            <FilePicker
              label="Notice PDF"
              accept="application/pdf,.pdf"
              value={notice}
              onChange={pick}
              currentLabel={q.data?.notice ? 'Current notice' : undefined}
              onOpenCurrent={q.data?.notice ? () => void openStoredFile(q.data!.notice) : undefined}
            />
          </FormSection>
          <FormSection title="Instructions">
            <FieldRow>
              <Area control={control} name="instruction_for_a" label="Section A" />
              <Area control={control} name="instruction_for_b" label="Section B" />
            </FieldRow>
            <Area control={control} name="attachment_instruction" label="Attachments" />
          </FormSection>
          <FormSection title="Classmates list">
            <Controller
              control={control}
              name="classmates_source"
              render={({ field }) => (
                <Field
                  label="Source"
                  hint={field.value === 'default' ? cfg.enrollmentHint : 'Type the names yourself.'}
                >
                  <Select
                    label="Source"
                    value={field.value}
                    options={[
                      { value: 'default', label: 'Enrollment list' },
                      { value: 'custom', label: 'Custom list' },
                    ]}
                    onChange={field.onChange}
                  />
                </Field>
              )}
            />
            {source === 'custom' ? (
              <Area
                control={control}
                name="classmates"
                label="Names"
                hint="Separate names with commas."
                placeholder="আব্দুল করিম, রহিম উদ্দিন, সালমা খাতুন"
              />
            ) : null}
          </FormSection>
          {dirty || !exists ? (
            <ActionBar label={dirty ? 'Unsaved settings' : 'Not created yet'} testID="reg-unsaved">
              {dirty ? (
                <Button
                  variant="ghost"
                  size="sm"
                  label="Discard"
                  onPress={() => {
                    reset(regFormValues(q.data, year));
                    setNotice(null);
                  }}
                  disabled={save.isPending}
                />
              ) : null}
              <Button
                size="sm"
                label={save.isPending ? 'Saving…' : exists ? 'Save settings' : 'Create settings'}
                onPress={submit}
                disabled={save.isPending}
                testID="reg-save"
              />
            </ActionBar>
          ) : null}
        </View>
      )}
      <ConfirmDialog
        open={removeOpen}
        title="Remove notice?"
        message={`Delete the ${cfg.yearText(year)} notice PDF? It disappears from the registration page.`}
        confirmLabel="Remove notice"
        busy={removeNotice.isPending}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => removeNotice.mutate(undefined)}
      />
    </SectionCard>
  );
}
