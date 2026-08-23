import axios from 'axios';
import React, { useState, useRef, useMemo, useDeferredValue, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ErrorMessage from '@/components/ErrorMessage';
import {
  PageHeader,
  SectionCard,
  StatsCard,
  Popup,
  FilterSelection,
  FilterField,
} from '@/components';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { staffFormSchema, type StaffFormData, type StaffFormInput } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import DeleteConfirmation from '@/components/DeleteConfimation';
import ActionButton from '@/components/ActionButton';
import { useStaff } from '@/queries/staff.queries';
import type { Staff } from '@/types/staff';

interface PopupState {
  visible: boolean;
  type: string;
  staff: Staff | null;
}

const uploadImageToR2 = async (file: File, staffId: number): Promise<void> => {
  const key = await uploadToR2('/api/staffs/presigned-url', file, undefined, {
    id: staffId,
  });
  await axios.put(`/api/staffs/${staffId}/image`, { key });
};

const StaffList = () => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: '',
    staff: null,
  });

  const defaultValues: StaffFormInput = {
    name: '',
    email: '',
    phone: '',
    designation: '',
    address: '',
  };

  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffFormInput, unknown, StaffFormData>({
    defaultValues,
    resolver: zodResolver(staffFormSchema),
    criteriaMode: 'firstError',
    mode: 'onBlur',
  });

  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidateStaff = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  const {
    data: staffResponse,
    isLoading,
    error: staffError,
  } = useStaff({ page, limit, search: deferredSearchQuery });

  const staff = useMemo(() => staffResponse?.data ?? [], [staffResponse]);
  const meta = staffResponse?.meta;

  const errorMessage = staffError
    ? (staffError as { response?: { status?: number } }).response?.status === 404
      ? 'No staff found.'
      : 'An error occurred while fetching staff.'
    : '';

  const addMutation = useMutation({
    mutationFn: async ({
      formValues,
      imageFile,
    }: {
      formValues: StaffFormData;
      imageFile: File | null;
    }) => {
      const response = await axios.post('/api/staffs', {
        staff: [formValues],
      });
      const newStaff = response.data.data[0];
      if (imageFile && newStaff?.id) {
        await uploadImageToR2(imageFile, newStaff.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Staff added successfully.');
      reset(defaultValues);
      setImage(null);
      setShowForm(false);
      invalidateStaff();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(
        error.response?.data?.message || 'An error occurred while adding the staff member.',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      staffMember,
      formValues,
      imageFile,
    }: {
      staffMember: Staff;
      formValues: StaffFormData;
      imageFile: File | null;
    }) => {
      const response = await axios.put(`/api/staffs/${staffMember.id}`, formValues);
      if (imageFile) {
        await uploadImageToR2(imageFile, staffMember.id);
      }
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Staff updated successfully.');
      reset(defaultValues);
      setImage(null);
      setIsEditing(false);
      setShowForm(false);
      setPopup({ visible: false, type: '', staff: null });
      invalidateStaff();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(
        error.response?.data?.message || 'An error occurred while updating the staff member.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (staffMember: Staff) => {
      await axios.delete(`/api/staffs/${staffMember.id}`);
    },
    onSuccess: () => {
      toast.success('Staff deleted successfully.');
      invalidateStaff();
    },
    onError: () => {
      toast.error('Failed to delete staff.');
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: async (staffId: number) => {
      await axios.delete(`/api/staffs/${staffId}/image`);
    },
    onSuccess: () => {
      toast.success('Image removed.');
      invalidateStaff();
    },
    onError: () => {
      toast.error('Failed to remove image.');
    },
  });

  const handleEdit = useCallback(
    (staffMember: Staff) => {
      reset({
        name: staffMember.name || '',
        email: staffMember.email ?? '',
        phone: staffMember.phone || '',
        address: staffMember.address ?? '',
        designation: staffMember.designation ?? '',
      });
      setIsEditing(true);
      setShowForm(true);
      setPopup({ visible: false, type: '', staff: staffMember });
    },
    [reset],
  );

  const handleDelete = useCallback(
    (staffMember: Staff) => {
      deleteMutation.mutate(staffMember);
    },
    [deleteMutation],
  );

  const closePopup = useCallback(() => {
    setPopup({ visible: false, type: '', staff: null });
  }, []);

  React.useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery]);

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  }, []);

  const onValidSubmit = useCallback(
    async (formValues: StaffFormData) => {
      if (isEditing && popup.staff) {
        updateMutation.mutate({
          staffMember: popup.staff,
          formValues,
          imageFile: image,
        });
      } else {
        addMutation.mutate({ formValues, imageFile: image });
      }
    },
    [isEditing, popup.staff, updateMutation, addMutation, image],
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Staff List" description="Manage staff records and profile information.">
        {!showForm && (
          <Button type="button" onClick={() => setShowForm((prev) => !prev)}>
            + Add Staff
          </Button>
        )}
      </PageHeader>

      {showForm && (
        <div className="bg-card border-border mb-6 overflow-hidden rounded-xl border shadow-sm">
          <div className="w-full p-6">
            <h2 className="text-foreground mb-6 text-xl font-bold">
              {isEditing ? 'Edit Staff' : 'Add Staff'}
            </h2>
            <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-6">
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
                    ) : isEditing && popup.staff?.image ? (
                      <img
                        src={getFileUrl(popup.staff.image)}
                        alt="Staff"
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
                  {!image && isEditing && popup.staff?.image && (
                    <button
                      type="button"
                      onClick={() => removeImageMutation.mutate(Number(popup.staff!.id))}
                      className="text-destructive mt-2 text-sm hover:underline"
                    >
                      Remove Current Image
                    </button>
                  )}
                </div>
              </div>

              <fieldset className="border-border bg-card rounded-lg border p-4 sm:p-5">
                <legend className="border-primary border-l-2 px-2 text-sm font-semibold sm:text-base">
                  Staff Information
                </legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Name <span className="text-destructive">*</span>
                    </label>
                    <Input type="text" placeholder="Enter staff name" {...register('name')} />
                    {errors.name && <ErrorMessage message={errors.name.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Email</label>
                    <Input type="email" placeholder="Enter email" {...register('email')} />
                    {typeof errors.email?.message === 'string' && (
                      <ErrorMessage message={errors.email.message} />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">
                      Phone <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Enter phone number"
                      maxLength={11}
                      {...register('phone')}
                    />
                    {errors.phone && <ErrorMessage message={errors.phone.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Designation</label>
                    <Input
                      type="text"
                      placeholder="Enter designation"
                      {...register('designation')}
                    />
                    {typeof errors.designation?.message === 'string' && (
                      <ErrorMessage message={errors.designation.message} />
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium">Address</label>
                    <Input type="text" placeholder="Enter address" {...register('address')} />
                    {typeof errors.address?.message === 'string' && (
                      <ErrorMessage message={errors.address.message} />
                    )}
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
                      : 'Add Staff'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatsCard label="Total Staff" value={meta?.total ?? 0} loading={isLoading} />
        <StatsCard
          label="Showing"
          value={`${staff.length} / ${meta?.total ?? 0}`}
          color="blue"
          loading={isLoading}
        />
      </div>

      <FilterSelection className="mb-6">
        <FilterField label="Search" wide>
          <div className="relative">
            <Search size={18} className="absolute top-2.5 left-3 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, phone, email or designation..."
              className="pl-10"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
        </FilterField>
      </FilterSelection>

      <SectionCard noPadding className="mb-6">
        {/* Desktop table */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-muted border-border border-b">
                {['Staff', 'Email', 'Designation', 'Actions'].map((header) => (
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
                      <p className="text-muted-foreground text-sm">Loading staff…</p>
                    </div>
                  </td>
                </tr>
              ) : staff.length > 0 ? (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        {member.image ? (
                          <img
                            src={getFileUrl(member.image)}
                            className="border-border h-10 w-10 rounded-full border object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="bg-muted text-foreground flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-foreground font-medium">{member.name}</span>
                      </div>
                    </td>
                    <td className="text-muted-foreground px-4 py-4 text-sm">
                      {member.email || '—'}
                    </td>
                    <td className="text-muted-foreground px-4 py-4 text-sm">
                      {member.designation || '—'}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        <ActionButton
                          action="view"
                          onClick={() => setPopup({ visible: true, type: 'view', staff: member })}
                        />
                        <ActionButton action="edit" onClick={() => handleEdit(member)} />
                        <DeleteConfirmation
                          onDelete={() => handleDelete(member)}
                          msg={`Are you sure you want to delete ${member.name}?`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="text-muted-foreground px-4 py-12 text-center text-sm">
                    {errorMessage || 'No staff found matching your criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Loading staff…</p>
            </div>
          ) : staff.length > 0 ? (
            <ul className="divide-border divide-y">
              {staff.map((member) => (
                <li key={member.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    {member.image ? (
                      <img
                        src={getFileUrl(member.image)}
                        className="border-border h-12 w-12 shrink-0 rounded-full border object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate font-medium">{member.name}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {member.email || '—'}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {member.designation || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <ActionButton
                      action="view"
                      onClick={() => setPopup({ visible: true, type: 'view', staff: member })}
                    />
                    <ActionButton action="edit" onClick={() => handleEdit(member)} />
                    <DeleteConfirmation
                      onDelete={() => handleDelete(member)}
                      msg={`Are you sure you want to delete ${member.name}?`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">
              {errorMessage || 'No staff found matching your criteria.'}
            </p>
          )}
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
                {[10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
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

      {popup.visible && popup.staff && (
        <Popup open onOpenChange={(open) => !open && closePopup()} size="md">
          {popup.type === 'view' && (
            <>
              <div className="border-border flex items-center justify-between border-b px-5 py-4">
                <h2 className="text-base font-semibold">Staff Details</h2>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none transition-colors"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              <div className="border-border bg-muted/20 flex flex-col items-center gap-2 border-b py-5">
                {popup.staff.image ? (
                  <img
                    src={getFileUrl(popup.staff.image)}
                    alt="Profile"
                    className="border-border aspect-7/9 w-20 rounded-sm border object-cover shadow"
                  />
                ) : (
                  <div className="border-border bg-muted text-muted-foreground flex aspect-7/9 w-20 items-center justify-center rounded-sm border text-4xl font-bold">
                    {popup.staff.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="text-base font-semibold">{popup.staff.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {popup.staff.designation || 'Staff'}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 px-5 py-4">
                <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                  Contact & Details
                </p>
                {[
                  { label: 'Email', value: popup.staff.email },
                  { label: 'Phone', value: popup.staff.phone },
                  { label: 'Address', value: popup.staff.address },
                ]
                  .filter(({ value }) => value)
                  .map(({ label, value }) => (
                    <div key={label} className="flex text-sm">
                      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
              </div>

              <div className="border-border flex justify-end border-t px-5 py-3">
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

export default StaffList;
