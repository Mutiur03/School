import { useRef, useState, useEffect } from "react";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "./ui/input";
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
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  function formatDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
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
    const monthLabel = new Date(year, month).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    return (
      <div className="w-56 sm:w-64">
        <div className="flex items-center relative mb-2">
          {isFirstCalendar && (
            <button
              onClick={() => {
                setVisibleMonth1(
                  new Date(
                    visibleMonth1.getFullYear(),
                    visibleMonth1.getMonth() - 1,
                    1
                  )
                );
                setVisibleMonth2(
                  new Date(
                    visibleMonth2.getFullYear(),
                    visibleMonth2.getMonth() - 1,
                    1
                  )
                );
              }}
              className="text-lg absolute left-0 rounded-md border border-gray-200 dark:border-gray-600 sm:p-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="text-muted-foreground sm:h-6 sm:w-6 h-5 w-5" />
            </button>
          )}
          <div className="mx-auto font-semibold text-gray-800 dark:text-gray-200 text-sm sm:text-base">
            {monthLabel}
          </div>
          {!isFirstCalendar && (
            <button
              onClick={() => {
                setVisibleMonth1(
                  new Date(
                    visibleMonth1.getFullYear(),
                    visibleMonth1.getMonth() + 1,
                    1
                  )
                );
                setVisibleMonth2(
                  new Date(
                    visibleMonth2.getFullYear(),
                    visibleMonth2.getMonth() + 1,
                    1
                  )
                );
              }}
              className="text-lg absolute right-0  rounded-md border border-gray-200 dark:border-gray-600 sm:p-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700"
            >
              <ChevronRight className="text-muted-foreground sm:h-6 sm:w-6 h-5 w-5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs px-2 sm:text-sm">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="font-bold text-gray-600 dark:text-gray-400">
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
                className={`cursor-pointer h-6 w-6 sm:h-8 sm:w-8 rounded-md flex items-center justify-center text-xs sm:text-sm 
                  ${isSelected
                    ? "bg-blue-600 text-white"
                    : inRange
                      ? "bg-blue-200 text-gray-800 dark:bg-blue-400 dark:text-gray-900"
                      : "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-700 dark:text-gray-300"
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
              ? `${format(date.from, "dd MMM yyyy")} to ${format(
                date.to,
                "dd MMM yyyy"
              )}`
              : date?.from
                ? `${format(date.from, "dd MMM yyyy")} to ...`
                : ""
          }
          placeholder="Click to select date range"
          className={`px-10 ${className}`}
        />
        <Calendar
          size={20}
          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
        />
      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          className="absolute sm:left-0 -left-2 right-0 mt-2 z-50 flex flex-col sm:flex-row border border-gray-300 bg-white shadow-lg p-4 sm:p-6 rounded-lg min-w-[21rem] sm:min-w-[36rem] dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex justify-between  w-full">
            {renderCalendar(
              visibleMonth1.getFullYear(),
              visibleMonth1.getMonth(),
              true
            )}
            {renderCalendar(
              visibleMonth2.getFullYear(),
              visibleMonth2.getMonth(),
              false
            )}
          </div>
        </div>
      )}
    </div>
  );
}
