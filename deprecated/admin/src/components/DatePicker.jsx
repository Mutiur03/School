import React from "react";
import { format, getYear, setMonth, setYear, getMonth } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const DatePicker = ({
  value,
  onChange,
  name = "date",
  placeholder = "Pick a date",
//   startYear = getYear(new Date()) - 100,
//   endYear = getYear(new Date()) + 100,
}) => {
//   const [date, setDate] = React.useState(value ? new Date(value) : new Date());
//   const months = [
//     "January",
//     "February",
//     "March",
//     "April",
//     "May",
//     "June",
//     "July",
//     "August",
//     "September",
//     "October",
//     "November",
//     "December",
//   ];
//   const years = Array.from(
//     { length: endYear - startYear + 1 },
//     (_, i) => startYear + i
//   );
//   const handleMonthChange = (month) => {
//     const newDate = setMonth(date, months.indexOf(month));
//     setDate(newDate);
//   };

//   const handleYearChange = (year) => {
//     const newDate = setYear(date, parseInt(year));
//     setDate(newDate);
//   };
  const handleSelect = (selectedDate) => {
    const formattedDate = selectedDate
      ? format(selectedDate, "yyyy-MM-dd")
      : null;
    // const currentValue = value ? format(new Date(value), "yyyy-MM-dd") : null;
    // console.log(formattedDate,currentValue);

    if (!selectedDate) {
      console.log("Date already selected");

      onChange({
        target: {
          name,
          value: "",
        },
      });
    } else if (selectedDate) {
      console.log("Date selected");

      onChange({
        target: {
          name,
          value: formattedDate,
        },
      });
    }
  };

  return (
    <Popover className="w-full">
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("max-w-[240px] justify-start text-left font-normal ")}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        {/* <div className="flex justify-between p-2">
          <Select
            onValueChange={handleMonthChange}
            value={months[getMonth(date)]}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month} value={month}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={handleYearChange}
            value={getYear(date).toString()}
          >
            <SelectTrigger className="w-[110px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div> */}
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;
