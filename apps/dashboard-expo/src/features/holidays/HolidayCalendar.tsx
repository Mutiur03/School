/**
 * The web Holidays page's month calendar: month stepper, a 7-column grid with holiday days in
 * red (optional ones amber), today outlined, and a date press listing that day's holidays.
 */
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Icon, type LucideIcon } from '@/components/ui/Icon';
import { ChevronLeft, ChevronRight, Pencil } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { formatDate, MONTHS } from '@/features/student/format';
import { useTheme } from '@/theme/ThemeProvider';
import type { Holiday } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatRange, holidayDaysInMonth, holidaysOn } from './model';

export function HolidayCalendar({
  holidays,
  year,
  today,
  onYear,
  onEdit,
}: {
  holidays: readonly Holiday[];
  year: number;
  today: string;
  /** Stepping past Dec / Jan moves the page's year selector too. */
  onYear: (year: number) => void;
  /** Edit button on each holiday in the date popup. */
  onEdit?: (holiday: Holiday) => void;
}) {
  const now = new Date();
  const [month, setMonth] = useState(now.getFullYear() === year ? now.getMonth() : 0);
  const [picked, setPicked] = useState<string | null>(null);
  const days = useMemo(() => holidayDaysInMonth(holidays, year, month), [holidays, year, month]);
  const { shadows } = useTheme();
  const cells = gridCells(year, month);
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
      description="Pick a date to see its holidays."
      testID="holiday-calendar"
    >
      {/* The web's Calendar: bordered arrows, centred month, 7-column grid, red holiday days. */}
      <View
        className="bg-card mx-auto w-full max-w-xs rounded-lg p-5"
        style={{ boxShadow: shadows.popover }}
      >
        <View className="flex-row items-center justify-between p-4">
          <StepButton icon={ChevronLeft} label="Previous month" onPress={() => step(-1)} />
          <Text weight="medium" testID="month-label">
            {MONTHS[month]} {year}
          </Text>
          <StepButton icon={ChevronRight} label="Next month" onPress={() => step(1)} />
        </View>
        <View className="flex-row">
          {SHORT_DAYS.map((d) => (
            <View key={d} className="flex-1 items-center py-2">
              <Text size="sm" weight="medium" className="text-gray-400">
                {d}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap p-2">
          {cells.map((cell, i) => {
            const weekend = i % 7 >= 5;
            if (!cell.date) {
              return (
                <View key={`o${i}`} className="w-[14.2857%] p-0.5">
                  <View className="h-9 items-center justify-center">
                    <Text size="sm" className="text-gray-400">
                      {cell.day}
                    </Text>
                  </View>
                </View>
              );
            }
            const on = days.has(cell.date);
            return (
              <View key={cell.date} className="w-[14.2857%] p-0.5">
                <Pressable
                  onPress={() => setPicked(cell.date)}
                  accessibilityRole="button"
                  accessibilityLabel={`${cell.day} ${MONTHS[month]}${on ? ': holiday' : ''}`}
                  testID={`holiday-cal-${cell.day}`}
                  className={cn(
                    'h-9 items-center justify-center rounded-lg',
                    on
                      ? 'bg-red-500 hover:bg-red-600'
                      : cell.date === today
                        ? 'bg-gray-200'
                        : 'hover:bg-gray-200',
                  )}
                >
                  <Text
                    size="sm"
                    tabular
                    className={on ? 'text-white' : weekend ? 'text-red-500' : undefined}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
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
                  {h.is_optional ? ' · Depends on moon' : ''}
                </Text>
                {h.description ? (
                  <Text size="sm" className="mt-1">
                    {h.description}
                  </Text>
                ) : null}
                {onEdit ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Pencil}
                    label="Edit"
                    className="mt-2 self-start"
                    onPress={() => {
                      setPicked(null);
                      onEdit(h);
                    }}
                  />
                ) : null}
              </View>
            ))}
          </View>
        )}
      </Dialog>
    </SectionCard>
  );
}

const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

/** Whole weeks (Sunday first); days outside the month carry no date so they are not pressable. */
function gridCells(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const prevCount = new Date(year, month, 0).getDate();
  const out: { day: number; date: string | null }[] = [];
  for (let i = first - 1; i >= 0; i--) out.push({ day: prevCount - i, date: null });
  for (let d = 1; d <= count; d++) {
    out.push({
      day: d,
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }
  for (let d = 1; out.length % 7 !== 0; d++) out.push({ day: d, date: null });
  return out;
}

function StepButton({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="border-border rounded-lg border p-1.5 hover:bg-gray-300"
    >
      <Icon icon={icon} size={16} color="mutedForeground" />
    </Pressable>
  );
}
