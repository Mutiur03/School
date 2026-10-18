/**
 * Student List, replicating dashboard/src/pages/Admin/StudentList.tsx: title with Session
 * selector, "N students" summary, More / Add student actions, and a SectionCard table
 * (muted header, uppercase tracking-wider labels, 28x36 photo/initial, name + father's name).
 * Phones get stacked rows instead of a sideways-scrolling table (Expo-only).
 * All rows are MOCK DATA. `?state=loading|empty|error` previews the page states.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronDown, Eye, Pencil, Plus, Search } from '@/components/ui/icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type DimensionValue } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { MockDataBadge, StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { MOCK_STUDENTS, type MockStudent } from '@/features/overview/mock-data';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useTheme } from '@/theme/ThemeProvider';
import { withAlpha } from '@/theme/tokens';

const SESSION = 2026;
const COLUMNS: { label: string; width?: DimensionValue }[] = [
  { label: 'Student' },
  { label: 'Roll', width: 96 },
  { label: 'Class', width: 128 },
  { label: 'Section', width: 128 },
  { label: 'Actions', width: 88 },
];

function Avatar({ name }: { name: string }) {
  const { colors, radii } = useTheme();
  return (
    <View style={[styles.avatar, { backgroundColor: colors.muted, borderRadius: radii.base }]}>
      <Text size="xs" weight="semibold" color="mutedForeground">
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function StudentCell({ s }: { s: MockStudent }) {
  return (
    <View style={styles.studentCell}>
      <Avatar name={s.name} />
      <View style={styles.flex}>
        <View style={styles.nameRow}>
          <Text size="sm" weight="medium" numberOfLines={1} style={styles.shrink}>
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

function Row({ s }: { s: MockStudent }) {
  const { colors } = useTheme();
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.tr,
        styles.trBody,
        {
          borderTopColor: colors.border,
          backgroundColor: hovered ? withAlpha(colors.muted, 0.6) : colors.card,
        },
      ]}
    >
      <View style={[styles.td, styles.flex]}>
        <StudentCell s={s} />
      </View>
      <View style={[styles.td, { width: 96 }]}>
        <Text size="sm" tabular>
          {s.roll}
        </Text>
      </View>
      <View style={[styles.td, { width: 128 }]}>
        <Text size="sm" tabular>
          {s.class}
        </Text>
      </View>
      <View style={[styles.td, { width: 128 }]}>
        <Text size="sm">{s.section}</Text>
      </View>
      <View style={[styles.td, styles.actions, { width: 88 }]}>
        <ActionButton icon={Pencil} label="Edit" tone="emerald" />
        <ActionButton icon={Eye} label="View" tone="blue" />
      </View>
    </Pressable>
  );
}

function Table({ rows, loading }: { rows: readonly MockStudent[]; loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <View testID="students-table">
      <View style={[styles.tr, { backgroundColor: colors.muted }]}>
        {COLUMNS.map((c) => (
          <View key={c.label} style={[styles.th, c.width ? { width: c.width } : styles.flex]}>
            <Text
              size="xs"
              weight="semibold"
              caps
              style={{ color: withAlpha(colors.foreground, 0.7) }}
            >
              {c.label === 'Actions' ? ' ' : c.label}
            </Text>
          </View>
        ))}
      </View>
      {loading
        ? Array.from({ length: 8 }, (_, i) => (
            <View key={i} style={[styles.trBody, styles.td, { borderTopColor: colors.border }]}>
              <Skeleton height={32} />
            </View>
          ))
        : rows.map((s) => <Row key={s.id} s={s} />)}
    </View>
  );
}

function MobileList({ rows, loading }: { rows: readonly MockStudent[]; loading?: boolean }) {
  const { colors } = useTheme();
  return (
    <View testID="students-cards">
      {loading
        ? Array.from({ length: 6 }, (_, i) => (
            <View
              key={i}
              style={[styles.mRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <Skeleton height={36} />
            </View>
          ))
        : rows.map((s, i) => (
            <View
              key={s.id}
              testID="student-card"
              style={[styles.mRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            >
              <View style={styles.flex}>
                <StudentCell s={s} />
              </View>
              <View style={styles.mMeta}>
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
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityLabel="Session year"
      style={[styles.select, { borderColor: colors.input, borderRadius: radii.md }]}
    >
      <Text size="sm" weight="medium">
        Session {SESSION}
      </Text>
      <Icon icon={ChevronDown} size={16} color="mutedForeground" />
    </View>
  );
}

export default function StudentsScreen() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const router = useRouter();
  const mobile = useBreakpoint() === 'mobile';
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    if (state === 'empty') return [];
    const q = query.trim().toLowerCase();
    return q
      ? MOCK_STUDENTS.filter(
          (s) =>
            s.name.toLowerCase().includes(q) ||
            String(s.roll) === q ||
            s.father_name.toLowerCase().includes(q),
        )
      : MOCK_STUDENTS;
  }, [query, state]);

  const loading = state === 'loading';
  const summary = `${query ? `${rows.length} of ` : ''}${MOCK_STUDENTS.length} students`;

  return (
    <PageLayout
      title="Student List"
      titleAccessory={<SessionSelect />}
      badge={<MockDataBadge />}
      description={state === 'empty' ? '0 students' : summary}
      actions={
        <>
          <Button variant="outline" label="More" icon={ChevronDown} iconPosition="end" disabled />
          <Button label="Add student" icon={Plus} disabled />
        </>
      }
    >
      {state === 'error' ? (
        <ErrorState
          title="Couldn't load students"
          message="Preview of the error state (MOCK DATA)."
          onRetry={() => router.setParams({ state: '' })}
        />
      ) : (
        <>
          <View style={styles.search}>
            <View style={styles.searchIcon} pointerEvents="none">
              <Icon icon={Search} size={16} color="mutedForeground" />
            </View>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, father's name or roll"
              accessibilityLabel="Search students"
              testID="student-search"
              style={styles.searchInput}
            />
          </View>
          <SectionCard noPadding>
            {!loading && rows.length === 0 ? (
              <EmptyState
                message={
                  query ? `No students match “${query}”.` : `No students in session ${SESSION} yet.`
                }
              />
            ) : mobile ? (
              <MobileList rows={rows} loading={loading} />
            ) : (
              <Table rows={rows} loading={loading} />
            )}
          </SectionCard>
        </>
      )}
    </PageLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  shrink: { flexShrink: 1 },
  tr: { flexDirection: 'row', alignItems: 'center' },
  trBody: { borderTopWidth: 1 },
  th: { paddingHorizontal: 16, paddingVertical: 10 },
  td: { paddingHorizontal: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },
  avatar: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  studentCell: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  mMeta: { alignItems: 'flex-end' },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 32,
    paddingHorizontal: 8,
    borderWidth: 1,
  },
  search: { maxWidth: 420, justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  searchInput: { paddingLeft: 36 },
});
