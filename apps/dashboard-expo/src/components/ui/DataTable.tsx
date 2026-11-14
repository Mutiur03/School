/**
 * The admin list table used across the web dashboard (StudentList, TeacherList, Notice,
 * Holidays...): SectionCard noPadding, `bg-muted` header with `text-xs font-semibold uppercase
 * tracking-wider text-foreground/70` labels, `divide-y` body rows with `px-4 py-2` cells and a
 * `hover:bg-muted/60` tint. Phones (< md) get stacked rows from `renderMobile` instead of a
 * sideways-scrolling table; wide screens scroll sideways when the columns do not fit. Columns with a `sortKey` get a clickable header (the web's
 * ColumnHeaderMenu sort arrow: unsorted → ascending → descending → unsorted).
 */
import { useState, type ReactNode } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { Icon } from './Icon';
import { ScrollView } from './ScrollView';
import { ArrowDown, ArrowUp, ChevronsUpDown } from './icons';
import { SectionCard } from './SectionCard';
import { EmptyState, Skeleton } from './states';
import { nextSort, type TableSort } from './table-sort';
import { Text } from './Text';

export interface Column<T> {
  key: string;
  label: string;
  /** Custom header cell (e.g. a select-all checkbox) in place of the `label` text. */
  header?: ReactNode;
  /**
   * Width classes, e.g. `w-32` or `min-w-0 flex-1`. Growing columns share spare width by their
   * flex (`flex-[2]` takes twice a `flex-1`); `min-w-[Npx]` sets their floor (default 200px).
   */
  className: string;
  align?: 'left' | 'right';
  /** Makes the header a sort toggle (needs the table's `onSort`). */
  sortKey?: string;
  render: (row: T) => ReactNode;
}

/** A growing column keeps a readable minimum; the table scrolls sideways before it collapses. */
const FLEX_MIN = 200;
const grows = (className: string) => /(?:^|\s)flex-(?:1|\[\d+\])(?:\s|$)/.test(className);
const explicitMin = (className: string) => /(?:^|\s)min-w-\[(\d+)px\]/.exec(className);
const colClass = (c: { className: string }) =>
  grows(c.className) && !explicitMin(c.className) ? cn(c.className, 'min-w-[200px]') : c.className;

/** Smallest width a column needs, read from its width class (`w-32`, `w-[120px]`, `flex-1`). */
function colMin({ className }: { className: string }): number {
  const min = explicitMin(className);
  if (min && grows(className)) return Number(min[1]);
  const px = /(?:^|\s)w-\[(\d+)px\]/.exec(className);
  if (px) return Number(px[1]);
  const step = /(?:^|\s)w-(\d+)(?:\s|$)/.exec(className);
  if (step) return Number(step[1]) * 4;
  return grows(className) ? FLEX_MIN : 0;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  renderMobile,
  onRowPress,
  rowPressOnWide,
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
  /** Phone cards only, unless `rowPressOnWide` (most wide tables use per-row action buttons). */
  onRowPress?: (row: T) => void;
  /** Also make the whole row pressable on wide screens (web rows that link to a detail page). */
  rowPressOnWide?: boolean;
  /** Current header sort; `onSort` receives the next one (null = unsorted). */
  sort?: TableSort | null;
  onSort?: (next: TableSort | null) => void;
  testID?: string;
}) {
  const phone = useBreakpoint() === 'mobile';
  const [width, setWidth] = useState(0);
  const minWidth = columns.reduce((sum, c) => sum + colMin(c), 0);
  // Cards whenever the columns do not fit (phones, tablets, narrow windows next to the sidebar),
  // so the page never needs a sideways scroll; the table only when it fits.
  const mobile = phone || (width > 0 && width < minWidth);
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
        <Pressable
          key={rowKey(r)}
          testID={testID ? `${testID}-row` : undefined}
          disabled={!rowPressOnWide || !onRowPress}
          onPress={rowPressOnWide && onRowPress ? () => onRowPress(r) : undefined}
          className="border-border bg-card hover:bg-muted/60 flex-row items-center border-t"
        >
          {columns.map((c) => (
            <View
              key={c.key}
              className={cn('px-4 py-2', colClass(c), c.align === 'right' && 'items-end')}
            >
              {c.render(r)}
            </View>
          ))}
        </Pressable>
      ))
    );

  const table = (
    <>
      {mobile ? (
        // Cards keep the custom header cells (select-all) in a header bar, at the same spot as
        // the table header: top-left, above the row checkboxes.
        columns.some((c) => c.header) && rows.length > 0 ? (
          <View className="bg-muted flex-row items-center gap-3 px-4 py-2.5">
            {columns
              .filter((c) => c.header)
              .map((c) => (
                <View key={c.key}>{c.header}</View>
              ))}
            <Text size="xs" weight="semibold" caps className="text-foreground/70">
              Select all
            </Text>
          </View>
        ) : null
      ) : (
        <View className="bg-muted flex-row items-center">
          {columns.map((c) => (
            <View
              key={c.key}
              className={cn('px-4 py-2.5', colClass(c), c.align === 'right' && 'items-end')}
            >
              {c.header ? (
                c.header
              ) : c.sortKey && onSort ? (
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
    </>
  );

  return (
    <SectionCard noPadding testID={testID}>
      {phone ? (
        table
      ) : (
        // Measured on every wide layout (also while showing cards) to pick cards vs table.
        // The table gets a definite width so growing columns wrap instead of stretching.
        <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {mobile ? (
            table
          ) : (
            <ScrollView horizontal>
              <View style={{ width: Math.max(width, minWidth) }}>{table}</View>
            </ScrollView>
          )}
        </View>
      )}
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
