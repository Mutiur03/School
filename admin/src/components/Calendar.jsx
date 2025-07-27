import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({
  onDateSelect,
  initialDate,
  className,
  modifiers,
  modifiersClassNames,
}) {
  const [currentDate, setCurrentDate] = useState(initialDate || new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate || null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const getDaysInMonth = (year, month) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const prevMonthDays = firstDay.getDay();
    const nextMonthDays = 6 - lastDay.getDay();

    const days = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = prevMonthDays - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    for (let i = 1; i <= nextMonthDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const days = getDaysInMonth(currentYear, currentMonth);

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    if (onDateSelect) {
      onDateSelect(date);
    }

    const handleMouseUp = () => {
      setSelectedDate(null);
      if (onDateSelect) {
        onDateSelect(null); // Pass null to indicate deselection
      }
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mouseup", handleMouseUp);
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date) => {
    if (!selectedDate) return false;
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const getModifierClassNames = (date) => {
    if (!modifiers || !modifiersClassNames) return "";
    return Object.keys(modifiers)
      .filter((key) => modifiers[key](date))
      .map((key) => modifiersClassNames[key])
      .join(" ");
  };

  return (
    <div
      className={`w-full max-w-xs bg-card mx-auto p-5 rounded-lg shadow-lg ${className}`}
    >
      <div className="flex items-center justify-between p-4">
        <button
          onClick={handlePreviousMonth}
          className="p-1.5 text-gray-600 hover:text-gray-900 border dark:border-gray-600 border-gray-200 dark:hover:bg-gray-600 hover:bg-gray-300 dark:text-white rounded-lg"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="text-md font-medium">
          {currentDate.toLocaleString("default", { month: "long" })}{" "}
          {currentYear}
        </div>
        <button
          onClick={handleNextMonth}
          className="p-1.5 text-gray-600 hover:text-gray-900 border dark:border-gray-600 border-gray-200 dark:hover:bg-gray-600 hover:bg-gray-300 dark:text-white rounded-lg"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-sm font-medium">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="py-2 text-gray-400 dark:text-gray-500">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 p-2">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="contents">
            {week.map((day, dayIndex) => (
              <div
                key={dayIndex}
                className={`flex items-center justify-center h-9 rounded-lg text-sm cursor-pointer
                  ${getModifierClassNames(day.date)}
                  ${
                    !day.isCurrentMonth
                      ? "text-gray-400 dark:text-gray-600"
                      : ""
                  }
                  ${isToday(day.date) ? "bg-gray-200 dark:bg-gray-700" : ""}
                  
                  ${
                    day.isCurrentMonth && !isSelected(day.date)
                      ? "hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      : ""
                  }
                  
                  ${
                    (dayIndex === 5 || dayIndex === 6) && day.isCurrentMonth
                      ? "text-red-500 dark:text-red-400"
                      : ""
                  }
                `}
                onClick={() => {
                  if (day.isCurrentMonth) {
                    handleDateClick(day.date);
                  }
                }}
              >
                {day.date.getDate()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
