import { useState, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import { Loader2, Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { levelFormSchema, type LevelFormSchemaData } from "@school/shared-schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, SectionCard, StatsCard, ErrorMessage } from "@/components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionButton from "@/components/ActionButton";
import DeleteConfirmation from "@/components/DeleteConfimation";
import { useLevels } from "@/queries/level.queries";
import { useTeacher } from "@/queries/teacher.queries";

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
  const [searchQuery, setSearchQuery] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LevelFormSchemaData>({
    resolver: zodResolver(levelFormSchema) as any,
    defaultValues: {
      class_name: undefined,
      section: "",
      year: new Date().getFullYear(),
      teacher_id: undefined,
    },
  });

  const invalidateLevels = () => queryClient.invalidateQueries({ queryKey: ["levels"] });

  const { data: levelsResponse, isLoading: isLevelsLoading } = useLevels();
  const { data: teachersResponse, isLoading: isTeachersLoading } = useTeacher({ limit: 100 });

  const assignedLevels = useMemo(() => levelsResponse?.data || [], [levelsResponse]);
  const teachers = useMemo(() => teachersResponse?.data || [], [teachersResponse]);

  const addMutation = useMutation({
    mutationFn: (data: LevelFormSchemaData) => axios.post("/api/level/addLevel", data),
    onSuccess: () => {
      toast.success("Class teacher assigned successfully");
      invalidateLevels();
      reset();
      setShowForm(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to assign teacher");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: LevelFormSchemaData) => axios.put(`/api/level/updateLevel/${editingId}`, data),
    onSuccess: () => {
      toast.success("Assignment updated successfully");
      invalidateLevels();
      reset();
      setShowForm(false);
      setIsEditing(false);
      setEditingId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update assignment");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => axios.delete(`/api/level/deleteLevel/${id}`),
    onSuccess: () => {
      toast.success("Assignment deleted successfully");
      invalidateLevels();
    },
    onError: () => toast.error("Failed to delete assignment"),
  });

  const onValidSubmit = (data: LevelFormSchemaData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      addMutation.mutate(data);
    }
  };

  const handleEdit = useCallback((level: Level) => {
    setEditingId(level.id);
    setIsEditing(true);
    setShowForm(true);
    reset({
      class_name: Number(level.class_name),
      section: level.section,
      year: level.year,
      teacher_id: Number(level.teacher_id),
    });
  }, [reset]);

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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
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
              {isEditing ? "Update Class Teacher" : "Assign New Class Teacher"}
            </h2>
          </div>

          <form onSubmit={handleSubmit((data) => onValidSubmit({ ...data, year: filterYear }))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Class</label>
                <select
                  {...register("class_name")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select Class</option>
                  {[6, 7, 8, 9, 10].map((cls) => (
                    <option key={cls} value={cls}>Class {cls}</option>
                  ))}
                </select>
                {errors.class_name && <ErrorMessage message={errors.class_name.message} />}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Section</label>
                <select
                  {...register("section")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Select Section</option>
                  {["A", "B"].map((sec) => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
                {errors.section && <ErrorMessage message={errors.section.message} />}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Teacher</label>
                <select
                  {...register("teacher_id")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Choose Teacher</option>
                  {teachers.map((teacher: any) => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
                {errors.teacher_id && <ErrorMessage message={errors.teacher_id.message} />}
              </div>
            </div>

            <div className="flex justify-between gap-3 pt-6 border-t border-border/50">
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
                    {isEditing ? "Updating..." : "Assigning..."}
                  </>
                ) : (
                  isEditing ? "Update Assignment" : "Assign Teacher"
                )}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <StatsCard label="Active Assignments" value={assignedLevels.length} loading={isLevelsLoading} />
        <StatsCard label="Total Teachers" value={teachers.length} color="emerald" loading={isTeachersLoading} />
      </div>

      <SectionCard className="mb-6">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Search Assignments</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by teacher or class..."
                className="pl-10 h-10 border-border bg-background/50 hover:bg-background transition-colors"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Academic Year</label>
            <div className="relative">
              <select
                value={filterYear}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterYear(Number(e.target.value))}
                className="flex h-10 w-full rounded-md border border-border bg-background/50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-background transition-colors cursor-pointer font-medium"
              >
                {[0, 1, 2].map((offset) => {
                  const yr = new Date().getFullYear() - offset + 1;
                  return <option key={yr} value={yr}>{yr}</option>;
                })}
              </select>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                {["Class", "Section", "Assigned Teacher", "Actions"].map((head) => (
                  <th key={head} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${head === "Actions" ? "text-right" : ""}`}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {isLevelsLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                    Loading assignments...
                  </td>
                </tr>
              ) : filteredLevels.length > 0 ? (
                filteredLevels.map((level: Level) => (
                  <tr key={level.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4 font-medium">Class {level.class_name}</td>
                    <td className="px-4 py-4">{level.section}</td>
                    <td className="px-4 py-4">
                      {level.teacher_name || "Unknown"}
                    </td>
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
                  <td colSpan={5} className="py-12 text-center text-muted-foreground font-medium">
                    No teacher assignments found for the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

export default AddLevel;
