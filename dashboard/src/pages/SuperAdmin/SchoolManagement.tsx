import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import {
  Building2,
  Download,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UserCog,
} from 'lucide-react';
import { downloadBlob } from '@school/common-ui/blob';
import {
  addAdminSchema,
  createSchoolSchema,
  districts,
  getUpazilasByDistrict,
  type District,
  type Upazila,
} from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SchoolData {
  id?: number;
  name: string;
  shortName?: string;
  nameBn?: string;
  eiin?: string;
  centerCode?: string;
  logo: string;
  favicon?: string;
  governmentLogo?: string;
  headerLogo?: string;
  district: string;
  upazila: string;
  address?: string;
  location?: string;
  phone: string;
  email: string;
  website?: string;
  mapEmbedUrl?: string;
  slogan?: string;
  establishedIn?: number;
  nationalizedYear?: string;
  resultsUrl?: string;
  teacherLoginUrl?: string;
  studentLoginUrl?: string;
  subdomain?: string;
  customDomain?: string;
  gaMeasurementId?: string;
}

interface SchoolAdmin {
  id: number;
  username: string;
  role: string;
}

type AdminFormValues = {
  username: string;
  password: string;
};

const currentYear = new Date().getFullYear();

type SchoolFormValues = z.input<typeof createSchoolSchema>;

const createEmptySchool = (): SchoolFormValues => ({
  name: '',
  shortName: '',
  nameBn: '',
  eiin: '',
  centerCode: '',
  logo: '',
  favicon: '',
  governmentLogo: '',
  headerLogo: '',
  district: '',
  upazila: '',
  address: '',
  location: '',
  phone: '',
  email: '',
  slogan: '',
  establishedIn: currentYear,
  nationalizedYear: '',
  subdomain: '',
  customDomain: '',
  website: '',
  resultsUrl: '',
  teacherLoginUrl: '',
  studentLoginUrl: '',
  mapEmbedUrl: '',
  gaMeasurementId: '',
});

const toFormValues = (school?: SchoolData | null): SchoolFormValues => ({
  name: school?.name ?? '',
  shortName: school?.shortName ?? '',
  nameBn: school?.nameBn ?? '',
  eiin: school?.eiin ?? '',
  centerCode: school?.centerCode ?? '',
  logo: school?.logo ?? '',
  favicon: school?.favicon ?? '',
  governmentLogo: school?.governmentLogo ?? '',
  headerLogo: school?.headerLogo ?? '',
  district: school?.district ?? '',
  upazila: school?.upazila ?? '',
  address: school?.address ?? '',
  location: school?.location ?? '',
  phone: school?.phone ?? '',
  email: school?.email ?? '',
  slogan: school?.slogan ?? '',
  establishedIn: school?.establishedIn ?? currentYear,
  nationalizedYear: school?.nationalizedYear ?? '',
  subdomain: school?.subdomain ?? '',
  customDomain: school?.customDomain ?? '',
  website: school?.website ?? '',
  resultsUrl: school?.resultsUrl ?? '',
  teacherLoginUrl: school?.teacherLoginUrl ?? '',
  studentLoginUrl: school?.studentLoginUrl ?? '',
  mapEmbedUrl: school?.mapEmbedUrl ?? '',
  gaMeasurementId: school?.gaMeasurementId ?? '',
});

function SchoolManagement() {
  const { confirm, dialog } = useConfirmDialog();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<number | 'new'>('new');
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
  const [fetchingAdmins, setFetchingAdmins] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<number | null>(null);
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const {
    register: registerAdmin,
    handleSubmit: handleAdminSubmit,
    reset: resetAdminForm,
    formState: { errors: adminErrors },
  } = useForm<AdminFormValues>({
    resolver: zodResolver(addAdminSchema),
    defaultValues: { username: '', password: '' },
    mode: 'onSubmit',
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: createEmptySchool(),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const district = watch('district');
  const schoolName = watch('name');
  const logoValue = watch('logo');

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const fetchSchools = useCallback(async () => {
    setFetching(true);
    try {
      const res = await axios.get('/api/schools');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSchools(list);

      setSelectedSchoolId((previousSelectedId) => {
        if (previousSelectedId === 'new') {
          return previousSelectedId;
        }

        const current = list.find((school: SchoolData) => school.id === previousSelectedId);
        if (current) {
          reset(toFormValues(current));
          return previousSelectedId;
        }

        reset(createEmptySchool());
        return 'new';
      });
    } catch (error) {
      console.error('Failed to fetch schools', error);
      toast.error('Failed to load schools');
    } finally {
      setFetching(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const fetchSchoolAdmins = useCallback(async (schoolId: number) => {
    setFetchingAdmins(true);
    try {
      const res = await axios.get(`/api/auth/super_admin/schools/${schoolId}/admins`);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSchoolAdmins(list);
    } catch (error) {
      console.error('Failed to fetch school admins', error);
      setSchoolAdmins([]);
      toast.error('Failed to load school admins');
    } finally {
      setFetchingAdmins(false);
    }
  }, []);

  useEffect(() => {
    resetAdminForm({ username: '', password: '' });
    if (typeof selectedSchoolId === 'number') {
      fetchSchoolAdmins(selectedSchoolId);
    } else {
      setSchoolAdmins([]);
    }
  }, [selectedSchoolId, fetchSchoolAdmins, resetAdminForm]);

  const selectSchool = (school: SchoolData) => {
    setSelectedSchoolId(school.id ?? 'new');
    reset(toFormValues(school));
  };

  const startNewSchool = () => {
    setSelectedSchoolId('new');
    reset(createEmptySchool());
    setSchoolAdmins([]);
    resetAdminForm({ username: '', password: '' });
    setPendingLogoFile(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
    }
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPendingLogoFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl(null);
      }
      return;
    }

    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        const result = { width: img.width, height: img.height };
        URL.revokeObjectURL(objectUrl);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read image'));
      };
      img.src = objectUrl;
    });

    if (dimensions.width !== dimensions.height) {
      setError('logo', {
        type: 'manual',
        message: 'Logo must be a square image',
      });
      toast.error('Logo must be a square image');
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }
    setLogoPreviewUrl(URL.createObjectURL(file));
    setPendingLogoFile(file);
    setValue('logo', `pending-logo/${file.name}`, { shouldValidate: true });
    clearErrors('logo');
  };

  const uploadLogoIfNeeded = async (): Promise<string | null> => {
    if (!pendingLogoFile) return null;

    setLogoUploading(true);
    try {
      const signRes = await axios.post('/api/schools/logo-upload-url', {
        fileName: pendingLogoFile.name,
        contentType: pendingLogoFile.type || 'image/png',
      });
      const uploadUrl = signRes.data?.data?.uploadUrl as string | undefined;
      const key = signRes.data?.data?.key as string | undefined;

      if (!uploadUrl || !key) {
        throw new Error('Upload URL generation failed');
      }

      await putFileToPresignedUrl(uploadUrl, pendingLogoFile, pendingLogoFile.type || 'image/png');

      setPendingLogoFile(null);
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
        setLogoPreviewUrl(null);
      }
      return key;
    } finally {
      setLogoUploading(false);
    }
  };

  const onSubmit = async (values: SchoolFormValues) => {
    clearErrors();
    setSaving(true);

    try {
      if (!values.logo && !pendingLogoFile) {
        setError('logo', {
          type: 'manual',
          message: 'Logo is required',
        });
        toast.error('Logo is required');
        return;
      }

      const uploadedLogoKey = await uploadLogoIfNeeded();
      const payload = {
        ...values,
        logo: uploadedLogoKey ?? values.logo,
      };

      if (selectedSchoolId !== 'new') {
        await axios.put(`/api/schools/${selectedSchoolId}`, payload);
        toast.success('School updated successfully');
      } else {
        const res = await axios.post('/api/schools', payload);
        toast.success('School created successfully');

        const createdId = res.data?.data?.id;
        if (typeof createdId === 'number') {
          setSelectedSchoolId(createdId);
        }
      }

      await fetchSchools();
    } catch (error) {
      console.error('Failed to save school', error);

      if (axios.isAxiosError(error)) {
        const responseData = error.response?.data as
          | {
              message?: string;
              errors?: Array<{ path?: Array<string | number>; message?: string }>;
            }
          | undefined;

        const issues = Array.isArray(responseData?.errors) ? responseData.errors : [];

        let appliedFieldError = false;
        for (const issue of issues) {
          const rawPath = Array.isArray(issue.path) ? issue.path.join('.') : '';
          const message = issue.message || 'Invalid value';

          if (rawPath && Object.prototype.hasOwnProperty.call(values, rawPath)) {
            setError(rawPath as keyof SchoolFormValues, {
              type: 'server',
              message,
            });
            appliedFieldError = true;
          }
        }

        if (appliedFieldError && issues[0]?.message) {
          toast.error(issues[0].message);
        } else {
          toast.error(responseData?.message || 'Failed to save school');
        }
      } else {
        toast.error('Failed to save school');
      }
    } finally {
      setSaving(false);
    }
  };

  const onAddAdmin = async (values: AdminFormValues) => {
    if (selectedSchoolId === 'new') {
      toast.error('Save the school before adding admins');
      return;
    }

    setAddingAdmin(true);
    try {
      await axios.post(`/api/auth/super_admin/schools/${selectedSchoolId}/admins`, values);
      toast.success('Admin added successfully');
      resetAdminForm({ username: '', password: '' });
      await fetchSchoolAdmins(selectedSchoolId);
    } catch (error) {
      console.error('Failed to add admin', error);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to add admin');
      } else {
        toast.error('Failed to add admin');
      }
    } finally {
      setAddingAdmin(false);
    }
  };

  const handleDeleteAdmin = async (admin: SchoolAdmin) => {
    if (selectedSchoolId === 'new') return;

    const confirmed = await confirm({
      title: 'Delete admin?',
      msg: `Delete admin "${admin.username}" from this school?`,
      confirmLabel: 'Delete Admin',
    });
    if (!confirmed) return;

    setDeletingAdminId(admin.id);
    try {
      await axios.delete(`/api/auth/super_admin/schools/${selectedSchoolId}/admins/${admin.id}`);
      toast.success('Admin deleted');
      await fetchSchoolAdmins(selectedSchoolId);
    } catch (error) {
      console.error('Failed to delete admin', error);
      toast.error('Failed to delete admin');
    } finally {
      setDeletingAdminId(null);
    }
  };

  const handleRotatePassword = async (id: number, name: string) => {
    const confirmed = await confirm({
      title: 'Rotate student passwords?',
      msg: `Rotate passwords for ALL students of "${name}"? New credentials will be downloaded as an Excel file. This cannot be undone.`,
      confirmLabel: 'Rotate Passwords',
    });
    if (!confirmed) return;

    setRotatingId(id);
    try {
      const { data } = await axios.post(`/api/schools/${id}/rotate-student-passwords`, undefined, {
        responseType: 'blob',
      });
      const safeName = (name || 'school').replace(/[^a-zA-Z0-9-_]/g, '_');
      downloadBlob(new Blob([data]), `${safeName}_rotated_passwords.xlsx`);
      toast.success('Student passwords rotated. Excel downloaded.');
    } catch (error) {
      console.error('Failed to rotate passwords', error);
      toast.error('Failed to rotate passwords');
    } finally {
      setRotatingId(null);
    }
  };

  const handleExportStudents = async (id: number, name: string) => {
    setExportingId(id);
    try {
      const { data } = await axios.get(`/api/schools/${id}/students/export`, {
        responseType: 'blob',
      });
      const safeName = (name || 'school').replace(/[^a-zA-Z0-9-_]/g, '_');
      downloadBlob(new Blob([data]), `${safeName}_students.xlsx`);
      toast.success('Students exported');
    } catch (error) {
      console.error('Failed to export students', error);
      toast.error('Failed to export students');
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="School Management"
        description="Create and manage multiple schools from the super admin panel."
      >
        <Button type="button" variant="outline" onClick={fetchSchools} disabled={fetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${fetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SectionCard
          className="lg:col-span-4"
          title={`Schools (${sortedSchools.length})`}
          icon={<Building2 size={20} />}
          headerAction={
            <Button type="button" size="sm" onClick={startNewSchool}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          }
        >
          <div className="max-h-130 space-y-2 overflow-y-auto pr-1">
            {sortedSchools.length === 0 && (
              <p className="text-muted-foreground text-sm">No schools found yet.</p>
            )}

            {sortedSchools.map((school) => {
              const isSelected = school.id === selectedSchoolId;
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => selectSchool(school)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="truncate font-medium">{school.name || 'Untitled School'}</p>
                  <p className="text-muted-foreground mt-1 truncate text-xs">
                    {school.subdomain ? `${school.subdomain}.localhost` : 'No subdomain'}
                  </p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          className="lg:col-span-8"
          title={
            selectedSchoolId !== 'new' ? `Edit: ${schoolName || 'School'}` : 'Create New School'
          }
          icon={<Building2 size={20} />}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {selectedSchoolId !== 'new' && (
              <div className="bg-muted/40 rounded-lg border p-4">
                <p className="text-sm font-medium">Student Actions</p>
                <p className="text-muted-foreground mb-3 text-xs">
                  Applies to all students of this school.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportStudents(selectedSchoolId, schoolName)}
                    disabled={exportingId === selectedSchoolId}
                    className="bg-background text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-60"
                  >
                    {exportingId === selectedSchoolId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download All Students
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRotatePassword(selectedSchoolId, schoolName)}
                    disabled={rotatingId === selectedSchoolId}
                    className="bg-background inline-flex items-center gap-2 rounded-md border border-amber-300 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                  >
                    {rotatingId === selectedSchoolId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    Rotate All Student Passwords
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Section 1: General & Board Info */}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <h3 className="text-primary flex items-center gap-1.5 border-b pb-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" />
                  General & Board Identification
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">School Name (English)</label>
                    <input
                      {...register('name')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. Dhaka Residential Model College"
                    />
                    {errors.name && (
                      <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">
                      School Name (Bengali / বাংলা নাম)
                    </label>
                    <input
                      {...register('nameBn')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. ঢাকা রেসিডেনসিয়াল মডেল কলেজ"
                    />
                    {errors.nameBn && (
                      <p className="mt-1 text-xs text-red-600">{errors.nameBn.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Short Name</label>
                    <input
                      {...register('shortName')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. DRMC"
                    />
                    {errors.shortName && (
                      <p className="mt-1 text-xs text-red-600">{errors.shortName.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">EIIN</label>
                    <input
                      {...register('eiin')}
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. 123456"
                    />
                    {errors.eiin && (
                      <p className="mt-1 text-xs text-red-600">{errors.eiin.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Center Code</label>
                    <input
                      {...register('centerCode')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. 102"
                    />
                    {errors.centerCode && (
                      <p className="mt-1 text-xs text-red-600">{errors.centerCode.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Established In</label>
                    <input
                      type="number"
                      {...register('establishedIn')}
                      className="w-full rounded-md border px-3 py-2"
                    />
                    {errors.establishedIn && (
                      <p className="mt-1 text-xs text-red-600">{errors.establishedIn.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Nationalized Year</label>
                    <input
                      {...register('nationalizedYear')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. 1980"
                    />
                    {errors.nationalizedYear && (
                      <p className="mt-1 text-xs text-red-600">{errors.nationalizedYear.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Slogan / Motto</label>
                    <input
                      {...register('slogan')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. Knowledge is Power"
                    />
                    {errors.slogan && (
                      <p className="mt-1 text-xs text-red-600">{errors.slogan.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Physical Location */}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <h3 className="text-primary flex items-center gap-1.5 border-b pb-2 text-sm font-semibold">
                  <MapPin className="h-4 w-4" />
                  Contact & Location
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                      <Phone className="h-4 w-4" /> Phone
                    </label>
                    <input
                      {...register('phone')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. 01712345678"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 flex items-center gap-1 text-sm font-medium">
                      <Mail className="h-4 w-4" /> Email
                    </label>
                    <input
                      type="email"
                      {...register('email')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. school@example.com"
                    />
                    {errors.email && (
                      <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">District</label>
                    <div className="relative">
                      <MapPin className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <select
                        {...register('district', {
                          onChange: () => {
                            setValue('upazila', '', { shouldValidate: true });
                          },
                        })}
                        className="w-full rounded-md border px-3 py-2 pl-10"
                      >
                        <option value="">Select District</option>
                        {districts.map((d: District) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors.district && (
                      <p className="mt-1 text-xs text-red-600">{errors.district.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Upazila</label>
                    <div className="relative">
                      <MapPin className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                      <select
                        {...register('upazila')}
                        className="w-full rounded-md border px-3 py-2 pl-10"
                        disabled={!district}
                      >
                        <option value="">Select Upazila</option>
                        {district &&
                          getUpazilasByDistrict(district).map((u: Upazila) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {errors.upazila && (
                      <p className="mt-1 text-xs text-red-600">{errors.upazila.message}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium">Full Postal Address</label>
                    <input
                      {...register('address')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. Mirpur Road, Mohammadpur, Dhaka-1207"
                    />
                    {errors.address && (
                      <p className="mt-1 text-xs text-red-600">{errors.address.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Short Location Summary</label>
                    <input
                      {...register('location')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. Mohammadpur, Dhaka"
                    />
                    {errors.location && (
                      <p className="mt-1 text-xs text-red-600">{errors.location.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Google Maps Embed URL</label>
                    <input
                      {...register('mapEmbedUrl')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://www.google.com/maps/embed?pb=..."
                    />
                    {errors.mapEmbedUrl && (
                      <p className="mt-1 text-xs text-red-600">{errors.mapEmbedUrl.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Subdomains & Portal Links */}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <h3 className="text-primary flex items-center gap-1.5 border-b pb-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" />
                  Routing & Portal Links
                </h3>
                <p className="text-muted-foreground text-xs">
                  Portal links power the public site menu and sidebar. Results defaults to{' '}
                  <code>/result</code> when blank. Leave teacher or student login blank to hide that
                  link.
                </p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Subdomain</label>
                    <input
                      {...register('subdomain')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. drmc"
                    />
                    {errors.subdomain && (
                      <p className="mt-1 text-xs text-red-600">{errors.subdomain.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Custom Domain</label>
                    <input
                      {...register('customDomain')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. drmc.edu.bd"
                    />
                    {errors.customDomain && (
                      <p className="mt-1 text-xs text-red-600">{errors.customDomain.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">External Website URL</label>
                    <input
                      {...register('website')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://drmc.edu.bd"
                    />
                    {errors.website && (
                      <p className="mt-1 text-xs text-red-600">{errors.website.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Results Portal Link</label>
                    <input
                      {...register('resultsUrl')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="Blank = /result, or e.g. https://results.example.com"
                    />
                    {errors.resultsUrl && (
                      <p className="mt-1 text-xs text-red-600">{errors.resultsUrl.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Teacher Login URL</label>
                    <input
                      {...register('teacherLoginUrl')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://drmc.edu.bd/teacher-login"
                    />
                    {errors.teacherLoginUrl && (
                      <p className="mt-1 text-xs text-red-600">{errors.teacherLoginUrl.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Student Login URL</label>
                    <input
                      {...register('studentLoginUrl')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://drmc.edu.bd/student-login"
                    />
                    {errors.studentLoginUrl && (
                      <p className="mt-1 text-xs text-red-600">{errors.studentLoginUrl.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Google Analytics Measurement ID (GA4)
                    </label>
                    <input
                      {...register('gaMeasurementId')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. G-XXXXXXXXXX"
                    />
                    {errors.gaMeasurementId && (
                      <p className="mt-1 text-xs text-red-600">{errors.gaMeasurementId.message}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 4: Logos & Branding */}
              <div className="bg-muted/40 space-y-4 rounded-lg border p-4">
                <h3 className="text-primary flex items-center gap-1.5 border-b pb-2 text-sm font-semibold">
                  <Building2 className="h-4 w-4" />
                  Logos & Graphics
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">Main School Logo</label>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={logoUploading}
                      className="text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {logoPreviewUrl && (
                      <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                        <img
                          src={logoPreviewUrl}
                          alt="Selected logo preview"
                          className="h-10 w-10 rounded border object-contain"
                        />
                        <span>Logo ready to upload</span>
                      </div>
                    )}
                    {!logoPreviewUrl && logoValue && logoValue.startsWith('http') && (
                      <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                        <img
                          src={logoValue}
                          alt="Uploaded logo preview"
                          className="h-10 w-10 rounded border object-contain"
                        />
                        <span>Logo uploaded</span>
                      </div>
                    )}
                    {!logoPreviewUrl && logoValue && (
                      <img src={getFileUrl(logoValue)} alt="" className="w-20" />
                    )}
                    {errors.logo && (
                      <p className="mt-1 text-xs text-red-600">{errors.logo.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Favicon URL / Path</label>
                    <input
                      {...register('favicon')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://.../favicon.ico"
                    />
                    {errors.favicon && (
                      <p className="mt-1 text-xs text-red-600">{errors.favicon.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Govt Emblem Logo URL</label>
                    <input
                      {...register('governmentLogo')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://.../govt-logo.png"
                    />
                    {errors.governmentLogo && (
                      <p className="mt-1 text-xs text-red-600">{errors.governmentLogo.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">Header Banner Logo URL</label>
                    <input
                      {...register('headerLogo')}
                      className="w-full rounded-md border px-3 py-2"
                      placeholder="e.g. https://.../header-logo.png"
                    />
                    {errors.headerLogo && (
                      <p className="mt-1 text-xs text-red-600">{errors.headerLogo.message}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || logoUploading}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {selectedSchoolId !== 'new' ? 'Update School' : 'Create School'}
              </Button>
            </div>
          </form>

          {selectedSchoolId !== 'new' && (
            <div className="bg-muted/40 mt-8 space-y-4 rounded-xl border p-5">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold">
                  <UserCog className="text-primary h-5 w-5" />
                  School Admins ({schoolAdmins.length})
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fetchSchoolAdmins(selectedSchoolId)}
                  disabled={fetchingAdmins}
                >
                  <RefreshCw
                    className={`mr-1 h-3.5 w-3.5 ${fetchingAdmins ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </Button>
              </div>

              {fetchingAdmins ? (
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading admins...
                </div>
              ) : schoolAdmins.length === 0 ? (
                <p className="text-muted-foreground text-sm">No admins for this school yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {schoolAdmins.map((admin) => (
                    <li
                      key={admin.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p className="font-medium">{admin.username}</p>
                        <p className="text-muted-foreground text-xs capitalize">{admin.role}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(admin)}
                        disabled={deletingAdminId === admin.id}
                        className="inline-flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs text-red-600"
                      >
                        {deletingAdminId === admin.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={handleAdminSubmit(onAddAdmin)}
                className="grid grid-cols-1 gap-3 border-t pt-2 md:grid-cols-3"
                noValidate
              >
                <div>
                  <label className="mb-1 block text-sm font-medium">Username</label>
                  <input
                    {...registerAdmin('username')}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="e.g. admin@school"
                  />
                  {adminErrors.username && (
                    <p className="mt-1 text-xs text-red-600">{adminErrors.username.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Password</label>
                  <input
                    type="password"
                    {...registerAdmin('password')}
                    className="w-full rounded-md border px-3 py-2"
                    placeholder="Min 6 characters"
                  />
                  {adminErrors.password && (
                    <p className="mt-1 text-xs text-red-600">{adminErrors.password.message}</p>
                  )}
                </div>
                <div className="flex items-end">
                  <Button type="submit" disabled={addingAdmin || fetchingAdmins} className="w-full">
                    {addingAdmin ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Admin
                  </Button>
                </div>
              </form>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default SchoolManagement;
