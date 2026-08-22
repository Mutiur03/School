import { useRef, useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from './ui/input';
interface DateRangePickerFProps {
  date: { from: Date | null; to: Date | null };
  setDate: (date: { from: Date | null; to: Date | null }) => void;
  className?: string;
}
export default function DateRangePickerF({ date, setDate, className }: DateRangePickerFProps) {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [showCalendar, setShowCalendar] = useState(false);
  const [visibleMonth1, setVisibleMonth1] = useState(new Date(today));
  const [visibleMonth2, setVisibleMonth2] = useState(new Date(nextMonth));
  const calendarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  function generateMonthDates(year: number, month: number) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }
  function isInRange(date: Date, from: Date | null, to: Date | null) {
    return from && to && date >= from && date <= to;
  }

  function handleDateClick(day: Date) {
    if (!date?.from && !date?.to) {
      setDate({ from: day, to: null });
    } else if (date?.from && !date?.to) {
      if (day < date.from) {
        setDate({ from: day, to: date.from });
      } else {
        setDate({ from: date.from, to: day });
      }
    } else if (date?.from && date?.to) {
      if (day < date.from) {
        setDate({ from: day, to: date.to });
      } else if (day > date.to) {
        setDate({ from: date.from, to: day });
      } else {
        setDate({ from: day, to: null });
      }
    }
  }

  function renderCalendar(year: number, month: number, isFirstCalendar: boolean) {
    const days = generateMonthDates(year, month);
    const monthLabel = new Date(year, month).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });

    return (
      <div className="w-56 sm:w-64">
        <div className="relative mb-2 flex items-center">
          {isFirstCalendar && (
            <button
              onClick={() => {
                setVisibleMonth1(
                  new Date(visibleMonth1.getFullYear(), visibleMonth1.getMonth() - 1, 1),
                );
                setVisibleMonth2(
                  new Date(visibleMonth2.getFullYear(), visibleMonth2.getMonth() - 1, 1),
                );
              }}
              className="border-border absolute left-0 rounded-md border p-0.5 text-lg hover:bg-gray-200 sm:p-1 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
          <div className="mx-auto text-sm font-semibold text-gray-800 sm:text-base dark:text-gray-200">
            {monthLabel}
          </div>
          {!isFirstCalendar && (
            <button
              onClick={() => {
                setVisibleMonth1(
                  new Date(visibleMonth1.getFullYear(), visibleMonth1.getMonth() + 1, 1),
                );
                setVisibleMonth2(
                  new Date(visibleMonth2.getFullYear(), visibleMonth2.getMonth() + 1, 1),
                );
              }}
              className="border-border absolute right-0 rounded-md border p-0.5 text-lg hover:bg-gray-200 sm:p-1 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <ChevronRight className="text-muted-foreground h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 px-2 text-center text-xs sm:text-sm">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
            <div key={d} className="text-muted-foreground font-bold dark:text-gray-400">
              {d}
            </div>
          ))}
          {days.map((day, index) => {
            if (!day) {
              return <div key={index}></div>;
            }
            const isSelected =
              (date?.from && formatDate(day) === formatDate(date.from)) ||
              (date?.to && formatDate(day) === formatDate(date.to));
            const inRange = isInRange(day, date?.from, date?.to);
            return (
              <div
                key={index}
                onClick={() => handleDateClick(day)}
                className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-xs sm:h-8 sm:w-8 sm:text-sm ${
                  isSelected
                    ? 'bg-primary text-white'
                    : inRange
                      ? 'bg-blue-200 text-gray-800 dark:bg-blue-400 dark:text-gray-900'
                      : 'hover:bg-muted text-gray-700 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {day.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="relative font-sans">
      <div className="relative">
        <Input
          type="text"
          readOnly
          onClick={() => setShowCalendar(!showCalendar)}
          value={
            date?.from && date?.to
              ? `${format(date.from, 'dd MMM yyyy')} to ${format(date.to, 'dd MMM yyyy')}`
              : date?.from
                ? `${format(date.from, 'dd MMM yyyy')} to ...`
                : ''
          }
          placeholder="Click to select date range"
          className={`px-10 ${className}`}
        />
        <Calendar
          size={20}
          className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 transform"
        />
      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          className="border-border absolute right-0 -left-2 z-50 mt-2 flex min-w-[21rem] flex-col rounded-lg border bg-white p-4 shadow-lg sm:left-0 sm:min-w-[36rem] sm:flex-row sm:p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex w-full justify-between">
            {renderCalendar(visibleMonth1.getFullYear(), visibleMonth1.getMonth(), true)}
            {renderCalendar(visibleMonth2.getFullYear(), visibleMonth2.getMonth(), false)}
          </div>
        </div>
      )}
    </div>
  );
}
