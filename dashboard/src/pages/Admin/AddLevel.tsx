import { useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { Loader2, Plus, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { levelFormSchema, type LevelFormSchemaData } from '@school/shared-schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PageHeader,
  SectionCard,
  StatsCard,
  ErrorMessage,
  FilterSelection,
  FilterField,
  filterSelectClassName,
  filterInputClassName,
} from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActionButton from '@/components/ActionButton';
import DeleteConfirmation from '@/components/DeleteConfimation';
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

const AddLevel = () => {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');

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
      year: new Date().getFullYear(),
      teacher_id: undefined,
    },
  });

  const invalidateLevels = () => queryClient.invalidateQueries({ queryKey: ['levels'] });

  const { data: levelsResponse, isLoading: isLevelsLoading } = useLevels();
  const { data: teachersResponse, isLoading: isTeachersLoading } = useTeacher({ limit: 100 });

  const assignedLevels = useMemo(() => levelsResponse?.data || [], [levelsResponse]);
  const teachers = useMemo(() => teachersResponse?.data || [], [teachersResponse]);

  const addMutation = useMutation({
    mutationFn: (data: LevelFormSchemaData) => axios.post('/api/level/addLevel', data),
    onSuccess: () => {
      toast.success('Class teacher assigned successfully');
      invalidateLevels();
      reset();
      setShowForm(false);
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
      reset();
      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);
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
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = useCallback(
    (level: Level) => {
      setEditingId(level.id);
      setIsEditing(true);
      setShowForm(true);
      reset({
        class_name: Number(level.class_name),
        section: level.section,
        year: level.year,
        teacher_id: Number(level.teacher_id),
      });
    },
    [reset],
  );

  const filteredLevels = useMemo(() => {
    return assignedLevels.filter((level: Level) => {
      const matchesYear = level.year === filterYear;
      const matchesSearch =
        level.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        `Class ${level.class_name}`.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  }, [assignedLevels, filterYear, searchQuery]);

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Class Teacher Assignment"
        description="Assign teachers to specific classes and sections per year."
      >
        <div className="flex flex-wrap gap-3">
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" /> Assign Teacher
            </Button>
          )}
        </div>
      </PageHeader>

      {showForm && (
        <SectionCard className="mb-8">
          <div className="mb-6">
            <h2 className="text-xl font-bold">
              {isEditing ? 'Update Class Teacher' : 'Assign New Class Teacher'}
            </h2>
          </div>

          <form
            onSubmit={handleSubmit((data) => onValidSubmit({ ...data, year: filterYear }))}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <select
                  {...register('class_name')}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">Select Class</option>
                  {[6, 7, 8, 9, 10].map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
                {errors.class_name && <ErrorMessage message={errors.class_name.message} />}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Section</label>
                <select
                  {...register('section')}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">Select Section</option>
                  {['A', 'B'].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
                {errors.section && <ErrorMessage message={errors.section.message} />}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Teacher</label>
                <select
                  {...register('teacher_id')}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="">Choose Teacher</option>
                  {teachers.map((teacher: any) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
                {errors.teacher_id && <ErrorMessage message={errors.teacher_id.message} />}
              </div>
            </div>

            <div className="border-border/50 flex justify-between gap-3 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setIsEditing(false);
                  reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Assigning...'}
                  </>
                ) : isEditing ? (
                  'Update Assignment'
                ) : (
                  'Assign Teacher'
                )}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatsCard
          label="Active Assignments"
          value={assignedLevels.length}
          loading={isLevelsLoading}
        />
        <StatsCard
          label="Total Teachers"
          value={teachers.length}
          color="emerald"
          loading={isTeachersLoading}
        />
      </div>

      <FilterSelection className="mb-6">
        <FilterField label="Search" wide>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by teacher or class..."
              className={`${filterInputClassName} pl-10`}
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            />
          </div>
        </FilterField>

        <FilterField label="Academic Year">
          <select
            value={filterYear}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setFilterYear(Number(e.target.value))
            }
            className={filterSelectClassName}
          >
            {[0, 1, 2].map((offset) => {
              const yr = new Date().getFullYear() - offset + 1;
              return (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              );
            })}
          </select>
        </FilterField>
      </FilterSelection>

      <SectionCard noPadding>
        {/* Desktop table */}
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] lg:block">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border border-b">
                {['Class', 'Section', 'Assigned Teacher', 'Actions'].map((head) => (
                  <th
                    key={head}
                    className={`text-muted-foreground px-4 py-3 text-xs font-semibold tracking-wider uppercase ${head === 'Actions' ? 'text-right' : ''} ${head === 'Class' ? 'bg-muted border-border/50 sticky left-0 z-20 border-r shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]' : ''}`}
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y text-sm">
              {isLevelsLoading ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-12 text-center">
                    <Loader2 className="text-primary mx-auto mb-2 h-8 w-8 animate-spin" />
                    Loading assignments...
                  </td>
                </tr>
              ) : filteredLevels.length > 0 ? (
                filteredLevels.map((level: Level) => (
                  <tr key={level.id} className="hover:bg-muted/50 transition-colors">
                    <td className="bg-card border-border/50 sticky left-0 z-10 border-r px-4 py-4 font-medium shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      Class {level.class_name}
                    </td>
                    <td className="px-4 py-4">{level.section}</td>
                    <td className="px-4 py-4">{level.teacher_name || 'Unknown'}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <ActionButton action="edit" onClick={() => handleEdit(level)} />
                        <DeleteConfirmation
                          onDelete={() => deleteMutation.mutate(level.id)}
                          msg={`Are you sure you want to remove ${level.teacher_name} from Class ${level.class_name} Section ${level.section}?`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-12 text-center font-medium">
                    No teacher assignments found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden">
          {isLevelsLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Loading assignments…</p>
            </div>
          ) : filteredLevels.length > 0 ? (
            <ul className="space-y-3 p-4">
              {filteredLevels.map((level: Level) => (
                <li
                  key={level.id}
                  className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        Class {level.class_name} · Section {level.section}
                      </p>
                      <p className="text-muted-foreground mt-0.5 truncate text-sm">
                        {level.teacher_name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ActionButton action="edit" onClick={() => handleEdit(level)} />
                      <DeleteConfirmation
                        onDelete={() => deleteMutation.mutate(level.id)}
                        msg={`Are you sure you want to remove ${level.teacher_name} from Class ${level.class_name} Section ${level.section}?`}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm font-medium">
              No teacher assignments found for the current filters.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
};

export default AddLevel;
