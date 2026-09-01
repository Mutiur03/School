import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Exam, ExamType, ExamWritePayload } from '@/queries/exam.queries';

export const EXAM_CLASSES = [6, 7, 8, 9, 10];

const emptyForm = (year: number): FormState => ({
  exam_type_id: '',
  exam_year: year,
  levels: [],
  start_date: '',
  end_date: '',
  result_date: '',
  return_date: '',
});

type FormState = {
  exam_type_id: number | '';
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
  return_date: string;
};

function dateOnly(value?: string | null) {
  return value?.split('T')[0] || '';
}

export function ExamFormDialog({
  open,
  onOpenChange,
  exam,
  defaultYear,
  examTypes,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exam: Exam | null;
  defaultYear: number;
  examTypes: ExamType[];
  saving: boolean;
  onSubmit: (payload: ExamWritePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultYear));
  const [levelError, setLevelError] = useState(false);

  const types = useMemo(() => {
    if (exam?.exam_type_id && !examTypes.some((type) => type.id === exam.exam_type_id)) {
      return [
        {
          id: exam.exam_type_id,
          name: exam.exam_name,
          is_year_end: !!exam.is_year_end,
          sort_order: 0,
        },
        ...examTypes,
      ];
    }
    return examTypes;
  }, [exam, examTypes]);

  useEffect(() => {
    if (!open) return;
    if (exam) {
      setForm({
        exam_type_id: exam.exam_type_id ?? '',
        exam_year: exam.exam_year,
        levels: exam.levels,
        start_date: dateOnly(exam.start_date),
        end_date: dateOnly(exam.end_date),
        result_date: dateOnly(exam.result_date),
        return_date: dateOnly(exam.return_date),
      });
    } else {
      setForm(emptyForm(defaultYear));
    }
    setLevelError(false);
  }, [open, exam, defaultYear]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (form.levels.length === 0) {
      setLevelError(true);
      document.getElementById('exam-classes')?.focus();
      return;
    }
    if (form.exam_type_id === '') return;
    await onSubmit({
      exam_type_id: Number(form.exam_type_id),
      exam_year: Number(form.exam_year),
      levels: form.levels,
      start_date: form.start_date,
      end_date: form.end_date,
      result_date: form.result_date,
      return_date: form.return_date || undefined,
    });
  };

  const toggleLevel = (level: number, checked: boolean) => {
    setForm((prev) => {
      const levels = checked
        ? [...prev.levels, level]
        : prev.levels.filter((item) => item !== level);
      if (levels.length > 0) setLevelError(false);
      return { ...prev, levels };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" aria-describedby="exam-form-desc">
        <DialogHeader>
          <DialogTitle className="text-pretty">{exam ? 'Edit Exam' : 'Create Exam'}</DialogTitle>
          <DialogDescription id="exam-form-desc">
            {exam
              ? 'Change dates, classes, or type. Year-end is set by the exam type.'
              : 'Pick a type, classes, and dates. Results stay hidden until you publish.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exam_type_id">Exam type</Label>
              <select
                id="exam_type_id"
                name="exam_type_id"
                required
                value={form.exam_type_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    exam_type_id: e.target.value ? Number(e.target.value) : '',
                  }))
                }
                className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                <option value="" disabled>
                  {types.length ? 'Select type…' : 'No types assigned'}
                </option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                    {type.is_year_end ? ' (year end)' : ''}
                  </option>
                ))}
              </select>
              {types.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  Superadmin has not assigned any exam types to this school.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam_year">Session year</Label>
              <Input
                id="exam_year"
                name="exam_year"
                type="number"
                inputMode="numeric"
                min={2000}
                max={2100}
                required
                value={form.exam_year}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, exam_year: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Classes</legend>
            <div id="exam-classes" tabIndex={-1} className="flex flex-wrap gap-2">
              {EXAM_CLASSES.map((level) => {
                const id = `exam-class-${level}`;
                const checked = form.levels.includes(level);
                return (
                  <label
                    key={level}
                    htmlFor={id}
                    className="border-border hover:bg-accent/40 inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <Checkbox
                      id={id}
                      name="levels"
                      checked={checked}
                      onCheckedChange={(value) => toggleLevel(level, value === true)}
                    />
                    Class {level}
                  </label>
                );
              })}
            </div>
            {levelError ? (
              <p className="text-destructive text-xs" role="alert">
                Select at least one class.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Start date</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">End date</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="result_date">Result date</Label>
              <Input
                id="result_date"
                name="result_date"
                type="date"
                required
                value={form.result_date}
                onChange={(e) => setForm((prev) => ({ ...prev, result_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="return_date">Marksheet return date</Label>
              <div className="flex gap-2">
                <Input
                  id="return_date"
                  name="return_date"
                  type="date"
                  value={form.return_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, return_date: e.target.value }))}
                />
                {form.return_date ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForm((prev) => ({ ...prev, return_date: '' }))}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || types.length === 0}>
              {saving ? 'Saving…' : exam ? 'Save Exam' : 'Create Exam'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
