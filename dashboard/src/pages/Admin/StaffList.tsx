import axios from 'axios';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Eye,
  Loader2,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ErrorMessage from '@/components/ErrorMessage';
import ActionButton from '@/components/ActionButton';
import { SectionCard, Popup, ConfirmationPopup, TablePagination } from '@/components';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { staffFormSchema, type StaffFormData, type StaffFormInput } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useStaff } from '@/queries/staff.queries';
import type { Staff } from '@/types/staff';

const uploadImageToR2 = async (file: File, staffId: number): Promise<void> => {
  const key = await uploadToR2('/api/staffs/presigned-url', file, undefined, {
    id: staffId,
  });
  await axios.put(`/api/staffs/${staffId}/image`, { key });
};

const defaultValues: StaffFormInput = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  address: '',
};

// Optional schema fields type their message loosely; keep only strings.
const errText = (m: unknown) => (typeof m === 'string' ? m : undefined);

type SortKey = 'name' | 'designation';

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground text-xs font-medium">{label}</p>
    <p className="mt-0.5 text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
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

const DialogHeader = ({
  id,
  title,
  onClose,
}: {
  id: string;
  title: string;
  onClose: () => void;
}) => (
  <div className="border-border flex items-center justify-between border-b px-5 py-4">
    <h2 id={id} className="text-base font-semibold">
      {title}
    </h2>
    <CloseButton onClick={onClose} />
  </div>
);

const Field = ({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={cn('space-y-1.5', className)}>
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </span>
      {children}
    </label>
    {error && <ErrorMessage message={error} />}
  </div>
);

// Staff photos are 7:9 passport crops; keep that ratio so heads aren't cut off.
const StaffAvatar = ({ staff }: { staff: Staff }) =>
  staff.image ? (
    <img
      src={getFileUrl(staff.image)}
      alt=""
      loading="lazy"
      className="border-border h-9 w-7 shrink-0 rounded border object-cover object-top"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex h-9 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold">
      {staff.name.charAt(0).toUpperCase()}
    </div>
  );

// Pinned Staff column while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky left-0 z-[1] bg-inherit max-xl:shadow-[1px_0_0_var(--border)]';

const dropzoneClass =
  'border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2';

const StaffList = () => {
  const queryClient = useQueryClient();
  const { data: staff = [], isLoading, isError, refetch } = useStaff();

  // ---- List ----
  const [search, setSearch] = useState('');
  const [phoneSearch, setPhoneSearch] = useState('');
  const [designationFilters, setDesignationFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [detail, setDetail] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);

  // ---- Form dialog ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const invalidateStaff = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  const designations = useMemo(
    () =>
      Array.from(new Set(staff.map((s) => s.designation?.trim()).filter(Boolean) as string[])).sort(
        (a, b) => a.localeCompare(b),
      ),
    [staff],
  );
  const withPhoto = staff.filter((s) => s.image).length;

  const filtersActive =
    Boolean(search.trim()) || Boolean(phoneSearch.trim()) || designationFilters.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const phone = phoneSearch.trim();
    const rows = staff.filter(
      (s) =>
        (!q ||
          [s.name, s.email, s.designation, s.address].some((v) => v?.toLowerCase().includes(q))) &&
        (!phone || s.phone.includes(phone)) &&
        (designationFilters.length === 0 ||
          designationFilters.includes(s.designation?.trim() || '__none__')),
    );
    if (!sort) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => dir * (a[sort.key] ?? '').localeCompare(b[sort.key] ?? ''));
  }, [staff, search, phoneSearch, designationFilters, sort]);

  const totalPages = Math.ceil(filtered.length / limit);
  const pageRows = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, phoneSearch, designationFilters, sort, limit]);

  const clearFilters = () => {
    setSearch('');
    setPhoneSearch('');
    setDesignationFilters([]);
  };

  // Preview for the photo card: the picked file, else the saved image.
  const imagePreview = useMemo(
    () => (image ? URL.createObjectURL(image) : editing?.image ? getFileUrl(editing.image) : null),
    [image, editing?.image],
  );
  useEffect(
    () => () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    },
    [imagePreview],
  );

  const handleCancel = () => {
    reset(defaultValues);
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditing(null);
    setFormOpen(false);
  };

  const openCreate = () => {
    reset(defaultValues);
    setImage(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (member: Staff) => {
    reset({
      name: member.name || '',
      email: member.email ?? '',
      phone: member.phone || '',
      address: member.address ?? '',
      designation: member.designation ?? '',
    });
    setImage(null);
    setEditing(member);
    setDetail(null);
    setFormOpen(true);
  };

  const pickImage = (file: File | null | undefined) => {
    if (file && !file.type.startsWith('image/')) {
      toast.error('Photo must be an image');
      return;
    }
    setImage(file ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
      handleCancel();
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
      handleCancel();
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
    onSuccess: (_, staffMember) => {
      toast.success('Staff deleted successfully.');
      setDetail((d) => (d?.id === staffMember.id ? null : d));
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
      setEditing((e) => (e ? { ...e, image: null } : e));
      invalidateStaff();
    },
    onError: () => {
      toast.error('Failed to remove image.');
    },
  });

  const submitting = addMutation.isPending || updateMutation.isPending;

  const onValidSubmit = (formValues: StaffFormData) => {
    if (editing) {
      updateMutation.mutate({ staffMember: editing, formValues, imageFile: image });
    } else {
      addMutation.mutate({ formValues, imageFile: image });
    }
  };

  const sortProps = (key: SortKey) => ({
    sortOrder: sort?.key === key ? sort.order : null,
    onSort: (order: SortOrder | null) => setSort(order ? { key, order } : null),
  });

  const columns: {
    label: string;
    sortKey?: SortKey;
    className?: string;
    header: React.ReactNode;
  }[] = [
    {
      label: 'Staff',
      sortKey: 'name',
      className: cn(stickyCell, 'px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Staff"
          {...sortProps('name')}
          filterInput={{
            value: search,
            onChange: setSearch,
            placeholder: 'Name, email or address…',
          }}
        />
      ),
    },
    {
      label: 'Designation',
      sortKey: 'designation',
      className: 'w-48',
      header: (
        <ColumnHeaderMenu
          label="Designation"
          {...sortProps('designation')}
          options={[
            ...designations.map((d) => ({ value: d, label: d })),
            { value: '__none__', label: 'Not set' },
          ]}
          selected={designationFilters}
          onSelectedChange={setDesignationFilters}
        />
      ),
    },
    {
      label: 'Phone',
      className: 'w-40',
      header: (
        <ColumnHeaderMenu
          label="Phone"
          filterInput={{ value: phoneSearch, onChange: setPhoneSearch, placeholder: '01…' }}
        />
      ),
    },
    { label: 'Email', className: 'w-56', header: 'Email' },
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

  const rowActions = (member: Staff) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton
        action="edit"
        iconOnly
        className="pointer-coarse:h-11 pointer-coarse:w-11"
        onClick={() => openEdit(member)}
      />
      {/* modal={false}: items open dialogs; a modal menu would leave pointer-events locked */}
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
            {member.name}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDetail(member)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(member)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(member)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {isError ? (
        <>
          <p>An error occurred while fetching staff.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </>
      ) : filtersActive ? (
        <>
          <p>No staff match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <>
          <p>No staff yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            <Plus /> Add staff
          </Button>
        </>
      )}
    </div>
  );

  const summary = isLoading
    ? ' '
    : [
        `${filtersActive ? `${filtered.length.toLocaleString()} of ` : ''}${plural(staff.length, 'staff member')}`,
        plural(designations.length, 'designation'),
      ].join(' · ');

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Staff List</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> Add staff
        </Button>
      </header>

      {!isLoading && staff.length > 0 && (
        <div className="border-border bg-card mb-6 grid grid-cols-3 gap-x-6 rounded-xl border px-5 py-4 shadow-sm sm:w-fit sm:min-w-[24rem]">
          <Stat label="Total" value={staff.length} />
          <Stat label="Designations" value={designations.length} />
          <Stat label="With photo" value={withPhoto} />
        </div>
      )}

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                {columns.map((col) => (
                  <th
                    key={col.label}
                    aria-sort={
                      sort && col.sortKey === sort.key
                        ? sort.order === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    className={cn(
                      'text-foreground/70 px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                      col.className,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {isLoading ? (
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length > 0 ? (
                pageRows.map((member) => (
                  // Opaque row colours so the pinned Staff cell hides what scrolls under it.
                  <tr
                    key={member.id}
                    className="bg-card transition-colors hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]"
                  >
                    <td className={cn(stickyCell, 'px-3 py-2 sm:px-4')}>
                      <div className="flex max-w-[12rem] items-center gap-3 sm:max-w-xs">
                        <StaffAvatar staff={member} />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setDetail(member)}
                            className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                          >
                            {member.name}
                          </button>
                          {member.address && (
                            <p className="text-muted-foreground truncate text-xs">
                              {member.address}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {member.designation || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-sm tabular-nums">
                      {member.phone || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="max-w-[14rem] truncate px-4 py-2 text-sm">
                      {member.email || <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">{rowActions(member)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>{emptyState}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          totalPages={totalPages}
          limit={limit}
          loading={isLoading}
          totalFiltered={filtered.length}
          limitOptions={[25, 50, 100]}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      </SectionCard>

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete staff"
        msg={`Delete ${deleteTarget?.name ?? 'this staff member'}? This cannot be undone.`}
      />

      {detail && (
        <Popup
          open
          onOpenChange={(o) => !o && setDetail(null)}
          size="md"
          aria-labelledby="staff-details-title"
        >
          <DialogHeader
            id="staff-details-title"
            title="Staff details"
            onClose={() => setDetail(null)}
          />
          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-4">
              {detail.image ? (
                <img
                  src={getFileUrl(detail.image)}
                  alt=""
                  className="border-border aspect-7/9 w-20 shrink-0 rounded-md border object-cover object-top"
                />
              ) : (
                <div className="bg-muted text-muted-foreground aspect-7/9 flex w-20 shrink-0 items-center justify-center rounded-md text-3xl font-semibold">
                  {detail.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight">{detail.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {detail.designation || 'Staff'}
                </p>
              </div>
            </div>
            <dl className="divide-border border-border divide-y rounded-lg border text-sm">
              {[
                { label: 'Phone', value: detail.phone },
                { label: 'Email', value: detail.email },
                { label: 'Address', value: detail.address },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 px-3 py-2">
                  <dt className="text-muted-foreground w-20 shrink-0">{label}</dt>
                  <dd className="min-w-0 break-words font-medium">
                    {label === 'Address' && value ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" /> {value}
                      </span>
                    ) : (
                      value || <span className="text-muted-foreground font-normal">—</span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="border-border flex flex-wrap items-center gap-2 border-t px-5 py-3">
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(detail)}
            >
              <Trash2 /> Delete
            </Button>
            <Button type="button" className="ml-auto" onClick={() => openEdit(detail)}>
              <Pencil /> Edit staff
            </Button>
          </div>
        </Popup>
      )}

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && !submitting && handleCancel()}
        size="lg"
        aria-labelledby="staff-form-title"
      >
        <form onSubmit={rhfHandleSubmit(onValidSubmit)}>
          <DialogHeader
            id="staff-form-title"
            title={editing ? 'Edit staff' : 'Add staff'}
            onClose={handleCancel}
          />

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.message}>
                <Input type="text" placeholder="Enter staff name" {...register('name')} />
              </Field>
              <Field label="Designation" error={errText(errors.designation?.message)}>
                <Input
                  type="text"
                  list="staff-designation-options"
                  placeholder="Enter designation"
                  {...register('designation')}
                />
                <datalist id="staff-designation-options">
                  {designations.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
              </Field>
              <Field label="Phone" required error={errors.phone?.message}>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="01XXXXXXXXX"
                  maxLength={11}
                  {...register('phone')}
                />
              </Field>
              <Field label="Email" error={errText(errors.email?.message)}>
                <Input type="email" placeholder="Enter email" {...register('email')} />
              </Field>
              <Field
                label="Address"
                error={errText(errors.address?.message)}
                className="sm:col-span-2"
              >
                <Input type="text" placeholder="Enter address" {...register('address')} />
              </Field>
            </div>

            {/* Photo */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium">
                Photo <span className="text-muted-foreground font-normal">(optional)</span>
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => pickImage(e.target.files?.[0])}
              />
              {imagePreview ? (
                <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                  <img
                    src={imagePreview}
                    alt=""
                    className="border-border aspect-7/9 w-12 shrink-0 rounded-md border object-cover object-top"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {image ? image.name : 'Current photo'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {image
                        ? `${(image.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                        : 'Shown on the staff profile'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {image ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => pickImage(null)}
                      >
                        <X /> Remove
                      </Button>
                    ) : (
                      editing && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={removeImageMutation.isPending}
                          onClick={() => removeImageMutation.mutate(editing.id)}
                        >
                          {removeImageMutation.isPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Trash2 />
                          )}
                          Remove current
                        </Button>
                      )
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload /> Replace
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    pickImage(e.dataTransfer.files[0]);
                  }}
                  className={dropzoneClass}
                >
                  <Upload size={20} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload photo</span>
                  <span className="text-muted-foreground text-xs">Click or drop an image here</span>
                </button>
              )}
            </div>
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> required
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleCancel} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                {editing ? 'Save changes' : 'Add staff'}
              </Button>
            </div>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default StaffList;
