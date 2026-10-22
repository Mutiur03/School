/**
 * Admission applications, replicating dashboard/src/pages/Admin/Admission.tsx: server-paged list
 * with search, Status / Class / Year filters, sort, the details dialog (Admission, Personal,
 * Parents, Address, Previous school, Guardian), PDF preview/download, approve / mark pending,
 * delete, and the server-built Excel sheet / photos zip exports.
 * Live data: /api/admission (settings: class list + year), /api/admission/form/*.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { headerSortValue, parseSortValue, withSortOption } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { CheckCircle2, Clock, Download, Eye, FileText, Trash2, XIcon } from '@/components/ui/icons';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import { useDebounced } from '@/hooks/useDebounced';
import { pdfFileName } from '@/lib/files/pdf-name';
import { XLSX_MIME } from '@/lib/files/save-file';
import type { AdmissionForm, AdmissionListParams, AdmissionSort, AdmissionStatus } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { admissionSections, parseClassList } from './admission-model';
import { datedName, dateTimeOf, yearsFrom } from './model';
import { DetailGrid, useFileTasks, ZIP_MIME } from './ui';

const SORT_KEYS = ['name', 'class', 'userId', 'status', 'date'] as const;
const SORT_LABELS: Record<string, string> = {
  name: 'Name',
  class: 'Class',
  userId: 'User ID',
  status: 'Status',
  date: 'Submitted',
};
const SORTS: { value: string; label: string }[] = [
  { value: 'date:desc', label: 'Newest first' },
  { value: 'date:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'class:asc', label: 'Class' },
  { value: 'userId:asc', label: 'User ID' },
  { value: 'status:asc', label: 'Status' },
];

export function AdmissionFormsScreen() {
  const { admission } = useApi();
  const { resolution } = useTenant();
  const files = useFileTasks();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<AdmissionStatus[]>([]);
  const [cls, setCls] = useState('');
  const [year, setYear] = useState<string | null>(null);
  const [sort, setSort] = useState('date:desc');
  const [detail, setDetail] = useState<AdmissionForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdmissionForm | null>(null);
  const dSearch = useDebounced(search, 300);

  const settings = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'admission', 'settings'),
    queryFn: ({ signal }) => admission.settings(signal),
  });
  const settingsYear = settings.data?.year ?? new Date().getFullYear();
  // Default to the admission year from the settings until the user picks one.
  const yearValue = year ?? (settings.data?.year ? String(settings.data.year) : '');
  const classes = parseClassList(settings.data?.values.class_list);

  const [sortKey, order] = sort.split(':') as [AdmissionSort, 'asc' | 'desc'];
  const filters: Omit<AdmissionListParams, 'page' | 'limit'> = {
    status,
    cls,
    year: yearValue,
    search: dSearch,
    sort: sortKey,
    order,
  };
  const params: AdmissionListParams = { ...filters, page, limit };
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'admission', 'forms', params),
    queryFn: ({ signal }) => admission.forms(params, signal),
    placeholderData: keepPreviousData,
    enabled: !settings.isPending,
  });
  const meta = q.data?.meta;
  const filtersActive = !!(search.trim() || status.length || cls);
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };

  const setFormStatus = useAdminMutation({
    mutationFn: async (v: { form: AdmissionForm; status: AdmissionStatus }) => {
      await admission.setStatus(v.form.id, v.status);
      return v.status;
    },
    invalidate: [['admission', 'forms']],
    success: (s) => (s === 'approved' ? 'Admission approved' : 'Marked as pending'),
    failure: 'Failed to update status',
    onSuccess: (s) => setDetail((d) => (d ? { ...d, status: s } : d)),
  });
  const remove = useAdminMutation({
    mutationFn: (id: string) => admission.removeForm(id),
    invalidate: [['admission', 'forms']],
    success: 'Admission deleted',
    failure: 'Failed to delete admission',
    onSuccess: () => {
      setDeleteTarget(null);
      setDetail(null);
    },
  });

  const pdfName = (a: AdmissionForm) => pdfFileName(['admission', a.name, a.userId]);
  const previewPdf = (a: AdmissionForm) =>
    files.pdf(`pdf-${a.id}`, () => admission.pdf(a.id), pdfName(a), 'Failed to open PDF');
  const downloadPdf = (a: AdmissionForm) =>
    files.save(
      `dl-${a.id}`,
      () => admission.pdf(a.id),
      pdfName(a),
      'application/pdf',
      'Failed to download PDF',
    );
  const exportFile = (kind: 'sheet' | 'photos') =>
    kind === 'sheet'
      ? files.save(
          'sheet',
          () => admission.exportExcel(filters),
          datedName('admissions_export_', 'xlsx'),
          XLSX_MIME,
          'Failed to export excel sheet',
        )
      : files.save(
          'photos',
          () => admission.exportPhotos(filters),
          `admission_images_${yearValue || 'all'}.zip`,
          ZIP_MIME,
          'Failed to export photos',
        );

  const toggle = (a: AdmissionForm) =>
    setFormStatus.mutate({ form: a, status: a.status === 'pending' ? 'approved' : 'pending' });
  const actions = (a: AdmissionForm) => (
    <View className="flex-row gap-0.5">
      <ActionButton icon={Eye} label={`View ${a.name}`} tone="blue" onPress={() => setDetail(a)} />
      <ActionButton
        icon={FileText}
        label={`Preview PDF of ${a.name}`}
        tone="blue"
        onPress={() => previewPdf(a)}
      />
      <ActionButton
        icon={Download}
        label={`Download PDF of ${a.name}`}
        tone="blue"
        onPress={() => downloadPdf(a)}
      />
      <ActionButton
        icon={a.status === 'pending' ? CheckCircle2 : Clock}
        label={a.status === 'pending' ? `Approve ${a.name}` : `Mark ${a.name} as pending`}
        tone="emerald"
        onPress={() => toggle(a)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete ${a.name}`}
        tone="red"
        onPress={() => setDeleteTarget(a)}
      />
    </View>
  );
  const student = (a: AdmissionForm) => {
    const photo = fileUrl(a.photo);
    return (
      <View className="flex-row items-center gap-3">
        {photo ? (
          <Image source={{ uri: photo }} className="bg-muted h-9 w-9 rounded-full" />
        ) : (
          <View className="bg-primary/10 h-9 w-9 items-center justify-center rounded-full">
            <Text size="sm" weight="semibold" className="text-primary">
              {(a.name || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text size="sm" weight="medium" numberOfLines={1}>
            {a.name || 'Unnamed'}
          </Text>
          {a.nameBn ? (
            <Text size="xs" color="mutedForeground" numberOfLines={1}>
              {a.nameBn}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };
  const statusKind = (s: string) => (s === 'approved' ? 'approved' : 'pending');
  const columns: Column<AdmissionForm>[] = [
    {
      key: 'student',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: student,
    },
    {
      key: 'class',
      label: 'Class',
      sortKey: 'class',
      className: 'w-24',
      render: (a) => <Text size="sm">{a.cls || '—'}</Text>,
    },
    {
      key: 'user',
      label: 'User ID',
      sortKey: 'userId',
      className: 'w-32',
      render: (a) => (
        <Text size="sm" className="font-mono">
          {a.userId || '—'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortKey: 'status',
      className: 'w-28',
      render: (a) => <StatusBadge status={statusKind(a.status)} />,
    },
    {
      key: 'date',
      label: 'Submitted',
      sortKey: 'date',
      className: 'w-32',
      render: (a) => (
        <Text size="sm" color="mutedForeground" tabular>
          {dateTimeOf(a.submitted)}
        </Text>
      ),
    },
    { key: 'actions', label: ' ', className: 'w-[150px]', align: 'right', render: actions },
  ];

  const summary = meta
    ? [
        plural(meta.pending + meta.approved, 'application'),
        meta.pending ? `${meta.pending.toLocaleString()} pending` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Loading…';

  return (
    <PageLayout
      title="Admissions"
      description={summary}
      titleAccessory={
        <Select
          label="Admission year"
          size="sm"
          value={yearValue}
          options={[
            { value: '', label: 'All years' },
            ...yearsFrom(settingsYear).map((y) => ({ value: String(y), label: String(y) })),
          ]}
          onChange={reset((v: string) => setYear(v))}
          testID="admission-year"
        />
      }
      actions={
        <View className="flex-row gap-2">
          <Button
            variant="outline"
            icon={Download}
            label={
              files.busy === 'sheet'
                ? 'Preparing…'
                : filtersActive
                  ? 'Excel sheet (current filters)'
                  : 'Excel sheet (all)'
            }
            onPress={() => exportFile('sheet')}
            disabled={!!files.busy}
            testID="admission-export-sheet"
          />
          <Button
            variant="outline"
            icon={Download}
            label={
              files.busy === 'photos'
                ? 'Preparing…'
                : filtersActive
                  ? 'Photos (current filters)'
                  : 'Photos (all)'
            }
            onPress={() => exportFile('photos')}
            disabled={!!files.busy}
          />
        </View>
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="min-w-[220px] flex-1">
          <SearchInput
            value={search}
            onChangeText={reset(setSearch)}
            placeholder="Search name, user ID, phone…"
            label="Search admissions"
            testID="admission-search"
          />
        </View>
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
          testID="admission-status"
        />
        <Select
          label="Class"
          size="sm"
          value={cls}
          options={[
            { value: '', label: 'All classes' },
            ...classes.map((c) => ({ value: c, label: c })),
          ]}
          onChange={reset(setCls)}
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
              setCls('');
              setPage(1);
            }}
          />
        ) : null}
      </View>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load admissions"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="admissions"
            sort={parseSortValue(sort, SORT_KEYS)}
            onSort={(next) => reset(setSort)(headerSortValue(next, sort, 'date:desc'))}
            rows={q.data?.rows ?? []}
            columns={columns}
            rowKey={(a) => a.id}
            loading={q.isPending}
            empty={
              filtersActive
                ? 'No applications match these filters.'
                : `No admission applications${yearValue ? ` for ${yearValue}` : ''} yet.`
            }
            onRowPress={setDetail}
            renderMobile={(a) => (
              <View className="gap-2">
                {student(a)}
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center gap-2">
                    <StatusBadge status={statusKind(a.status)} />
                    <Text size="xs" color="mutedForeground" tabular>
                      {[a.cls, a.userId, dateTimeOf(a.submitted)].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  {actions(a)}
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
        title={detail?.name || 'Application'}
        description={
          detail
            ? [detail.cls, detail.userId, dateTimeOf(detail.submitted)].filter(Boolean).join(' · ')
            : undefined
        }
        size="xl"
        testID="admission-detail"
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
              {detail.status === 'pending' ? (
                <Button
                  icon={CheckCircle2}
                  label={setFormStatus.isPending ? 'Saving…' : 'Approve'}
                  onPress={() => toggle(detail)}
                  disabled={setFormStatus.isPending}
                />
              ) : (
                <Button
                  variant="outline"
                  icon={Clock}
                  label={setFormStatus.isPending ? 'Saving…' : 'Mark as pending'}
                  onPress={() => toggle(detail)}
                  disabled={setFormStatus.isPending}
                />
              )}
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
            {admissionSections(detail.fields).map(([title, items]) =>
              items.some(([, v]) => v) ? (
                <View key={title} className="gap-2">
                  <Text size="sm" weight="semibold">
                    {title}
                  </Text>
                  <DetailGrid items={items} />
                </View>
              ) : null,
            )}
          </>
        ) : null}
      </Dialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete admission?"
        message={`Delete the admission application for ${deleteTarget?.name || 'this student'}? This cannot be undone.`}
        confirmLabel="Delete admission"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}
