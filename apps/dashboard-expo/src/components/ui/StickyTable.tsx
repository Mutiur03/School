/**
 * Scroll frame for wide tables: the header row and the first columns stay put while the rest
 * scrolls both ways (web: one `overflow: auto` box + CSS `position: sticky`; native keeps the
 * plain horizontal scroll, where sticky cells are not available).
 *
 * Rows must be `items-stretch` with the vertical padding on the cells (not the row), so a frozen
 * cell covers the full row height and nothing shows through above or below it.
 *
 * Usage: wrap the table; give the header row `stickyHeader`, and every cell of a frozen column
 * `stickyCell(left)` (`left` = total width of the frozen columns before it). Frozen cells need an
 * opaque background (`bg-muted` in the header, `bg-card` in rows).
 */
import type { ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { ScrollView } from './ScrollView';

const web = Platform.OS === 'web';
// react-native's ViewStyle has no `sticky` / `auto` / `max-content`; react-native-web passes them through.
const css = (s: Record<string, unknown>) => (web ? (s as ViewStyle) : undefined);

/** Header row: sticks to the top of the table frame. */
export const stickyHeader = css({ position: 'sticky', top: 0, zIndex: 3 });

/** Cell of a frozen column; `top` also set when it sits in the header row. */
export const stickyCell = (left: number, inHeader = false) =>
  css({ position: 'sticky', left, zIndex: inHeader ? 4 : 2 });

/** Cell of a frozen column on the right edge. */
export const stickyEnd = (inHeader = false) =>
  css({ position: 'sticky', right: 0, zIndex: inHeader ? 4 : 2 });

/** Hairline on the last frozen column so it reads as pinned while content slides under it. */
export const frozenEdge = css({ boxShadow: '1px 0 0 rgba(0,0,0,0.08)' });
export const frozenEdgeEnd = css({ boxShadow: '-1px 0 0 rgba(0,0,0,0.08)' });

export function StickyTable({
  children,
  maxHeight = '70vh',
  testID,
}: {
  children: ReactNode;
  /** Table frame height cap on web; rows beyond it scroll under the sticky header. */
  maxHeight?: string;
  testID?: string;
}) {
  if (!web) {
    return (
      <ScrollView horizontal contentContainerClassName="min-w-full" testID={testID}>
        <View className="flex-1">{children}</View>
      </ScrollView>
    );
  }
  return (
    <View testID={testID} style={css({ overflow: 'auto', maxHeight })}>
      <View style={css({ minWidth: '100%', width: 'max-content' })}>{children}</View>
    </View>
  );
}
