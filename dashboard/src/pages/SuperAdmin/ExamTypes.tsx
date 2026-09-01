import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import {
  Building2,
  ChevronRight,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  SchoolLogo,
  ExamTypeRowSkeleton,
  SchoolListItemSkeleton,
} from '@/components';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import type { ExamType } from '@/queries/exam.queries';

function classLabel(levels: number[]) {
  if (levels.length === 0) return 'No classes';
  return `Class ${levels.join(', ')}`;
}

interface SchoolRow {
  id: number;
  name: string;
  shortName?: string | null;
  logo?: string | null;
}

const emptyTypeForm = {
  name: '',
  is_year_end: false,
  sort_order: 0,
  assign_to_new_schools: true,
};

function apiError(error: unknown, fallback: string) {
  const err = error as AxiosError<{ message?: string; error?: string }>;
  return err.response?.data?.message || err.response?.data?.error || fallback;
}

function SearchField({
  id,
  value,
  placeholder,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        className="h-9 pl-9"
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function TypeFlags({ type }: { type: ExamType }) {
  return (
    <div className="flex flex-wrap gap-1">
      {type.is_year_end ? <Badge>Year end</Badge> : null}
      {type.assign_to_new_schools ? <Badge variant="outline">New schools</Badge> : null}
    </div>
  );
}

export default function ExamTypes() {
  const { confirm, dialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const [types, setTypes] = useState<ExamType[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [typeForm, setTypeForm] = useState(emptyTypeForm);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState('');
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolTypeQuery, setSchoolTypeQuery] = useState('');
  const [schoolTypeIds, setSchoolTypeIds] = useState<number[]>([]);
  const [savingSchool, setSavingSchool] = useState(false);

  const selectedSchoolId = Number(searchParams.get('school')) || null;
  const selectedSchool = schools.find((school) => school.id === selectedSchoolId) ?? null;
  const usedTypeId = Number(searchParams.get('used')) || null;
  const usedType = types.find((type) => type.id === usedTypeId) ?? null;

  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    const isInitial = !hasLoadedOnce.current;
    if (isInitial) {
      setLoading(true);
      setLoadError(false);
    } else {
      setRefreshing(true);
    }
    try {
      const [typeRes, schoolRes] = await Promise.all([
        axios.get('/api/exam-types'),
        axios.get('/api/schools'),
      ]);
      setTypes(Array.isArray(typeRes.data?.data) ? typeRes.data.data : []);
      const schoolList = Array.isArray(schoolRes.data?.data) ? schoolRes.data.data : [];
      setSchools(
        schoolList.map((s: SchoolRow) => ({
          id: s.id,
          name: s.name,
          shortName: s.shortName,
          logo: s.logo,
        })),
      );
      hasLoadedOnce.current = true;
      setLoadError(false);
    } catch (error) {
      if (isInitial) setLoadError(true);
      toast.error(apiError(error, 'Could not load exam types'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedSchoolId) {
      setSchoolTypeIds([]);
      return;
    }
    setSchoolTypeIds(
      types.filter((type) => type.school_ids?.includes(selectedSchoolId)).map((type) => type.id),
    );
    setSchoolTypeQuery('');
  }, [selectedSchoolId, types]);

  const visibleTypes = useMemo(() => {
    const needle = typeQuery.trim().toLowerCase();
    if (!needle) return types;
    return types.filter((type) => type.name.toLowerCase().includes(needle));
  }, [types, typeQuery]);

  const visibleSchools = useMemo(() => {
    const needle = schoolQuery.trim().toLowerCase();
    if (!needle) return schools;
    return schools.filter(
      (school) =>
        school.name.toLowerCase().includes(needle) ||
        (school.shortName ?? '').toLowerCase().includes(needle),
    );
  }, [schools, schoolQuery]);

  const schoolDialogTypes = useMemo(() => {
    const needle = schoolTypeQuery.trim().toLowerCase();
    if (!needle) return types;
    return types.filter((type) => type.name.toLowerCase().includes(needle));
  }, [types, schoolTypeQuery]);

  const typeCountBySchool = useMemo(() => {
    const counts = new Map<number, number>();
    for (const type of types) {
      for (const schoolId of type.school_ids ?? []) {
        counts.set(schoolId, (counts.get(schoolId) ?? 0) + 1);
      }
    }
    return counts;
  }, [types]);

  const resetTypeForm = () => {
    setTypeForm(emptyTypeForm);
    setEditingId(null);
    setTypeDialogOpen(false);
  };

  const startCreateType = () => {
    setEditingId(null);
    setTypeForm(emptyTypeForm);
    setTypeDialogOpen(true);
  };

  const startEditType = (type: ExamType) => {
    setEditingId(type.id);
    setTypeForm({
      name: type.name,
      is_year_end: type.is_year_end,
      sort_order: type.sort_order,
      assign_to_new_schools: type.assign_to_new_schools ?? false,
    });
    setTypeDialogOpen(true);
  };

  const openSchool = (schoolId: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('school', String(schoolId));
        next.delete('used');
        return next;
      },
      { replace: true },
    );
  };

  const closeSchool = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('school');
        return next;
      },
      { replace: true },
    );
  };

  const openUsedBy = (typeId: number) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('used', String(typeId));
        next.delete('school');
        return next;
      },
      { replace: true },
    );
  };

  const closeUsedBy = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('used');
        return next;
      },
      { replace: true },
    );
  };

  const handleTypeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const response = await axios.put(`/api/exam-types/${editingId}`, typeForm);
        const cascade = response.data?.data?.cascade as
          { updated?: number; skipped_frozen?: number; skipped_overlap?: number } | undefined;
        const updatedCount = cascade?.updated ?? 0;
        const skippedFrozen = cascade?.skipped_frozen ?? 0;
        const skippedOverlap = cascade?.skipped_overlap ?? 0;
        if (updatedCount || skippedFrozen || skippedOverlap) {
          const bits = [`${updatedCount} exam${updatedCount === 1 ? '' : 's'} updated`];
          if (skippedFrozen) bits.push(`${skippedFrozen} frozen skipped`);
          if (skippedOverlap) bits.push(`${skippedOverlap} overlap skipped`);
          toast.success(bits.join('. '));
        } else {
          toast.success('Exam type updated');
        }
      } else {
        await axios.post('/api/exam-types', typeForm);
        toast.success('Exam type created');
      }
      resetTypeForm();
      await load();
    } catch (error) {
      toast.error(apiError(error, 'Could not save exam type'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteType = async (type: ExamType) => {
    const ok = await confirm({
      title: 'Delete exam type?',
      msg:
        (type.exam_count ?? 0) > 0
          ? `“${type.name}” is used by ${type.exam_count} exam${type.exam_count === 1 ? '' : 's'}. Delete those exams first.`
          : `Delete “${type.name}”? Schools lose this option.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/exam-types/${type.id}`);
      toast.success('Exam type deleted');
      if (editingId === type.id) resetTypeForm();
      await load();
    } catch (error) {
      toast.error(apiError(error, 'Could not delete exam type'));
    }
  };

  const toggleSchoolType = (typeId: number, checked: boolean) => {
    setSchoolTypeIds((prev) => (checked ? [...prev, typeId] : prev.filter((id) => id !== typeId)));
  };

  const handleSaveSchoolTypes = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    setSavingSchool(true);
    try {
      await axios.put(`/api/exam-types/school/${selectedSchoolId}`, {
        exam_type_ids: schoolTypeIds,
      });
      toast.success(`Exam types updated for ${selectedSchool?.name ?? 'school'}`);
      await load();
      closeSchool();
    } catch (error) {
      toast.error(apiError(error, 'Could not update school exam types'));
    } finally {
      setSavingSchool(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Exams"
        description="Global catalog and which types each school can create."
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => void load()}
            disabled={loading || refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            onClick={startCreateType}
            disabled={loading}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create type
          </Button>
        </div>
      </PageHeader>

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load exam data</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Check your connection and try again.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          'relative grid grid-cols-1 gap-6 lg:grid-cols-12',
          refreshing && 'pointer-events-none opacity-60',
        )}
      >
        {refreshing ? (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center pt-2"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="bg-background/90 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Updating…
            </span>
          </div>
        ) : null}
        <SectionCard
          className="lg:col-span-7"
          title="Exam types"
          description={`${types.length} in catalog`}
          icon={<ClipboardList size={20} />}
        >
          <SearchField
            id="exam-type-search"
            value={typeQuery}
            placeholder="Search types…"
            onChange={setTypeQuery}
            disabled={loading}
          />

          {loading ? (
            <ul
              className="mt-3 divide-y rounded-lg border"
              aria-busy="true"
              aria-label="Loading exam types"
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <ExamTypeRowSkeleton key={index} />
              ))}
            </ul>
          ) : loadError ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Exam types could not be loaded.
            </p>
          ) : visibleTypes.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {types.length === 0
                ? 'No exam types yet. Create the first type.'
                : 'No types match that search.'}
            </p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border">
              {visibleTypes.map((type) => {
                const examCount = type.exam_count ?? 0;
                const schoolCount = type.school_ids?.length ?? 0;
                const canDelete = examCount === 0;
                return (
                  <li
                    key={type.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground font-medium">{type.name}</p>
                      <div className="mt-1.5">
                        <TypeFlags type={type} />
                      </div>
                      <p className="text-muted-foreground mt-2 text-xs tabular-nums">
                        {schoolCount} school{schoolCount === 1 ? '' : 's'}
                        <span aria-hidden="true"> · </span>
                        {examCount > 0 ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => openUsedBy(type.id)}
                          >
                            {examCount} exam instance{examCount === 1 ? '' : 's'}
                          </button>
                        ) : (
                          '0 exam instances'
                        )}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 sm:flex sm:shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => startEditType(type)}
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canDelete}
                        title={
                          canDelete
                            ? `Delete ${type.name}`
                            : `Used by ${examCount} exam${examCount === 1 ? '' : 's'}`
                        }
                        onClick={() => void handleDeleteType(type)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          className="lg:col-span-5"
          title="Schools"
          description="Assign catalog types per tenant"
          icon={<Building2 size={20} />}
        >
          <SearchField
            id="exam-school-search"
            value={schoolQuery}
            placeholder="Search schools…"
            onChange={setSchoolQuery}
            disabled={loading}
          />

          {loading ? (
            <ul
              className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1"
              aria-busy="true"
              aria-label="Loading schools"
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <SchoolListItemSkeleton key={index} />
              ))}
            </ul>
          ) : loadError ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              Schools could not be loaded.
            </p>
          ) : visibleSchools.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {schools.length === 0 ? 'No schools yet.' : 'No schools match that search.'}
            </p>
          ) : (
            <ul className="mt-3 max-h-[32rem] space-y-2 overflow-y-auto pr-1">
              {visibleSchools.map((school) => {
                const count = typeCountBySchool.get(school.id) ?? 0;
                const isOpen = selectedSchoolId === school.id;
                return (
                  <li key={school.id}>
                    <button
                      type="button"
                      onClick={() => openSchool(school.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                        'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                        isOpen
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/40 hover:bg-accent/30',
                      )}
                    >
                      <SchoolLogo logo={school.logo} className="h-10 w-10" />
                      <span className="min-w-0 flex-1">
                        <span className="text-foreground block truncate font-medium">
                          {school.name}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {school.shortName ? `${school.shortName} · ` : ''}
                          {count} type{count === 1 ? '' : 's'} assigned
                        </span>
                      </span>
                      <ChevronRight
                        className="text-muted-foreground h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>
      </div>

      <Dialog
        open={typeDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetTypeForm();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit exam type' : 'Create exam type'}</DialogTitle>
            <DialogDescription>
              Year-end types drive pass/fail and promotion. Changing year-end updates open school
              exams automatically (frozen or overlapping ones are skipped).
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTypeSubmit} className="space-y-4" autoComplete="off">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="exam-type-name">Name</Label>
                <Input
                  id="exam-type-name"
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                  maxLength={100}
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam-type-sort">Sort order</Label>
                <Input
                  id="exam-type-sort"
                  type="number"
                  inputMode="numeric"
                  value={typeForm.sort_order}
                  onChange={(e) =>
                    setTypeForm((prev) => ({ ...prev, sort_order: Number(e.target.value) }))
                  }
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-md border p-3">
              <label htmlFor="flag-year-end" className="inline-flex items-start gap-2 text-sm">
                <Checkbox
                  id="flag-year-end"
                  className="mt-0.5"
                  checked={typeForm.is_year_end}
                  onCheckedChange={(value) =>
                    setTypeForm((prev) => ({ ...prev, is_year_end: value === true }))
                  }
                />
                <span>
                  <span className="font-medium">Year-end official result</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Only this exam&apos;s marks count for GPA, merit, and promotion.
                  </span>
                </span>
              </label>
              <label htmlFor="flag-new-schools" className="inline-flex items-start gap-2 text-sm">
                <Checkbox
                  id="flag-new-schools"
                  className="mt-0.5"
                  checked={typeForm.assign_to_new_schools}
                  onCheckedChange={(value) =>
                    setTypeForm((prev) => ({ ...prev, assign_to_new_schools: value === true }))
                  }
                />
                <span>
                  <span className="font-medium">Assign to new schools</span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    Auto-enable when a new tenant is created.
                  </span>
                </span>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetTypeForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : editingId ? (
                  'Save type'
                ) : (
                  'Create type'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedSchool}
        onOpenChange={(open) => {
          if (!open) closeSchool();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-pretty">
              {selectedSchool ? `Exam types · ${selectedSchool.name}` : 'Exam types'}
            </DialogTitle>
            <DialogDescription>
              Choose which catalog types this school can create. Unchecking a type does not delete
              exams already created.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveSchoolTypes} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs tabular-nums">
                {schoolTypeIds.length} of {types.length} selected
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSchoolTypeIds(types.map((type) => type.id))}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSchoolTypeIds([])}
                >
                  None
                </Button>
              </div>
            </div>
            <SearchField
              id="school-type-search"
              value={schoolTypeQuery}
              placeholder="Search types…"
              onChange={setSchoolTypeQuery}
            />
            <div className="border-border max-h-64 overflow-y-auto overscroll-contain rounded-md border p-2">
              {schoolDialogTypes.length === 0 ? (
                <p className="text-muted-foreground px-1 py-6 text-center text-sm">
                  {types.length === 0
                    ? 'Create an exam type first.'
                    : 'No types match that search.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {schoolDialogTypes.map((type) => {
                    const id = `school-type-${type.id}`;
                    return (
                      <li key={type.id}>
                        <label
                          htmlFor={id}
                          className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                        >
                          <Checkbox
                            id={id}
                            checked={schoolTypeIds.includes(type.id)}
                            onCheckedChange={(value) => toggleSchoolType(type.id, value === true)}
                          />
                          <span className="min-w-0 flex-1 truncate">{type.name}</span>
                          {type.is_year_end ? (
                            <Badge variant="outline" className="shrink-0">
                              Year end
                            </Badge>
                          ) : null}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeSchool}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingSchool || types.length === 0 || loading}>
                {savingSchool ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  'Save types'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!usedType}
        onOpenChange={(open) => {
          if (!open) closeUsedBy();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-pretty">
              {usedType ? `In use · ${usedType.name}` : 'In use'}
            </DialogTitle>
            <DialogDescription>
              School exam instances using this type. Remove them in the school admin panel before
              deleting the catalog entry.
            </DialogDescription>
          </DialogHeader>
          <div className="border-border max-h-80 overflow-y-auto overscroll-contain rounded-md border">
            {(usedType?.used_by ?? []).length === 0 ? (
              <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                No exams use this type.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {(usedType?.used_by ?? []).map((row, index) => (
                  <li
                    key={`${row.school_id}-${row.exam_year}-${index}`}
                    className="px-4 py-3 text-sm"
                  >
                    <p className="text-foreground truncate font-medium">{row.school_name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {row.exam_year} · {classLabel(row.levels)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeUsedBy}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
