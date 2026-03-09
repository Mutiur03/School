import axios from "axios";
import React, { useState, useRef, useMemo, useDeferredValue, useCallback } from "react";
import toast from "react-hot-toast";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ErrorMessage from "@/components/ErrorMessage";
import { PageHeader, SectionCard, StatsCard, Popup } from "@/components";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherFormSchema, type TeacherFormSchemaData } from "@school/shared-schemas";
import { getFileUrl } from "@/lib/backend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteConfirmation from "@/components/DeleteConfimation";
import ActionButton from "@/components/ActionButton";
import { useTeacher } from "@/queries/teacher.queries";

interface Teacher {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  designation: string;
  subject: string;
  available: boolean;
  image?: string;
}

interface PopupState {
  visible: boolean;
  type: string;
  teacher: Teacher | null;
}

const uploadImageToR2 = async (file: File, teacherId: number): Promise<void> => {
  const key = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { data } = await axios.post("/api/teachers/image/upload-url", {
    id: teacherId,
    key,
    contentType: file.type,
  });
  const { uploadUrl, key: r2Key } = data.data;
  await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  await axios.put(`/api/teachers/${teacherId}/image`, { key: r2Key });
};

const TeacherList = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "",
    teacher: null,
  });
  const defaultValues = {
    name: "",
    email: "",
    phone: "",
    address: "",
    designation: "",
  };
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormSchemaData>({
    defaultValues,
    resolver: zodResolver(teacherFormSchema),
    criteriaMode: "firstError",
    mode: "onBlur",
  });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidateTeachers = () =>
    queryClient.invalidateQueries({ queryKey: ["teachers"] });

  const { data: teachersResponse, isLoading, error: teachersError } = useTeacher({ page, limit, search: deferredSearchQuery })

  const teachers = useMemo(() => teachersResponse?.data ?? [], [teachersResponse]);
  const meta = teachersResponse?.meta;

  const errorMessage = teachersError
    ? ((teachersError as { response?: { status?: number } }).response?.status === 404
      ? "No teachers found."
      : "An error occurred while fetching teachers.")
    : "";

  const addMutation = useMutation({
    mutationFn: async ({
      formValues,
      imageFile,
    }: {
      formValues: TeacherFormSchemaData;
      imageFile: File | null;
    }) => {
      await axios.post("/api/teachers", {
        teachers: [formValues],
      });
      // The new API returns an Excel file download, so we need to get the teacher data differently
      // For now, we'll handle it by fetching the teachers list again
      if (imageFile) {
        // We'll need to get the teacher ID after creation
        const teachersResponse = await axios.get("/api/teachers");
        const newTeacher = teachersResponse.data.data.data[teachersResponse.data.data.data.length - 1];
        await uploadImageToR2(imageFile, newTeacher.id);
      }
      return { message: "Teacher added successfully" };
    },
    onSuccess: (data) => {
      toast.success(data.message || "Teacher added successfully.");
      reset(defaultValues);
      setImage(null);
      setShowForm(false);
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "An error occurred while adding the teacher.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      teacher,
      formValues,
      imageFile,
    }: {
      teacher: Teacher;
      formValues: TeacherFormSchemaData;
      imageFile: File | null;
    }) => {
      const response = await axios.put(
        `/api/teachers/${teacher.id}`,
        formValues
      );
      if (imageFile) {
        await uploadImageToR2(imageFile, teacher.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Teacher updated successfully.");
      reset(defaultValues);
      setImage(null);
      setIsEditing(false);
      setShowForm(false);
      setPopup({ visible: false, type: "", teacher: null });
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { error?: string } } }) => {
      toast.error(error.response?.data?.error || "An error occurred while updating the teacher.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teacher: Teacher) => {
      await axios.delete(`/api/teachers/${teacher.id}`);
    },
    onSuccess: () => {
      toast.success("Teacher deleted successfully.");
      invalidateTeachers();
    },
    onError: () => {
      toast.error("Failed to delete teacher.");
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await axios.delete(`/api/teachers/${teacherId}/image`);
    },
    onSuccess: () => {
      toast.success("Image removed.");
      invalidateTeachers();
    },
    onError: () => {
      toast.error("Failed to remove image.");
    },
  });

  const handleEdit = useCallback((teacher: Teacher) => {
    reset({
      name: teacher.name || "",
      email: teacher.email || "",
      phone: teacher.phone || "",
      address: teacher.address || "",
      designation: teacher.designation || "",
    });
    setIsEditing(true);
    setShowForm(true);
    setPopup({ visible: false, type: "", teacher });
  }, [reset, setIsEditing, setShowForm, setPopup]);

  const handleDelete = useCallback((teacher: Teacher) => {
    deleteMutation.mutate(teacher);
  }, [deleteMutation]);

  const closePopup = useCallback(() => {
    setPopup({ visible: false, type: "", teacher: null });
  }, [setPopup]);

  // Reset page when search changes
  React.useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery]);

  const isSubmitting = addMutation.isPending || updateMutation.isPending;
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, [setSearchQuery]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  }, [setImage]);

  const onValidSubmit = useCallback(async (formValues: TeacherFormSchemaData) => {
    if (isEditing && popup.teacher) {
      updateMutation.mutate({ teacher: popup.teacher, formValues, imageFile: image });
    } else {
      addMutation.mutate({ formValues, imageFile: image });
    }
  }, [isEditing, popup.teacher, updateMutation, addMutation, image]);

  const filteredTeachers = useMemo(
    () => teachers.filter((teacher: Teacher) => teacher.available),
    [teachers],
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Teacher List"
        description="Manage teacher records and profile information."
      >
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
          >
            + Add Teacher
          </Button>
        )}
      </PageHeader>

      {showForm && (
        <div className="bg-card rounded-xl border border-border shadow-sm mb-6 overflow-hidden">
          <div className="w-full p-6">
            <h2 className="text-xl font-bold text-foreground mb-6">
              {isEditing ? "Edit Teacher" : "Add Teacher"}
            </h2>
            <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-6">

              {/* Image */}
              <div className="rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex justify-center flex-col items-center">
                  <p className="text-sm font-medium mb-2">Profile Image</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 sm:w-32 aspect-7/9 bg-card border border-border rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    {image ? (
                      <img src={URL.createObjectURL(image)} alt="Preview" className="w-full h-full object-cover" />
                    ) : isEditing && popup.teacher?.image ? (
                      <img src={getFileUrl(popup.teacher.image)} alt="Teacher" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground text-xs sm:text-sm text-center px-1">Click to upload</span>
                    )}
                  </label>
                  {image && (
                    <button
                      type="button"
                      onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Image
                    </button>
                  )}
                  {!image && isEditing && popup.teacher?.image && (
                    <button
                      type="button"
                      onClick={() => removeImageMutation.mutate(popup.teacher!.id)}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Current Image
                    </button>
                  )}
                </div>
              </div>

              {/* Info */}
              <fieldset className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <legend className="px-2 text-sm sm:text-base font-semibold border-l-2 border-primary">Teacher Information</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Name <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's name"
                      {...register("name")}
                    />
                    {errors.name && <ErrorMessage message={errors.name.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Email <span className="text-destructive">*</span></label>
                    <Input
                      type="email"
                      placeholder="Enter teacher's email"
                      {...register("email")}
                    />
                    {errors.email && <ErrorMessage message={errors.email.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Phone <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's phone number"
                      maxLength={11}
                      {...register("phone")}
                    />
                    {errors.phone && <ErrorMessage message={errors.phone.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Designation <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's designation"
                      {...register("designation")}
                    />
                    {errors.designation && <ErrorMessage message={errors.designation.message} />}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium">Home Town</label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's home town"
                      {...register("address")}
                    />
                    {errors.address && <ErrorMessage message={errors.address.message} />}
                  </div>
                </div>
              </fieldset>

              <div className="sticky bottom-0 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/70 border-t border-border pt-4 flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="min-w-24"
                  onClick={() => {
                    setShowForm(false);
                    setIsEditing(false);
                    reset(defaultValues);
                    setImage(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-28">
                  {isSubmitting ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update" : "Add Teacher")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <StatsCard label="Total Teachers" value={meta?.total ?? 0} loading={isLoading} />
        <StatsCard
          label="Showing"
          value={`${filteredTeachers.length} / ${meta?.total ?? 0}`}
          color="blue"
          loading={isLoading}
        />
        <StatsCard label="Available" value={filteredTeachers.length} color="emerald" loading={isLoading} />
      </div>

      <SectionCard className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by name, subject or email..."
            className="pl-10"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </SectionCard>

      <SectionCard noPadding className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                {["Teacher", "Email", "Designation", "Actions"].map((header) => (
                  <th
                    key={header}
                    className={`px-4 py-3 text-xs font-semibold text-foreground/70 uppercase tracking-wider ${header === "Actions" ? "text-right" : "text-left"}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col justify-center items-center gap-2">
                      <Loader2 className="animate-spin h-8 w-8 text-primary" />
                      <p className="text-sm text-muted-foreground dark:text-gray-400">Loading teachers...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher: Teacher) => (
                  <tr key={teacher.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {teacher.image ? (
                          <img src={getFileUrl(teacher.image)} className="w-10 h-10 rounded-full object-cover border border-border" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-sm">
                            {teacher.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-foreground">{teacher.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{teacher.email}</td>
                    <td className="px-4 py-4 text-sm text-muted-foreground">{teacher.designation}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="view"
                          onClick={() => setPopup({ visible: true, type: "view", teacher })}
                        />
                        <ActionButton
                          action="edit"
                          onClick={() => handleEdit(teacher)}
                        />
                        <DeleteConfirmation
                          onDelete={() => handleDelete(teacher)}
                          msg={`Are you sure you want to delete ${teacher.name}?`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {errorMessage || "No teachers found matching your criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Page {meta?.page ?? page} of {meta?.totalPages ?? 0}
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <select
                className="px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {[10, 20, 50, 100].map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const totalPages = meta?.totalPages ?? 0;
              const currentPage = page;
              const maxVisible = 7;
              if (totalPages <= maxVisible) {
                return Array.from({ length: totalPages }, (_, i) => (
                  <Button
                    key={i}
                    type="button"
                    variant={i + 1 === currentPage ? "default" : "outline"}
                    onClick={() => setPage(i + 1)}
                    disabled={isLoading}
                  >
                    {i + 1}
                  </Button>
                ));
              }
              const pages: (number | string)[] = [];
              const half = Math.floor(maxVisible / 2);
              let start = Math.max(1, currentPage - half);
              let end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
              }
              if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push("...");
              }
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
              if (end < totalPages) {
                if (end < totalPages - 1) pages.push("...");
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === "..." ? (
                  <span key={idx} className="px-2 text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <Button
                    key={idx}
                    type="button"
                    variant={p === currentPage ? "default" : "outline"}
                    onClick={() => setPage(p as number)}
                    disabled={isLoading}
                  >
                    {p}
                  </Button>
                )
              );
            })()}
          </div>
        </div>
      </SectionCard>

      {popup.visible && popup.teacher && (
        <Popup open onOpenChange={(o) => !o && closePopup()} size="md">
          {popup.type === "view" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-base font-semibold">Teacher Details</h2>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Profile */}
              <div className="flex flex-col items-center gap-2 py-5 border-b border-border bg-muted/20">
                {popup.teacher.image ? (
                  <img
                    src={getFileUrl(popup.teacher.image)}
                    alt="Profile"
                    className="w-20 aspect-[7/9] object-cover rounded-sm border border-border shadow"
                  />
                ) : (
                  <div className="w-20 aspect-[7/9] rounded-sm border border-border bg-muted flex items-center justify-center text-2xl text-muted-foreground font-bold">
                    {popup.teacher.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="font-semibold text-base">{popup.teacher.name}</p>
                  <p className="text-xs text-muted-foreground">{popup.teacher.designation}</p>
                </div>
                {popup.teacher.subject && (
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">
                    {popup.teacher.subject}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="px-5 py-4 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact & Details</p>
                {[
                  { label: "Email", value: popup.teacher.email },
                  { label: "Phone", value: popup.teacher.phone },
                  { label: "Home Town", value: popup.teacher.address },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label} className="flex text-sm">
                    <span className="w-28 text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border flex justify-end">
                <Button onClick={closePopup} variant="outline" type="button">
                  Close
                </Button>
              </div>
            </>
          )}
        </Popup>
      )}
    </div>
  );
};

export default TeacherList;
