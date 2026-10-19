/**
 * The admin list table used across the web dashboard (StudentList, TeacherList, Notice,
 * Holidays...): SectionCard noPadding, `bg-muted` header with `text-xs font-semibold uppercase
 * tracking-wider text-foreground/70` labels, `divide-y` body rows with `px-4 py-2` cells and a
 * `hover:bg-muted/60` tint. Phones (< md) get stacked rows from `renderMobile` instead of a
 * sideways-scrolling table. Columns with a `sortKey` get a clickable header (the web's
 * ColumnHeaderMenu sort arrow: unsorted → ascending → descending → unsorted).
 */
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { ArrowDown, ArrowUp, ChevronsUpDown } from './icons';
import { SectionCard } from './SectionCard';
import { EmptyState, Skeleton } from './states';
import { nextSort, type TableSort } from './table-sort';
import { Text } from './Text';

export interface Column<T> {
  key: string;
  label: string;
  /** Width classes, e.g. `w-32` or `min-w-0 flex-1`. */
  className: string;
  align?: 'left' | 'right';
  /** Makes the header a sort toggle (needs the table's `onSort`). */
  sortKey?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  renderMobile,
  onRowPress,
  sort,
  onSort,
  testID,
}: {
  rows: readonly T[];
  columns: readonly Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  /** Shown instead of rows when not loading and `rows` is empty. */
  empty: ReactNode | string;
  renderMobile: (row: T) => ReactNode;
  onRowPress?: (row: T) => void;
  /** Current header sort; `onSort` receives the next one (null = unsorted). */
  sort?: TableSort | null;
  onSort?: (next: TableSort | null) => void;
  testID?: string;
}) {
  const mobile = useBreakpoint() === 'mobile';
  const body =
    !loading && rows.length === 0 ? (
      typeof empty === 'string' ? (
        <EmptyState message={empty} />
      ) : (
        empty
      )
    ) : loading ? (
      Array.from({ length: mobile ? 6 : 8 }, (_, i) => (
        <View key={i} className={cn('px-4 py-2.5', (i > 0 || !mobile) && 'border-border border-t')}>
          <Skeleton height={32} />
        </View>
      ))
    ) : mobile ? (
      rows.map((r, i) => (
        <Pressable
          key={rowKey(r)}
          testID={testID ? `${testID}-card` : undefined}
          disabled={!onRowPress}
          onPress={onRowPress ? () => onRowPress(r) : undefined}
          className={cn('active:bg-muted/60 px-4 py-3', i > 0 && 'border-border border-t')}
        >
          {renderMobile(r)}
        </Pressable>
      ))
    ) : (
      rows.map((r) => (
        <View
          key={rowKey(r)}
          testID={testID ? `${testID}-row` : undefined}
          className="border-border bg-card hover:bg-muted/60 flex-row items-center border-t"
        >
          {columns.map((c) => (
            <View
              key={c.key}
              className={cn('px-4 py-2', c.className, c.align === 'right' && 'items-end')}
            >
              {c.render(r)}
            </View>
          ))}
        </View>
      ))
    );

  return (
    <SectionCard noPadding testID={testID}>
      {mobile ? null : (
        <View className="bg-muted flex-row items-center">
          {columns.map((c) => (
            <View
              key={c.key}
              className={cn('px-4 py-2.5', c.className, c.align === 'right' && 'items-end')}
            >
              {c.sortKey && onSort ? (
                <SortHeader
                  label={c.label}
                  order={sort?.key === c.sortKey ? sort.order : null}
                  onPress={() => onSort(nextSort(sort ?? null, c.sortKey!))}
                  testID={testID ? `${testID}-sort-${c.sortKey}` : undefined}
                />
              ) : (
                <Text size="xs" weight="semibold" caps className="text-foreground/70">
                  {c.label}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
      {body}
    </SectionCard>
  );
}

function SortHeader({
  label,
  order,
  onPress,
  testID,
}: {
  label: string;
  order: 'asc' | 'desc' | null;
  onPress: () => void;
  testID?: string;
}) {
  const state = order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : 'not sorted';
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${state}. Sort`}
      className="hover:bg-background -mx-1.5 flex-row items-center gap-1 self-start rounded px-1.5 py-0.5"
    >
      <Text
        size="xs"
        weight="semibold"
        caps
        className={order ? 'text-foreground' : 'text-foreground/70'}
      >
        {label}
      </Text>
      <Icon
        icon={order === 'asc' ? ArrowUp : order === 'desc' ? ArrowDown : ChevronsUpDown}
        size={12}
        color={order ? 'foreground' : 'mutedForeground'}
      />
    </Pressable>
  );
}
