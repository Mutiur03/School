import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useStudents } from '@/queries/students.queries';
import { cn } from '@/lib/utils';
import { selectClass } from '../Accounts/heads';
import { CLASSES, YEARS } from './constants';

export const Select = ({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) => (
  <label className="block space-y-1">
    <span className="text-muted-foreground block text-xs font-medium">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(selectClass, 'w-36', className)}
    >
      {children}
    </select>
  </label>
);

export const YearSelect = ({
  value,
  onChange,
}: {
  value: number;
  onChange: (year: number) => void;
}) => (
  <Select label="Session" value={value} onChange={(v) => onChange(Number(v))} className="w-28">
    {YEARS.map((y) => (
      <option key={y} value={y}>
        {y}
      </option>
    ))}
  </Select>
);

export const ClassSelect = ({
  value,
  onChange,
  allowAll,
}: {
  value: number | '';
  onChange: (cls: number | '') => void;
  allowAll?: boolean;
}) => (
  <Select
    label="Class"
    value={value}
    onChange={(v) => onChange(v === '' ? '' : Number(v))}
    className="w-28"
  >
    <option value="">{allowAll ? 'All classes' : 'Select'}</option>
    {CLASSES.map((c) => (
      <option key={c} value={c}>
        {c}
      </option>
    ))}
  </Select>
);

export type PickedStudent = {
  id: number;
  name: string;
  roll: number;
  section: string;
  class: number;
};

/** Class → section → student. Loads the class once and filters it on the client. */
export const StudentPicker = ({
  year,
  value,
  onChange,
}: {
  year: number;
  value: number | null;
  onChange: (student: PickedStudent | null) => void;
}) => {
  const [cls, setCls] = useState<number | ''>('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useStudents(
    { year, page: 1, limit: 200, level: cls || undefined, sort: 'roll', order: 'asc' },
    { enabled: !!cls },
  );
  const students = useMemo(() => data?.data ?? [], [data]);
  const sections = useMemo(() => [...new Set(students.map((s) => s.section))].sort(), [students]);
  const q = search.trim().toLowerCase();
  const shown = students.filter(
    (s) =>
      (!section || s.section === section) &&
      (!q || s.name.toLowerCase().includes(q) || String(s.roll) === q),
  );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <ClassSelect
        value={cls}
        onChange={(c) => {
          setCls(c);
          setSection('');
          onChange(null);
        }}
      />
      <Select
        label="Section"
        value={section}
        onChange={(s) => {
          setSection(s);
          onChange(null);
        }}
        className="w-28"
      >
        <option value="">All</option>
        {sections.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
      <label className="block space-y-1">
        <span className="text-muted-foreground block text-xs font-medium">Find by name / roll</span>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search"
          className="w-44"
          disabled={!cls}
        />
      </label>
      <Select
        label="Student"
        value={value ?? ''}
        onChange={(v) => {
          const s = students.find((x) => x.id === Number(v));
          onChange(
            s ? { id: s.id, name: s.name, roll: s.roll, section: s.section, class: s.class } : null,
          );
        }}
        className="w-72"
      >
        <option value="">
          {!cls ? 'Pick a class first' : isLoading ? 'Loading…' : 'Select student'}
        </option>
        {shown.map((s) => (
          <option key={s.id} value={s.id}>
            {s.section}-{s.roll} · {s.name}
          </option>
        ))}
      </Select>
    </div>
  );
};
