/**
 * The web Holidays page's month calendar: month stepper, a 7-column grid with holiday days in
 * red (optional ones amber), today outlined, and a date press listing that day's holidays.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Dialog } from '@/components/ui/Dialog';
import { Icon } from '@/components/ui/Icon';
import { CalendarDays } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { MonthStepper } from '@/features/student/components';
import { calendarCells, formatDate, MONTHS, WEEKDAYS } from '@/features/student/format';
import type { Holiday } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatRange, holidayDaysInMonth, holidaysOn } from './model';

export function HolidayCalendar({
  holidays,
  year,
  today,
  onYear,
}: {
  holidays: readonly Holiday[];
  year: number;
  today: string;
  /** Stepping past Dec / Jan moves the page's year selector too. */
  onYear: (year: number) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getFullYear() === year ? now.getMonth() : 0);
  const [picked, setPicked] = useState<string | null>(null);
  const days = useMemo(() => holidayDaysInMonth(holidays, year, month), [holidays, year, month]);
  const cells = calendarCells(year, month);
  const pickedList = picked ? holidaysOn(holidays, picked) : [];

  const step = (delta: number) => {
    const m = month + delta;
    if (m < 0) {
      setMonth(11);
      onYear(year - 1);
    } else if (m > 11) {
      setMonth(0);
      onYear(year + 1);
    } else setMonth(m);
  };

  return (
    <SectionCard
      title="Calendar"
      description={`${days.size} holiday ${days.size === 1 ? 'day' : 'days'} in ${MONTHS[month]}`}
      icon={<Icon icon={CalendarDays} size={20} color="primary" />}
      testID="holiday-calendar"
    >
      <View className="mb-3 flex-row justify-end">
        <MonthStepper month={month} year={year} onStep={step} />
      </View>
      <View className="border-border overflow-hidden rounded-xl border">
        <View className="border-border bg-muted/40 flex-row border-b">
          {WEEKDAYS.map((d) => (
            <View key={d} className="flex-1 items-center py-2">
              <Text
                size="xs"
                weight="semibold"
                caps
                color="mutedForeground"
                className="text-[11px]"
              >
                {d}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap p-2">
          {cells.map((cell, i) => {
            if (!cell) return <View key={`e${i}`} className="h-11 w-[14.2857%]" />;
            const on = days.has(cell.date);
            const optional = on && holidaysOn(holidays, cell.date).every((h) => h.is_optional);
            return (
              <View key={cell.date} className="w-[14.2857%] p-0.5">
                <Pressable
                  onPress={() => setPicked(cell.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.day} ${MONTHS[month]}${on ? ': holiday' : ''}`}
                  testID={`holiday-cal-${cell.day}`}
                  className={cn(
                    'h-11 items-center justify-center rounded-md border hover:opacity-80',
                    on
                      ? optional
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-red-200 bg-red-50'
                      : 'border-border/60 bg-background',
                    cell.date === today && 'border-primary border-2',
                  )}
                >
                  <Text
                    size="sm"
                    weight={on ? 'semibold' : 'regular'}
                    tabular
                    className={
                      on ? (optional ? 'text-amber-700' : 'text-red-700') : 'text-foreground'
                    }
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
      <View className="mt-3 flex-row flex-wrap gap-4">
        <Legend dot="bg-red-500" label="Holiday" />
        <Legend dot="bg-amber-500" label="Optional" />
      </View>

      <Dialog
        open={picked !== null}
        onClose={() => setPicked(null)}
        title={picked ? formatDate(picked) : ''}
        testID="holiday-day"
      >
        {pickedList.length === 0 ? (
          <Text size="sm" color="mutedForeground">
            No holiday on this date.
          </Text>
        ) : (
          <View className="gap-3">
            {pickedList.map((h) => (
              <View key={h.id} className="border-border rounded-lg border p-3">
                <Text size="sm" weight="semibold">
                  {h.title}
                </Text>
                <Text size="xs" color="mutedForeground" tabular>
                  {formatRange(h)}
                  {h.is_optional ? ' · Optional' : ''}
                </Text>
                {h.description ? (
                  <Text size="sm" className="mt-1">
                    {h.description}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Dialog>
    </SectionCard>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('h-2 w-2 rounded-full', dot)} />
      <Text size="xs" color="mutedForeground">
        {label}
      </Text>
    </View>
  );
}
