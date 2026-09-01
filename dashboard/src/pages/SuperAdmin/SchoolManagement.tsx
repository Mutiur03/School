import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import toast from 'react-hot-toast';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  GripVertical,
  ImageIcon,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserCog,
} from 'lucide-react';
import { downloadBlob } from '@school/common-ui/blob';
import { useSearchParams } from 'react-router-dom';
import {
  addAdminSchema,
  createSchoolSchema,
  districts,
  getUpazilasByDistrict,
  SCHOOL_BOARDS,
  SCHOOL_GENDERS,
  SCHOOL_MEDIUMS,
  SCHOOL_OWNERSHIPS,
  VALID_GROUPS,
  formatSubjectGroups,
  type District,
  type SchoolAssetKind,
  type Upazila,
} from '@school/shared-schemas';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { PageHeader, SectionCard, SchoolLogo, SchoolListItemSkeleton, EditorPanelSkeleton } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface SchoolData {
  id?: number;
  name: string;
  shortName?: string | null;
  nameBn?: string | null;
  eiin?: string | null;
  centerCode?: string | null;
  schoolCode?: string | null;
  subjectGroups?: string | null;
  medium?: string | null;
  board?: string | null;
  ownership?: string | null;
  gender?: string | null;
  logo: string;
  headerLogo?: string | null;
  bannerUrls?: string[] | null;
  district: string;
  upazila: string;
  address?: string | null;
  phone: string;
  email: string;
  mapEmbedUrl?: string | null;
  establishedIn?: number | null;
  nationalizedYear?: string | null;
  resultsUrl?: string | null;
  teacherLoginUrl?: string | null;
  studentLoginUrl?: string | null;
  subdomain?: string | null;
  customDomain?: string | null;
  gaMeasurementId?: string | null;
  descriptions?: { main?: string | null; sub?: string | null } | null;
  academicProfile?: {
    grades?: string | null;
    ageRange?: string | null;
    enrollment?: string | null;
    studentTeacherRatio?: string | null;
    colors?: string | null;
    campusArea?: string | null;
    playgroundArea?: string | null;
  } | null;
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

const MB = 1024 * 1024;

/** Client-side image constraints for school branding assets. */
const IMAGE_RULES = {
  logo: {
    label: 'Logo',
    maxBytes: 2 * MB,
    minWidth: 256,
    maxWidth: 2048,
    square: true as const,
  },
  header: {
    label: 'Header logo',
    maxBytes: 3 * MB,
    minWidth: 800,
    maxWidth: 3200,
    minHeight: 120,
    maxHeight: 900,
    /** Width must be at least this many times the height (wide banner mark). */
    minAspect: 2.5,
  },
  banner: {
    label: 'Banner',
    maxBytes: 4 * MB,
    minWidth: 1200,
    maxWidth: 3840,
    minHeight: 300,
    maxHeight: 1600,
    minAspect: 1.5,
  },
} as const;

const formatMb = (bytes: number) => `${(bytes / MB).toFixed(bytes % MB === 0 ? 0 : 1)} MB`;

const readImageDimensions = (file: File) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
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

const validateSchoolImage = async (
  file: File,
  kind: keyof typeof IMAGE_RULES,
): Promise<string | null> => {
  const rules = IMAGE_RULES[kind];
  if (!file.type.startsWith('image/')) {
    return `${rules.label} must be an image file (PNG or JPG)`;
  }
  if (file.size > rules.maxBytes) {
    return `${rules.label} must be under ${formatMb(rules.maxBytes)} (got ${formatMb(file.size)})`;
  }

  let dimensions: { width: number; height: number };
  try {
    dimensions = await readImageDimensions(file);
  } catch {
    return `Unable to read ${rules.label.toLowerCase()} image`;
  }

  const { width, height } = dimensions;
  if (width < 1 || height < 1) {
    return `${rules.label} image is invalid`;
  }

  if (kind === 'logo') {
    const logo = IMAGE_RULES.logo;
    if (width !== height) {
      return `${logo.label} must be square (got ${width}×${height})`;
    }
    if (width < logo.minWidth) {
      return `${logo.label} must be at least ${logo.minWidth}×${logo.minWidth}px (got ${width}×${height})`;
    }
    if (width > logo.maxWidth) {
      return `${logo.label} must be at most ${logo.maxWidth}×${logo.maxWidth}px (got ${width}×${height})`;
    }
    return null;
  }

  const wide = kind === 'header' ? IMAGE_RULES.header : IMAGE_RULES.banner;
  if (width < wide.minWidth || height < wide.minHeight) {
    return `${wide.label} must be at least ${wide.minWidth}×${wide.minHeight}px (got ${width}×${height})`;
  }
  if (width > wide.maxWidth || height > wide.maxHeight) {
    return `${wide.label} must be at most ${wide.maxWidth}×${wide.maxHeight}px (got ${width}×${height})`;
  }
  const aspect = width / height;
  if (aspect < wide.minAspect) {
    return `${wide.label} must be wide (at least ${wide.minAspect}:1, got ${aspect.toFixed(2)}:1)`;
  }
  return null;
};

const EDITOR_TABS = [
  { id: 'identity', label: 'Identity' },
  { id: 'contact', label: 'Contact' },
  { id: 'domains', label: 'Domains' },
  { id: 'branding', label: 'Branding' },
  { id: 'academic', label: 'Academic' },
  { id: 'about', label: 'About' },
  { id: 'admins', label: 'Admins' },
] as const;

type EditorTab = (typeof EDITOR_TABS)[number]['id'];

const EDITOR_TAB_IDS = new Set<string>(EDITOR_TABS.map((tab) => tab.id));

const parseSchoolId = (raw: string | null): number | 'new' => {
  if (!raw || raw === 'new') return 'new';
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : 'new';
};

const parseEditorTab = (raw: string | null): EditorTab =>
  raw && EDITOR_TAB_IDS.has(raw) ? (raw as EditorTab) : 'identity';

const FIELD_TAB: Record<string, EditorTab> = {
  name: 'identity',
  nameBn: 'identity',
  shortName: 'identity',
  eiin: 'identity',
  centerCode: 'identity',
  schoolCode: 'identity',
  establishedIn: 'identity',
  nationalizedYear: 'identity',
  phone: 'contact',
  email: 'contact',
  district: 'contact',
  upazila: 'contact',
  address: 'contact',
  mapEmbedUrl: 'contact',
  subdomain: 'domains',
  customDomain: 'domains',
  resultsUrl: 'domains',
  teacherLoginUrl: 'domains',
  studentLoginUrl: 'domains',
  gaMeasurementId: 'domains',
  logo: 'branding',
  headerLogo: 'branding',
  bannerUrls: 'branding',
  subjectGroups: 'academic',
  medium: 'academic',
  board: 'academic',
  ownership: 'academic',
  gender: 'academic',
  academicProfile: 'academic',
  descriptions: 'about',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'School Name',
  nameBn: 'Bengali Name',
  shortName: 'Short Name',
  eiin: 'EIIN',
  centerCode: 'Center Code',
  schoolCode: 'School Code',
  establishedIn: 'Established In',
  nationalizedYear: 'Nationalized Year',
  phone: 'Phone',
  email: 'Email',
  district: 'District',
  upazila: 'Upazila',
  address: 'Address',
  mapEmbedUrl: 'Map Embed URL',
  subdomain: 'Subdomain',
  customDomain: 'Custom Domain',
  resultsUrl: 'Results URL',
  teacherLoginUrl: 'Teacher Login URL',
  studentLoginUrl: 'Student Login URL',
  gaMeasurementId: 'GA Measurement ID',
  logo: 'Main Logo',
  headerLogo: 'Header Logo',
  bannerUrls: 'Banners',
  subjectGroups: 'Groups',
  medium: 'Medium',
  board: 'Board',
  ownership: 'Ownership',
  gender: 'School For',
  'academicProfile.grades': 'Grades',
  'academicProfile.ageRange': 'Age Range',
  'academicProfile.enrollment': 'Enrollment',
  'academicProfile.studentTeacherRatio': 'Student-Teacher Ratio',
  'academicProfile.colors': 'Uniform Colors',
  'academicProfile.campusArea': 'Campus Area',
  'academicProfile.playgroundArea': 'Playground Area',
  'descriptions.main': 'Main Description',
  'descriptions.sub': 'Sub Description',
};

function collectFormErrors(
  errors: FieldErrors,
  prefix = '',
): Array<{ path: string; message: string }> {
  const out: Array<{ path: string; message: string }> = [];
  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== 'object') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ('message' in value && value.message) {
      out.push({ path, message: String(value.message) });
    } else {
      out.push(...collectFormErrors(value as FieldErrors, path));
    }
  }
  return out;
}

const fieldLabel = (path: string) =>
  FIELD_LABELS[path] || FIELD_LABELS[path.split('.')[0] ?? ''] || path;

const tabForPath = (path: string): EditorTab =>
  FIELD_TAB[path] ?? FIELD_TAB[path.split('.')[0] ?? ''] ?? 'identity';

const pendingAssetKey = (kind: 'logo' | 'header', fileName: string) =>
  `pending-${kind}/${fileName.replace(/[^a-z0-9._-]+/gi, '_')}`;

const selectClassName = cn(
  'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-[color,box-shadow]',
  'border-border bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white',
  'focus:border-transparent focus:ring-2 focus:ring-primary/20',
  'disabled:cursor-not-allowed disabled:opacity-50',
);

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id?: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} className="text-foreground">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const emptyAcademic = (): NonNullable<SchoolFormValues['academicProfile']> => ({
  grades: '',
  ageRange: '',
  enrollment: '',
  studentTeacherRatio: '',
  colors: '',
  campusArea: '',
  playgroundArea: '',
});

const emptyDescriptions = () => ({ main: '', sub: '' });

const createEmptySchool = (): SchoolFormValues => ({
  name: '',
  shortName: '',
  nameBn: '',
  eiin: '',
  centerCode: '',
  schoolCode: '',
  logo: '',
  headerLogo: '',
  bannerUrls: [],
  district: '',
  upazila: '',
  address: '',
  phone: '',
  email: '',
  establishedIn: currentYear,
  nationalizedYear: '',
  subdomain: '',
  customDomain: '',
  resultsUrl: '',
  teacherLoginUrl: '',
  studentLoginUrl: '',
  mapEmbedUrl: '',
  gaMeasurementId: '',
  subjectGroups: '',
  medium: '' as '' | (typeof SCHOOL_MEDIUMS)[number],
  board: '' as '' | (typeof SCHOOL_BOARDS)[number],
  ownership: '' as '' | (typeof SCHOOL_OWNERSHIPS)[number],
  gender: '' as '' | (typeof SCHOOL_GENDERS)[number],
  descriptions: emptyDescriptions(),
  academicProfile: emptyAcademic(),
});

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

const pickEnum = <T extends string>(value: unknown, allowed: readonly T[]): T | '' => {
  const raw = asString(value).trim();
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : '';
};

const pickGroups = (value: unknown) => formatSubjectGroups(value) ?? '';

const normalizeBannerUrls = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return [];
};

const toFormValues = (school?: SchoolData | null): SchoolFormValues => ({
  name: school?.name ?? '',
  shortName: school?.shortName ?? '',
  nameBn: school?.nameBn ?? '',
  eiin: school?.eiin ?? '',
  centerCode: school?.centerCode ?? '',
  schoolCode: school?.schoolCode ?? '',
  logo: school?.logo ?? '',
  headerLogo: school?.headerLogo ?? '',
  bannerUrls: normalizeBannerUrls(school?.bannerUrls),
  district: school?.district ?? '',
  upazila: school?.upazila ?? '',
  address: school?.address ?? '',
  phone: school?.phone ?? '',
  email: school?.email ?? '',
  establishedIn: school?.establishedIn ?? currentYear,
  nationalizedYear: school?.nationalizedYear ?? '',
  subdomain: school?.subdomain ?? '',
  customDomain: school?.customDomain ?? '',
  resultsUrl: school?.resultsUrl ?? '',
  teacherLoginUrl: school?.teacherLoginUrl ?? '',
  studentLoginUrl: school?.studentLoginUrl ?? '',
  mapEmbedUrl: school?.mapEmbedUrl ?? '',
  gaMeasurementId: school?.gaMeasurementId ?? '',
  subjectGroups: pickGroups(school?.subjectGroups),
  medium: pickEnum(school?.medium, SCHOOL_MEDIUMS),
  board: pickEnum(school?.board, SCHOOL_BOARDS),
  ownership: pickEnum(school?.ownership, SCHOOL_OWNERSHIPS),
  gender: pickEnum(school?.gender, SCHOOL_GENDERS),
  descriptions: {
    main: asString(school?.descriptions?.main),
    sub: asString(school?.descriptions?.sub),
  },
  academicProfile: {
    ...emptyAcademic(),
    grades: asString(school?.academicProfile?.grades),
    ageRange: asString(school?.academicProfile?.ageRange),
    enrollment: asString(school?.academicProfile?.enrollment),
    studentTeacherRatio: asString(school?.academicProfile?.studentTeacherRatio),
    colors: asString(school?.academicProfile?.colors),
    campusArea: asString(school?.academicProfile?.campusArea),
    playgroundArea: asString(school?.academicProfile?.playgroundArea),
  },
});

type PendingAssetFiles = {
  logo: File | null;
  header: File | null;
  banners: File[];
};

function SchoolManagement() {
  const { confirm, dialog } = useConfirmDialog();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSchoolId = parseSchoolId(searchParams.get('school'));
  const editorTab = parseEditorTab(searchParams.get('tab'));
  const selectedSchoolIdRef = useRef(selectedSchoolId);
  selectedSchoolIdRef.current = selectedSchoolId;

  const patchQuery = useCallback(
    (patch: { school?: number | 'new'; tab?: EditorTab }, replace = true) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (patch.school !== undefined) next.set('school', String(patch.school));
          if (patch.tab !== undefined) next.set('tab', patch.tab);
          if (!next.get('school')) next.set('school', 'new');
          if (!next.get('tab')) next.set('tab', 'identity');
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  const setEditorTab = useCallback(
    (tab: EditorTab) => {
      patchQuery({ tab });
    },
    [patchQuery],
  );

  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetUploading, setAssetUploading] = useState(false);
  const [pendingAssets, setPendingAssets] = useState<PendingAssetFiles>({
    logo: null,
    header: null,
    banners: [],
  });
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [bannerPreviewUrls, setBannerPreviewUrls] = useState<string[]>([]);
  const [bannerDragIndex, setBannerDragIndex] = useState<number | null>(null);
  const [bannerDropIndex, setBannerDropIndex] = useState<number | null>(null);
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
  const [fetchingAdmins, setFetchingAdmins] = useState(false);
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [deletingAdminId, setDeletingAdminId] = useState<number | null>(null);
  const [rotatingId, setRotatingId] = useState<number | null>(null);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [schoolQuery, setSchoolQuery] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

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
  const headerLogoValue = watch('headerLogo');
  const bannerUrls = normalizeBannerUrls(watch('bannerUrls'));
  const selectedGroups = pickGroups(watch('subjectGroups')).split(', ').filter(Boolean);
  const hasLogo = Boolean(logoPreviewUrl || logoValue);
  const hasHeaderLogo = Boolean(headerPreviewUrl || headerLogoValue);
  const hasBanners = bannerUrls.length > 0 || bannerPreviewUrls.length > 0;
  const formErrorList = collectFormErrors(errors);
  const tabsWithErrors = new Set(formErrorList.map((e) => tabForPath(e.path)));

  const sortedSchools = useMemo(
    () => [...schools].sort((a, b) => a.name.localeCompare(b.name)),
    [schools],
  );

  const filteredSchools = useMemo(() => {
    const q = schoolQuery.trim().toLowerCase();
    if (!q) return sortedSchools;
    return sortedSchools.filter((school) => {
      const hay = [
        school.name,
        school.shortName,
        school.eiin,
        school.subdomain,
        school.customDomain,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedSchools, schoolQuery]);

  const clearPendingPreviews = useCallback(() => {
    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl);
    bannerPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setLogoPreviewUrl(null);
    setHeaderPreviewUrl(null);
    setBannerPreviewUrls([]);
    setPendingAssets({
      logo: null,
      header: null,
      banners: [],
    });
  }, [logoPreviewUrl, headerPreviewUrl, bannerPreviewUrls]);

  const fetchSchools = useCallback(async () => {
    setFetching(true);
    try {
      const res = await axios.get('/api/schools');
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setSchools(list);

      const schoolId = selectedSchoolIdRef.current;
      if (schoolId !== 'new' && !list.some((school: SchoolData) => school.id === schoolId)) {
        patchQuery({ school: 'new' });
      }
    } catch (error) {
      console.error('Failed to fetch schools', error);
      toast.error('Failed to load schools');
    } finally {
      setFetching(false);
    }
  }, [patchQuery]);

  useEffect(() => {
    if (!searchParams.get('school') || !searchParams.get('tab')) {
      patchQuery({ school: selectedSchoolId, tab: editorTab });
    }
  }, [searchParams, selectedSchoolId, editorTab, patchQuery]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    if (selectedSchoolId === 'new') return;
    const current = schools.find((school) => school.id === selectedSchoolId);
    if (current) reset(toFormValues(current));
  }, [selectedSchoolId, schools, reset]);

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
    clearPendingPreviews();
    reset(toFormValues(school));
    patchQuery({ school: school.id ?? 'new', tab: 'identity' });
  };

  const startNewSchool = () => {
    clearPendingPreviews();
    reset(createEmptySchool());
    setSchoolAdmins([]);
    resetAdminForm({ username: '', password: '' });
    patchQuery({ school: 'new', tab: 'identity' });
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = await validateSchoolImage(file, 'logo');
    if (error) {
      setError('logo', { type: 'manual', message: error });
      toast.error(error);
      event.target.value = '';
      return;
    }

    if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
    setLogoPreviewUrl(URL.createObjectURL(file));
    setPendingAssets((prev) => ({ ...prev, logo: file }));
    setValue('logo', pendingAssetKey('logo', file.name), { shouldValidate: true });
    clearErrors('logo');
    event.target.value = '';
  };

  const handleHeaderPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const error = await validateSchoolImage(file, 'header');
    if (error) {
      setError('headerLogo', { type: 'manual', message: error });
      toast.error(error);
      event.target.value = '';
      return;
    }

    if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl);
    setHeaderPreviewUrl(URL.createObjectURL(file));
    setPendingAssets((prev) => ({ ...prev, header: file }));
    setValue('headerLogo', pendingAssetKey('header', file.name), { shouldValidate: true });
    clearErrors('headerLogo');
    event.target.value = '';
  };

  const onInvalid = (formErrors: FieldErrors<SchoolFormValues>) => {
    const list = collectFormErrors(formErrors);
    const first = list[0];
    if (first) setEditorTab(tabForPath(first.path));
    toast.error(
      first ? `${fieldLabel(first.path)}: ${first.message}` : 'Please fix the highlighted fields',
    );
  };

  const applyServerFieldErrors = (
    issues: Array<{ path?: Array<string | number>; message?: string }>,
  ) => {
    let firstPath = '';
    for (const issue of issues) {
      const rawPath = Array.isArray(issue.path) ? issue.path.join('.') : '';
      const message = issue.message || 'Invalid value';
      if (!rawPath) continue;
      setError(rawPath as any, { type: 'server', message });
      if (!firstPath) firstPath = rawPath;
    }
    if (firstPath) setEditorTab(tabForPath(firstPath));
    return Boolean(firstPath);
  };

  const handleBannerPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const remaining = 12 - bannerUrls.length - pendingAssets.banners.length;
    if (remaining <= 0) {
      toast.error('Maximum 12 banners allowed');
      event.target.value = '';
      return;
    }

    const candidates = files.slice(0, remaining);
    const accepted: File[] = [];
    for (const file of candidates) {
      const error = await validateSchoolImage(file, 'banner');
      if (error) {
        toast.error(error);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) {
      event.target.value = '';
      return;
    }

    const previews = accepted.map((file) => URL.createObjectURL(file));
    setBannerPreviewUrls((prev) => [...prev, ...previews]);
    setPendingAssets((prev) => ({ ...prev, banners: [...prev.banners, ...accepted] }));
    event.target.value = '';
  };

  const removeExistingBanner = (index: number) => {
    const next = bannerUrls.filter((_, i) => i !== index);
    setValue('bannerUrls', next, { shouldValidate: true });
  };

  const removePendingBanner = (index: number) => {
    setBannerPreviewUrls((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
    setPendingAssets((prev) => ({
      ...prev,
      banners: prev.banners.filter((_, i) => i !== index),
    }));
  };

  const moveBannerTo = (from: number, to: number) => {
    if (from === to) return;
    const saved = [...bannerUrls];
    const previews = [...bannerPreviewUrls];
    const files = [...pendingAssets.banners];
    if (
      from < 0 ||
      to < 0 ||
      from >= saved.length + files.length ||
      to >= saved.length + files.length
    ) {
      return;
    }

    type BannerSlot =
      { kind: 'saved'; key: string } | { kind: 'pending'; file: File; preview: string };
    const slots: BannerSlot[] = [
      ...saved.map((key) => ({ kind: 'saved' as const, key })),
      ...files.map((file, index) => ({
        kind: 'pending' as const,
        file,
        preview: previews[index],
      })),
    ];
    const [item] = slots.splice(from, 1);
    slots.splice(to, 0, item);

    const nextSaved: string[] = [];
    const nextFiles: File[] = [];
    const nextPreviews: string[] = [];
    for (const slot of slots) {
      if (slot.kind === 'saved') nextSaved.push(slot.key);
      else {
        nextFiles.push(slot.file);
        nextPreviews.push(slot.preview);
      }
    }
    setValue('bannerUrls', nextSaved, { shouldValidate: true });
    setPendingAssets((prev) => ({ ...prev, banners: nextFiles }));
    setBannerPreviewUrls(nextPreviews);
  };

  const moveBanner = (from: number, direction: -1 | 1) => moveBannerTo(from, from + direction);

  const removeBannerAt = (flatIndex: number) => {
    if (flatIndex < bannerUrls.length) removeExistingBanner(flatIndex);
    else removePendingBanner(flatIndex - bannerUrls.length);
  };

  const bannerDisplayItems = useMemo(
    () => [
      ...bannerUrls.map((key) => ({
        kind: 'saved' as const,
        key,
        previewUrl: getFileUrl(key),
      })),
      ...bannerPreviewUrls.map((previewUrl, pendingIndex) => ({
        kind: 'pending' as const,
        pendingIndex,
        previewUrl,
      })),
    ],
    [bannerUrls, bannerPreviewUrls],
  );

  const uploadAssetFile = async (kind: SchoolAssetKind, file: File): Promise<string> => {
    const signRes = await axios.post('/api/schools/logo-upload-url', {
      fileName: file.name,
      contentType: file.type || 'image/png',
      kind,
    });
    const uploadUrl = signRes.data?.data?.uploadUrl as string | undefined;
    const key = signRes.data?.data?.key as string | undefined;
    if (!uploadUrl || !key) throw new Error('Upload URL generation failed');
    await putFileToPresignedUrl(uploadUrl, file, file.type || 'image/png');
    return key;
  };

  const onSubmit = async (values: SchoolFormValues) => {
    clearErrors();
    setSaving(true);

    try {
      if (!values.logo && !pendingAssets.logo) {
        setError('logo', { type: 'manual', message: 'Logo is required' });
        toast.error('Logo is required');
        setSaving(false);
        return;
      }

      setAssetUploading(true);
      const uploadedLogoKey = pendingAssets.logo
        ? await uploadAssetFile('logo', pendingAssets.logo)
        : null;
      const uploadedHeaderKey = pendingAssets.header
        ? await uploadAssetFile('header', pendingAssets.header)
        : null;
      const uploadedBannerKeys = await Promise.all(
        pendingAssets.banners.map((file) => uploadAssetFile('banner', file)),
      );
      setAssetUploading(false);

      const payload = {
        ...values,
        logo: uploadedLogoKey ?? values.logo,
        headerLogo: uploadedHeaderKey ?? values.headerLogo,
        bannerUrls: [...normalizeBannerUrls(values.bannerUrls), ...uploadedBannerKeys],
      };

      if (selectedSchoolId !== 'new') {
        await axios.put(`/api/schools/${selectedSchoolId}`, payload);
        toast.success('School updated successfully');
      } else {
        const res = await axios.post('/api/schools', payload);
        toast.success('School created successfully');

        const createdId = res.data?.data?.id;
        if (typeof createdId === 'number') {
          selectedSchoolIdRef.current = createdId;
          patchQuery({ school: createdId });
        }
      }

      clearPendingPreviews();
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
        const appliedFieldError = applyServerFieldErrors(issues);
        const firstIssue = issues.find((i) => Array.isArray(i.path) && i.path.length > 0);

        toast.error(
          appliedFieldError && firstIssue
            ? `${fieldLabel(firstIssue.path!.join('.'))}: ${firstIssue.message || 'Invalid value'}`
            : responseData?.message || 'Failed to save school',
        );
      } else {
        toast.error('Failed to save school');
      }
    } finally {
      setAssetUploading(false);
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
        description="Create and manage Bangladesh school tenants from the super admin panel."
      >
        <Button type="button" variant="outline" onClick={fetchSchools} disabled={fetching}>
          <RefreshCw className={cn('mr-2 h-4 w-4', fetching && 'animate-spin')} />
          Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <SectionCard
          className={cn('lg:col-span-4', fetching && schools.length > 0 && 'opacity-60')}
          title="Schools"
          description={`${sortedSchools.length} tenant${sortedSchools.length === 1 ? '' : 's'}`}
          icon={<Building2 size={20} />}
          headerAction={
            <Button type="button" size="sm" onClick={startNewSchool}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New
            </Button>
          }
        >
          <div className="relative mb-3">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={schoolQuery}
              onChange={(e) => setSchoolQuery(e.target.value)}
              placeholder="Search schools…"
              className="pl-9"
              aria-label="Search schools"
              disabled={fetching && schools.length === 0}
            />
          </div>

          <div className="max-h-[32rem] space-y-2 overflow-y-auto pr-1">
            {fetching && schools.length === 0 ? (
              <ul className="space-y-2" aria-busy="true" aria-label="Loading schools">
                {Array.from({ length: 6 }).map((_, index) => (
                  <SchoolListItemSkeleton key={index} />
                ))}
              </ul>
            ) : sortedSchools.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No schools yet — create one.
              </p>
            ) : filteredSchools.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">No schools match</p>
            ) : (
              filteredSchools.map((school) => {
                const isSelected = school.id === selectedSchoolId;
                const domainLabel =
                  school.customDomain ||
                  (school.subdomain ? `${school.subdomain}.localhost` : 'No domain');
                return (
                  <button
                    key={school.id}
                    type="button"
                    onClick={() => selectSchool(school)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                      'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    <SchoolLogo logo={school.logo} className="h-10 w-10" />
                    <span className="min-w-0 flex-1">
                      <p className="truncate font-medium">{school.name || 'Untitled School'}</p>
                      <p className="text-muted-foreground truncate text-xs">{domainLabel}</p>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </SectionCard>

        <SectionCard
          className="lg:col-span-8"
          title={
            selectedSchoolId !== 'new' ? `Edit: ${schoolName || 'School'}` : 'Create New School'
          }
          icon={<Building2 size={20} />}
        >
          {fetching && schools.length === 0 ? (
            <EditorPanelSkeleton />
          ) : (
            <>
          {selectedSchoolId !== 'new' && (
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleExportStudents(selectedSchoolId, schoolName)}
                disabled={exportingId === selectedSchoolId}
              >
                {exportingId === selectedSchoolId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download All Students
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleRotatePassword(selectedSchoolId, schoolName)}
                disabled={rotatingId === selectedSchoolId}
              >
                {rotatingId === selectedSchoolId ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Rotate passwords
              </Button>
            </div>
          )}

          <div
            role="tablist"
            aria-label="School editor sections"
            className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b"
          >
            {EDITOR_TABS.map((tab) => {
              const selected = editorTab === tab.id;
              const hasError = tabsWithErrors.has(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => setEditorTab(tab.id)}
                  className={cn(
                    'shrink-0 px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:ring-ring rounded-t-md focus-visible:ring-2 focus-visible:outline-none',
                    selected
                      ? 'border-primary text-foreground border-b-2'
                      : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent',
                    hasError && !selected && 'text-red-600',
                    hasError && selected && 'border-red-600',
                  )}
                >
                  {tab.label}
                  {hasError ? <span className="ml-1 text-red-600">•</span> : null}
                </button>
              );
            })}
          </div>

          {formErrorList.length > 0 ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              <p className="font-medium">Fix these before saving:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {formErrorList.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setEditorTab(tabForPath(item.path))}
                    >
                      {fieldLabel(item.path)}
                    </button>
                    : {item.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {editorTab === 'admins' ? (
            selectedSchoolId === 'new' ? (
              <p
                role="tabpanel"
                id="panel-admins"
                aria-labelledby="tab-admins"
                className="text-muted-foreground py-8 text-center text-sm"
              >
                Save the school first, then add admins.
              </p>
            ) : (
              <div
                role="tabpanel"
                id="panel-admins"
                aria-labelledby="tab-admins"
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 text-sm font-semibold">
                    <UserCog className="text-primary h-4 w-4" />
                    School Admins ({schoolAdmins.length})
                  </h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchSchoolAdmins(selectedSchoolId)}
                    disabled={fetchingAdmins}
                  >
                    <RefreshCw
                      className={cn('mr-1 h-3.5 w-3.5', fetchingAdmins && 'animate-spin')}
                    />
                    Refresh
                  </Button>
                </div>

                {fetchingAdmins ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading admins…
                  </div>
                ) : schoolAdmins.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No admins for this school yet.</p>
                ) : (
                  <ul className="divide-border divide-y rounded-lg border">
                    {schoolAdmins.map((admin) => (
                      <li
                        key={admin.id}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <div>
                          <p className="font-medium">{admin.username}</p>
                          <p className="text-muted-foreground text-xs capitalize">{admin.role}</p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteAdmin(admin)}
                          disabled={deletingAdminId === admin.id}
                          className="text-red-600 hover:text-red-700"
                        >
                          {deletingAdminId === admin.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  onSubmit={handleAdminSubmit(onAddAdmin)}
                  className="grid grid-cols-1 gap-3 border-t pt-4 md:grid-cols-3"
                  noValidate
                >
                  <Field id="admin-username" label="Username" error={adminErrors.username?.message}>
                    <Input
                      id="admin-username"
                      {...registerAdmin('username')}
                      placeholder="e.g. admin@school…"
                      autoComplete="username"
                    />
                  </Field>
                  <Field id="admin-password" label="Password" error={adminErrors.password?.message}>
                    <Input
                      id="admin-password"
                      type="password"
                      {...registerAdmin('password')}
                      placeholder="Min 6 characters…"
                      autoComplete="new-password"
                    />
                  </Field>
                  <div className="flex items-end">
                    <Button
                      type="submit"
                      disabled={addingAdmin || fetchingAdmins}
                      className="w-full"
                    >
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
            )
          ) : (
            <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="flex flex-col" noValidate>
              <div
                role="tabpanel"
                id={`panel-${editorTab}`}
                aria-labelledby={`tab-${editorTab}`}
                className="min-h-[20rem] space-y-4 pb-4"
              >
                {editorTab === 'identity' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field
                      id="name"
                      label="School Name (English)"
                      error={errors.name?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        id="name"
                        {...register('name')}
                        placeholder="e.g. Dhaka Residential Model College…"
                        autoComplete="organization"
                      />
                    </Field>
                    <Field
                      id="nameBn"
                      label="School Name (Bengali / বাংলা নাম)"
                      error={errors.nameBn?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        id="nameBn"
                        {...register('nameBn')}
                        placeholder="e.g. ঢাকা রেসিডেনসিয়াল মডেল কলেজ…"
                      />
                    </Field>
                    <Field id="shortName" label="Short Name" error={errors.shortName?.message}>
                      <Input id="shortName" {...register('shortName')} placeholder="e.g. DRMC…" />
                    </Field>
                    <Field id="eiin" label="EIIN" error={errors.eiin?.message}>
                      <Input
                        id="eiin"
                        {...register('eiin')}
                        inputMode="numeric"
                        maxLength={6}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="e.g. 123456…"
                      />
                    </Field>
                    <Field id="centerCode" label="Center Code" error={errors.centerCode?.message}>
                      <Input
                        id="centerCode"
                        {...register('centerCode')}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="e.g. 102…"
                      />
                    </Field>
                    <Field id="schoolCode" label="School Code" error={errors.schoolCode?.message}>
                      <Input
                        id="schoolCode"
                        {...register('schoolCode')}
                        spellCheck={false}
                        autoComplete="off"
                        placeholder="e.g. 5100…"
                      />
                    </Field>
                    <Field
                      id="establishedIn"
                      label="Established In"
                      error={errors.establishedIn?.message}
                    >
                      <Input
                        id="establishedIn"
                        type="number"
                        {...register('establishedIn')}
                        placeholder="e.g. 1960…"
                      />
                    </Field>
                    <Field
                      id="nationalizedYear"
                      label="Nationalized Year"
                      error={errors.nationalizedYear?.message}
                    >
                      <Input
                        id="nationalizedYear"
                        {...register('nationalizedYear')}
                        placeholder="e.g. 1980…"
                      />
                    </Field>
                  </div>
                )}

                {editorTab === 'contact' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field id="phone" label="Phone" error={errors.phone?.message}>
                      <Input
                        id="phone"
                        {...register('phone')}
                        autoComplete="tel"
                        placeholder="e.g. 01712345678…"
                      />
                    </Field>
                    <Field id="email" label="Email" error={errors.email?.message}>
                      <Input
                        id="email"
                        type="email"
                        {...register('email')}
                        autoComplete="email"
                        placeholder="e.g. school@example.com…"
                      />
                    </Field>
                    <Field id="district" label="District" error={errors.district?.message}>
                      <select
                        id="district"
                        {...register('district', {
                          onChange: () => {
                            setValue('upazila', '', { shouldValidate: true });
                          },
                        })}
                        className={selectClassName}
                      >
                        <option value="">Select district…</option>
                        {districts.map((d: District) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field id="upazila" label="Upazila" error={errors.upazila?.message}>
                      <select
                        id="upazila"
                        {...register('upazila')}
                        className={selectClassName}
                        disabled={!district}
                      >
                        <option value="">Select upazila…</option>
                        {district &&
                          getUpazilasByDistrict(district).map((u: Upazila) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field
                      id="address"
                      label="Full Postal Address"
                      error={errors.address?.message}
                      className="md:col-span-2"
                    >
                      <Input
                        id="address"
                        {...register('address')}
                        placeholder="e.g. Mirpur Road, Mohammadpur, Dhaka-1207…"
                      />
                    </Field>
                    <Field
                      id="mapEmbedUrl"
                      label="Google Maps Embed URL"
                      error={errors.mapEmbedUrl?.message}
                    >
                      <Input
                        id="mapEmbedUrl"
                        {...register('mapEmbedUrl')}
                        autoComplete="url"
                        placeholder="e.g. https://www.google.com/maps/embed?pb=…"
                      />
                    </Field>
                  </div>
                )}

                {editorTab === 'domains' && (
                  <div className="space-y-4">
                    <p className="text-muted-foreground text-xs">
                      Portal links power the public site menu and sidebar. Results defaults to{' '}
                      <code className="text-foreground">/result</code> when blank. Leave teacher or
                      student login blank to hide that link.
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field id="subdomain" label="Subdomain" error={errors.subdomain?.message}>
                        <Input
                          id="subdomain"
                          {...register('subdomain')}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder="e.g. drmc…"
                        />
                      </Field>
                      <Field
                        id="customDomain"
                        label="Custom Domain"
                        error={errors.customDomain?.message}
                      >
                        <Input
                          id="customDomain"
                          {...register('customDomain')}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder="e.g. drmc.edu.bd…"
                        />
                      </Field>
                      <Field
                        id="resultsUrl"
                        label="Results Portal Link"
                        error={errors.resultsUrl?.message}
                      >
                        <Input
                          id="resultsUrl"
                          {...register('resultsUrl')}
                          autoComplete="url"
                          placeholder="Blank = /result, or full URL…"
                        />
                      </Field>
                      <Field
                        id="teacherLoginUrl"
                        label="Teacher Login URL"
                        error={errors.teacherLoginUrl?.message}
                      >
                        <Input
                          id="teacherLoginUrl"
                          {...register('teacherLoginUrl')}
                          autoComplete="url"
                          placeholder="e.g. https://drmc.edu.bd/teacher-login…"
                        />
                      </Field>
                      <Field
                        id="studentLoginUrl"
                        label="Student Login URL"
                        error={errors.studentLoginUrl?.message}
                      >
                        <Input
                          id="studentLoginUrl"
                          {...register('studentLoginUrl')}
                          autoComplete="url"
                          placeholder="e.g. https://drmc.edu.bd/student-login…"
                        />
                      </Field>
                      <Field
                        id="gaMeasurementId"
                        label="Google Analytics Measurement ID (GA4)"
                        error={errors.gaMeasurementId?.message}
                      >
                        <Input
                          id="gaMeasurementId"
                          {...register('gaMeasurementId')}
                          spellCheck={false}
                          autoComplete="off"
                          placeholder="e.g. G-XXXXXXXXXX…"
                        />
                      </Field>
                    </div>
                  </div>
                )}

                {editorTab === 'branding' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Field
                        id="logo-upload"
                        label="Main School Logo (square)"
                        error={errors.logo?.message}
                        hint={`${IMAGE_RULES.logo.minWidth}–${IMAGE_RULES.logo.maxWidth}px square · max ${formatMb(IMAGE_RULES.logo.maxBytes)}`}
                      >
                        <input
                          ref={logoInputRef}
                          id="logo-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={assetUploading}
                          onChange={handleLogoUpload}
                        />
                        {hasLogo ? (
                          <div className="border-border bg-background flex items-center gap-3 rounded-lg border p-3">
                            <SchoolLogo
                              logo={logoPreviewUrl ? undefined : String(logoValue)}
                              src={logoPreviewUrl}
                              className="h-16 w-16"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">Logo selected</p>
                              <p className="text-muted-foreground text-xs">
                                Square image for favicon &amp; PDFs
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={assetUploading}
                              onClick={() => logoInputRef.current?.click()}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={assetUploading}
                            onClick={() => logoInputRef.current?.click()}
                            className="border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                          >
                            <ImageIcon className="h-8 w-8 opacity-60" aria-hidden />
                            <span className="text-foreground text-sm font-medium">
                              Upload square logo
                            </span>
                          </button>
                        )}
                      </Field>

                      <Field
                        id="header-upload"
                        label="Header Logo"
                        error={errors.headerLogo?.message}
                        hint={`≥${IMAGE_RULES.header.minWidth}×${IMAGE_RULES.header.minHeight}px · ≥${IMAGE_RULES.header.minAspect}:1 · max ${formatMb(IMAGE_RULES.header.maxBytes)}`}
                      >
                        <input
                          ref={headerInputRef}
                          id="header-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={assetUploading}
                          onChange={handleHeaderPick}
                        />
                        {hasHeaderLogo ? (
                          <div className="border-border bg-background flex items-center gap-3 rounded-lg border p-3">
                            <img
                              src={headerPreviewUrl || getFileUrl(String(headerLogoValue))}
                              alt="Header preview"
                              className="h-12 max-h-16 max-w-40 shrink-0 rounded border object-contain"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">Header logo selected</p>
                              <p className="text-muted-foreground text-xs">
                                Wide image for the public header
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={assetUploading}
                              onClick={() => headerInputRef.current?.click()}
                            >
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={assetUploading}
                            onClick={() => headerInputRef.current?.click()}
                            className="border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                          >
                            <ImageIcon className="h-8 w-8 opacity-60" aria-hidden />
                            <span className="text-foreground text-sm font-medium">
                              Upload header logo
                            </span>
                          </button>
                        )}
                      </Field>
                    </div>

                    <div className="border-border bg-muted/15 space-y-4 rounded-xl border p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-foreground text-sm font-semibold">
                              Header carousel slides
                            </h4>
                            <span className="bg-background text-muted-foreground rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums">
                              {bannerDisplayItems.length}/12
                            </span>
                          </div>
                          <p className="text-muted-foreground max-w-xl text-xs leading-relaxed">
                            Landscape photos rotate behind the header logo on the public site. Order
                            here is the carousel order — drag a slide or use the arrows, then save.
                          </p>
                        </div>
                        {bannerDisplayItems.length < 12 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={assetUploading}
                            onClick={() => bannerInputRef.current?.click()}
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Add images
                          </Button>
                        ) : null}
                      </div>

                      <input
                        ref={bannerInputRef}
                        id="banner-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={assetUploading}
                        onChange={handleBannerPick}
                      />

                      {hasBanners ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {bannerDisplayItems.map((item, index) => (
                            <article
                              key={
                                item.kind === 'saved'
                                  ? `saved-${item.key}-${index}`
                                  : `pending-${item.pendingIndex}-${index}`
                              }
                              draggable={!assetUploading}
                              onDragStart={(event) => {
                                if (assetUploading) {
                                  event.preventDefault();
                                  return;
                                }
                                setBannerDragIndex(index);
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData('text/plain', String(index));
                              }}
                              onDragEnd={() => {
                                setBannerDragIndex(null);
                                setBannerDropIndex(null);
                              }}
                              onDragOver={(event) => {
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                if (bannerDragIndex != null && bannerDragIndex !== index) {
                                  setBannerDropIndex(index);
                                }
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                const from = Number(event.dataTransfer.getData('text/plain'));
                                if (Number.isFinite(from)) moveBannerTo(from, index);
                                setBannerDragIndex(null);
                                setBannerDropIndex(null);
                              }}
                              className={cn(
                                'bg-background overflow-hidden rounded-lg border shadow-sm transition-all',
                                !assetUploading && 'cursor-grab active:cursor-grabbing',
                                assetUploading && 'opacity-60',
                                bannerDragIndex === index && 'scale-[0.98] opacity-50',
                                bannerDropIndex === index &&
                                  'border-primary ring-primary/30 ring-2',
                              )}
                            >
                              <div className="border-border flex items-center justify-between gap-2 border-b px-2.5 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <GripVertical
                                    className="text-muted-foreground h-4 w-4 shrink-0"
                                    aria-hidden
                                  />
                                  <span className="text-xs font-semibold tabular-nums">
                                    Slide {index + 1}
                                  </span>
                                  {index === 0 ? (
                                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                                      First
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-center gap-1">
                                  {item.kind === 'pending' ? (
                                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                                      New
                                    </span>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={assetUploading}
                                    onClick={() => removeBannerAt(index)}
                                    aria-label={`Remove slide ${index + 1}`}
                                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded p-1 transition-colors disabled:opacity-40"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </div>
                              </div>

                              <div className="bg-muted/40 relative aspect-[16/10]">
                                <img
                                  src={item.previewUrl}
                                  alt={`Carousel slide ${index + 1}`}
                                  draggable={false}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                                <span className="text-muted-foreground text-[11px]">
                                  {index === 0 ? 'Shows first on site' : `After slide ${index}`}
                                </span>
                                <div className="flex gap-0.5">
                                  <button
                                    type="button"
                                    disabled={index === 0 || assetUploading}
                                    onClick={() => moveBanner(index, -1)}
                                    aria-label={`Move slide ${index + 1} earlier`}
                                    className="border-border hover:bg-muted rounded border p-1 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      index === bannerDisplayItems.length - 1 || assetUploading
                                    }
                                    onClick={() => moveBanner(index, 1)}
                                    aria-label={`Move slide ${index + 1} later`}
                                    className="border-border hover:bg-muted rounded border p-1 disabled:cursor-not-allowed disabled:opacity-40"
                                  >
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                                  </button>
                                </div>
                              </div>
                            </article>
                          ))}

                          {bannerDisplayItems.length < 12 ? (
                            <button
                              type="button"
                              disabled={assetUploading}
                              onClick={() => bannerInputRef.current?.click()}
                              aria-label="Add carousel slide"
                              className="border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/40 focus-visible:ring-ring flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                            >
                              <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                                <Plus className="h-5 w-5" aria-hidden />
                              </div>
                              <span className="text-foreground text-sm font-medium">Add slide</span>
                              <span className="text-xs">
                                {12 - bannerDisplayItems.length} slot
                                {12 - bannerDisplayItems.length === 1 ? '' : 's'} left
                              </span>
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={assetUploading}
                          onClick={() => bannerInputRef.current?.click()}
                          className="border-border bg-background text-muted-foreground hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                        >
                          <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
                            <ImageIcon className="h-6 w-6 opacity-70" aria-hidden />
                          </div>
                          <div className="space-y-1">
                            <p className="text-foreground text-sm font-medium">
                              Add your first carousel slide
                            </p>
                            <p className="text-xs leading-relaxed">
                              Upload up to 12 landscape campus or school photos for the public
                              header.
                            </p>
                          </div>
                        </button>
                      )}

                      <p className="text-muted-foreground text-[11px] leading-relaxed">
                        Recommended: at least {IMAGE_RULES.banner.minWidth}×
                        {IMAGE_RULES.banner.minHeight}px landscape, max{' '}
                        {formatMb(IMAGE_RULES.banner.maxBytes)} per image.
                      </p>
                      {errors.bannerUrls?.message ? (
                        <p className="text-destructive text-xs" role="alert">
                          {errors.bannerUrls.message}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}

                {editorTab === 'academic' && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {(
                      [
                        ['grades', 'Grades', 'e.g. Class 3–12…'],
                        ['ageRange', 'Age Range', 'e.g. 8–18 years…'],
                        ['enrollment', 'Enrollment', 'e.g. 3,500 students…'],
                        ['studentTeacherRatio', 'Student-Teacher Ratio', 'e.g. 30:1…'],
                        ['colors', 'Uniform Colors', 'e.g. White & Navy Blue…'],
                        ['campusArea', 'Campus / Land Area', 'e.g. 12 acres…'],
                        ['playgroundArea', 'Playground Area', 'e.g. 2 acres…'],
                      ] as const
                    ).map(([key, label, placeholder]) => (
                      <Field
                        key={key}
                        id={`academic-${key}`}
                        label={label}
                        error={errors.academicProfile?.[key]?.message}
                      >
                        <Input
                          id={`academic-${key}`}
                          {...register(`academicProfile.${key}`)}
                          placeholder={placeholder}
                        />
                      </Field>
                    ))}

                    <Field id="academic-medium" label="Medium" error={errors.medium?.message}>
                      <select
                        id="academic-medium"
                        {...register('medium')}
                        className={selectClassName}
                      >
                        <option value="">Select medium…</option>
                        {SCHOOL_MEDIUMS.map((medium) => (
                          <option key={medium} value={medium}>
                            {medium}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field id="academic-board" label="Board" error={errors.board?.message}>
                      <select
                        id="academic-board"
                        {...register('board')}
                        className={selectClassName}
                      >
                        <option value="">Select board…</option>
                        {SCHOOL_BOARDS.map((board) => (
                          <option key={board} value={board}>
                            {board}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field
                      id="academic-ownership"
                      label="Ownership"
                      error={errors.ownership?.message}
                    >
                      <select
                        id="academic-ownership"
                        {...register('ownership')}
                        className={selectClassName}
                      >
                        <option value="">Select ownership…</option>
                        {SCHOOL_OWNERSHIPS.map((ownership) => (
                          <option key={ownership} value={ownership}>
                            {ownership}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Field id="academic-gender" label="School For" error={errors.gender?.message}>
                      <select
                        id="academic-gender"
                        {...register('gender')}
                        className={selectClassName}
                      >
                        <option value="">Select…</option>
                        {SCHOOL_GENDERS.map((gender) => (
                          <option key={gender} value={gender}>
                            {gender}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <div className="md:col-span-2">
                      <Label className="text-foreground mb-2 block">Groups Available</Label>
                      <div className="flex flex-wrap gap-4">
                        {VALID_GROUPS.map((group) => {
                          const checked = selectedGroups.includes(group);
                          return (
                            <label key={group} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = checked
                                    ? selectedGroups.filter((g) => g !== group)
                                    : [...selectedGroups, group];
                                  setValue(
                                    'subjectGroups',
                                    formatSubjectGroups(next.join(', ')) ?? '',
                                    { shouldValidate: true },
                                  );
                                }}
                              />
                              {group}
                            </label>
                          );
                        })}
                      </div>
                      {errors.subjectGroups?.message ? (
                        <p className="mt-1 text-xs text-red-600" role="alert">
                          {errors.subjectGroups.message}
                        </p>
                      ) : null}
                      <input type="hidden" {...register('subjectGroups')} />
                    </div>
                  </div>
                )}

                {editorTab === 'about' && (
                  <div className="space-y-4">
                    <Field id="descriptions-main" label="Main Description">
                      <Textarea
                        id="descriptions-main"
                        {...register('descriptions.main')}
                        rows={4}
                        placeholder="Brief overview of history, mission, and academic excellence…"
                      />
                    </Field>
                    <Field id="descriptions-sub" label="Sub Description">
                      <Textarea
                        id="descriptions-sub"
                        {...register('descriptions.sub')}
                        rows={3}
                        placeholder="Short highlight shown under cards or side panels…"
                      />
                    </Field>
                  </div>
                )}
              </div>

              <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-0 -mx-6 mt-2 flex items-center justify-end gap-3 border-t px-6 py-4 backdrop-blur">
                <Button type="submit" disabled={saving || assetUploading}>
                  {saving || assetUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  {assetUploading
                    ? 'Uploading…'
                    : saving
                      ? 'Saving…'
                      : selectedSchoolId !== 'new'
                        ? 'Update School'
                        : 'Create School'}
                </Button>
              </div>
            </form>
          )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export default SchoolManagement;
