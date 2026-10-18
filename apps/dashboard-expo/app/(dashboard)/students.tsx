/**
 * Student List, replicating dashboard/src/pages/Admin/StudentList.tsx: title with Session
 * selector, "N students" summary, More / Add student actions, and a SectionCard table
 * (muted header, uppercase tracking-wider labels, 28x36 photo/initial, name + father's name).
 * Phones get stacked rows instead of a sideways-scrolling table (Expo-only).
 * Live data: GET /api/students for the current session year, server-side search, 50 per page.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Pencil,
  Plus,
  Search,
} from '@/components/ui/icons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import type { StudentRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const SESSION = new Date().getFullYear();
const PAGE_SIZE = 50;
// Column widths shared by the header and body rows.
const W = {
  student: 'min-w-0 flex-1',
  roll: 'w-24',
  class: 'w-32',
  section: 'w-32',
  actions: 'w-[88px]',
};
const COLUMNS: { label: string; width: string }[] = [
  { label: 'Student', width: W.student },
  { label: 'Roll', width: W.roll },
  { label: 'Class', width: W.class },
  { label: 'Section', width: W.section },
  { label: 'Actions', width: W.actions },
];

const TD = 'px-4 py-2';
const M_ROW = 'flex-row items-center gap-3 px-4 py-2.5';

function Avatar({ name }: { name: string }) {
  return (
    <View className="bg-muted h-9 w-7 items-center justify-center rounded">
      <Text size="xs" weight="semibold" color="mutedForeground">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function StudentCell({ s }: { s: StudentRow }) {
  return (
    <View className="flex-row items-center gap-3">
      <Avatar name={s.name} />
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

function Row({ s }: { s: StudentRow }) {
  return (
    <Pressable className="border-border bg-card hover:bg-muted/60 flex-row items-center border-t">
      <View className={cn(TD, W.student)}>
        <StudentCell s={s} />
      </View>
      <View className={cn(TD, W.roll)}>
        <Text size="sm" tabular>
          {s.roll}
        </Text>
      </View>
      <View className={cn(TD, W.class)}>
        <Text size="sm" tabular>
          {s.class}
        </Text>
      </View>
      <View className={cn(TD, W.section)}>
        <Text size="sm">{s.section}</Text>
      </View>
      <View className={cn(TD, W.actions, 'flex-row justify-end gap-0.5')}>
        <ActionButton icon={Pencil} label="Edit" tone="emerald" />
        <ActionButton icon={Eye} label="View" tone="blue" />
      </View>
    </Pressable>
  );
}

function Table({ rows, loading }: { rows: readonly StudentRow[]; loading?: boolean }) {
  return (
    <View testID="students-table">
      <View className="bg-muted flex-row items-center">
        {COLUMNS.map((c) => (
          <View key={c.label} className={cn('px-4 py-2.5', c.width)}>
            <Text size="xs" weight="semibold" caps className="text-foreground/70">
              {c.label === 'Actions' ? ' ' : c.label}
            </Text>
          </View>
        ))}
      </View>
      {loading
        ? Array.from({ length: 8 }, (_, i) => (
            <View key={i} testID="student-skeleton" className={cn(TD, 'border-border border-t')}>
              <Skeleton height={32} />
            </View>
          ))
        : rows.map((s) => <Row key={s.enrollment_id ?? s.id} s={s} />)}
    </View>
  );
}

function MobileList({ rows, loading }: { rows: readonly StudentRow[]; loading?: boolean }) {
  return (
    <View testID="students-cards">
      {loading
        ? Array.from({ length: 6 }, (_, i) => (
            <View key={i} className={cn(M_ROW, i > 0 && 'border-border border-t')}>
              <Skeleton height={36} />
            </View>
          ))
        : rows.map((s, i) => (
            <View
              key={s.enrollment_id ?? s.id}
              testID="student-card"
              className={cn(M_ROW, i > 0 && 'border-border border-t')}
            >
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
          ))}
    </View>
  );
}

function SessionSelect() {
  return (
    <View
      accessibilityLabel="Session year"
      className="border-input h-8 flex-row items-center gap-2 rounded-md border px-2"
    >
      <Text size="sm" weight="medium">
        Session {SESSION}
      </Text>
      <Icon icon={ChevronDown} size={16} color="mutedForeground" />
    </View>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function StudentsScreen() {
  const mobile = useBreakpoint() === 'mobile';
  const { students } = useApi();
  const { resolution } = useTenant();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(query.trim(), 300);

  useEffect(() => setPage(1), [search]);

  const list = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'students', { year: SESSION, search, page }),
    queryFn: ({ signal }) =>
      students.list({ year: SESSION, page, limit: PAGE_SIZE, search: search || undefined }, signal),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const rows = list.data?.rows ?? [];
  const meta = list.data?.meta;
  const loading = list.isPending;
  const summary = !meta
    ? 'Loading…'
    : search
      ? `${meta.filtered} of ${meta.total} students`
      : `${meta.total} students`;

  return (
    <PageLayout
      title="Student List"
      titleAccessory={<SessionSelect />}
      description={summary}
      actions={
        <>
          <Button variant="outline" label="More" icon={ChevronDown} iconPosition="end" disabled />
          <Button label="Add student" icon={Plus} disabled />
        </>
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
          <View className="max-w-[420px] justify-center">
            <View className="absolute left-3 z-[1]" pointerEvents="none">
              <Icon icon={Search} size={16} color="mutedForeground" />
            </View>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, father's name or roll"
              accessibilityLabel="Search students"
              testID="student-search"
              className="pl-9"
            />
          </View>
          <SectionCard noPadding>
            {!loading && rows.length === 0 ? (
              <EmptyState
                message={
                  search
                    ? `No students match “${search}”.`
                    : `No students in session ${SESSION} yet.`
                }
              />
            ) : mobile ? (
              <MobileList rows={rows} loading={loading} />
            ) : (
              <Table rows={rows} loading={loading} />
            )}
          </SectionCard>
          {meta && meta.totalPages > 1 ? (
            <View className="flex-row items-center justify-end gap-2">
              <Text size="sm" color="mutedForeground" tabular>
                Page {meta.page} of {meta.totalPages}
              </Text>
              <Button
                variant="outline"
                size="icon-sm"
                icon={ChevronLeft}
                accessibilityLabel="Previous page"
                disabled={page <= 1 || list.isFetching}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              />
              <Button
                variant="outline"
                size="icon-sm"
                icon={ChevronRight}
                accessibilityLabel="Next page"
                disabled={page >= meta.totalPages || list.isFetching}
                onPress={() => setPage((p) => p + 1)}
              />
            </View>
          ) : null}
        </>
      )}
    </PageLayout>
  );
}
