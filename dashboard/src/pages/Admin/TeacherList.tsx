import axios from "axios";
import React, { useState, useRef, useMemo, useDeferredValue, useCallback } from "react";
import toast from "react-hot-toast";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ErrorMessage from "@/components/ErrorMessage";
import { PageHeader, SectionCard, StatsCard, Popup, ConfirmationPopup } from "@/components";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherFormSchema, type TeacherFormSchemaData } from "@school/shared-schemas";
import { getFileUrl } from "@/lib/backend";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import DeleteConfirmation from "@/components/DeleteConfimation";
import ActionButton from "@/components/ActionButton";
import { useTeacher } from "@/queries/teacher.queries";
import type { Teacher } from "@/types/teachers";

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

const uploadSignatureToR2 = async (file: File, teacherId: number): Promise<void> => {
  const key = `signature-${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
  const { data } = await axios.post("/api/teachers/signature/upload-url", {
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
  await axios.put(`/api/teachers/${teacherId}/signature`, { key: r2Key });
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
  const [signature, setSignature] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<number>>(() => new Set());
  const [bulkRotateOpen, setBulkRotateOpen] = useState(false);

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
      signatureFile,
    }: {
      formValues: TeacherFormSchemaData;
      imageFile: File | null;
      signatureFile: File | null;
    }) => {
      const response = await axios.post("/api/teachers", {
        teachers: [formValues],
      });
      const newTeacher = response.data.data.teachers[0];
      if (imageFile) {
        await uploadImageToR2(imageFile, newTeacher.id);
      }
      if (signatureFile) {
        await uploadSignatureToR2(signatureFile, newTeacher.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Teacher added successfully.");
      reset(defaultValues);
      setImage(null);
      setSignature(null);
      setShowForm(false);
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "An error occurred while adding the teacher.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      teacher,
      formValues,
      imageFile,
      signatureFile,
    }: {
      teacher: Teacher;
      formValues: TeacherFormSchemaData;
      imageFile: File | null;
      signatureFile: File | null;
    }) => {
      const response = await axios.put(
        `/api/teachers/${teacher.id}`,
        formValues
      );
      if (imageFile) {
        await uploadImageToR2(imageFile, teacher.id);
      }
      if (signatureFile) {
        await uploadSignatureToR2(signatureFile, teacher.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Teacher updated successfully.");
      reset(defaultValues);
      setImage(null);
      setSignature(null);
      setIsEditing(false);
      setShowForm(false);
      setPopup({ visible: false, type: "", teacher: null });
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || "An error occurred while updating the teacher.");
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

  const removeSignatureMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await axios.delete(`/api/teachers/${teacherId}/signature`);
    },
    onSuccess: () => {
      toast.success("Signature removed.");
      invalidateTeachers();
    },
    onError: () => {
      toast.error("Failed to remove signature.");
    },
  });

  const bulkRotateMutation = useMutation({
    mutationFn: async (teacherIds: number[]) => {
      const response = await axios.post(
        "/api/teachers/password-rotations",
        { teacherIds },
        { responseType: "blob" }
      );
      return response.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "rotated_passwords.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Passwords rotated successfully. Excel downloaded.");
      setSelectedTeacherIds(new Set());
      invalidateTeachers();
      setBulkRotateOpen(false);
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to rotate passwords. Please try again.");
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
      updateMutation.mutate({ teacher: popup.teacher, formValues, imageFile: image, signatureFile: signature });
    } else {
      addMutation.mutate({ formValues, imageFile: image, signatureFile: signature });
    }
  }, [isEditing, popup.teacher, updateMutation, addMutation, image, signature]);

  const filteredTeachers = useMemo(
    () => teachers.filter((teacher: Teacher) => teacher.available),
    [teachers],
  );

  const onToggleSelect = useCallback((teacherId: number) => {
    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
  }, []);

  const visibleTeacherIds = useMemo(() => filteredTeachers.map((t: Teacher) => t.id), [filteredTeachers]);
  const visibleTeacherIdSet = useMemo(() => new Set<number>(visibleTeacherIds), [visibleTeacherIds]);

  const selectedVisibleCount = useMemo(() => {
    let count = 0;
    selectedTeacherIds.forEach((id) => {
      if (visibleTeacherIdSet.has(id)) count += 1;
    });
    return count;
  }, [selectedTeacherIds, visibleTeacherIdSet]);

  const allVisibleSelected =
    visibleTeacherIds.length > 0 && selectedVisibleCount === visibleTeacherIds.length;

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedTeacherIds((prev) => {
        const next = new Set(prev);
        visibleTeacherIdSet.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    setSelectedTeacherIds((prev) => {
      const next = new Set(prev);
      visibleTeacherIdSet.forEach((id) => next.add(id));
      return next;
    });
  };

  React.useEffect(() => {
    setSelectedTeacherIds((prev) => {
      const existing = new Set(teachers.map((teacher: Teacher) => teacher.id));
      const next = new Set<number>();
      prev.forEach((id) => {
        if (existing.has(id)) next.add(id);
      });
      return next;
    });
  }, [teachers]);

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
                      onClick={() => removeImageMutation.mutate(Number(popup.teacher!.id))}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Current Image
                    </button>
                  )}
                </div>

                <div className="flex justify-center flex-col items-center">
                  <p className="text-sm font-medium mb-2">Digital Signature</p>
                  <input
                    ref={signatureInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSignature(file);
                    }}
                    className="hidden"
                  />
                  <label
                    onClick={() => signatureInputRef.current?.click()}
                    className="w-40 h-24 bg-card border border-border border-dashed rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors"
                  >
                    {signature ? (
                      <img src={URL.createObjectURL(signature)} alt="Signature Preview" className="w-full h-full object-contain p-2" />
                    ) : isEditing && popup.teacher?.signature ? (
                      <img src={getFileUrl(popup.teacher.signature)} alt="Current Signature" className="w-full h-full object-contain p-2" />
                    ) : (
                      <span className="text-muted-foreground text-xs text-center px-1">Click to upload signature</span>
                    )}
                  </label>
                  {signature && (
                    <button
                      type="button"
                      onClick={() => { setSignature(null); if (signatureInputRef.current) signatureInputRef.current.value = ""; }}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Signature
                    </button>
                  )}
                  {!signature && isEditing && popup.teacher?.signature && (
                    <button
                      type="button"
                      onClick={() => removeSignatureMutation.mutate(Number(popup.teacher!.id))}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Current Signature
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
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...register("designation")}
                      defaultValue={isEditing ? popup.teacher?.designation : ""}
                    >
                      <option value="">Select Designation</option>
                      <option value="Headmaster">Headmaster</option>
                      <option value="Assistant Headmaster">Assistant Headmaster</option>
                      <option value="Headmaster (Incharge)">Headmaster (Incharge)</option>
                      <option value="Senior Teacher">Senior Teacher</option>
                      <option value="Assistant Teacher">Assistant Teacher</option>
                    </select>
                    {errors.designation && <ErrorMessage message={errors.designation.message} />}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium">Address</label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's address"
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
        {selectedTeacherIds.size > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-muted border-b border-border">
            <p className="text-sm font-medium text-foreground">
              {selectedTeacherIds.size} teacher(s) selected
            </p>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkRotateOpen(true)}
                disabled={bulkRotateMutation.isPending}
                className="w-full sm:w-auto bg-white hover:bg-gray-50 text-black! border-gray-200"
              >
                Rotate Passwords
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedTeacherIds(new Set())}
                className="w-full sm:w-auto text-muted-foreground"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(input) => {
                      if (input) {
                        input.indeterminate =
                          selectedVisibleCount > 0 &&
                          selectedVisibleCount < visibleTeacherIds.length;
                      }
                    }}
                    onChange={handleSelectAllVisible}
                    aria-label="Select all visible teachers"
                    className="h-4 w-4"
                  />
                </th>
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
                  <tr key={teacher.id} className={`transition-colors ${selectedTeacherIds.has(teacher.id) ? "bg-sidebar-accent" : "hover:bg-muted/50"}`}>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm text-center">
                      <input
                        type="checkbox"
                        checked={selectedTeacherIds.has(teacher.id)}
                        onChange={() => onToggleSelect(teacher.id)}
                        aria-label={`Select ${teacher.name}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {teacher.image ? (
                          <img src={getFileUrl(teacher.image)} className="w-10 h-10 rounded-full object-cover border border-border" alt="" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-foreground font-bold text-lg">
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
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
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
                  <div className="w-20 aspect-[7/9] rounded-sm border border-border bg-muted flex items-center justify-center text-4xl text-muted-foreground font-bold">
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
                  { label: "Address", value: popup.teacher.address },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label} className="flex text-sm">
                    <span className="w-28 text-muted-foreground shrink-0">{label}</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}

                {popup.teacher.signature && (
                  <div className="flex text-sm pt-2">
                    <span className="w-28 text-muted-foreground shrink-0">Signature</span>
                    <div className="h-12 border rounded-sm bg-white overflow-hidden p-1">
                      <img src={getFileUrl(popup.teacher.signature)} alt="Signature" className="h-full object-contain" />
                    </div>
                  </div>
                )}
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

      {bulkRotateOpen && (
        <ConfirmationPopup
          open={bulkRotateOpen}
          onOpenChange={setBulkRotateOpen}
          onConfirm={() => bulkRotateMutation.mutate(Array.from(selectedTeacherIds))}
          title="Rotate Passwords"
          msg={`Are you sure you want to rotate passwords for ${selectedTeacherIds.size} selected ${selectedTeacherIds.size === 1 ? "teacher" : "teachers"}? A new password will be generated for each and an Excel file will be downloaded, while also sending an email to the headmaster.`}
          confirmLabel={bulkRotateMutation.isPending ? "Generating..." : "Yes, Rotate Passwords"}
        />
      )}
    </div>
  );
};

export default TeacherList;
