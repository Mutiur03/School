/**
 * Create / edit one school tenant, ported from dashboard/src/pages/SuperAdmin/SchoolManagement.tsx:
 * Identity, Contact, Domains, Branding, Academic, About (plus Admins, Billing, SMS once the
 * school exists), "Tools & danger zone" (Download All Students, Rotate passwords), the initial
 * admin + free-trial block when creating, "Fix these before saving" and server field errors
 * mapped back onto their tab. Same endpoints and validation as the web (updateSchoolSchema /
 * createSchoolSchema, re-validated by the server).
 *
 * Create, update (with domain-change wording), rotate passwords: confirmed and single-flight
 * through the shared confirm gate. Images are uploaded only after the confirm.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import {
  PROMOTION_VERSIONS,
  SCHOOL_BOARDS,
  SCHOOL_GENDERS,
  SCHOOL_MEDIUMS,
  SCHOOL_OWNERSHIPS,
  VALID_GROUPS,
  districts,
  formatSubjectGroups,
  getUpazilasByDistrict,
} from '@school/shared-schemas';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DateInput } from '@/components/ui/DateInput';
import { Field, FieldRow } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Image as ImageIcon,
  KeyRound,
  Plus,
  Save,
  Trash2,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { appConfig } from '@/config/env';
import { mutationErrorMessage } from '@/features/admin/errors';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import { isApiError, type PickedFile, type PlatformSchool } from '@/lib/api';
import type { AcademicKey } from '@/lib/api/platform';
import { pickFiles } from '@/lib/files/pick-file';
import { saveFile, XLSX_MIME } from '@/lib/files/save-file';
import { cn } from '@/lib/utils';
import { usePlatformApi } from '@/session/ApiProvider';
import { resolveFileUrl } from '@/tenant/branding';
import { AdminsPanel, PasswordInput } from './AdminsPanel';
import { BillingEditor } from './BillingEditor';
import { checkImage, previewUri, releasePreview } from './image-file';
import {
  CREATE_TABS,
  EDITOR_TABS,
  IMAGE_RULES,
  MAX_BANNERS,
  PROMOTION_VERSION_LABELS,
  createEmptySchool,
  defaultTrialEnd,
  domainChanges,
  fieldLabel,
  formatMb,
  issuesToErrors,
  moveItem,
  orderedBannerKeys,
  pendingAssetKey,
  pendingBannerFiles,
  safeFileName,
  saveSchoolConfirm,
  savedBannerKeys,
  schoolPayload,
  tabForPath,
  toFormValues,
  trialEndsAtIso,
  validateAdminForm,
  validateSchoolForm,
  type BannerSlot,
  type EditorTab,
  type FieldErrors,
  type SchoolFormValues,
  type SchoolTextField,
} from './model';
import { platformSchemas } from './schemas';
import { SmsPanel } from './SmsPanel';
import { SchoolLogo, usePlatformKey, type useConfirmGate } from './ui';

type Picked = { file: PickedFile; uri: string };

const ACADEMIC_FIELDS: readonly [AcademicKey, string, string][] = [
  ['grades', 'Grades', 'e.g. Class 3–12…'],
  ['ageRange', 'Age Range', 'e.g. 8–18 years…'],
  ['enrollment', 'Enrollment', 'e.g. 3,500 students…'],
  ['studentTeacherRatio', 'Student-Teacher Ratio', 'e.g. 30:1…'],
  ['colors', 'Uniform Colors', 'e.g. White & Navy Blue…'],
  ['campusArea', 'Campus / Land Area', 'e.g. 12 acres…'],
  ['playgroundArea', 'Playground Area', 'e.g. 2 acres…'],
];

const enumOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const DISTRICT_OPTIONS = districts.map((d) => ({ value: d.id, label: d.name }));

export function EditorTabs({
  tabs,
  value,
  onChange,
  withErrors,
}: {
  tabs: readonly { id: EditorTab; label: string }[];
  value: EditorTab;
  onChange: (t: EditorTab) => void;
  withErrors: ReadonlySet<EditorTab>;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="border-border -mx-1 mb-4 flex-row flex-wrap border-b"
      testID="school-editor-tabs"
    >
      {tabs.map((t) => {
        const selected = t.id === value;
        const err = withErrors.has(t.id);
        return (
          <Pressable
            key={t.id}
            accessibilityRole="tab"
            aria-selected={selected}
            testID={`school-tab-${t.id}`}
            onPress={() => onChange(t.id)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2',
              selected ? (err ? 'border-red-600' : 'border-primary') : 'border-transparent',
            )}
          >
            <Text
              size="sm"
              weight="medium"
              color={selected ? 'foreground' : 'mutedForeground'}
              className={err && !selected ? 'text-red-600' : undefined}
            >
              {t.label}
              {err ? <Text className="text-red-600"> •</Text> : null}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function TextInputField({
  label,
  value,
  onChange,
  error,
  placeholder,
  hint,
  required,
  keyboardType,
  noCaps,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'number-pad' | 'url';
  noCaps?: boolean;
  multiline?: boolean;
}) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <Input
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={noCaps ? 'none' : undefined}
        autoCorrect={noCaps ? false : undefined}
        accessibilityLabel={label}
        multiline={multiline}
      />
    </Field>
  );
}

export function SchoolEditor({
  school,
  tab,
  onTab,
  confirm,
  onCreated,
  onDirtyChange,
}: {
  /** null = creating a new school. */
  school: PlatformSchool | null;
  tab: EditorTab;
  onTab: (t: EditorTab) => void;
  confirm: ReturnType<typeof useConfirmGate>;
  onCreated: (id: number | null) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const platform = usePlatformApi();
  const key = usePlatformKey();
  const queryClient = useQueryClient();
  const toast = useToast();
  const creating = school === null;
  const baseline = useMemo(
    () => (school ? toFormValues(school, platformSchemas) : createEmptySchool()),
    [school],
  );
  const [values, setValues] = useState<SchoolFormValues>(baseline);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [logoFile, setLogoFile] = useState<Picked | null>(null);
  const [headerFile, setHeaderFile] = useState<Picked | null>(null);
  const [banners, setBanners] = useState<BannerSlot<Picked>[]>(() =>
    baseline.bannerUrls.map((k) => ({ kind: 'saved', key: k })),
  );
  const [admin, setAdmin] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const initialTrial = useRef(defaultTrialEnd());
  const [trialEndsAt, setTrialEndsAt] = useState(initialTrial.current);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'saving'>('idle');
  const [toolsOpen, setToolsOpen] = useState(false);
  const exportFlight = useSingleFlight();
  const [exporting, setExporting] = useState(false);
  const busy = confirm.gate.busy;

  // Reset only when the saved content changes (after save + refetch). A background refetch hands
  // back an equal school as a new object; keying on content keeps in-progress edits.
  const baselineSig = JSON.stringify(baseline);
  const lastSig = useRef(baselineSig);
  useEffect(() => {
    if (lastSig.current === baselineSig) return;
    lastSig.current = baselineSig;
    const next = JSON.parse(baselineSig) as SchoolFormValues;
    setValues(next);
    setBanners(next.bannerUrls.map((k) => ({ kind: 'saved', key: k })));
    setErrors({});
  }, [baselineSig]);

  // Revoke web object URLs for previews on unmount.
  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach(releasePreview), []);

  const bannerKeys = savedBannerKeys(banners);
  const dirty =
    JSON.stringify({ ...values, bannerUrls: bannerKeys }) !== JSON.stringify(baseline) ||
    !!logoFile ||
    !!headerFile ||
    pendingBannerFiles(banners).length > 0 ||
    (creating && (!!admin.username || !!admin.password || trialEndsAt !== initialTrial.current));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const set = (field: SchoolTextField, v: string) => {
    setValues((prev) => ({ ...prev, [field]: v }));
    if (errors[field]) setErrors(({ [field]: _drop, ...rest }) => rest);
  };
  const setAcademic = (k: AcademicKey, v: string) =>
    setValues((prev) => ({ ...prev, academicProfile: { ...prev.academicProfile, [k]: v } }));
  const setDescription = (k: 'main' | 'sub', v: string) =>
    setValues((prev) => ({ ...prev, descriptions: { ...prev.descriptions, [k]: v } }));

  const tabs = creating ? EDITOR_TABS.filter((t) => CREATE_TABS.has(t.id)) : EDITOR_TABS;
  const errorTabs = new Set(Object.keys(errors).map(tabForPath));
  const errorList = Object.entries(errors);
  const upazilaOptions = useMemo(
    () =>
      values.district
        ? getUpazilasByDistrict(values.district).map((u) => ({ value: u.id, label: u.name }))
        : [],
    [values.district],
  );
  const selectedGroups = values.subjectGroups
    ? values.subjectGroups.split(', ').filter(Boolean)
    : [];

  const track = (uri: string) => {
    previews.current.push(uri);
    return uri;
  };
  const pickImage = async (kind: 'logo' | 'header') => {
    const file = (await pickFiles('image/*'))[0];
    if (!file) return;
    const uri = track(previewUri(file));
    const problem = await checkImage(file, uri, kind);
    const field = kind === 'logo' ? 'logo' : 'headerLogo';
    if (problem) {
      setErrors((e) => ({ ...e, [field]: problem }));
      toast.error(problem);
      return;
    }
    (kind === 'logo' ? setLogoFile : setHeaderFile)({ file, uri });
    set(field, pendingAssetKey(kind, file.name));
  };
  const pickBanners = async () => {
    const remaining = MAX_BANNERS - banners.length;
    if (remaining <= 0) {
      toast.error('Maximum 12 banners allowed');
      return;
    }
    const files = (await pickFiles('image/*', { multiple: true })).slice(0, remaining);
    const accepted: BannerSlot<Picked>[] = [];
    for (const file of files) {
      const uri = track(previewUri(file));
      const problem = await checkImage(file, uri, 'banner');
      if (problem) toast.error(problem);
      else accepted.push({ kind: 'pending', file: { file, uri } });
    }
    if (accepted.length) setBanners((prev) => [...prev, ...accepted]);
  };

  const fail = (errs: FieldErrors) => {
    setErrors(errs);
    const first = Object.entries(errs)[0];
    if (first) {
      onTab(tabForPath(first[0]));
      toast.error(`${fieldLabel(first[0])}: ${first[1]}`);
    }
  };

  const submit = () => {
    const form = { ...values, bannerUrls: bannerKeys };
    const errs: FieldErrors = {};
    if (!form.logo && !logoFile) errs.logo = 'Logo is required';
    const checked = validateSchoolForm(form, platformSchemas);
    if (!checked.ok) Object.assign(errs, checked.errors);
    let initialAdmin: { username: string; password: string } | null = null;
    let trialIso: string | null = null;
    if (creating) {
      const a = validateAdminForm(admin, platformSchemas);
      if (!a.ok) {
        for (const [k, v] of Object.entries(a.errors)) errs[`initialAdmin.${k}`] = v;
      } else initialAdmin = a.value;
      trialIso = trialEndsAtIso(trialEndsAt);
      if (!trialIso || Date.parse(trialIso) <= Date.now())
        errs.trialEndsAt = 'Trial end must be in the future';
    }
    if (Object.keys(errs).length || !checked.ok) {
      fail(errs);
      return;
    }
    setErrors({});
    const parsed = checked.value as Record<string, unknown>;
    const copy = saveSchoolConfirm(
      creating ? 'create' : 'update',
      form.name.trim(),
      domainChanges(creating ? null : baseline, form),
      { adminUsername: initialAdmin?.username, trialEnds: trialEndsAt },
    );
    const slots = [...banners];
    const logo = logoFile;
    const header = headerFile;
    confirm.ask(copy, async () => {
      try {
        setPhase('uploading');
        const uploadedLogo = logo ? await platform.uploadAsset('logo', logo.file) : null;
        const uploadedHeader = header ? await platform.uploadAsset('header', header.file) : null;
        const uploadedBanners: string[] = [];
        for (const p of pendingBannerFiles(slots))
          uploadedBanners.push(await platform.uploadAsset('banner', p.file));
        setPhase('saving');
        const payload = schoolPayload(parsed, {
          logo: uploadedLogo,
          header: uploadedHeader,
          bannerUrls: orderedBannerKeys(slots, uploadedBanners),
        });
        if (creating) {
          const { id } = await platform.createSchool({
            ...payload,
            initialAdmin,
            trialEndsAt: trialIso,
          });
          toast.success('School created successfully');
          onCreated(id);
        } else {
          await platform.updateSchool(school.id, payload);
          toast.success('School updated successfully');
        }
        setLogoFile(null);
        setHeaderFile(null);
        await queryClient.invalidateQueries({ queryKey: key('schools') });
      } catch (e) {
        const issues = isApiError(e) ? e.details : [];
        const mapped = issuesToErrors(issues);
        if (Object.keys(mapped).length) fail(mapped);
        else toast.error(mutationErrorMessage(e, 'Failed to save school'));
      } finally {
        setPhase('idle');
      }
    });
  };

  const exportStudents = () => {
    if (!school) return;
    void exportFlight.run(async () => {
      setExporting(true);
      try {
        const bytes = await platform.exportStudents(school.id);
        await saveFile(bytes, `${safeFileName(school.name)}_students.xlsx`, XLSX_MIME);
        toast.success('Students exported');
      } catch (e) {
        toast.error(mutationErrorMessage(e, 'Failed to export students'));
      } finally {
        setExporting(false);
      }
    });
  };
  const rotatePasswords = () => {
    if (!school) return;
    confirm.ask(
      {
        title: 'Rotate student passwords?',
        message: `Rotate passwords for ALL students of "${school.name}"? New credentials will be downloaded as an Excel file. This cannot be undone.`,
        confirmLabel: 'Rotate Passwords',
        tone: 'destructive',
      },
      async () => {
        try {
          const bytes = await platform.rotateStudentPasswords(school.id);
          await saveFile(bytes, `${safeFileName(school.name)}_rotated_passwords.xlsx`, XLSX_MIME);
          toast.success('Student passwords rotated. Excel downloaded.');
        } catch (e) {
          toast.error(mutationErrorMessage(e, 'Failed to rotate passwords'));
        }
      },
    );
  };

  const savingLabel =
    phase === 'uploading'
      ? 'Uploading…'
      : phase === 'saving'
        ? 'Saving…'
        : creating
          ? 'Create School'
          : 'Update School';
  const logoUri = logoFile?.uri ?? resolveFileUrl(values.logo, appConfig.cdnUrl);
  const headerUri = headerFile?.uri ?? resolveFileUrl(values.headerLogo, appConfig.cdnUrl);

  const profileTab = !['admins', 'billing', 'sms'].includes(tab);

  return (
    <View testID="school-editor">
      {school ? (
        <View className="border-border mb-4 rounded-lg border">
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: toolsOpen }}
            onPress={() => setToolsOpen((v) => !v)}
            className="flex-row items-center justify-between px-3 py-2"
            testID="school-tools-toggle"
          >
            <Text size="sm" weight="medium" color="mutedForeground">
              Tools & danger zone
            </Text>
            <Icon icon={ChevronDown} size={16} color="mutedForeground" />
          </Pressable>
          {toolsOpen ? (
            <View className="border-border flex-row flex-wrap gap-2 border-t px-3 py-3">
              <Button
                variant="outline"
                size="sm"
                icon={Download}
                label={exporting ? 'Downloading…' : 'Download All Students'}
                disabled={exporting}
                onPress={exportStudents}
              />
              <Button
                variant="outline"
                size="sm"
                icon={KeyRound}
                label="Rotate passwords"
                disabled={busy}
                onPress={rotatePasswords}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <EditorTabs tabs={tabs} value={tab} onChange={onTab} withErrors={errorTabs} />

      {errorList.length > 0 && profileTab ? (
        <View
          accessibilityRole="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <Text size="sm" weight="medium" className="text-red-800">
            Fix these before saving:
          </Text>
          {errorList.map(([path, msg]) => (
            <Pressable
              key={path}
              onPress={() => onTab(tabForPath(path))}
              accessibilityRole="button"
            >
              <Text size="sm" className="text-red-800">
                •{' '}
                <Text size="sm" className="text-red-800 underline">
                  {fieldLabel(path)}
                </Text>
                : {msg}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === 'admins' && school ? (
        <AdminsPanel schoolId={school.id} schoolName={school.name} confirm={confirm} />
      ) : tab === 'billing' && school ? (
        <BillingEditor schoolId={school.id} schoolName={school.name} confirm={confirm} />
      ) : tab === 'sms' && school ? (
        <SmsPanel schoolId={school.id} schoolName={school.name} confirm={confirm} />
      ) : (
        <View>
          <View className="min-h-80 gap-4 pb-4">
            {tab === 'identity' ? (
              <View className="gap-4">
                {creating ? (
                  <View
                    className="border-border bg-muted/30 gap-4 rounded-xl border p-4"
                    testID="school-initial-admin"
                  >
                    <Text size="sm" weight="medium">
                      Initial admin & free trial
                    </Text>
                    <Text size="xs" color="mutedForeground">
                      Created with the school so the admin can sign in immediately. Trial has no
                      grace — access locks when it ends.
                    </Text>
                    <FieldRow>
                      <TextInputField
                        label="Initial admin username"
                        value={admin.username}
                        onChange={(username) => setAdmin((a) => ({ ...a, username }))}
                        error={errors['initialAdmin.username']}
                        placeholder="e.g. school.admin"
                        noCaps
                      />
                      <Field label="Initial admin password" error={errors['initialAdmin.password']}>
                        <PasswordInput
                          label="Initial admin password"
                          value={admin.password}
                          onChangeText={(password) => setAdmin((a) => ({ ...a, password }))}
                          show={showPassword}
                          onToggle={() => setShowPassword((v) => !v)}
                          placeholder="At least 6 characters"
                        />
                      </Field>
                      <Field label="Free trial ends" error={errors.trialEndsAt}>
                        <DateInput
                          label="Free trial ends"
                          value={trialEndsAt}
                          onChange={setTrialEndsAt}
                        />
                      </Field>
                    </FieldRow>
                  </View>
                ) : null}
                <TextInputField
                  label="School Name (English)"
                  value={values.name}
                  onChange={(v) => set('name', v)}
                  error={errors.name}
                  placeholder="e.g. Dhaka Residential Model College…"
                  required
                />
                <TextInputField
                  label="School Name (Bengali / বাংলা নাম)"
                  value={values.nameBn}
                  onChange={(v) => set('nameBn', v)}
                  error={errors.nameBn}
                />
                <FieldRow>
                  <TextInputField
                    label="Short Name"
                    value={values.shortName}
                    onChange={(v) => set('shortName', v)}
                    error={errors.shortName}
                    placeholder="e.g. DRMC…"
                  />
                  <TextInputField
                    label="EIIN"
                    value={values.eiin}
                    onChange={(v) => set('eiin', v.replace(/[^\d]/g, ''))}
                    error={errors.eiin}
                    keyboardType="number-pad"
                    placeholder="6 digits"
                  />
                  <TextInputField
                    label="Center Code"
                    value={values.centerCode}
                    onChange={(v) => set('centerCode', v)}
                    error={errors.centerCode}
                  />
                  <TextInputField
                    label="School Code"
                    value={values.schoolCode}
                    onChange={(v) => set('schoolCode', v)}
                    error={errors.schoolCode}
                  />
                  <TextInputField
                    label="Established In"
                    value={values.establishedIn}
                    onChange={(v) => set('establishedIn', v.replace(/[^\d]/g, ''))}
                    error={errors.establishedIn}
                    keyboardType="number-pad"
                  />
                  <TextInputField
                    label="Nationalized Year"
                    value={values.nationalizedYear}
                    onChange={(v) => set('nationalizedYear', v)}
                    error={errors.nationalizedYear}
                  />
                </FieldRow>
              </View>
            ) : null}

            {tab === 'contact' ? (
              <View className="gap-4">
                <FieldRow>
                  <TextInputField
                    label="Phone"
                    value={values.phone}
                    onChange={(v) => set('phone', v)}
                    error={errors.phone}
                    keyboardType="phone-pad"
                    placeholder="01XXXXXXXXX"
                    required
                  />
                  <TextInputField
                    label="Email"
                    value={values.email}
                    onChange={(v) => set('email', v)}
                    error={errors.email}
                    keyboardType="email-address"
                    placeholder="info@school.edu.bd"
                    noCaps
                    required
                  />
                  <Field label="District" error={errors.district} required>
                    <Select
                      label="District"
                      value={values.district || null}
                      placeholder="Select district…"
                      options={DISTRICT_OPTIONS}
                      invalid={!!errors.district}
                      onChange={(d) => {
                        setValues((prev) => ({ ...prev, district: d, upazila: '' }));
                        setErrors(({ district: _d, upazila: _u, ...rest }) => rest);
                      }}
                    />
                  </Field>
                  <Field label="Upazila" error={errors.upazila} required>
                    <Select
                      label="Upazila"
                      value={values.upazila || null}
                      placeholder={values.district ? 'Select upazila…' : 'Select a district first'}
                      options={upazilaOptions}
                      disabled={!values.district}
                      invalid={!!errors.upazila}
                      onChange={(u) => set('upazila', u)}
                    />
                  </Field>
                </FieldRow>
                <TextInputField
                  label="Full Postal Address"
                  value={values.address}
                  onChange={(v) => set('address', v)}
                  error={errors.address}
                  multiline
                />
                <TextInputField
                  label="Google Maps Embed URL"
                  value={values.mapEmbedUrl}
                  onChange={(v) => set('mapEmbedUrl', v)}
                  error={errors.mapEmbedUrl}
                  noCaps
                  keyboardType="url"
                />
              </View>
            ) : null}

            {tab === 'domains' ? (
              <View className="gap-4">
                <Text size="xs" color="mutedForeground">
                  Portal links power the public site menu and sidebar. Results defaults to /result
                  when blank. Leave teacher or student login blank to hide that link. Changing the
                  subdomain or custom domain moves where the school's site and dashboard answer.
                </Text>
                <FieldRow>
                  <TextInputField
                    label="Subdomain"
                    value={values.subdomain}
                    onChange={(v) => set('subdomain', v)}
                    error={errors.subdomain}
                    placeholder="e.g. drmc…"
                    noCaps
                  />
                  <TextInputField
                    label="Custom Domain"
                    value={values.customDomain}
                    onChange={(v) => set('customDomain', v)}
                    error={errors.customDomain}
                    placeholder="e.g. drmc.edu.bd…"
                    noCaps
                    keyboardType="url"
                  />
                  <TextInputField
                    label="Results Portal Link"
                    value={values.resultsUrl}
                    onChange={(v) => set('resultsUrl', v)}
                    error={errors.resultsUrl}
                    placeholder="Blank = /result, or full URL…"
                    noCaps
                    keyboardType="url"
                  />
                  <TextInputField
                    label="Teacher Login URL"
                    value={values.teacherLoginUrl}
                    onChange={(v) => set('teacherLoginUrl', v)}
                    error={errors.teacherLoginUrl}
                    placeholder="e.g. https://drmc.edu.bd/teacher-login…"
                    noCaps
                    keyboardType="url"
                  />
                  <TextInputField
                    label="Student Login URL"
                    value={values.studentLoginUrl}
                    onChange={(v) => set('studentLoginUrl', v)}
                    error={errors.studentLoginUrl}
                    placeholder="e.g. https://drmc.edu.bd/student-login…"
                    noCaps
                    keyboardType="url"
                  />
                  <TextInputField
                    label="Google Analytics Measurement ID (GA4)"
                    value={values.gaMeasurementId}
                    onChange={(v) => set('gaMeasurementId', v)}
                    error={errors.gaMeasurementId}
                    placeholder="e.g. G-XXXXXXXXXX…"
                    noCaps
                  />
                </FieldRow>
              </View>
            ) : null}

            {tab === 'branding' ? (
              <View className="gap-6">
                <FieldRow>
                  <Field
                    label="Main School Logo (square)"
                    error={errors.logo}
                    hint={`${IMAGE_RULES.logo.minWidth}–${IMAGE_RULES.logo.maxWidth}px square · max ${formatMb(IMAGE_RULES.logo.maxBytes)}`}
                  >
                    <AssetSlot
                      uri={logoUri}
                      kind="logo"
                      emptyLabel="Upload square logo"
                      selectedLabel="Logo selected"
                      detail="Square image for favicon & PDFs"
                      disabled={busy}
                      onPick={() => void pickImage('logo')}
                    />
                  </Field>
                  <Field
                    label="Header Logo"
                    error={errors.headerLogo}
                    hint={`≥${IMAGE_RULES.header.minWidth}×${IMAGE_RULES.header.minHeight}px · ≥${IMAGE_RULES.header.minAspect}:1 · max ${formatMb(IMAGE_RULES.header.maxBytes)}`}
                  >
                    <AssetSlot
                      uri={headerUri}
                      kind="header"
                      emptyLabel="Upload header logo"
                      selectedLabel="Header logo selected"
                      detail="Wide image for the public header"
                      disabled={busy}
                      onPick={() => void pickImage('header')}
                    />
                  </Field>
                </FieldRow>
                <View className="border-border bg-muted/15 gap-4 rounded-xl border p-4">
                  <View className="flex-row flex-wrap items-start justify-between gap-3">
                    <View className="shrink gap-1">
                      <Text size="sm" weight="semibold">
                        Header carousel slides{' '}
                        <Text size="xs" color="mutedForeground" tabular>
                          ({banners.length}/{MAX_BANNERS})
                        </Text>
                      </Text>
                      <Text size="xs" color="mutedForeground">
                        Landscape photos rotate behind the header logo on the public site. Order
                        here is the carousel order — use the arrows, then save.
                      </Text>
                    </View>
                    {banners.length < MAX_BANNERS ? (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={Plus}
                        label="Add images"
                        disabled={busy}
                        onPress={() => void pickBanners()}
                      />
                    ) : null}
                  </View>
                  {banners.length ? (
                    <View className="flex-row flex-wrap gap-3">
                      {banners.map((slot, i) => {
                        const uri =
                          slot.kind === 'saved'
                            ? resolveFileUrl(slot.key, appConfig.cdnUrl)
                            : slot.file.uri;
                        return (
                          <View
                            key={
                              slot.kind === 'saved' ? `s-${slot.key}-${i}` : `p-${slot.file.uri}`
                            }
                            className="border-border bg-background w-full overflow-hidden rounded-lg border sm:w-[47%] lg:w-[31%]"
                          >
                            <View className="border-border flex-row items-center justify-between border-b px-2.5 py-1.5">
                              <Text size="xs" weight="semibold" tabular>
                                Slide {i + 1}
                                {i === 0 ? ' · First' : ''}
                                {slot.kind === 'pending' ? ' · New' : ''}
                              </Text>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove slide ${i + 1}`}
                                disabled={busy}
                                onPress={() => setBanners((b) => b.filter((_, j) => j !== i))}
                                className="p-1"
                              >
                                <Icon icon={Trash2} size={14} color="mutedForeground" />
                              </Pressable>
                            </View>
                            <View className="bg-muted/40 aspect-[16/10]">
                              {uri ? (
                                <Image
                                  source={{ uri }}
                                  accessibilityIgnoresInvertColors
                                  resizeMode="cover"
                                  style={{ width: '100%', height: '100%' }}
                                />
                              ) : null}
                            </View>
                            <View className="flex-row items-center justify-between px-2 py-1.5">
                              <Text size="xs" color="mutedForeground">
                                {i === 0 ? 'Shows first on site' : `After slide ${i}`}
                              </Text>
                              <View className="flex-row gap-1">
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  icon={ChevronLeft}
                                  accessibilityLabel={`Move slide ${i + 1} earlier`}
                                  disabled={i === 0 || busy}
                                  onPress={() => setBanners((b) => moveItem(b, i, i - 1))}
                                />
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  icon={ChevronRight}
                                  accessibilityLabel={`Move slide ${i + 1} later`}
                                  disabled={i === banners.length - 1 || busy}
                                  onPress={() => setBanners((b) => moveItem(b, i, i + 1))}
                                />
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void pickBanners()}
                      className="border-border bg-background items-center gap-2 rounded-lg border-2 border-dashed px-6 py-10"
                    >
                      <Icon icon={ImageIcon} size={24} color="mutedForeground" />
                      <Text size="sm" weight="medium">
                        Add your first carousel slide
                      </Text>
                      <Text size="xs" color="mutedForeground" className="text-center">
                        Upload up to 12 landscape campus or school photos for the public header.
                      </Text>
                    </Pressable>
                  )}
                  <Text size="xs" color="mutedForeground">
                    Recommended: at least {IMAGE_RULES.banner.minWidth}×
                    {IMAGE_RULES.banner.minHeight}px landscape, max{' '}
                    {formatMb(IMAGE_RULES.banner.maxBytes)} per image.
                  </Text>
                  {errors.bannerUrls ? (
                    <Text size="xs" color="destructive">
                      {errors.bannerUrls}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {tab === 'academic' ? (
              <View className="gap-4">
                <FieldRow>
                  {ACADEMIC_FIELDS.map(([k, label, placeholder]) => (
                    <TextInputField
                      key={k}
                      label={label}
                      value={values.academicProfile[k]}
                      onChange={(v) => setAcademic(k, v)}
                      error={errors[`academicProfile.${k}`]}
                      placeholder={placeholder}
                    />
                  ))}
                  <Field label="Medium" error={errors.medium}>
                    <Select
                      label="Medium"
                      value={values.medium || null}
                      placeholder="Select medium…"
                      options={enumOptions(SCHOOL_MEDIUMS)}
                      onChange={(v) => set('medium', v)}
                    />
                  </Field>
                  <Field label="Board" error={errors.board}>
                    <Select
                      label="Board"
                      value={values.board || null}
                      placeholder="Select board…"
                      options={enumOptions(SCHOOL_BOARDS)}
                      onChange={(v) => set('board', v)}
                    />
                  </Field>
                  <Field label="Ownership" error={errors.ownership}>
                    <Select
                      label="Ownership"
                      value={values.ownership || null}
                      placeholder="Select ownership…"
                      options={enumOptions(SCHOOL_OWNERSHIPS)}
                      onChange={(v) => set('ownership', v)}
                    />
                  </Field>
                  <Field label="School For" error={errors.gender}>
                    <Select
                      label="School For"
                      value={values.gender || null}
                      placeholder="Select…"
                      options={enumOptions(SCHOOL_GENDERS)}
                      onChange={(v) => set('gender', v)}
                    />
                  </Field>
                  <Field label="Promotion system version" error={errors.promotionVersion}>
                    <Select
                      label="Promotion system version"
                      value={values.promotionVersion}
                      options={PROMOTION_VERSIONS.map((v) => ({
                        value: v,
                        label: PROMOTION_VERSION_LABELS[v],
                      }))}
                      onChange={(v) => set('promotionVersion', v)}
                    />
                  </Field>
                </FieldRow>
                <Field label="Groups Available" error={errors.subjectGroups}>
                  <View className="flex-row flex-wrap gap-4">
                    {VALID_GROUPS.map((g) => {
                      const on = selectedGroups.includes(g);
                      return (
                        <Checkbox
                          key={g}
                          checked={on}
                          label={g}
                          onChange={() => {
                            const next = on
                              ? selectedGroups.filter((x) => x !== g)
                              : [...selectedGroups, g];
                            set('subjectGroups', formatSubjectGroups(next.join(', ')) ?? '');
                          }}
                        />
                      );
                    })}
                  </View>
                </Field>
              </View>
            ) : null}

            {tab === 'about' ? (
              <View className="gap-4">
                <TextInputField
                  label="Main Description"
                  value={values.descriptions.main}
                  onChange={(v) => setDescription('main', v)}
                  error={errors['descriptions.main']}
                  placeholder="Brief overview of history, mission, and academic excellence…"
                  multiline
                />
                <TextInputField
                  label="Sub Description"
                  value={values.descriptions.sub}
                  onChange={(v) => setDescription('sub', v)}
                  error={errors['descriptions.sub']}
                  placeholder="Short highlight shown under cards or side panels…"
                  multiline
                />
              </View>
            ) : null}
          </View>

          <View className="border-border gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <Text size="xs" color="mutedForeground" className="shrink">
              {creating
                ? 'Creates the school, initial admin, and free trial. Billing & SMS come after.'
                : 'Saves school profile only. Billing, SMS, and Admins have their own save buttons.'}
            </Text>
            <Button
              testID="school-save"
              icon={Save}
              label={savingLabel}
              disabled={busy || phase !== 'idle'}
              onPress={submit}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function AssetSlot({
  uri,
  kind,
  emptyLabel,
  selectedLabel,
  detail,
  disabled,
  onPick,
}: {
  uri: string | null;
  kind: 'logo' | 'header';
  emptyLabel: string;
  selectedLabel: string;
  detail: string;
  disabled: boolean;
  onPick: () => void;
}) {
  if (!uri) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPick}
        className="border-border bg-muted/30 items-center gap-2 rounded-lg border border-dashed px-4 py-8"
      >
        <Icon icon={ImageIcon} size={28} color="mutedForeground" />
        <Text size="sm" weight="medium">
          {emptyLabel}
        </Text>
      </Pressable>
    );
  }
  const details = (
    <>
      <View className="min-w-0 flex-1">
        <Text size="sm" weight="medium" numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Text size="xs" color="mutedForeground">
          {detail}
        </Text>
      </View>
      <Button variant="outline" size="sm" label="Replace" disabled={disabled} onPress={onPick} />
    </>
  );
  // The wide header logo gets the full width above its label; the square logo sits beside it.
  return kind === 'logo' ? (
    <View className="border-border bg-background flex-row items-center gap-3 rounded-lg border p-3">
      <SchoolLogo uri={uri} size={64} />
      {details}
    </View>
  ) : (
    <View className="border-border bg-background gap-3 rounded-lg border p-3">
      <View className="bg-muted/30 items-center rounded-md p-2">
        <Image
          source={{ uri }}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={{ width: '100%', height: 56 }}
        />
      </View>
      <View className="flex-row items-center gap-3">{details}</View>
    </View>
  );
}
