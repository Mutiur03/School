import React, { useEffect, useState } from "react";
import axios, { AxiosError } from "axios";
import {
  PencilLine,
  Trash2,
  PlusCircle,
  Clock,
  BookOpen,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAIN_COLOR = "bg-blue-600 dark:bg-blue-500";
const MAIN_COLOR_HOVER = "hover:bg-blue-700 dark:hover:bg-blue-400";
const WARNING_COLOR = "bg-yellow-500 dark:bg-yellow-600";
const WARNING_COLOR_HOVER = "hover:bg-yellow-600 dark:hover:bg-yellow-700";
const DANGER_COLOR = "bg-red-600 dark:bg-red-500";
const DANGER_COLOR_HOVER = "hover:bg-red-700 dark:hover:bg-red-400";
const CARD_COLOR = "bg-white dark:bg-zinc-900";
const BORDER_COLOR = "border-gray-200 dark:border-zinc-800";
const TEXT_MUTED = "text-gray-500 dark:text-gray-400";
const TEXT_SUCCESS = "text-green-600 dark:text-green-400";
const TEXT_ERROR = "text-red-600 dark:text-red-400";

interface TimeOption {
  label: string;
  value: string;
  mins: number;
}

interface Slot {
  id: number;
  start_time: string;
  end_time: string;
}

interface Routine {
  id: number;
  class: number;
  slot_id: number;
  day: string;
  subject: string;
  slot?: Slot;
}

interface RoutineForm {
  class: string;
  slot_id: string;
  day: string;
  subject: string;
}

interface SlotForm {
  start_time: string;
  end_time: string;
}

const classOptions = [6, 7, 8, 9, 10].sort((a, b) => a - b);
const dayOptions = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"];

function generateTimeOptions(stepMinutes = 5): TimeOption[] {
  const options: TimeOption[] = [];
  for (let mins = 480; mins <= 1020; mins += stepMinutes) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const ampm = h24 < 12 ? "AM" : "PM";
    const label = `${hour12.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")} ${ampm}`;
    options.push({ label, value: label, mins });
  }
  options.sort((a, b) => a.mins - b.mins);
  return options;
}

const timeOptions = generateTimeOptions(5);

function ClassRoutine() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [form, setForm] = useState<RoutineForm>({
    class: "",
    slot_id: "",
    day: "",
    subject: "",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);
  const [slotForm, setSlotForm] = useState<SlotForm>({
    start_time: "",
    end_time: "",
  });
  const [slotError, setSlotError] = useState("");
  const [routineError, setRoutineError] = useState("");
  const [loadingRoutines, setLoadingRoutines] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [slotSuccessMsg, setSlotSuccessMsg] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [showSlotsTable, setShowSlotsTable] = useState(false);

  const fetchRoutines = async () => {
    setLoadingRoutines(true);
    try {
      const res = await axios.get<Routine[]>("/api/class-routine");
      setRoutines(res.data);
    } catch {
      setRoutineError("Failed to fetch routines.");
    }
    setLoadingRoutines(false);
  };

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await axios.get<Slot[]>("/api/class-routine/slots");
      setSlots(res.data);
    } catch {
      setSlotError("Failed to fetch slots.");
    }
    setLoadingSlots(false);
  };

  useEffect(() => {
    fetchRoutines();
    fetchSlots();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setRoutineError("");
    setSuccessMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.slot_id) {
      setRoutineError("Please select a class slot.");
      return;
    }
    try {
      if (editingId) {
        await axios.put(`/api/class-routine/${editingId}`, form);
        setSuccessMsg("Routine updated successfully!");
      } else {
        await axios.post("/api/class-routine", form);
        setSuccessMsg("Routine added successfully!");
      }
      setForm({
        class: "",
        slot_id: "",
        day: "",
        subject: "",
      });
      setEditingId(null);
      setRoutineError("");
      fetchRoutines();
    } catch (err) {
      const error = err as AxiosError<{ error?: string }>;
      setRoutineError(
        error?.response?.data?.error ||
        "Failed to save routine entry. Please try again."
      );
    }
  };

  const handleEdit = (routine: Routine) => {
    setForm({
      class: String(routine.class),
      slot_id: String(routine.slot_id),
      day: routine.day,
      subject: routine.subject,
    });
    setEditingId(routine.id);
    setShowForm(true);
    setSuccessMsg("");
    setRoutineError("");
  };

  const handleDelete = async (id: number) => {
    setLoadingRoutines(true);
    try {
      await axios.delete(`/api/class-routine/${id}`);
      setSuccessMsg("Routine deleted successfully!");
      setEditingId(null);
      setShowForm(false);
      fetchRoutines();
    } catch {
      setRoutineError("Failed to delete routine.");
    }
    setLoadingRoutines(false);
  };

  const handleSlotEdit = (slot: Slot) => {
    setSlotForm({
      start_time: slot.start_time,
      end_time: slot.end_time,
    });
    setEditingSlotId(slot.id);
    setShowSlotForm(true);
    setSlotError("");
    setSlotSuccessMsg("");
  };

  const handleSlotDelete = async (id: number) => {
    setLoadingSlots(true);
    try {
      await axios.delete(`/api/class-routine/slots/${id}`);
      setSlotSuccessMsg("Slot deleted successfully!");
      fetchSlots();
    } catch {
      setSlotError("Failed to delete slot.");
    }
    setLoadingSlots(false);
  };

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start_time = slotForm.start_time;
    const end_time = slotForm.end_time;
    const time12hrRegex = /^(0[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;
    if (!start_time || !end_time) {
      setSlotError("All fields are required.");
      return;
    }
    if (!time12hrRegex.test(start_time) || !time12hrRegex.test(end_time)) {
      setSlotError("Time must be in 12-hour format (e.g. 08:00 AM, 01:00 PM)");
      return;
    }
    setLoadingSlots(true);
    try {
      if (editingSlotId) {
        await axios.put(`/api/class-routine/slots/${editingSlotId}`, {
          start_time,
          end_time,
        });
        setSlotSuccessMsg("Slot updated successfully!");
        setEditingSlotId(null);
      } else {
        await axios.post("/api/class-routine/slots", { start_time, end_time });
        setSlotSuccessMsg("Slot created successfully!");
      }
      setSlotForm({
        start_time: "",
        end_time: "",
      });
      setSlotError("");
      fetchSlots();
    } catch {
      setSlotError("Failed to save slot.");
    }
    setLoadingSlots(false);
  };

  const theme = {
    primary: MAIN_COLOR,
    primaryHover: MAIN_COLOR_HOVER,
    accent: "bg-sky-500 dark:bg-sky-600",
    accentHover: "hover:bg-sky-600 dark:hover:bg-sky-700",
    danger: DANGER_COLOR,
    dangerHover: DANGER_COLOR_HOVER,
    warning: WARNING_COLOR,
    warningHover: WARNING_COLOR_HOVER,
    border: BORDER_COLOR,
    card: CARD_COLOR,
    muted: TEXT_MUTED,
    success: TEXT_SUCCESS,
    error: TEXT_ERROR,
  };

  return (
    <div className="max-w-6xl mx-auto mt-6 px-2 sm:px-4 font-sans">
      <div className="flex flex-col lg:flex-row gap-6 mb-8 items-stretch">
        <Card
          className={`flex-1 min-w-0 mb-6 ${theme.card} ${theme.border} shadow-sm`}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <Clock className="text-blue-600 dark:text-blue-400" /> Create
              Class Slot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showSlotForm && !editingSlotId && (
              <Button
                className={`mb-2 w-full sm:w-auto ${theme.primary} ${theme.primaryHover} text-white`}
                onClick={() => setShowSlotForm(true)}
              >
                <PlusCircle className="mr-2" /> Add Slot
              </Button>
            )}
            {(showSlotForm || editingSlotId) && (
              <form onSubmit={handleSlotSubmit} className="flex flex-col gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start_time">Start Time</Label>
                  <select
                    id="start_time"
                    name="start_time"
                    className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
                    value={slotForm.start_time}
                    onChange={(e) =>
                      setSlotForm((f) => ({
                        ...f,
                        start_time: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select Start Time</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end_time">End Time</Label>
                  <select
                    id="end_time"
                    name="end_time"
                    className="w-full border rounded px-3 py-2 bg-white dark:bg-zinc-900"
                    value={slotForm.end_time}
                    onChange={(e) =>
                      setSlotForm((f) => ({
                        ...f,
                        end_time: e.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Select End Time</option>
                    {timeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="submit"
                    className={`flex-1 flex items-center justify-center gap-2 text-white ${theme.primary} ${theme.primaryHover}`}
                    disabled={loadingSlots}
                  >
                    {loadingSlots ? (
                      <Loader2 className="animate-spin h-4 w-4" />
                    ) : (
                      <PlusCircle className="text-blue-600 dark:text-blue-400" />
                    )}
                    {editingSlotId ? "Update Slot" : "Create Slot"}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className={`flex-1 ${theme.warning} ${theme.warningHover} text-white`}
                    onClick={() => {
                      setEditingSlotId(null);
                      setSlotForm({ start_time: "", end_time: "" });
                      setShowSlotForm(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
                {slotError && (
                  <div
                    className={`${theme.error} text-sm mt-1 flex items-center gap-1`}
                  >
                    <XCircle className="text-red-600 dark:text-red-400" />{" "}
                    {slotError}
                  </div>
                )}
                {slotSuccessMsg && (
                  <div
                    className={`${theme.success} text-sm mt-1 flex items-center gap-1`}
                  >
                    <CheckCircle2 className="text-blue-600 dark:text-blue-400" />{" "}
                    {slotSuccessMsg}
                  </div>
                )}
                <div className={`text-xs ${theme.muted} mt-2`}>
                  Please use 12-hour format (e.g. 08:00 AM, 01:00 PM)
                </div>
              </form>
            )}
            <h3 className="mt-6 mb-2 text-base font-semibold">
              Existing Slots
            </h3>
            {!showSlotsTable && (
              <Button
                className={`mb-2 w-full sm:w-auto ${theme.primary} ${theme.primaryHover} text-white`}
                onClick={() => setShowSlotsTable(true)}
              >
                Show Existing Slots
              </Button>
            )}
            {showSlotsTable && (
              <div className="overflow-x-auto rounded border border-gray-200 dark:border-zinc-800">
                <table
                  className={`w-full min-w-[340px] border-collapse bg-gray-50 dark:bg-zinc-900 text-xs sm:text-sm`}
                >
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-blue-600 dark:bg-blue-500 text-white">
                      <th className="p-2">Start Time</th>
                      <th className="p-2">End Time</th>
                      <th className="p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSlots ? (
                      <tr>
                        <td colSpan={3} className="text-center py-4">
                          <Loader2 className="animate-spin h-5 w-5 mx-auto text-blue-600 dark:text-blue-400" />
                        </td>
                      </tr>
                    ) : slots.length === 0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-center py-4 text-gray-400 dark:text-gray-500"
                        >
                          No slots created.
                        </td>
                      </tr>
                    ) : (
                      [...slots]
                        .sort((a, b) => {
                          const parseTime = (t: string) => {
                            const [time, ampm] = t.split(" ");
                            const [hStr, mStr] = time.split(":");
                            let h = Number(hStr);
                            const m = Number(mStr);
                            if (ampm === "PM" && h !== 12) h += 12;
                            if (ampm === "AM" && h === 12) h = 0;
                            return h * 60 + m;
                          };
                          return (
                            parseTime(a.start_time) - parseTime(b.start_time)
                          );
                        })
                        .map((s, idx) => (
                          <tr
                            key={s.id}
                            className={
                              idx % 2 === 0
                                ? "bg-gray-100 dark:bg-zinc-800"
                                : "bg-white dark:bg-zinc-900"
                            }
                          >
                            <td className="p-2">{s.start_time}</td>
                            <td className="p-2 ">{s.end_time}</td>
                            <td className="p-2 flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="p-2 rounded flex items-center gap-1"
                                onClick={() => handleSlotEdit(s)}
                                title="Edit Slot"
                              >
                                <PencilLine className="text-blue-600 dark:text-blue-400" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="p-2 rounded flex items-center gap-1"
                                onClick={() => handleSlotDelete(s.id)}
                                title="Delete Slot"
                                disabled={loadingSlots}
                              >
                                <Trash2 className="text-red-600 dark:text-red-400" />
                              </Button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
                <Button
                  className={`mt-2 w-full sm:w-auto ${theme.warning} ${theme.warningHover} text-white`}
                  onClick={() => setShowSlotsTable(false)}
                >
                  Hide Existing Slots
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-2 bg-blue-50 dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 rounded px-3 py-2 text-xs sm:text-sm text-blue-800 dark:text-blue-200">
            <Info className="w-4 h-4 text-blue-500 dark:text-blue-400" />
            <span>
              For better UI, add <b>"Break"</b> every day at the same slot.
            </span>
          </div>
          <Card
            className={`${theme.card} ${theme.border} shadow-sm flex-1 min-w-0`}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-semibold">
                <PlusCircle className="text-blue-600 dark:text-blue-400" /> Add
                / Edit Routine Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showForm && !editingId && (
                <Button
                  className={`mb-2 ${theme.primary} ${theme.primaryHover} text-white`}
                  onClick={() => setShowForm(true)}
                >
                  <PlusCircle className="mr-2" /> Add Routine Entry
                </Button>
              )}
              {(showForm || editingId) && (
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="class">Class</Label>
                    <Select
                      value={form.class}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, class: value }))
                      }
                      required
                    >
                      <SelectTrigger id="class" className="w-full">
                        <SelectValue placeholder="Select Class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classOptions.map((c) => (
                          <SelectItem key={c} value={String(c)}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="slot_id">Slot</Label>
                    <Select
                      value={form.slot_id}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, slot_id: value }))
                      }
                      required
                    >
                      <SelectTrigger id="slot_id" className="w-full">
                        <SelectValue placeholder="Select Slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {[...slots]
                          .sort((a, b) => {
                            const parseTime = (t: string) => {
                              const [time, ampm] = t.split(" ");
                              const [hStr, mStr] = time.split(":");
                              let h = Number(hStr);
                              const m = Number(mStr);
                              if (ampm === "PM" && h !== 12) h += 12;
                              if (ampm === "AM" && h === 12) h = 0;
                              return h * 60 + m;
                            };
                            return (
                              parseTime(a.start_time) - parseTime(b.start_time)
                            );
                          })
                          .map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.start_time} - {s.end_time}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="day">Day</Label>
                    <Select
                      value={form.day}
                      onValueChange={(value) =>
                        setForm((f) => ({ ...f, day: value }))
                      }
                      required
                    >
                      <SelectTrigger id="day" className="w-full">
                        <SelectValue placeholder="Select Day" />
                      </SelectTrigger>
                      <SelectContent>
                        {dayOptions.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      placeholder="Subject"
                      value={form.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="submit"
                      className={`flex-1 flex items-center justify-center gap-2 text-white ${theme.primary} ${theme.primaryHover}`}
                      disabled={loadingRoutines}
                    >
                      {loadingRoutines ? (
                        <Loader2 className="animate-spin h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="text-blue-600 dark:text-blue-400" />
                      )}
                      {editingId ? "Update" : "Add"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className={`flex-1 ${theme.warning} ${theme.warningHover} text-white`}
                      onClick={() => {
                        setEditingId(null);
                        setForm({
                          class: "",
                          slot_id: "",
                          day: "",
                          subject: "",
                        });
                        setShowForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                  {routineError && (
                    <div
                      className={`${theme.error} text-sm mt-1 flex items-center gap-1`}
                    >
                      <XCircle className="text-red-600 dark:text-red-400" />{" "}
                      {routineError}
                    </div>
                  )}
                  {successMsg && (
                    <div
                      className={`${theme.success} text-sm mt-1 flex items-center gap-1`}
                    >
                      <CheckCircle2 className="text-blue-600 dark:text-blue-400" />{" "}
                      {successMsg}
                    </div>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Card className={`mb-8 ${theme.card} ${theme.border} shadow-sm`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BookOpen className="text-blue-600 dark:text-blue-400" /> Class
            Routine Entries
          </CardTitle>
          <div className="flex flex-wrap gap-2 sm:gap-4 mt-4">
            <div>
              <Label htmlFor="filter-class" className="mr-2">
                Class
              </Label>
              <select
                id="filter-class"
                className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 text-xs sm:text-sm"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">All</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="filter-day" className="mr-2">
                Day
              </Label>
              <select
                id="filter-day"
                className="border rounded px-2 py-1 bg-white dark:bg-zinc-900 text-xs sm:text-sm"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
              >
                <option value="">All</option>
                {dayOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border border-gray-200 dark:border-zinc-800">
            <table className="min-w-[340px] w-full border-collapse bg-gray-50 dark:bg-zinc-900 text-xs sm:text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-blue-600 dark:bg-blue-500 text-white">
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Class
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Slot
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Day
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-xs font-medium uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingRoutines ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4">
                      <Loader2 className="animate-spin h-5 w-5 mx-auto text-blue-600 dark:text-blue-400" />
                    </td>
                  </tr>
                ) : routines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-4 text-gray-400 dark:text-gray-500"
                    >
                      No routine entries found.
                    </td>
                  </tr>
                ) : (
                  [...routines]
                    .filter(
                      (r) =>
                        (classFilter === "" ||
                          String(r.class) === String(classFilter)) &&
                        (dayFilter === "" || r.day === dayFilter)
                    )
                    .sort((a, b) => {
                      const dayOrder = dayOptions;
                      const dayA = dayOrder.indexOf(a.day);
                      const dayB = dayOrder.indexOf(b.day);
                      if (dayA !== dayB) return dayA - dayB;

                      const parseTime = (t: string) => {
                        if (!t) return -1;
                        const [time, ampm] = t.split(" ");
                        const [hStr, mStr] = time.split(":");
                        let h = Number(hStr);
                        const m = Number(mStr);
                        if (ampm === "PM" && h !== 12) h += 12;
                        if (ampm === "AM" && h === 12) h = 0;
                        return h * 60 + m;
                      };
                      if (!a.slot && !b.slot) return 0;
                      if (!a.slot) return 1;
                      if (!b.slot) return -1;
                      return (
                        parseTime(a.slot.start_time) -
                        parseTime(b.slot.start_time)
                      );
                    })
                    .map((r, idx) => (
                      <tr
                        key={r.id}
                        className={
                          idx % 2 === 0
                            ? "bg-gray-100 dark:bg-zinc-800"
                            : "bg-white dark:bg-zinc-900"
                        }
                      >
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          {r.class}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          {r.slot
                            ? `${r.slot.start_time} - ${r.slot.end_time}`
                            : ""}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          {r.day}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                          {r.subject}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="p-2 rounded flex items-center gap-1"
                            onClick={() => handleEdit(r)}
                            title="Edit Routine"
                          >
                            <PencilLine className="text-blue-600 dark:text-blue-400" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="p-2 rounded flex items-center gap-1"
                            onClick={() => handleDelete(r.id)}
                            title="Delete Routine"
                            disabled={loadingRoutines}
                          >
                            <Trash2 className="text-red-600 dark:text-red-400" />
                          </Button>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ClassRoutine;
