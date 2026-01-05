import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import DeleteConfirmation from "@/components/DeleteConfimation";
import { Calendar } from "@/components/Calendar";
import { format } from "date-fns";
import toast from "react-hot-toast";
import DateRangePickerF from "@/components/DateRangePickerF";
import { useHolidayStore } from "@/store";
import { Loader2 } from "lucide-react";

interface Holiday {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

interface HolidayForm {
  title: string;
  start_date: string;
  end_date: string;
  description: string;
  is_optional: boolean;
}

interface DateRange {
  from: Date | null;
  to: Date | null;
}

const HolidayCalendar = () => {
  const {
    holidays,
    fetchHolidays,
    isLoading,
    deleteHoliday,
    addHoliday,
    updateHoliday,
  } = useHolidayStore() as {
    holidays: Holiday[];
    fetchHolidays: () => Promise<void>;
    isLoading: boolean;
    deleteHoliday: (id: number) => Promise<void>;
    addHoliday: (form: HolidayForm) => Promise<void>;
    updateHoliday: (id: number, form: HolidayForm) => Promise<void>;
  };
  const [open, setOpen] = useState<boolean>(false);
  const [form, setForm] = useState<HolidayForm>({
    title: "",
    start_date: "",
    end_date: "",
    description: "",
    is_optional: false,
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateDialogOpen, setDateDialogOpen] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

  const getHolidaysForDate = (date: Date): Holiday[] => {
    return holidays.filter((h: Holiday) => {
      const checkDate = date.setHours(0, 0, 0, 0);
      const start = new Date(h.start_date).setHours(0, 0, 0, 0);
      const end = new Date(h.end_date).setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  useEffect(() => {
    if (dateRange.from && dateRange.to) {
      setForm((prev) => ({
        ...prev,
        start_date: format(dateRange.from as Date, "yyyy-MM-dd"),
        end_date: format(dateRange.to as Date, "yyyy-MM-dd"),
      }));
    }
  }, [dateRange]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateHoliday(editingId, form);
      } else {
        await addHoliday(form);
      }
      handleClose();
    } catch {
      toast.error("Failed to add holiday. Please try again.");
    }
  };

  const handleClose = (): void => {
    setOpen(false);
    setEditingId(null);
    setForm({
      title: "",
      start_date: "",
      end_date: "",
      description: "",
      is_optional: false,
    });
    setDateRange({ from: null, to: null });
  };

  const handleEdit = (holiday: Holiday): void => {
    setForm({
      title: holiday.title,
      start_date: holiday.start_date,
      end_date: holiday.end_date,
      description: holiday.description,
      is_optional: holiday.is_optional,
    });
    setDateRange({
      from: new Date(holiday.start_date),
      to: new Date(holiday.end_date),
    });
    setEditingId(holiday.id);
    setOpen(true);
  };

  const isHoliday = (date: Date): boolean => {
    return holidays.some((h: Holiday) => {
      const checkDate = date.setHours(0, 0, 0, 0);
      const start = new Date(h.start_date).setHours(0, 0, 0, 0);
      const end = new Date(h.end_date).setHours(0, 0, 0, 0);
      return checkDate >= start && checkDate <= end;
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Holiday Calendar</h2>
        <Button onClick={() => setOpen(true)}>Add Holiday</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading holidays...</span>
        </div>
      ) : holidays.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground">No holidays available</p>
          <p className="text-sm text-muted-foreground mt-2">
            Click the "Add Holiday" button to add new holidays
          </p>
        </div>
      ) : (
        <>
          <Calendar
            onDateSelect={(date: Date | null) => {
              if (date) {
                setSelectedDate(date);
                setDateDialogOpen(true);
              }
            }}
            modifiers={{
              holiday: (date: Date) => isHoliday(date),
            }}
            modifiersClassNames={{
              holiday: "bg-red-500 text-white dark:text-white dark:bg-red-500 dark:hover:bg-red-600 hover:bg-red-600 hover:text-white",
            }}
          />

          <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Holiday Info</DialogTitle>
                <DialogDescription>
                  {selectedDate &&
                    new Date(selectedDate).toLocaleDateString(undefined, {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {selectedDate &&
                  getHolidaysForDate(selectedDate).map((holiday) => (
                    <div key={holiday.id} className="border p-2 rounded-lg space-y-1">
                      <p className="font-semibold">{holiday.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {holiday.start_date} to {holiday.end_date}
                      </p>
                      <p className="text-sm">{holiday.description}</p>
                      <p className="text-sm italic">
                        {holiday.is_optional ? "Depends on moon" : "Mandatory"}
                      </p>
                    </div>
                  ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDateDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ul className="space-y-2">
            {holidays.map((holiday: Holiday) => (
              <li key={holiday.id} className="border p-2 rounded-xl flex justify-between items-center">
                <div>
                  <p className="font-medium">{holiday.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {holiday.start_date} - {holiday.end_date}
                  </p>
                </div>
                <div className="space-x-2">
                  <Button onClick={() => handleEdit(holiday)}>Edit</Button>
                  <DeleteConfirmation onDelete={() => deleteHoliday(holiday.id)} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Holiday" : "Add Holiday"}</DialogTitle>
            <DialogDescription>Fill in the holiday details below.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                className="w-[325%]"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label>Date Range</Label>
              <DateRangePickerF date={dateRange} setDate={setDateRange} className="w-[325%]" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                className="w-[325%]"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="optional"
                checked={form.is_optional}
                onCheckedChange={(val) => setForm({ ...form, is_optional: val as boolean })}
              />
              <Label htmlFor="optional">Optional</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleSubmit}>{editingId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HolidayCalendar;
