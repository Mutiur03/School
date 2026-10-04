import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  Eye,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
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
import {
  SectionCard,
  Popup,
  ConfirmationPopup,
  TablePagination,
  filterSelectClassName,
} from '@/components';
import ActionButton from '@/components/ActionButton';
import { ColumnHeaderMenu, type SortOrder } from '@/components/ColumnHeaderMenu';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherFormSchema, type TeacherFormSchemaData } from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { cn } from '@/lib/utils';
import { downloadBlob } from '@school/common-ui/blob';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeacher } from '@/queries/teacher.queries';
import type { Teacher } from '@/types/teachers';

type SortKey = 'name' | 'email' | 'designation';

const DESIGNATIONS = [
  'Headmaster',
  'Assistant Headmaster',
  'Headmaster (Incharge)',
  'Senior Teacher',
  'Assistant Teacher',
];

const defaultValues: TeacherFormSchemaData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  designation: '',
};

// ponytail: the list API caps a page at 200; one page holds every teacher of a school,
// so filter/sort/paginate client-side. Page through the API if a school ever passes 200.
const FETCH_LIMIT = 200;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const uploadToR2 = async (kind: 'image' | 'signature', file: File, teacherId: number) => {
  const prefix = kind === 'signature' ? 'signature-' : '';
  const key = `${prefix}${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
  const { data } = await axios.post(`/api/teachers/${kind}/upload-url`, {
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
  await axios.put(`/api/teachers/${teacherId}/${kind}`, { key: r2Key });
};

const Stat = ({ label, value, dot }: { label: string; value: number; dot?: string }) => (
  <div className="min-w-0">
    <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dot)} aria-hidden />}
      {label}
    </p>
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

// Teacher photos are 7:9 passport crops; keep that ratio so heads aren't cut off.
const TeacherAvatar = ({ teacher }: { teacher: Teacher }) =>
  teacher.image ? (
    <img
      src={getFileUrl(teacher.image)}
      alt=""
      loading="lazy"
      className="border-border h-9 w-7 shrink-0 rounded border object-cover object-top"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex h-9 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold">
      {teacher.name.charAt(0).toUpperCase()}
    </div>
  );

const dropzoneClass =
  'border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2';

/** Dropzone when empty, file card when a new pick or a saved file exists. */
const ImagePicker = ({
  label,
  file,
  currentUrl,
  thumbClassName,
  onPick,
  onRemoveCurrent,
  removing,
}: {
  label: string;
  file: File | null;
  currentUrl?: string;
  thumbClassName: string;
  onPick: (file: File | null) => void;
  onRemoveCurrent: () => void;
  removing: boolean;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : currentUrl ? getFileUrl(currentUrl) : null),
    [file, currentUrl],
  );
  useEffect(
    () => () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const pick = (f: File | null | undefined) => {
    if (f && !f.type.startsWith('image/')) {
      toast.error(`${label} must be an image`);
      return;
    }
    onPick(f ?? null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium">
        {label} <span className="text-muted-foreground font-normal">(optional)</span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />
      {preview ? (
        <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
          <img
            src={preview}
            alt=""
            className={cn('border-border h-12 shrink-0 rounded-md border', thumbClassName)}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {file ? file.name : `Current ${label.toLowerCase()}`}
            </p>
            <p className="text-muted-foreground text-xs">
              {file
                ? `${(file.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                : 'Saved'}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {file ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => pick(null)}>
                <X /> Remove
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={removing}
                onClick={onRemoveCurrent}
              >
                {removing ? <Loader2 className="animate-spin" /> : <Trash2 />} Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
            >
              <Upload /> Replace
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
          className={dropzoneClass}
        >
          <Upload size={20} className="text-muted-foreground" />
          <span className="text-sm font-medium">Upload {label.toLowerCase()}</span>
          <span className="text-muted-foreground text-xs">Click or drop an image here</span>
        </button>
      )}
    </div>
  );
};

// Checkbox + Teacher columns stay pinned while the table scrolls sideways on narrow screens.
const stickyCell = 'sticky z-[1] bg-inherit';
const stickyEdge = 'max-xl:shadow-[1px_0_0_var(--border)]';

const TeacherList = () => {
  const queryClient = useQueryClient();

  // ---- List ----
  const [search, setSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [designationFilters, setDesignationFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; order: SortOrder } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [bulkRotateOpen, setBulkRotateOpen] = useState(false);
  const [detail, setDetail] = useState<Teacher | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null);

  // ---- Form dialog ----
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [signature, setSignature] = useState<File | null>(null);

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

  const invalidateTeachers = () => queryClient.invalidateQueries({ queryKey: ['teachers'] });

  const {
    data: teachersResponse,
    isLoading,
    error: teachersError,
    refetch,
  } = useTeacher({ page: 1, limit: FETCH_LIMIT });

  const teachers = useMemo(
    () => ((teachersResponse?.data ?? []) as Teacher[]).filter((t) => t.available),
    [teachersResponse],
  );
  const total: number = teachersResponse?.meta?.total ?? teachers.length;

  const errorMessage = teachersError
    ? (teachersError as { response?: { status?: number } }).response?.status === 404
      ? 'No teachers found.'
      : 'An error occurred while fetching teachers.'
    : '';

  const filtersActive =
    Boolean(search.trim()) || Boolean(emailSearch.trim()) || designationFilters.length > 0;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const mail = emailSearch.trim().toLowerCase();
    const rows = teachers.filter(
      (t) =>
        (!q || `${t.name} ${t.phone ?? ''} ${t.address ?? ''}`.toLowerCase().includes(q)) &&
        (!mail || (t.email ?? '').toLowerCase().includes(mail)) &&
        (designationFilters.length === 0 || designationFilters.includes(t.designation ?? '')),
    );
    if (!sort) return rows;
    const dir = sort.order === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => dir * (a[sort.key] ?? '').localeCompare(b[sort.key] ?? ''));
  }, [teachers, search, emailSearch, designationFilters, sort]);

  const totalPages = Math.ceil(filtered.length / limit);
  const pageRows = filtered.slice((page - 1) * limit, page * limit);

  useEffect(() => {
    setPage(1);
  }, [search, emailSearch, designationFilters, sort, limit]);

  // Drop selections for teachers that no longer exist.
  useEffect(() => {
    setSelectedIds((prev) => {
      const existing = new Set(teachers.map((t) => t.id));
      return new Set([...prev].filter((id) => existing.has(id)));
    });
  }, [teachers]);

  const withPhoto = teachers.filter((t) => t.image).length;
  const withSignature = teachers.filter((t) => t.signature).length;
  const designationOptions = Array.from(
    new Set([...DESIGNATIONS, ...teachers.map((t) => t.designation).filter(Boolean)]),
  ).map((d) => ({ value: d, label: d }));

  const clearFilters = () => {
    setSearch('');
    setEmailSearch('');
    setDesignationFilters([]);
  };

  // ---- Mutations ----
  const closeForm = () => {
    reset(defaultValues);
    setImage(null);
    setSignature(null);
    setEditing(null);
    setFormOpen(false);
  };

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
      const response = await axios.post('/api/teachers', { teachers: [formValues] });
      const newTeacher = response.data.data.teachers[0];
      if (imageFile) await uploadToR2('image', imageFile, newTeacher.id);
      if (signatureFile) await uploadToR2('signature', signatureFile, newTeacher.id);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Teacher added successfully.');
      closeForm();
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
      if (imageFile) await uploadToR2('image', imageFile, teacher.id);
      if (signatureFile) await uploadToR2('signature', signatureFile, teacher.id);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Teacher updated successfully.');
      closeForm();
      invalidateTeachers();
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'An error occurred while updating the teacher.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (teacher: Teacher) => axios.delete(`/api/teachers/${teacher.id}`),
    onSuccess: (_, teacher) => {
      toast.success('Teacher deleted successfully.');
      setDetail((d) => (d?.id === teacher.id ? null : d));
      invalidateTeachers();
    },
    onError: () => toast.error('Failed to delete teacher.'),
  });

  const removeImageMutation = useMutation({
    mutationFn: (teacherId: number) => axios.delete(`/api/teachers/${teacherId}/image`),
    onSuccess: () => {
      toast.success('Image removed.');
      setEditing((t) => (t ? { ...t, image: undefined } : t));
      invalidateTeachers();
    },
    onError: () => toast.error('Failed to remove image.'),
  });

  const removeSignatureMutation = useMutation({
    mutationFn: (teacherId: number) => axios.delete(`/api/teachers/${teacherId}/signature`),
    onSuccess: () => {
      toast.success('Signature removed.');
      setEditing((t) => (t ? { ...t, signature: undefined } : t));
      invalidateTeachers();
    },
    onError: () => toast.error('Failed to remove signature.'),
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
      setSelectedIds(new Set());
      invalidateTeachers();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to rotate passwords. Please try again.');
    },
  });

  const isSubmitting = addMutation.isPending || updateMutation.isPending;

  // ---- Handlers ----
  const openCreate = () => {
    reset(defaultValues);
    setImage(null);
    setSignature(null);
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = useCallback(
    (teacher: Teacher) => {
      reset({
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        address: teacher.address || '',
        designation: teacher.designation || '',
      });
      setImage(null);
      setSignature(null);
      setEditing(teacher);
      setDetail(null);
      setFormOpen(true);
    },
    [reset],
  );

  const onValidSubmit = (formValues: TeacherFormSchemaData) => {
    if (editing) {
      updateMutation.mutate({
        teacher: editing,
        formValues,
        imageFile: image,
        signatureFile: signature,
      });
    } else {
      addMutation.mutate({ formValues, imageFile: image, signatureFile: signature });
    }
  };

  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pageIds = pageRows.map((t) => t.id);
  const selectedOnPage = pageIds.filter((id) => selectedIds.has(id)).length;
  const allPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length;

  const toggleSelectPage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => (allPageSelected ? next.delete(id) : next.add(id)));
      return next;
    });

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
      label: 'Teacher',
      sortKey: 'name',
      className: cn(stickyCell, stickyEdge, 'left-10 px-3 sm:px-4'),
      header: (
        <ColumnHeaderMenu
          label="Teacher"
          {...sortProps('name')}
          filterInput={{ value: search, onChange: setSearch, placeholder: 'Name, phone, address…' }}
        />
      ),
    },
    {
      label: 'Email',
      sortKey: 'email',
      header: (
        <ColumnHeaderMenu
          label="Email"
          {...sortProps('email')}
          filterInput={{ value: emailSearch, onChange: setEmailSearch, placeholder: 'Email…' }}
        />
      ),
    },
    {
      label: 'Designation',
      sortKey: 'designation',
      className: 'w-56',
      header: (
        <ColumnHeaderMenu
          label="Designation"
          {...sortProps('designation')}
          options={designationOptions}
          selected={designationFilters}
          onSelectedChange={setDesignationFilters}
        />
      ),
    },
    { label: 'Signature', className: 'w-28', header: 'Signature' },
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
  const colSpan = columns.length + 1;

  const rowActions = (teacher: Teacher) => (
    <div className="flex items-center justify-end gap-0.5">
      <ActionButton
        action="edit"
        iconOnly
        className="pointer-coarse:h-11 pointer-coarse:w-11"
        onClick={() => openEdit(teacher)}
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
            {teacher.name}
          </DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => setDetail(teacher)}>
            <Eye /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openEdit(teacher)}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(teacher)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const emptyState = (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-4 py-12 text-center text-sm">
      {errorMessage ? (
        <>
          <p>{errorMessage}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            <RotateCw /> Retry
          </Button>
        </>
      ) : filtersActive ? (
        <>
          <p>No teachers match these filters.</p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
            <X /> Clear filters
          </Button>
        </>
      ) : (
        <>
          <p>No teachers yet.</p>
          <Button type="button" variant="outline" size="sm" onClick={openCreate}>
            <Plus /> Add teacher
          </Button>
        </>
      )}
    </div>
  );

  const summary = isLoading
    ? ' '
    : [
        `${filtersActive ? `${filtered.length.toLocaleString()} of ` : ''}${plural(total, 'teacher')}`,
        total > teachers.length ? `showing first ${teachers.length.toLocaleString()}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Teacher List</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">{summary}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          <Plus /> Add teacher
        </Button>
      </header>

      {!isLoading && teachers.length > 0 && (
        <div className="border-border bg-card mb-6 grid grid-cols-3 gap-x-6 rounded-xl border px-5 py-4 shadow-sm sm:w-fit sm:min-w-[24rem]">
          <Stat label="Total" value={total} />
          <Stat label="With photo" value={withPhoto} dot="bg-emerald-500" />
          <Stat label="With signature" value={withSignature} dot="bg-sky-500" />
        </div>
      )}

      <SectionCard noPadding className="mb-6">
        {/* One table for every screen: narrow screens scroll it sideways. */}
        <div className="overflow-x-auto xl:overflow-visible">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead className="xl:sticky xl:top-0 xl:z-10">
              <tr className="border-border [&>th]:bg-muted border-b [&>th:first-child]:rounded-tl-[calc(var(--radius)+3px)] [&>th:last-child]:rounded-tr-[calc(var(--radius)+3px)]">
                <th className={cn(stickyCell, 'left-0 w-10 px-3 py-2.5')}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedOnPage > 0 && !allPageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all teachers on this page"
                    className="h-4 w-4 align-middle"
                  />
                </th>
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
                    <td colSpan={colSpan} className="px-4 py-2">
                      <Skeleton className="h-9 w-full" />
                    </td>
                  </tr>
                ))
              ) : pageRows.length > 0 ? (
                pageRows.map((teacher) => {
                  const isSelected = selectedIds.has(teacher.id);
                  return (
                    // Opaque row colours so the pinned cells hide what scrolls under them.
                    <tr
                      key={teacher.id}
                      className={cn(
                        'transition-colors',
                        isSelected
                          ? 'bg-[color-mix(in_oklab,var(--primary)_6%,var(--card))]'
                          : 'bg-card hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]',
                      )}
                    >
                      <td className={cn(stickyCell, 'left-0 w-10 px-3 py-2')}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(teacher.id)}
                          aria-label={`Select ${teacher.name}`}
                          className="h-4 w-4 align-middle"
                        />
                      </td>
                      <td className={cn(stickyCell, stickyEdge, 'left-10 px-3 py-2 sm:px-4')}>
                        <div className="flex max-w-[12rem] items-center gap-3 sm:max-w-none">
                          <TeacherAvatar teacher={teacher} />
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => setDetail(teacher)}
                              className="focus-visible:ring-ring block max-w-full truncate rounded text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2"
                            >
                              {teacher.name}
                            </button>
                            {teacher.phone && (
                              <p className="text-muted-foreground truncate text-xs tabular-nums">
                                {teacher.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {teacher.email || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {teacher.designation || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {teacher.signature ? (
                          <span className="text-emerald-700 dark:text-emerald-400">Added</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {rowActions(teacher)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={colSpan}>{emptyState}</td>
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

      {selectedIds.size > 0 && <div aria-hidden className="min-h-6 flex-1" />}
      {selectedIds.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CloseButton onClick={() => setSelectedIds(new Set())} />
            <p className="text-sm font-medium tabular-nums">
              {plural(selectedIds.size, 'teacher')} selected
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setBulkRotateOpen(true)}
            disabled={bulkRotateMutation.isPending}
          >
            {bulkRotateMutation.isPending ? <Loader2 className="animate-spin" /> : <KeyRound />}
            Rotate passwords
          </Button>
        </div>
      )}

      <ConfirmationPopup
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget);
          setDeleteTarget(null);
        }}
        confirmLabel="Delete teacher"
        msg={`Delete ${deleteTarget?.name ?? 'this teacher'}? This cannot be undone.`}
      />

      <ConfirmationPopup
        open={bulkRotateOpen}
        onOpenChange={setBulkRotateOpen}
        onConfirm={() => {
          setBulkRotateOpen(false);
          bulkRotateMutation.mutate(Array.from(selectedIds));
        }}
        title="Rotate passwords"
        confirmLabel="Rotate passwords"
        variant="default"
        msg={`This will generate new passwords for ${plural(selectedIds.size, 'teacher')} and download an Excel file with the new credentials. An email is also sent to the headmaster. Old passwords stop working.`}
      />

      {detail && (
        <Popup
          open
          onOpenChange={(o) => !o && setDetail(null)}
          size="md"
          aria-labelledby="teacher-details-title"
        >
          <DialogHeader
            id="teacher-details-title"
            title="Teacher details"
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
                <div className="border-border bg-muted text-muted-foreground aspect-7/9 flex w-20 shrink-0 items-center justify-center rounded-md border text-3xl font-semibold">
                  {detail.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-lg font-semibold leading-tight">{detail.name}</p>
                <p className="text-muted-foreground mt-1 text-sm">{detail.designation || '—'}</p>
                {detail.subject && (
                  <span className="bg-primary/10 text-primary mt-2 inline-block rounded-sm px-2 py-0.5 text-xs font-medium">
                    {detail.subject}
                  </span>
                )}
              </div>
            </div>
            <dl className="grid grid-cols-[6rem_1fr] gap-x-3 gap-y-2 text-sm">
              {[
                { label: 'Email', value: detail.email },
                { label: 'Phone', value: detail.phone },
                { label: 'Address', value: detail.address },
              ]
                .filter(({ value }) => value)
                .map(({ label, value }) => (
                  <React.Fragment key={label}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="break-words font-medium">{value}</dd>
                  </React.Fragment>
                ))}
              {detail.signature && (
                <>
                  <dt className="text-muted-foreground">Signature</dt>
                  <dd>
                    <div className="h-12 w-fit overflow-hidden rounded-sm border bg-white p-1">
                      <img
                        src={getFileUrl(detail.signature)}
                        alt="Signature"
                        className="h-full object-contain"
                      />
                    </div>
                  </dd>
                </>
              )}
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
              <Pencil /> Edit teacher
            </Button>
          </div>
        </Popup>
      )}

      <Popup
        open={formOpen}
        onOpenChange={(o) => !o && !isSubmitting && closeForm()}
        size="lg"
        aria-labelledby="teacher-form-title"
      >
        <form onSubmit={rhfHandleSubmit(onValidSubmit)}>
          <DialogHeader
            id="teacher-form-title"
            title={editing ? 'Edit teacher' : 'Add teacher'}
            onClose={closeForm}
          />

          <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name?.message}>
                <Input type="text" placeholder="Enter teacher's name" {...register('name')} />
              </Field>
              <Field label="Email" required error={errors.email?.message}>
                <Input type="email" placeholder="Enter teacher's email" {...register('email')} />
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
              <Field label="Designation" required error={errors.designation?.message}>
                <select className={filterSelectClassName} {...register('designation')}>
                  <option value="">Select designation</option>
                  {DESIGNATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
                <Input type="text" placeholder="Enter teacher's address" {...register('address')} />
              </Field>
            </div>

            <ImagePicker
              label="Photo"
              file={image}
              currentUrl={editing?.image}
              thumbClassName="w-10 object-cover object-top"
              onPick={setImage}
              onRemoveCurrent={() => editing && removeImageMutation.mutate(editing.id)}
              removing={removeImageMutation.isPending}
            />
            <ImagePicker
              label="Signature"
              file={signature}
              currentUrl={editing?.signature}
              thumbClassName="w-24 bg-white object-contain p-1"
              onPick={setSignature}
              onRemoveCurrent={() => editing && removeSignatureMutation.mutate(editing.id)}
              removing={removeSignatureMutation.isPending}
            />
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t px-5 py-3">
            <p className="text-muted-foreground text-xs">
              <span className="text-destructive">*</span> required
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={closeForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {editing ? 'Save changes' : 'Add teacher'}
              </Button>
            </div>
          </div>
        </form>
      </Popup>
    </div>
  );
};

export default TeacherList;
