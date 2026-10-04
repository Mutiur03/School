import { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { levelFormSchema, type LevelFormSchemaData } from '@school/shared-schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  SectionCard,
  Popup,
  ConfirmationPopup,
  ErrorMessage,
  filterSelectClassName,
} from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { cn } from '@/lib/utils';
import { useLevels } from '@/queries/level.queries';
import { useTeacher } from '@/queries/teacher.queries';

interface Level {
  id: string;
  class_name: string;
  section: string;
  year: number;
  teacher_id: string;
  teacher_name?: string;
}

const CLASSES = [6, 7, 8, 9, 10];
const SECTIONS = ['A', 'B'];

// Opaque so the pinned Class cell hides what scrolls under it.
const stickyCell = 'sticky left-0 z-[1] bg-inherit shadow-[1px_0_0_var(--border)]';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

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

const AddLevel = () => {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isEditing = editingId !== null;
  const [filterYear, setFilterYear] = useState(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilters, setClassFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: 'class' | 'teacher'; order: SortOrder } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Level | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LevelFormSchemaData>({
    resolver: zodResolver(levelFormSchema) as any,
    defaultValues: {
      class_name: undefined,
      section: '',
      year: currentYear,
      teacher_id: undefined,
    },
  });

  const invalidateLevels = () => queryClient.invalidateQueries({ queryKey: ['levels'] });

  const { data: levelsResponse, isLoading: isLevelsLoading } = useLevels();
  const { data: teachersResponse, isLoading: isTeachersLoading } = useTeacher({ limit: 100 });

  const assignedLevels = useMemo<Level[]>(() => levelsResponse?.data || [], [levelsResponse]);
  const teachers = useMemo(() => teachersResponse?.data || [], [teachersResponse]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    reset();
  };

  const addMutation = useMutation({
    mutationFn: (data: LevelFormSchemaData) => axios.post('/api/level/addLevel', data),
    onSuccess: () => {
      toast.success('Class teacher assigned successfully');
      invalidateLevels();
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to assign teacher');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: LevelFormSchemaData) =>
      axios.put(`/api/level/updateLevel/${editingId}`, data),
    onSuccess: () => {
      toast.success('Assignment updated successfully');
      invalidateLevels();
      closeForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update assignment');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/level/deleteLevel/${id}`),
    onSuccess: () => {
      toast.success('Assignment deleted successfully');
      invalidateLevels();
    },
    onError: () => toast.error('Failed to delete assignment'),
  });

  const onValidSubmit = (data: LevelFormSchemaData) => {
    if (isEditing) updateMutation.mutate(data);
    else addMutation.mutate(data);
  };

  const openCreate = () => {
    setEditingId(null);
    reset({ class_name: undefined, section: '', year: filterYear, teacher_id: undefined });
    setShowForm(true);
  };

  const handleEdit = (level: Level) => {
    setEditingId(level.id);
    setShowForm(true);
    reset({
      class_name: Number(level.class_name),
      section: level.section,
      year: level.year,
      teacher_id: Number(level.teacher_id),
    });
  };

  const yearLevels = useMemo(
    () => assignedLevels.filter((level) => level.year === filterYear),
    [assignedLevels, filterYear],
  );

  const filteredLevels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const rows = yearLevels.filter(
      (level) =>
        (classFilters.length === 0 || classFilters.includes(String(level.class_name))) &&
        (!q ||
          level.teacher_name?.toLowerCase().includes(q) ||
          `Class ${level.class_name}`.toLowerCase().includes(q)),
    );
    if (!sort) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      sort.key === 'class'
        ? dir * (Number(a.class_name) - Number(b.class_name) || a.section.localeCompare(b.section))
        : dir * (a.teacher_name ?? '').localeCompare(b.teacher_name ?? ''),
    );
  }, [yearLevels, classFilters, searchQuery, sort]);

  const filtersActive = classFilters.length > 0 || searchQuery !== '';
  const clearFilters = () => {
    setClassFilters([]);
    setSearchQuery('');
  };

  const sortProps = (key: 'class' | 'teacher') => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });

  const isSubmitting = addMutation.isPending || updateMutation.isPending;
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1];

  const summary =
    isLevelsLoading || isTeachersLoading
      ? ' '
      : `${plural(yearLevels.length, 'assignment')} in ${filterYear} · ${plural(teachers.length, 'teacher')}`;

  const rowActions = (level: Level) => (
    // modal={false}: items open dialogs; a modal menu would leave pointer-events locked
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ActionButton
          iconOnly
          label="More actions"
          icon={<MoreHorizontal size={16} />}
          className="pointer-coarse:h-11 pointer-coarse:w-11"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate normal-case tracking-normal">
          Class {level.class_name} · Section {level.section}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => handleEdit(level)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(level)}>
          <Trash2 /> Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const columns = [
    {
      label: 'Class',
      className: cn(stickyCell, 'px-4'),
      header: (
        <ColumnHeaderMenu
          label="Class"
          {...sortProps('class')}
          options={CLASSES.map((c) => ({ value: String(c), label: `Class ${c}` }))}
          selected={classFilters}
          onSelectedChange={setClassFilters}
        />
      ),
    },
    { label: 'Section', className: 'w-32 px-4', header: 'Section' },
    {
      label: 'Teacher',
      className: 'px-4',
      header: (
        <ColumnHeaderMenu
          label="Teacher"
          {...sortProps('teacher')}
          filterInput={{
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: 'Teacher or class…',
          }}
        />
      ),
    },
    {
      label: 'Actions',
      className: 'w-px px-3 text-right',
      header: filtersActive ? (
        <ActionButton
          iconOnly
          label="Clear filters"
          icon={<X size={16} />}
          onClick={clearFilters}
        />
      ) : (
        <span className="sr-only">Actions</span>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">Class Teachers</h1>
            <select
              aria-label="Academic year"
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className={cn(filterSelectClassName, 'h-8 w-auto font-medium tabular-nums')}
            >
              {yearOptions.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> Assign teacher
        </Button>
      </header>

      <SectionCard noPadding>
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className={cn(
                      'text-foreground/70 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLevelsLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredLevels.length > 0 ? (
                filteredLevels.map((level) => (
                  <tr
                    key={level.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td
                      className={cn(stickyCell, 'whitespace-nowrap px-4 py-2 text-sm font-medium')}
                    >
                      Class {level.class_name}
                    </td>
                    <td className="px-4 py-2 text-sm">{level.section}</td>
                    <td className="px-4 py-2 text-sm">
                      {level.teacher_name || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(level)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>
                    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
                      {filtersActive ? (
                        <>
                          <p>No assignments match these filters.</p>
                          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                            <X /> Clear filters
                          </Button>
                        </>
                      ) : (
                        <>
                          <p>No class teachers assigned for {filterYear}.</p>
                          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
                            <Plus /> Assign teacher
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        confirmLabel="Remove"
        msg={`Are you sure you want to remove ${deleteTarget?.teacher_name ?? 'this teacher'} from Class ${deleteTarget?.class_name} Section ${deleteTarget?.section}?`}
      />

      <Popup
        open={showForm}
        onOpenChange={(o) => !o && !isSubmitting && closeForm()}
        size="md"
        aria-labelledby="level-form-title"
      >
        <form onSubmit={handleSubmit((data) => onValidSubmit({ ...data, year: filterYear }))}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="level-form-title" className="text-base font-semibold">
              {isEditing ? 'Update class teacher' : 'Assign class teacher'}
              <span className="text-muted-foreground font-normal tabular-nums">
                {' '}
                · {filterYear}
              </span>
            </h2>
            <CloseButton onClick={closeForm} />
          </div>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium">Class</span>
                <select {...register('class_name')} className={filterSelectClassName}>
                  <option value="">Select class</option>
                  {CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
                {errors.class_name && <ErrorMessage message={errors.class_name.message} />}
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-medium">Section</span>
                <select {...register('section')} className={filterSelectClassName}>
                  <option value="">Select section</option>
                  {SECTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
                {errors.section && <ErrorMessage message={errors.section.message} />}
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="block text-sm font-medium">Teacher</span>
              <select {...register('teacher_id')} className={filterSelectClassName}>
                <option value="">
                  {isTeachersLoading ? 'Loading teachers…' : 'Choose teacher'}
                </option>
                {teachers.map((teacher: any) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.name}
                  </option>
                ))}
              </select>
              {errors.teacher_id && <ErrorMessage message={errors.teacher_id.message} />}
            </label>
          </div>

          <div className="border-border flex items-center justify-end gap-2 border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isSubmitting
                ? isEditing
                  ? 'Updating…'
                  : 'Assigning…'
                : isEditing
                  ? 'Update assignment'
                  : 'Assign teacher'}
            </Button>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default AddLevel;
