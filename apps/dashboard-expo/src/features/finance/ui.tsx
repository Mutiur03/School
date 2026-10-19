/** Small shared pieces for the fee and accounts pages (web Accounts/ui.tsx). */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { DateInput } from '@/components/ui/DateInput';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { CLASSES, feeYears } from '@/features/fees/model';
import { formatMoney, sanitizeMoneyText, type Paisa } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import type { FontSize, FontWeight } from '@/theme/tokens';

/** Amount in BD grouping; negatives in red (web <Money>). */
export function Money({
  value,
  size = 'sm',
  weight,
  className,
  blankZero,
}: {
  value: Paisa;
  size?: FontSize;
  weight?: FontWeight;
  className?: string;
  /** Render nothing for 0 (debit/credit columns). */
  blankZero?: boolean;
}) {
  if (blankZero && value === 0) return null;
  return (
    <Text
      size={size}
      weight={weight}
      tabular
      numberOfLines={1}
      color={value < 0 ? 'destructive' : undefined}
      className={className}
    >
      {formatMoney(value)}
    </Text>
  );
}

/** Small muted label above a filter control (web `text-xs font-medium text-muted-foreground`). */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('gap-1', className)}>
      <Text size="xs" weight="medium" color="mutedForeground">
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Filters({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap items-end gap-3">{children}</View>;
}

export function LabeledSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className = 'w-36',
  placeholder,
  disabled,
  testID,
}: {
  label: string;
  value: T | null | undefined;
  options: readonly SelectOption<T>[];
  onChange: (v: T) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}) {
  return (
    <FilterField label={label} className={className}>
      <Select
        label={label}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        testID={testID}
      />
    </FilterField>
  );
}

export function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  return (
    <LabeledSelect
      label="Session"
      value={value}
      onChange={onChange}
      className="w-28"
      options={feeYears().map((y) => ({ value: y, label: String(y) }))}
      testID="fee-year"
    />
  );
}

/** 0 = none / all. */
export function ClassSelect({
  value,
  onChange,
  allowAll,
  testID = 'fee-class',
}: {
  value: number;
  onChange: (c: number) => void;
  allowAll?: boolean;
  testID?: string;
}) {
  return (
    <LabeledSelect
      label="Class"
      value={value}
      onChange={onChange}
      className="w-28"
      options={[
        { value: 0, label: allowAll ? 'All classes' : 'Select' },
        ...CLASSES.map((c) => ({ value: c, label: String(c) })),
      ]}
      testID={testID}
    />
  );
}

export function DateField({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID?: string;
}) {
  return (
    <FilterField label={label} className="w-40">
      <DateInput label={label} value={value} onChange={onChange} testID={testID} />
    </FilterField>
  );
}

/** Amount text field: digits, one point, commas; decimal keypad; right-aligned. */
export function MoneyInput({
  value,
  onChange,
  label,
  allowNegative,
  invalid,
  placeholder = '0.00',
  className,
  testID,
  editable,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  allowNegative?: boolean;
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  testID?: string;
  editable?: boolean;
}) {
  return (
    <Input
      value={value}
      onChangeText={(t) => onChange(sanitizeMoneyText(t, allowNegative))}
      keyboardType={allowNegative ? 'numbers-and-punctuation' : 'decimal-pad'}
      inputMode="decimal"
      accessibilityLabel={label}
      placeholder={placeholder}
      testID={testID}
      editable={editable}
      invalid={invalid}
      stateIcon={false}
      className={cn('text-right tabular-nums', className)}
    />
  );
}

/** Totals row under a table (the web tables' <tfoot>). */
export function TotalBar({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      className="border-border bg-muted/40 -mt-4 flex-row flex-wrap items-center justify-between gap-3 rounded-b-xl border border-t-0 px-4 py-2.5"
    >
      {children}
    </View>
  );
}

/** Coloured pill used for fee status and voucher types. */
export function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'emerald' | 'sky' | 'amber' | 'red' | 'violet' | 'gray';
}) {
  const box = {
    emerald: 'bg-emerald-500/15',
    sky: 'bg-sky-500/15',
    amber: 'bg-amber-500/15',
    red: 'bg-red-500/15',
    violet: 'bg-violet-500/15',
    gray: 'bg-muted',
  }[tone];
  const text = {
    emerald: 'text-emerald-700',
    sky: 'text-sky-700',
    amber: 'text-amber-700',
    red: 'text-red-700',
    violet: 'text-violet-700',
    gray: 'text-muted-foreground',
  }[tone];
  return (
    <View className={cn('self-start rounded-full px-2 py-0.5', box)}>
      <Text size="xs" weight="medium" className={cn('capitalize', text)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
