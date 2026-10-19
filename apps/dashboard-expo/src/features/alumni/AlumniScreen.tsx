/**
 * Alumni List, replicating dashboard/src/pages/Admin/AlumniList.tsx: "N alumni · M batches"
 * (or "X of N" when filtered), search by name / phone, Batch and District filters, sort, the
 * table (Student with photo + father's name + inactive badge, Batch, Phone, Address, DOB) with a
 * "View details" action, client pagination at 50 and the "Alumnus details" dialog.
 * Live data: GET /api/students/alumni (admin only, this school). Read-only.
 * Filters are single-select here (the web uses multi-select column menus).
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Eye } from '@/components/ui/icons';
import { Pagination } from '@/components/ui/Pagination';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import {
  alumniAddress,
  alumniFacets,
  alumniPhone,
  alumniSummary,
  alumniDefaultOrder,
  filterAlumni,
  type AlumniSort,
} from '@/features/alumni/model';
import { fileUrl } from '@/features/student/components';
import type { AlumnusRow } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const PAGE_SIZE = 50;

function Avatar({ a }: { a: AlumnusRow }) {
  const url = fileUrl(a.image);
  return url ? (
    <Image source={{ uri: url }} accessibilityLabel="" className="bg-muted h-9 w-7 rounded" />
  ) : (
    <View className="bg-muted h-9 w-7 items-center justify-center rounded">
      <Text size="xs" weight="semibold" color="mutedForeground">
        {a.name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function AlumnusCell({ a }: { a: AlumnusRow }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar a={a} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text size="sm" weight="medium" numberOfLines={1} className="shrink">
            {a.name}
          </Text>
          {a.available ? null : <StatusBadge status="inactive" />}
        </View>
        <Text size="xs" color="mutedForeground" numberOfLines={1}>
          {a.father_name ?? '—'}
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

export function AlumniScreen() {
  const { students } = useApi();
  const { resolution } = useTenant();
  const [query, setQuery] = useState('');
  const [batch, setBatch] = useState<string[]>([]);
  const [district, setDistrict] = useState<string[]>([]);
  const [sort, setSort] = useState<AlumniSort>('batch');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AlumnusRow | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'alumni'),
    queryFn: ({ signal }) => students.alumni(signal),
    staleTime: 60_000,
  });
  const all = useMemo(() => q.data ?? [], [q.data]);
  const facets = useMemo(() => alumniFacets(all), [all]);
  const rows = useMemo(
    () => filterAlumni(all, { search: query, batch, district, sort, order }),
    [all, query, batch, district, sort, order],
  );
  useEffect(() => setPage(1), [query, batch, district, sort, order]);
  const pickSort = (next: AlumniSort, dir = alumniDefaultOrder(next)) => {
    setSort(next);
    setOrder(dir);
  };
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const filtered = Boolean(query.trim() || batch.length || district.length);

  const columns: Column<AlumnusRow>[] = [
    {
      key: 'student',
      label: 'Student',
      sortKey: 'name',
      className: 'min-w-0 flex-1',
      render: (a) => <AlumnusCell a={a} />,
    },
    {
      key: 'batch',
      label: 'Batch',
      sortKey: 'batch',
      className: 'w-24',
      render: (a) => (
        <Text size="sm" tabular>
          {a.batch || '—'}
        </Text>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      className: 'w-36',
      render: (a) => (
        <Text size="sm" tabular>
          {alumniPhone(a) ?? '—'}
        </Text>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      sortKey: 'district',
      className: 'w-64',
      render: (a) => (
        <Text size="sm" color="mutedForeground" numberOfLines={1}>
          {alumniAddress(a) || '—'}
        </Text>
      ),
    },
    {
      key: 'dob',
      label: 'DOB',
      className: 'w-28',
      render: (a) => (
        <Text size="sm" tabular>
          {a.dob || '—'}
        </Text>
      ),
    },
    {
      key: 'actions',
      label: ' ',
      className: 'w-[56px]',
      align: 'right',
      render: (a) => (
        <ActionButton
          icon={Eye}
          label={`View details of ${a.name}`}
          tone="blue"
          onPress={() => setViewing(a)}
        />
      ),
    },
  ];

  return (
    <PageLayout
      title="Alumni List"
      description={
        q.isPending
          ? 'Loading…'
          : alumniSummary(all.length, rows.length, facets.batches.length, filtered)
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Failed to load alumni list."
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <>
          <View className="flex-row flex-wrap items-center gap-2">
            <View className="min-w-[240px] flex-1">
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or phone"
                label="Search alumni"
                testID="alumni-search"
              />
            </View>
            <MultiSelect
              label="Batch"
              allLabel="All batches"
              value={batch}
              onChange={setBatch}
              options={facets.batches.map((b) => ({ value: b, label: `Batch ${b}` }))}
              className="w-36"
              testID="alumni-batch"
            />
            <MultiSelect
              label="District"
              allLabel="All districts"
              value={district}
              onChange={setDistrict}
              options={facets.districts.map((d) => ({ value: d, label: d }))}
              className="w-40"
              testID="alumni-district"
            />
            <Select
              label="Sort"
              value={sort}
              onChange={(v) => pickSort(v)}
              options={[
                { value: 'batch', label: 'Sort: batch' },
                { value: 'name', label: 'Sort: name' },
                { value: 'district', label: 'Sort: district' },
              ]}
              className="w-40"
            />
          </View>
          <DataTable
            testID="alumni"
            sort={{ key: sort, order }}
            onSort={(next) =>
              next ? pickSort(next.key as AlumniSort, next.order) : pickSort('batch')
            }
            rows={pageRows}
            columns={columns}
            rowKey={(a) => a.id}
            loading={q.isPending}
            empty={filtered ? 'No alumni match these filters.' : 'No alumni yet.'}
            onRowPress={setViewing}
            renderMobile={(a) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1">
                  <AlumnusCell a={a} />
                </View>
                <View className="items-end">
                  <Text size="xs" color="mutedForeground" tabular>
                    Batch {a.batch || '—'}
                  </Text>
                  <Text size="sm" tabular>
                    {alumniPhone(a) ?? '—'}
                  </Text>
                </View>
              </View>
            )}
          />
          {rows.length > PAGE_SIZE ? (
            <Pagination page={page} totalPages={totalPages} onPage={setPage} />
          ) : null}
        </>
      )}

      <Dialog
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title="Alumnus details"
        description={viewing?.name}
        testID="alumnus-details"
        footer={<Button variant="outline" label="Close" onPress={() => setViewing(null)} />}
      >
        {viewing ? (
          <View className="flex-row flex-wrap gap-4">
            <Detail label="Login ID" value={viewing.login_id} />
            <Detail label="Batch" value={viewing.batch} />
            <Detail label="Father's name" value={viewing.father_name} />
            <Detail label="Mother's name" value={viewing.mother_name} />
            <Detail label="Father's phone" value={viewing.father_phone} />
            <Detail label="Mother's phone" value={viewing.mother_phone} />
            <Detail label="Date of birth" value={viewing.dob} />
            <Detail label="Religion" value={viewing.religion} />
            <Detail label="Stipend" value={viewing.has_stipend ? 'Yes' : 'No'} />
            <Detail label="Address" value={alumniAddress(viewing)} />
          </View>
        ) : null}
      </Dialog>
    </PageLayout>
  );
}
