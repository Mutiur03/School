/**
 * Certificates, replicating dashboard/src/pages/Admin/Certificates.tsx: the list of student
 * certificate requests with Student / Exam / Year / Mobile / Status / Edits filters, sort by last
 * updated, the history dialog (details, edit history with sensitive fields flagged, PDF with or
 * without the address, approve / unlock) and delete.
 * Live data: /api/admin/certificates (Nest, admin only, school from the session).
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { headerSortValue, parseSortValue, withSortOption } from '@/components/ui/table-sort';
import { Dialog } from '@/components/ui/Dialog';
import { Eye, FileText, Trash2, XIcon } from '@/components/ui/icons';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useDebounced } from '@/hooks/useDebounced';
import { pdfFileName } from '@/lib/files/pdf-name';
import type {
  CertificateParams,
  CertificateRecord,
  CertificateSort,
  CertificateStatus,
} from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import {
  CERTIFICATE_FIELDS,
  certificateSummary,
  dayOf,
  examLabel,
  fieldLabel,
  SENSITIVE_FIELDS,
} from './model';
import { DetailGrid, useFileTasks } from './ui';

type EditFilter = 'edited' | 'never';
const SORT_KEYS = ['name', 'exam', 'year', 'mobile', 'updated', 'edits'] as const;
const SORT_LABELS: Record<string, string> = {
  name: 'Name',
  exam: 'Exam',
  year: 'Year',
  mobile: 'Mobile',
  updated: 'Last updated',
  edits: 'Edits',
};
const SORTS: { value: string; label: string }[] = [
  { value: 'updated:desc', label: 'Last updated (newest)' },
  { value: 'updated:asc', label: 'Last updated (oldest)' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'year:desc', label: 'Year (newest)' },
  { value: 'edits:desc', label: 'Most edited' },
];

export function CertificatesScreen() {
  const { certificates } = useApi();
  const { resolution } = useTenant();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [exam, setExam] = useState<string[]>([]);
  const [year, setYear] = useState<string[]>([]);
  const [status, setStatus] = useState<CertificateStatus[]>([]);
  const [edits, setEdits] = useState<EditFilter[]>([]);
  const [sort, setSort] = useState('updated:desc');
  const [viewing, setViewing] = useState<CertificateRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CertificateRecord | null>(null);
  const dName = useDebounced(name, 300);
  const dMobile = useDebounced(mobile, 300);

  const [sortKey, order] = sort.split(':') as [CertificateSort, 'asc' | 'desc'];
  const params: CertificateParams = {
    page,
    limit,
    sort: sortKey,
    order,
    name: dName,
    mobile: dMobile,
    exam,
    year,
    status,
    edits,
  };
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'certificates', params),
    queryFn: ({ signal }) => certificates.list(params, signal),
    placeholderData: keepPreviousData,
  });
  const meta = q.data?.meta;
  const filtersActive = !!(
    name.trim() ||
    mobile.trim() ||
    exam.length ||
    year.length ||
    status.length ||
    edits.length
  );
  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const clear = () => {
    setName('');
    setMobile('');
    setExam([]);
    setYear([]);
    setStatus([]);
    setEdits([]);
    setPage(1);
  };

  const remove = useAdminMutation({
    mutationFn: (id: string) => certificates.remove(id),
    invalidate: [['certificates']],
    success: 'Certificate deleted',
    failure: 'Error deleting certificate',
    onSuccess: () => {
      setDeleteTarget(null);
      setViewing(null);
    },
  });

  const studentName = (r: CertificateRecord) =>
    r.data.student_name_en || r.data.student_name_bn || 'Unnamed student';
  const actions = (r: CertificateRecord) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={Eye}
        label={`View ${studentName(r)}`}
        tone="blue"
        onPress={() => setViewing(r)}
      />
      <ActionButton
        icon={Trash2}
        label={`Delete certificate of ${studentName(r)}`}
        tone="red"
        onPress={() => setDeleteTarget(r)}
      />
    </View>
  );
  const editsCell = (r: CertificateRecord) =>
    r.edits > 0 ? (
      <View className="flex-row items-center gap-1.5">
        <View className="h-2 w-2 rounded-full bg-amber-500" />
        <Text size="sm" tabular>
          {r.edits}
        </Text>
      </View>
    ) : (
      <Text size="sm" color="mutedForeground">
        —
      </Text>
    );
  const columns: Column<CertificateRecord>[] = [
    {
      key: 'student',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (r) => (
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/10 h-8 w-8 items-center justify-center rounded-full">
            <Text size="sm" weight="semibold" className="text-primary">
              {studentName(r).charAt(0).toUpperCase()}
            </Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text size="sm" weight="medium" numberOfLines={1}>
              {studentName(r)}
            </Text>
            {r.data.father_name_en ? (
              <Text size="xs" color="mutedForeground" numberOfLines={1}>
                {r.data.father_name_en}
              </Text>
            ) : null}
          </View>
        </View>
      ),
    },
    {
      key: 'exam',
      label: 'Exam',
      sortKey: 'exam',
      className: 'w-24',
      render: (r) => <Text size="sm">{examLabel(r.data.exam)}</Text>,
    },
    {
      key: 'year',
      label: 'Year',
      sortKey: 'year',
      className: 'w-20',
      render: (r) => (
        <Text size="sm" tabular>
          {r.data.passing_year ?? '—'}
        </Text>
      ),
    },
    {
      key: 'mobile',
      label: 'Mobile',
      sortKey: 'mobile',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" tabular>
          {r.data.mobile ?? '—'}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-28',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'updated',
      label: 'Last updated',
      sortKey: 'updated',
      className: 'w-32',
      render: (r) => (
        <Text size="sm" color="mutedForeground" tabular>
          {dayOf(r.updated_at)}
        </Text>
      ),
    },
    { key: 'edits', label: 'Edits', sortKey: 'edits', className: 'w-20', render: editsCell },
    { key: 'actions', label: ' ', className: 'w-[88px]', align: 'right', render: actions },
  ];

  const examOptions = (meta?.exams ?? []).map((e) => ({ value: e, label: examLabel(e) }));
  const yearOptions = (meta?.years ?? []).map((y) => ({ value: String(y), label: String(y) }));

  return (
    <PageLayout
      title="Certificates"
      description={certificateSummary(meta, filtersActive)}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      <View className="flex-row flex-wrap items-center gap-2">
        <View className="min-w-[200px] flex-1">
          <SearchInput
            value={name}
            onChangeText={reset(setName)}
            placeholder="Student name…"
            label="Search by student name"
            testID="cert-name"
          />
        </View>
        <View className="w-full sm:w-44">
          <SearchInput
            value={mobile}
            onChangeText={reset(setMobile)}
            placeholder="Mobile number"
            label="Search by mobile"
          />
        </View>
        <MultiSelect
          label="Exam"
          size="sm"
          value={exam}
          options={examOptions}
          onChange={reset(setExam)}
          allLabel="All exams"
          testID="cert-exam"
        />
        <MultiSelect
          label="Year"
          size="sm"
          value={year}
          options={yearOptions}
          onChange={reset(setYear)}
          allLabel="All years"
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
          testID="cert-status"
        />
        <MultiSelect
          label="Edits"
          size="sm"
          value={edits}
          options={[
            { value: 'edited', label: 'Edited' },
            { value: 'never', label: 'Never edited' },
          ]}
          onChange={reset(setEdits)}
          allLabel="Any edits"
        />
        <Select
          label="Sort"
          size="sm"
          value={sort}
          options={withSortOption(SORTS, sort, SORT_LABELS)}
          onChange={reset(setSort)}
        />
        {filtersActive ? (
          <Button variant="ghost" size="sm" icon={XIcon} label="Clear filters" onPress={clear} />
        ) : null}
      </View>
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load certificates"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <DataTable
            testID="certificates"
            sort={parseSortValue(sort, SORT_KEYS)}
            onSort={(next) => reset(setSort)(headerSortValue(next, sort, 'updated:desc'))}
            rows={q.data?.items ?? []}
            columns={columns}
            rowKey={(r) => r.id}
            loading={q.isPending}
            empty={
              filtersActive
                ? 'No certificates match these filters.'
                : 'No certificates have been generated yet.'
            }
            onRowPress={setViewing}
            renderMobile={(r) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text size="sm" weight="medium" numberOfLines={1}>
                    {studentName(r)}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {[examLabel(r.data.exam), r.data.passing_year, r.data.mobile]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <StatusBadge status={r.status} />
                    {r.edits > 0 ? (
                      <Text
                        size="xs"
                        className="text-amber-700"
                      >{`${r.edits} edit${r.edits === 1 ? '' : 's'}`}</Text>
                    ) : null}
                  </View>
                </View>
                {actions(r)}
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

      <CertificateDialog
        record={viewing}
        onClose={() => setViewing(null)}
        onDelete={(r) => setDeleteTarget(r)}
        onStatusChange={(s) => viewing && setViewing({ ...viewing, status: s })}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete certificate?"
        message={`Delete the certificate of ${deleteTarget ? studentName(deleteTarget) : 'this student'}? Its edit history is deleted too. This cannot be undone.`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
      />
    </PageLayout>
  );
}

function CertificateDialog({
  record,
  onClose,
  onDelete,
  onStatusChange,
}: {
  record: CertificateRecord | null;
  onClose: () => void;
  onDelete: (r: CertificateRecord) => void;
  onStatusChange: (s: CertificateStatus) => void;
}) {
  const { certificates } = useApi();
  const { resolution } = useTenant();
  const files = useFileTasks();
  const revisions = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'certificates', 'revisions', record?.id),
    queryFn: ({ signal }) => certificates.revisions(record!.id, signal),
    enabled: !!record,
  });
  const status = useAdminMutation({
    mutationFn: async (s: CertificateStatus) => {
      await certificates.setStatus(record!.id, s);
      return s;
    },
    invalidate: [['certificates']],
    success: (s) => (s === 'approved' ? 'Certificate approved' : 'Unlocked for editing'),
    failure: 'Failed to update status',
    onSuccess: (s) => onStatusChange(s),
  });
  if (!record) return null;
  const name = record.data.student_name_en || record.data.student_name_bn || 'Certificate';
  const pdf = (withAddress: boolean) =>
    files.pdf(
      withAddress ? 'addr' : 'plain',
      () => certificates.pdf(record.id, withAddress),
      pdfFileName(['certificate', name, record.data.passing_year]),
      'Failed to open certificate PDF',
    );
  return (
    <Dialog
      open
      onClose={onClose}
      title={name}
      description={`${examLabel(record.data.exam)} · ${record.data.passing_year ?? ''}`}
      size="lg"
      testID="certificate-dialog"
      footer={
        <>
          <Text size="xs" color="mutedForeground" className="mr-auto">
            {record.status === 'approved'
              ? 'Locked: the student cannot edit it.'
              : 'The student can still edit it.'}
          </Text>
          <Button variant="outline" icon={Trash2} label="Delete" onPress={() => onDelete(record)} />
          {record.status === 'approved' ? (
            <Button
              variant="outline"
              label={status.isPending ? 'Saving…' : 'Mark as pending (allow edit)'}
              onPress={() => status.mutate('pending')}
              disabled={status.isPending}
            />
          ) : (
            <Button
              label={status.isPending ? 'Saving…' : 'Approve'}
              onPress={() => status.mutate('approved')}
              disabled={status.isPending}
              testID="certificate-approve"
            />
          )}
        </>
      }
    >
      <View className="flex-row flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={FileText}
          label={files.busy === 'plain' ? 'Opening…' : 'Open certificate PDF'}
          onPress={() => pdf(false)}
          disabled={!!files.busy}
        />
        <Button
          variant="outline"
          size="sm"
          icon={FileText}
          label={files.busy === 'addr' ? 'Opening…' : 'Open with address (admin only)'}
          onPress={() => pdf(true)}
          disabled={!!files.busy}
        />
        <StatusBadge status={record.status} />
      </View>
      <Text size="sm" weight="semibold">
        Details
      </Text>
      <DetailGrid items={CERTIFICATE_FIELDS.map((f) => [fieldLabel(f), record.data[f]] as const)} />
      <Text size="sm" weight="semibold">
        Edit history
      </Text>
      {revisions.isPending ? (
        <Skeleton height={48} />
      ) : revisions.isError ? (
        <Text size="sm" color="destructive">
          Couldn't load the edit history.
        </Text>
      ) : revisions.data.length === 0 ? (
        <Text size="sm" color="mutedForeground">
          Not edited since it was created.
        </Text>
      ) : (
        <View className="gap-3">
          {revisions.data.map((rev) => (
            <View key={rev.id} className="border-border gap-1.5 rounded-lg border p-3">
              <Text size="xs" color="mutedForeground">
                {`Edited by student · ${dayOf(rev.created_at)}`}
              </Text>
              {rev.changes.map((c) => (
                <View key={c.field} className="flex-row flex-wrap items-center gap-x-2">
                  <Text size="sm" weight="medium">
                    {fieldLabel(c.field)}
                  </Text>
                  <Text size="sm" color="mutedForeground" className="line-through">
                    {c.from ?? '—'}
                  </Text>
                  <Text size="sm">{`→ ${c.to ?? '—'}`}</Text>
                  {SENSITIVE_FIELDS.has(c.field) ? (
                    <Text size="xs" weight="semibold" className="text-amber-700">
                      Review
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </Dialog>
  );
}
