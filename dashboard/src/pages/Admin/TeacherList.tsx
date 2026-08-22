import axios from 'axios';
import React, { useState, useRef, useMemo, useDeferredValue, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ErrorMessage from '@/components/ErrorMessage';
import { PageHeader, SectionCard, StatsCard, Popup, ConfirmationPopup } from '@/components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherFormSchema, type TeacherFormSchemaData } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { downloadBlob } from '@school/common-ui/blob';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DeleteConfirmation from '@/components/DeleteConfimation';
import ActionButton from '@/components/ActionButton';
import { useTeacher } from '@/queries/teacher.queries';
import type { Teacher } from '@/types/teachers';

interface PopupState {
  visible: boolean;
  type: string;
  teacher: Teacher | null;
}

const uploadImageToR2 = async (file: File, teacherId: number): Promise<void> => {
  const key = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const { data } = await axios.post('/api/teachers/image/upload-url', {
    id: teacherId,
    key,
    contentType: file.type,
  });
  const { uploadUrl, key: r2Key } = data.data;
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  await axios.put(`/api/teachers/${teacherId}/image`, { key: r2Key });
};

const uploadSignatureToR2 = async (file: File, teacherId: number): Promise<void> => {
  const key = `signature-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const { data } = await axios.post('/api/teachers/signature/upload-url', {
    id: teacherId,
    key,
    contentType: file.type,
  });
  const { uploadUrl, key: r2Key } = data.data;
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  await axios.put(`/api/teachers/${teacherId}/signature`, { key: r2Key });
};

const TeacherList = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: '',
    teacher: null,
  });
  const defaultValues = {
    name: '',
    email: '',
    phone: '',
    address: '',
    designation: '',
  };
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormSchemaData>({
    defaultValues,
    resolver: zodResolver(teacherFormSchema),
    criteriaMode: 'firstError',
    mode: 'onBlur',
  });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<number>>(() => new Set());
  const [bulkRotateOpen, setBulkRotateOpen] = useState(false);

  const invalidateTeachers = () => queryClient.invalidateQueries({ queryKey: ['teachers'] });

  const {
    data: teachersResponse,
    isLoading,
    error: teachersError,
  } = useTeacher({ page, limit, search: deferredSearchQuery });

  const teachers = useMemo(() => teachersResponse?.data ?? [], [teachersResponse]);
  const meta = teachersResponse?.meta;

  const errorMessage = teachersError
    ? (teachersError as { response?: { status?: number } }).response?.status === 404
      ? 'No teachers found.'
      : 'An error occurred while fetching teachers.'
    : '';

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
      const response = await axios.post('/api/teachers', {
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
      toast.success(data.message || 'Teacher added successfully.');
      reset(defaultValues);
      setImage(null);
      setSignature(null);
      setShowForm(false);
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'An error occurred while adding the teacher.');
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
      const response = await axios.put(`/api/teachers/${teacher.id}`, formValues);
      if (imageFile) {
        await uploadImageToR2(imageFile, teacher.id);
      }
      if (signatureFile) {
        await uploadSignatureToR2(signatureFile, teacher.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Teacher updated successfully.');
      reset(defaultValues);
      setImage(null);
      setSignature(null);
      setIsEditing(false);
      setShowForm(false);
      setPopup({ visible: false, type: '', teacher: null });
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'An error occurred while updating the teacher.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (teacher: Teacher) => {
      await axios.delete(`/api/teachers/${teacher.id}`);
    },
    onSuccess: () => {
      toast.success('Teacher deleted successfully.');
      invalidateTeachers();
    },
    onError: () => {
      toast.error('Failed to delete teacher.');
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await axios.delete(`/api/teachers/${teacherId}/image`);
    },
    onSuccess: () => {
      toast.success('Image removed.');
      invalidateTeachers();
    },
    onError: () => {
      toast.error('Failed to remove image.');
    },
  });

  const removeSignatureMutation = useMutation({
    mutationFn: async (teacherId: number) => {
      await axios.delete(`/api/teachers/${teacherId}/signature`);
    },
    onSuccess: () => {
      toast.success('Signature removed.');
      invalidateTeachers();
    },
    onError: () => {
      toast.error('Failed to remove signature.');
    },
  });

  const bulkRotateMutation = useMutation({
    mutationFn: async (teacherIds: number[]) => {
      const response = await axios.post(
        '/api/teachers/password-rotations',
        { teacherIds },
        { responseType: 'blob' },
      );
      return response.data;
    },
    onSuccess: (data) => {
      downloadBlob(new Blob([data]), 'rotated_passwords.xlsx');
      toast.success('Passwords rotated successfully. Excel downloaded.');
      setSelectedTeacherIds(new Set());
      invalidateTeachers();
      setBulkRotateOpen(false);
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to rotate passwords. Please try again.');
    },
  });

  const handleEdit = useCallback(
    (teacher: Teacher) => {
      reset({
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        address: teacher.address || '',
        designation: teacher.designation || '',
      });
      setIsEditing(true);
      setShowForm(true);
      setPopup({ visible: false, type: '', teacher });
    },
    [reset, setIsEditing, setShowForm, setPopup],
  );

  const handleDelete = useCallback(
    (teacher: Teacher) => {
      deleteMutation.mutate(teacher);
    },
    [deleteMutation],
  );

  const closePopup = useCallback(() => {
    setPopup({ visible: false, type: '', teacher: null });
  }, [setPopup]);

  // Reset page when search changes
  React.useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery]);

  const isSubmitting = addMutation.isPending || updateMutation.isPending;
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery],
  );

  const handleImageUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setImage(file);
      }
    },
    [setImage],
  );

  const onValidSubmit = useCallback(
    async (formValues: TeacherFormSchemaData) => {
      if (isEditing && popup.teacher) {
        updateMutation.mutate({
          teacher: popup.teacher,
          formValues,
          imageFile: image,
          signatureFile: signature,
        });
      } else {
        addMutation.mutate({ formValues, imageFile: image, signatureFile: signature });
      }
    },
    [isEditing, popup.teacher, updateMutation, addMutation, image, signature],
  );

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

  const visibleTeacherIds = useMemo(
    () => filteredTeachers.map((t: Teacher) => t.id),
    [filteredTeachers],
  );
  const visibleTeacherIdSet = useMemo(
    () => new Set<number>(visibleTeacherIds),
    [visibleTeacherIds],
  );

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
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Teacher List"
        description="Manage teacher records and profile information."
      >
        {!showForm && (
          <Button type="button" onClick={() => setShowForm((prev) => !prev)}>
            + Add Teacher
          </Button>
        )}
      </PageHeader>

      {showForm && (
        <div className="bg-card border-border mb-6 overflow-hidden rounded-xl border shadow-sm">
          <div className="w-full p-6">
            <h2 className="text-foreground mb-6 text-xl font-bold">
              {isEditing ? 'Edit Teacher' : 'Add Teacher'}
            </h2>
            <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-6">
              {/* Image */}
              <div className="border-border bg-muted/40 rounded-lg border p-4">
                <div className="flex flex-col items-center justify-center">
                  <p className="mb-2 text-sm font-medium">Profile Image</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-card border-border hover:border-primary/50 flex aspect-7/9 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-lg border transition-colors sm:w-32"
                  >
                    {image ? (
                      <img
                        src={URL.createObjectURL(image)}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : isEditing && popup.teacher?.image ? (
                      <img
                        src={getFileUrl(popup.teacher.image)}
                        alt="Teacher"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground px-1 text-center text-xs sm:text-sm">
                        Click to upload
                      </span>
                    )}
                  </label>
                  {image && (
                    <button
                      type="button"
                      onClick={() => {
                        setImage(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-destructive mt-2 text-sm hover:underline"
                    >
                      Remove Image
                    </button>
                  )}
                  {!image && isEditing && popup.teacher?.image && (
                    <button
                      type="button"
                      onClick={() => removeImageMutation.mutate(Number(popup.teacher!.id))}
                      className="text-destructive mt-2 text-sm hover:underline"
                    >
                      Remove Current Image
                    </button>
                  )}
                </div>

                <div className="flex flex-col items-center justify-center">
                  <p className="mb-2 text-sm font-medium">Digital Signature</p>
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
                    className="bg-card border-border hover:border-primary/50 flex h-24 w-40 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed transition-colors"
                  >
                    {signature ? (
                      <img
                        src={URL.createObjectURL(signature)}
                        alt="Signature Preview"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : isEditing && popup.teacher?.signature ? (
                      <img
                        src={getFileUrl(popup.teacher.signature)}
                        alt="Current Signature"
                        className="h-full w-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-muted-foreground px-1 text-center text-xs">
                        Click to upload signature
                      </span>
                    )}
                  </label>
                  {signature && (
                    <button
                      type="button"
                      onClick={() => {
                        setSignature(null);
                        if (signatureInputRef.current) signatureInputRef.current.value = '';
                      }}
                      className="text-destructive mt-2 text-sm hover:underline"
                    >
                      Remove Signature
                    </button>
                  )}
                  {!signature && isEditing && popup.teacher?.signature && (
                    <button
                      type="button"
                      onClick={() => removeSignatureMutation.mutate(Number(popup.teacher!.id))}
                      className="text-destructive mt-2 text-sm hover:underline"
                    >
                      Remove Current Signature
                    </button>
                  )}
                </div>
              </div>

              {/* Info */}
              <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                  Teacher Information
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <Input type="text" placeholder="Enter teacher's name" {...register('name')} />
                    {errors.name && <ErrorMessage message={errors.name.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="Enter teacher's email"
                      {...register('email')}
                    />
                    {errors.email && <ErrorMessage message={errors.email.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Phone <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's phone number"
                      maxLength={11}
                      {...register('phone')}
                    />
                    {errors.phone && <ErrorMessage message={errors.phone.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Designation <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      {...register('designation')}
                      defaultValue={isEditing ? popup.teacher?.designation : ''}
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
                      {...register('address')}
                    />
                    {errors.address && <ErrorMessage message={errors.address.message} />}
                  </div>
                </div>
              </fieldset>

              <div className="bg-card/95 supports-backdrop-filter:bg-card/70 border-border sticky bottom-0 flex justify-between border-t pt-4 backdrop-blur">
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
                  {isSubmitting
                    ? isEditing
                      ? 'Updating...'
                      : 'Adding...'
                    : isEditing
                      ? 'Update'
                      : 'Add Teacher'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatsCard label="Total Teachers" value={meta?.total ?? 0} loading={isLoading} />
        <StatsCard
          label="Showing"
          value={`${filteredTeachers.length} / ${meta?.total ?? 0}`}
          color="blue"
          loading={isLoading}
        />
        <StatsCard
          label="Available"
          value={filteredTeachers.length}
          color="emerald"
          loading={isLoading}
        />
      </div>

      <SectionCard className="mb-6">
        <div className="relative">
          <Search size={18} className="absolute top-2.5 left-3 text-gray-400" />
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
          <div className="bg-muted border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-foreground text-sm font-medium">
              {selectedTeacherIds.size} teacher(s) selected
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setBulkRotateOpen(true)}
                disabled={bulkRotateMutation.isPending}
                className="w-full border-gray-200 bg-white text-black! hover:bg-gray-50 sm:w-auto"
              >
                Rotate Passwords
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedTeacherIds(new Set())}
                className="text-muted-foreground w-full sm:w-auto"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border border-b">
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
                {['Teacher', 'Email', 'Designation', 'Actions'].map((header) => (
                  <th
                    key={header}
                    className={`text-foreground/70 px-4 py-3 text-xs font-semibold tracking-wider uppercase ${header === 'Actions' ? 'text-right' : 'text-left'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="text-primary h-8 w-8 animate-spin" />
                      <p className="text-muted-foreground text-sm dark:text-gray-400">
                        Loading teachers...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher: Teacher) => (
                  <tr
                    key={teacher.id}
                    className={`transition-colors ${selectedTeacherIds.has(teacher.id) ? 'bg-sidebar-accent' : 'hover:bg-muted/50'}`}
                  >
                    <td className="px-2 py-2 text-center text-sm whitespace-nowrap sm:px-4 sm:py-3">
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
                          <img
                            src={getFileUrl(teacher.image)}
                            className="border-border h-10 w-10 rounded-full border object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold">
                            {teacher.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-foreground font-medium">{teacher.name}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-4 text-sm">{teacher.email}</td>
                    <td className="text-muted-foreground px-4 py-4 text-sm">
                      {teacher.designation}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="view"
                          onClick={() => setPopup({ visible: true, type: 'view', teacher })}
                        />
                        <ActionButton action="edit" onClick={() => handleEdit(teacher)} />
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
                  <td colSpan={5} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    {errorMessage || 'No teachers found matching your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-muted-foreground text-sm">
            Page {meta?.page ?? page} of {meta?.totalPages ?? 0}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Rows</span>
              <select
                className="bg-card border-border text-foreground focus:ring-primary/30 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
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
                    variant={i + 1 === currentPage ? 'default' : 'outline'}
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
              const end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start < maxVisible - 1) {
                start = Math.max(1, end - maxVisible + 1);
              }
              if (start > 1) {
                pages.push(1);
                if (start > 2) pages.push('...');
              }
              for (let i = start; i <= end; i++) {
                pages.push(i);
              }
              if (end < totalPages) {
                if (end < totalPages - 1) pages.push('...');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === '...' ? (
                  <span key={idx} className="text-muted-foreground px-2">
                    ...
                  </span>
                ) : (
                  <Button
                    key={idx}
                    type="button"
                    variant={p === currentPage ? 'default' : 'outline'}
                    onClick={() => setPage(p as number)}
                    disabled={isLoading}
                  >
                    {p}
                  </Button>
                ),
              );
            })()}
          </div>
        </div>
      </SectionCard>

      {popup.visible && popup.teacher && (
        <Popup open onOpenChange={(o) => !o && closePopup()} size="md">
          {popup.type === 'view' && (
            <>
              {/* Header */}
              <div className="border-border flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-base font-semibold">Teacher Details</h2>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Profile */}
              <div className="border-border bg-muted/20 flex flex-col items-center gap-2 border-b py-5">
                {popup.teacher.image ? (
                  <img
                    src={getFileUrl(popup.teacher.image)}
                    alt="Profile"
                    className="border-border aspect-[7/9] w-20 rounded-sm border object-cover shadow"
                  />
                ) : (
                  <div className="border-border bg-muted text-muted-foreground flex aspect-[7/9] w-20 items-center justify-center rounded-sm border text-4xl font-bold">
                    {popup.teacher.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-base font-semibold">{popup.teacher.name}</p>
                  <p className="text-muted-foreground text-xs">{popup.teacher.designation}</p>
                </div>
                {popup.teacher.subject && (
                  <span className="bg-primary/10 text-primary rounded-sm px-2 py-0.5 text-xs font-medium">
                    {popup.teacher.subject}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="space-y-1.5 px-5 py-4">
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  Contact & Details
                </p>
                {[
                  { label: 'Email', value: popup.teacher.email },
                  { label: 'Phone', value: popup.teacher.phone },
                  { label: 'Address', value: popup.teacher.address },
                ]
                  .filter(({ value }) => value)
                  .map(({ label, value }) => (
                    <div key={label} className="flex text-sm">
                      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}

                {popup.teacher.signature && (
                  <div className="flex pt-2 text-sm">
                    <span className="text-muted-foreground w-28 shrink-0">Signature</span>
                    <div className="h-12 overflow-hidden rounded-sm border bg-white p-1">
                      <img
                        src={getFileUrl(popup.teacher.signature)}
                        alt="Signature"
                        className="h-full object-contain"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="border-border flex justify-end border-t px-5 py-3">
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
          msg={`Are you sure you want to rotate passwords for ${selectedTeacherIds.size} selected ${selectedTeacherIds.size === 1 ? 'teacher' : 'teachers'}? A new password will be generated for each and an Excel file will be downloaded, while also sending an email to the headmaster.`}
          confirmLabel={bulkRotateMutation.isPending ? 'Generating...' : 'Yes, Rotate Passwords'}
        />
      )}
    </div>
  );
};

export default TeacherList;
