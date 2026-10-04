import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Loader2, X } from 'lucide-react';
import { Popup, filterSelectClassName } from '@/components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
  </div>
);

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

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

  const close = () => {
    if (!saving) onOpenChange(false);
  };

  return (
    <Popup
      open={open}
      onOpenChange={(next) => !next && close()}
      size="xl"
      aria-labelledby="exam-form-title"
    >
      <form onSubmit={handleSubmit} autoComplete="off">
        <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 id="exam-form-title" className="text-base font-semibold">
              {exam ? 'Edit exam' : 'Create exam'}
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {exam
                ? 'Change dates, classes, or type. Year-end is set by the exam type.'
                : 'Pick a type, classes, and dates. Results stay hidden until you publish.'}
            </p>
          </div>
          <CloseButton onClick={close} />
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Exam type"
              hint={
                types.length === 0
                  ? 'Superadmin has not assigned any exam types to this school.'
                  : undefined
              }
            >
              <select
                name="exam_type_id"
                required
                value={form.exam_type_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    exam_type_id: e.target.value ? Number(e.target.value) : '',
                  }))
                }
                className={filterSelectClassName}
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
            </Field>
            <Field label="Session year">
              <Input
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
            </Field>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Classes</legend>
            <div id="exam-classes" tabIndex={-1} className="flex flex-wrap gap-2">
              {EXAM_CLASSES.map((level) => {
                const id = `exam-class-${level}`;
                return (
                  <label
                    key={level}
                    htmlFor={id}
                    className="border-border hover:bg-muted/50 pointer-coarse:py-2.5 inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm"
                  >
                    <Checkbox
                      id={id}
                      name="levels"
                      checked={form.levels.includes(level)}
                      onCheckedChange={(value) => toggleLevel(level, value === true)}
                    />
                    Class {level}
                  </label>
                );
              })}
            </div>
            {levelError ? (
              <p className="text-destructive mt-1.5 text-xs" role="alert">
                Select at least one class.
              </p>
            ) : null}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date">
              <Input
                name="start_date"
                type="date"
                required
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </Field>
            <Field label="End date">
              <Input
                name="end_date"
                type="date"
                required
                value={form.end_date}
                onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
              />
            </Field>
            <Field label="Result date">
              <Input
                name="result_date"
                type="date"
                required
                value={form.result_date}
                onChange={(e) => setForm((prev) => ({ ...prev, result_date: e.target.value }))}
              />
            </Field>
            <div className="space-y-1.5">
              <label htmlFor="return_date" className="block text-sm font-medium">
                Marksheet return date
              </label>
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
              <p className="text-muted-foreground text-xs">Optional.</p>
            </div>
          </div>
        </div>

        <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
          <Button type="button" variant="ghost" onClick={close} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || types.length === 0}>
            {saving && <Loader2 className="animate-spin" />}
            {exam ? 'Save changes' : 'Create exam'}
          </Button>
        </div>
      </form>
    </Popup>
  );
}
