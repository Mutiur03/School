/** Shared bits of the account report pages (web Accounts/ui.tsx YearSelect, Reports/AmountTable). */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { AlertTriangle, CheckCircle2, Download } from '@/components/ui/icons';
import { useToast } from '@/components/ui/Toast';
import type { CsvSheet } from '@/features/accounts/report-export';
import { saveCsv } from '@/lib/files/csv';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { amountGroups, pickedYear, reportYears } from '@/features/accounts/model';
import { LabeledSelect, Money } from '@/features/finance/ui';
import type { AccHead, AmountRow } from '@/lib/api';
import { formatMoney, type Paisa } from '@/lib/money/money';
import { cn } from '@/lib/utils';

/** Calendar-year shortcut: 1 Jan - 31 Dec; "Custom" when the dates are something else. */
export function ReportYearSelect({
  from,
  to,
  onPick,
}: {
  /** Omit for as-of reports that only have a `to` date. */
  from?: string;
  to: string;
  onPick: (from: string, to: string) => void;
}) {
  const years = reportYears();
  return (
    <LabeledSelect
      label="Year"
      value={pickedYear(from, to, years) ?? 0}
      className="w-28"
      onChange={(y) => (y ? onPick(`${y}-01-01`, `${y}-12-31`) : undefined)}
      options={[
        { value: 0, label: 'Custom' },
        ...years.map((y) => ({ value: y, label: String(y) })),
      ]}
    />
  );
}

function Line({
  label,
  value,
  strong,
  indent,
  muted,
  italic,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
  indent?: boolean;
  muted?: boolean;
  italic?: boolean;
}) {
  return (
    <View
      className={cn(
        'border-border flex-row items-center gap-3 border-t px-4 py-2',
        muted && 'bg-muted/30',
      )}
    >
      <Text
        size="sm"
        weight={strong ? 'semibold' : muted ? 'medium' : 'regular'}
        className={cn('min-w-0 flex-1', indent && 'pl-5', italic && 'italic')}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View className="w-40 items-end">{value}</View>
    </View>
  );
}

/** Amount list grouped under each row's parent head, with integer subtotals and a total. */
export function AmountTable({
  title,
  rows,
  total,
  byId,
  extra,
  testID,
}: {
  title: string;
  rows: readonly AmountRow[];
  total: Paisa;
  byId: ReadonlyMap<number, AccHead>;
  extra?: { label: string; value: Paisa };
  testID?: string;
}) {
  const groups = amountGroups(rows, byId);
  return (
    <SectionCard noPadding testID={testID}>
      <View className="bg-muted flex-row px-4 py-2">
        <Text size="xs" weight="semibold" caps className="text-foreground/70 min-w-0 flex-1">
          {title}
        </Text>
        <Text size="xs" weight="semibold" caps className="text-foreground/70 w-40 text-right">
          Amount
        </Text>
      </View>
      {rows.length === 0 && !extra ? (
        <Text size="sm" color="mutedForeground" className="px-4 py-8 text-center">
          Nothing to show.
        </Text>
      ) : null}
      {groups.map((g) => (
        <View key={g.parent?.id ?? 'top'}>
          {g.parent ? (
            <Line
              muted
              label={g.parent.name}
              value={<Money value={g.subtotal} weight="medium" />}
            />
          ) : null}
          {g.rows.map((r) => (
            <Line
              key={r.head_id}
              indent={!!g.parent}
              label={r.name}
              value={<Money value={r.amount} />}
            />
          ))}
        </View>
      ))}
      {extra ? <Line italic label={extra.label} value={<Money value={extra.value} />} /> : null}
      <Line
        strong
        label={`Total ${title.toLowerCase()}`}
        value={
          <Text size="sm" weight="semibold" tabular>
            {formatMoney(total)}
          </Text>
        }
      />
    </SectionCard>
  );
}

/** Green "balanced" / red "out of balance" strip. */
export function BalanceBanner({
  ok,
  children,
  testID,
}: {
  ok: boolean;
  children: ReactNode;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      className={cn(
        'flex-row items-center gap-2 rounded-xl border px-5 py-3',
        ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-destructive/40 bg-destructive/10',
      )}
    >
      <Icon
        icon={ok ? CheckCircle2 : AlertTriangle}
        size={16}
        color={ok ? 'chart2' : 'destructive'}
      />
      <Text
        size="sm"
        weight="medium"
        tabular
        className={ok ? 'text-emerald-700' : 'text-destructive'}
      >
        {children}
      </Text>
    </View>
  );
}

/** "Export" (the web's Excel button): writes the report as CSV, see lib/files/csv.ts. */
export function ExportCsvButton({ sheet }: { sheet: (() => CsvSheet) | null }) {
  const toast = useToast();
  return (
    <Button
      variant="outline"
      icon={Download}
      label="Export CSV"
      disabled={!sheet}
      testID="export-csv"
      onPress={() => {
        if (!sheet) return;
        const s = sheet();
        void saveCsv(s.fileName, s.headers, s.rows)
          .then((r) => {
            if (r === 'unavailable') toast.error('Saving files is not available on this device.');
          })
          .catch(() => toast.error('Could not save the file.'));
      }}
    />
  );
}
