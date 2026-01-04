import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { Input } from "./ui/input";
import { motion, AnimatePresence } from "framer-motion";
interface DatePickerProps {
  value: string | null;
  onChange: (event: { target: { name: string; value: string | null } }) => void;
  name?: string;
  placeholder?: string;
}
const DatePicker = ({
  value,
  onChange,
  name = "date",
  placeholder = "Pick a date",
}: DatePickerProps) => {
  const [visibleMonth, setVisibleMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
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
  const handleDateClick = (selectedDate: Date) => {
    const formattedDate = selectedDate
      ? format(selectedDate, "yyyy-MM-dd")
      : null;
    onChange({
      target: {
        name,
        value: formattedDate,
      },
    });
    setShowCalendar(false);
  };

  const generateMonthDates = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++)
      days.push(new Date(year, month, d));
    return days;
  };

  const renderCalendar = () => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const days = generateMonthDates(year, month);
    const monthLabel = visibleMonth.toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        ref={calendarRef}
        className="absolute  shadow-lg rounded-lg bg-white dark:bg-slate-700 p-4 z-10 w-full sm:w-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setVisibleMonth(new Date(year, month - 1, 1))}
            className="p-2 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 ease-in-out rounded-md "
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold text-center">{monthLabel}</span>
          <button
            type="button"
            onClick={() => setVisibleMonth(new Date(year, month + 1, 1))}
            className="p-2 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-200 ease-in-out rounded-md "
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-2 text-center text-sm">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
            <div
              key={day}
              className="font-bold text-gray-600 dark:text-gray-300"
            >
              {day}
            </div>
          ))}
          {days.map((day, index) => (
            <div
              key={index}
              onClick={() => day && handleDateClick(day)}
              className={`cursor-pointer h-8 w-8 flex items-center justify-center rounded-md ${day
                ? "hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
                : "pointer-events-none"
                }`}
            >
              {day ? day.getDate() : ""}
            </div>
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="relative">
      <Input
        name={name}
        type="text"
        readOnly
        value={value ? format(new Date(value), "dd MMM yyyy") : ""}
        onClick={() => setShowCalendar(!showCalendar)}
        placeholder={placeholder}
        className=" px-10 "
      />
      <Calendar
        size={18}
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
      />
      <AnimatePresence>{showCalendar && renderCalendar()}</AnimatePresence>
    </div>
  );
};

export default DatePicker;
