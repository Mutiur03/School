import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatsCard } from '@/components';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentAttendance } from '@/queries/students.queries';
import type { AttendanceRecord, AttendanceStatus } from '@/types/attendance';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function normalizeStatus(status: string): AttendanceStatus | 'unknown' {
  const value = status.trim().toLowerCase();
  if (value === 'present') return 'present';
  if (value === 'absent') return 'absent';
  if (value === 'run-awayed') return 'run-awayed';
  return 'unknown';
}

function statusMeta(status: AttendanceStatus | 'unknown') {
  switch (status) {
    case 'present':
      return {
        label: 'Present',
        short: 'P',
        cellClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/50',
        dotClass: 'bg-emerald-500',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    case 'absent':
      return {
        label: 'Absent',
        short: 'A',
        cellClass: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-200/50',
        dotClass: 'bg-red-500',
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    case 'run-awayed':
      return {
        label: 'Run awayed',
        short: 'R',
        cellClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/50',
        dotClass: 'bg-amber-500',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      };
    default:
      return {
        label: 'Unknown',
        short: '?',
        cellClass: 'bg-muted text-muted-foreground border-border',
        dotClass: 'bg-muted-foreground',
        icon: null,
      };
  }
}

interface StudentAttendanceViewProps {
  studentId?: number;
  initialMonth?: number;
  initialYear?: number;
  embedded?: boolean;
}

export function StudentAttendanceView({
  studentId,
  initialMonth,
  initialYear,
  embedded = false,
}: StudentAttendanceViewProps) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? now.getMonth());
  const [selectedYear, setSelectedYear] = useState(initialYear ?? now.getFullYear());

  const { data, isLoading, isFetching } = useStudentAttendance({
    studentId,
    month: selectedMonth,
    year: selectedYear,
  });

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const record of data?.records ?? []) {
      map.set(record.date, record);
    }
    return map;
  }, [data?.records]);

  const calendarCells = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const cells: Array<{ day: number | null; dateKey?: string }> = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({ day: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, dateKey });
    }

    return cells;
  }, [selectedMonth, selectedYear]);

  const goPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((year) => year - 1);
      return;
    }
    setSelectedMonth((month) => month - 1);
  };

  const goNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((year) => year + 1);
      return;
    }
    setSelectedMonth((month) => month + 1);
  };

  const stats = data?.stats;
  const recentRecords = [...(data?.records ?? [])].reverse().slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="text-primary h-5 w-5" />
          <div>
            <p className="text-sm font-medium">Attendance record</p>
            <p className="text-muted-foreground text-xs">Monthly view of marked days</p>
          </div>
        </div>

        <div className="border-border flex items-center gap-1 rounded-lg border p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goPrevMonth}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[9rem] px-2 text-center text-sm font-medium">
            {MONTHS[selectedMonth]} {selectedYear}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={goNextMonth}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className={`grid gap-3 ${embedded ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-4'}`}>
        <StatsCard
          label="Present"
          value={stats?.present ?? 0}
          color="emerald"
          icon={<CheckCircle2 className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          label="Absent"
          value={stats?.absent ?? 0}
          color="red"
          icon={<XCircle className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          label="Run awayed"
          value={stats?.runAwayed ?? 0}
          color="amber"
          icon={<AlertTriangle className="h-4 w-4" />}
          loading={isLoading}
        />
        <StatsCard
          label="Attendance rate"
          value={stats?.attendanceRate != null ? `${stats.attendanceRate}%` : '—'}
          color="blue"
          icon={<TrendingUp className="h-4 w-4" />}
          loading={isLoading}
        />
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <div className="border-border bg-muted/40 grid grid-cols-7 border-b">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="text-muted-foreground py-2 text-center text-[11px] font-semibold tracking-wide uppercase"
            >
              {day}
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-7 gap-2 p-3">
            {Array.from({ length: 35 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-md" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5 p-3">
            {calendarCells.map((cell, index) => {
              if (!cell.day) {
                return <div key={`empty-${index}`} className="h-14" />;
              }

              const record = cell.dateKey ? recordMap.get(cell.dateKey) : undefined;
              const status = record ? normalizeStatus(record.status) : undefined;
              const meta = status ? statusMeta(status) : null;

              return (
                <div
                  key={cell.dateKey}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-md border transition-colors ${
                    meta ? meta.cellClass : 'border-border/60 bg-background text-muted-foreground'
                  } ${isFetching ? 'opacity-70' : ''}`}
                  title={
                    record
                      ? `${format(parseISO(cell.dateKey!), 'dd MMM yyyy')} — ${meta?.label}`
                      : format(parseISO(cell.dateKey!), 'dd MMM yyyy')
                  }
                >
                  <span className="text-xs font-semibold">{cell.day}</span>
                  {meta ? (
                    <span className="text-[10px] font-bold tracking-wide uppercase">
                      {meta.short}
                    </span>
                  ) : (
                    <span className="bg-border h-1.5 w-1.5 rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-border rounded-lg border">
        <div className="border-border bg-muted/30 border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Recent entries</h3>
          <p className="text-muted-foreground text-xs">Latest marked days this month</p>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-10 rounded-md" />
            ))}
          </div>
        ) : recentRecords.length === 0 ? (
          <div className="text-muted-foreground p-6 text-center text-sm">
            No attendance marked for this month yet.
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {recentRecords.map((record) => {
              const status = normalizeStatus(record.status);
              const meta = statusMeta(status);
              return (
                <li
                  key={record.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {format(parseISO(record.date), 'EEEE, dd MMM yyyy')}
                    </p>
                    <p className="text-muted-foreground text-xs">{record.date}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cellClass}`}
                  >
                    {meta.icon}
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
