/**
 * Teacher account settings, replicating dashboard/src/pages/Teachers/TeacherSettings.tsx:
 *  - Profile: photo (upload, image under 2MB), name / designation / Active · Teacher badges,
 *    read-only Professional Information (email, phone, designation, address) with the "only
 *    administrative staff" note, and the Digital Signature (upload under 1MB, remove).
 *  - Security: current / new / confirm password with show toggles, the strength meter and the
 *    four requirements, submit via POST /api/teachers/change-password.
 *
 * Uploads use the web build's file input; native needs a picker module, so it says so instead.
 * After a photo / signature change the session is refreshed so the new keys show everywhere
 * (the web page calls checkAuth() for the same reason).
 *
 * Not ported on purpose: the web's "Updating your password will invalidate all other active
 * sessions" line. TeacherService.changePassword doesn't bump the token version, so it isn't true
 * (see docs/web-parity.md).
 */
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, FieldError } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import {
  Briefcase,
  Camera,
  CheckCircle2,
  Lock,
  Mail,
  MapPin,
  PenTool,
  Phone,
  ShieldCheck,
  User,
  type LucideIcon,
} from '@/components/ui/icons';
import { PasswordInput as SharedPasswordInput } from '@/components/ui/PasswordInput';
import { SectionCard } from '@/components/ui/SectionCard';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { fileUrl } from '@/features/student/components';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { checkTeacherFile, type TeacherFileKind } from '@/lib/api/teacher-self';
import { pickFile } from '@/lib/files/pick-file';
import { cn } from '@/lib/utils';
import { useApi, useSession } from '@/session/ApiProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { tw } from '@/theme/tokens';
import { passwordFormError, passwordRules, passwordStrength, type PasswordForm } from './password';
import { teacherProfile, type TeacherProfile } from './profile';

type Tab = 'profile' | 'security';

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Lock },
  ];
  return (
    <View role="tablist" className="border-border flex-row gap-1 border-b">
      {tabs.map((t) => {
        const on = t.id === value;
        return (
          <Pressable
            key={t.id}
            role="tab"
            aria-selected={on}
            accessibilityState={{ selected: on }}
            onPress={() => onChange(t.id)}
            className={cn(
              '-mb-px flex-row items-center gap-2 border-b-2 px-4 py-2.5',
              on ? 'border-primary' : 'border-transparent',
            )}
            testID={`settings-tab-${t.id}`}
          >
            <Icon icon={t.icon} size={16} color={on ? 'primary' : 'mutedForeground'} />
            <Text
              size="sm"
              weight={on ? 'semibold' : 'medium'}
              color={on ? undefined : 'mutedForeground'}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReadOnlyField({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="min-w-[220px] flex-1 gap-2">
      <View className="flex-row items-center gap-2">
        <Icon icon={icon} size={14} color="mutedForeground" />
        <Text size="xs" weight="bold" color="mutedForeground" className="uppercase">
          {label}
        </Text>
      </View>
      <View className="border-border bg-muted/30 h-11 flex-row items-center rounded-xl border px-3">
        <Text size="sm" weight="medium" className="min-w-0 flex-1" numberOfLines={1}>
          {value}
        </Text>
        <Icon icon={Lock} size={12} color="mutedForeground" />
      </View>
    </View>
  );
}

function Busy() {
  return (
    <View className="bg-background/60 absolute inset-0 items-center justify-center">
      <ActivityIndicator />
    </View>
  );
}

function ProfileTab({ t }: { t: TeacherProfile }) {
  const { teacherSelf, session } = useApi();
  const toast = useToast();
  const mobile = useBreakpoint() === 'mobile';
  const [busy, setBusy] = useState<TeacherFileKind | 'remove' | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const photo = fileUrl(t.image);
  const signature = fileUrl(t.signature);

  const upload = async (kind: TeacherFileKind) => {
    if (busy) return;
    const file = await pickFile('image/*');
    if (!file) return;
    const problem = checkTeacherFile(kind, file);
    if (problem) {
      toast.error(problem);
      return;
    }
    setBusy(kind);
    try {
      await teacherSelf.uploadFile(kind, t.id, file);
      toast.success(
        kind === 'image'
          ? 'Profile image updated successfully'
          : 'Digital signature updated successfully',
      );
      await session.refresh().catch(() => false);
    } catch (e) {
      toast.error(
        mutationErrorMessage(
          e,
          kind === 'image' ? 'Failed to upload image' : 'Failed to upload signature',
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  const removeSignature = async () => {
    setBusy('remove');
    try {
      await teacherSelf.removeSignature(t.id);
      toast.success('Signature removed');
      setConfirmRemove(false);
      await session.refresh().catch(() => false);
    } catch {
      toast.error('Failed to remove signature');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View className={mobile ? 'gap-6' : 'flex-row items-start gap-8'}>
      <View className={mobile ? '' : 'w-[34%]'}>
        <SectionCard title="Profile Photo" icon={<Icon icon={Camera} size={18} />}>
          <View className="items-center py-6">
            <View>
              <View className="border-background bg-muted h-48 w-48 items-center justify-center overflow-hidden rounded-2xl border-4">
                {photo ? (
                  <Image
                    source={{ uri: photo }}
                    accessibilityLabel={t.name}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <Icon icon={User} size={96} color="mutedForeground" />
                )}
                {busy === 'image' ? <Busy /> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Update Profile Picture"
                disabled={busy !== null}
                onPress={() => void upload('image')}
                className={cn(
                  'bg-primary absolute -bottom-3 -right-3 rounded-xl p-3',
                  busy !== null && 'opacity-50',
                )}
                testID="upload-photo"
              >
                <Icon icon={Camera} size={20} rawColor={tw.white} />
              </Pressable>
            </View>
            <View className="mt-8 items-center gap-2">
              <Text weight="bold" className="text-center text-2xl">
                {t.name}
              </Text>
              <View className="flex-row items-center gap-2">
                <Icon icon={Briefcase} size={16} color="primary" />
                <Text weight="medium" color="primary">
                  {t.designation ?? 'Staff Member'}
                </Text>
              </View>
              <View className="flex-row gap-2 pt-2">
                <View className="rounded-full bg-emerald-100 px-3 py-1">
                  <Text
                    weight="bold"
                    className="text-[10px] uppercase tracking-wider text-emerald-700"
                  >
                    Active
                  </Text>
                </View>
                <View className="rounded-full bg-blue-100 px-3 py-1">
                  <Text
                    weight="bold"
                    className="text-[10px] uppercase tracking-wider text-blue-700"
                  >
                    Teacher
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SectionCard>
      </View>

      <View className={mobile ? 'gap-6' : 'min-w-0 flex-1 gap-8'}>
        <SectionCard title="Professional Information" icon={<Icon icon={User} size={18} />}>
          <View className="flex-row flex-wrap gap-6 py-2">
            <ReadOnlyField icon={Mail} label="Email Address" value={t.email || '—'} />
            <ReadOnlyField icon={Phone} label="Phone Number" value={t.phone ?? 'Not provided'} />
            <ReadOnlyField
              icon={Briefcase}
              label="Current Designation"
              value={t.designation ?? 'Not provided'}
            />
          </View>
          <View className="bg-muted/40 border-border/50 mt-6 gap-3 rounded-2xl border p-5">
            <View className="flex-row items-center gap-2">
              <Icon icon={MapPin} size={14} color="primary" />
              <Text size="xs" weight="bold" color="mutedForeground" className="uppercase">
                Permanent Address on File
              </Text>
            </View>
            <Text
              size="sm"
              color="mutedForeground"
              className="border-primary/20 border-l-4 pl-4 italic"
            >
              {t.address ?? 'Contact administrative office to update registry address.'}
            </Text>
          </View>
          <View className="mt-6 flex-row items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <Icon icon={ShieldCheck} size={20} rawColor="#2563eb" />
            <Text size="xs" weight="medium" className="min-w-0 flex-1 text-blue-800">
              For institutional data integrity, modification of professional records is only
              permitted by administrative staff.
            </Text>
          </View>
        </SectionCard>

        <SectionCard title="Digital Signature" icon={<Icon icon={PenTool} size={18} />}>
          <View className={mobile ? 'items-center gap-6 py-2' : 'flex-row items-center gap-8 py-2'}>
            <View className="border-border bg-muted/30 h-24 w-40 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed p-2">
              {signature ? (
                <Image
                  source={{ uri: signature }}
                  accessibilityLabel="Teacher Signature"
                  style={{ width: 144, height: 80 }}
                  resizeMode="contain"
                />
              ) : (
                <Icon icon={PenTool} size={32} color="mutedForeground" />
              )}
              {busy === 'signature' || busy === 'remove' ? <Busy /> : null}
            </View>
            <View className="min-w-0 flex-1 gap-2">
              <Text weight="bold">Official Signature</Text>
              <Text size="xs" color="mutedForeground">
                This signature will be automatically embedded in student marksheets and official
                transcripts. Please ensure the image is clear and has a white or transparent
                background.
              </Text>
              <View className="flex-row gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  label="Upload New"
                  disabled={busy !== null}
                  onPress={() => void upload('signature')}
                  testID="upload-signature"
                />
                {t.signature ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    label="Remove"
                    disabled={busy !== null}
                    onPress={() => setConfirmRemove(true)}
                    testID="remove-signature"
                  />
                ) : null}
              </View>
            </View>
          </View>
        </SectionCard>
      </View>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove signature?"
        message="Are you sure you want to remove your digital signature?"
        confirmLabel="Remove"
        busy={busy === 'remove'}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => void removeSignature()}
      />
    </View>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  invalid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
}) {
  return (
    <SharedPasswordInput
      label={label}
      value={value}
      onChangeText={onChange}
      kind={id === 'currentPassword' ? 'password' : 'new-password'}
      placeholder={placeholder}
      invalid={invalid}
      testID={id}
    />
  );
}

const EMPTY: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' };

function SecurityTab() {
  const { teacherSelf } = useApi();
  const toast = useToast();
  const { colors } = useTheme();
  const [form, setForm] = useState<PasswordForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const rules = passwordRules(form.newPassword);
  const strength = passwordStrength(form.newPassword);
  const mismatch = !!form.confirmPassword && form.newPassword !== form.confirmPassword;
  const valid = passwordFormError(form) === null;
  const set = (k: keyof PasswordForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    const problem = passwordFormError(form);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      await teacherSelf.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Security credentials updated');
      setForm(EMPTY);
    } catch (e) {
      toast.error(mutationErrorMessage(e, 'Verification failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="w-full max-w-3xl self-center">
      <SectionCard title="Update Password" icon={<Icon icon={Lock} size={18} />}>
        <View className="gap-6 py-2">
          <Field label="Current Security Key">
            <PasswordInput
              id="currentPassword"
              label="Current password"
              value={form.currentPassword}
              onChange={set('currentPassword')}
              placeholder="••••••••"
            />
          </Field>
          <View className="flex-row flex-wrap gap-6">
            <View className="min-w-[240px] flex-1 gap-3">
              <Field label="New Password">
                <PasswordInput
                  id="newPassword"
                  label="New password"
                  value={form.newPassword}
                  onChange={set('newPassword')}
                  placeholder="Min. 8 chars"
                />
              </Field>
              {form.newPassword ? (
                <View
                  className="flex-row items-center justify-between px-1"
                  testID="password-strength"
                >
                  <Text
                    weight="bold"
                    color="mutedForeground"
                    className="text-[10px] uppercase tracking-widest"
                  >
                    Strength: {strength.label}
                  </Text>
                  <View className="flex-row gap-1">
                    {[1, 2, 3, 4].map((i) => (
                      <View
                        key={i}
                        className={cn(
                          'h-1 w-6 rounded-full',
                          i <= strength.score ? strength.bar : 'bg-muted',
                        )}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
            <View className="min-w-[240px] flex-1 gap-3">
              <Field label="Confirm Password">
                <PasswordInput
                  id="confirmPassword"
                  label="Confirm password"
                  value={form.confirmPassword}
                  onChange={set('confirmPassword')}
                  placeholder="Match your password"
                  invalid={mismatch}
                />
              </Field>
              {mismatch ? (
                <FieldError message="Passwords do not match" />
              ) : form.confirmPassword && strength.score >= 4 ? (
                <View className="flex-row items-center gap-1 px-1">
                  <Icon icon={CheckCircle2} size={10} rawColor="#059669" />
                  <Text weight="bold" className="text-[10px] text-emerald-600">
                    Configuration Valid
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View className="bg-muted/30 border-border/40 flex-row flex-wrap gap-x-6 gap-y-2 rounded-2xl border p-4">
            {rules.map((r) => (
              <View
                key={r.label}
                className="min-w-[45%] flex-row items-center gap-2"
                accessibilityLabel={`${r.label}: ${r.met ? 'met' : 'not met'}`}
              >
                <View
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: r.met ? '#10b981' : colors.mutedForeground }}
                />
                <Text
                  weight="medium"
                  className={cn('text-[11px]', r.met ? 'text-emerald-600' : 'text-gray-500')}
                >
                  {r.label}
                </Text>
              </View>
            ))}
          </View>
          <View className="border-border items-end border-t pt-6">
            <Button
              icon={Lock}
              label={saving ? 'Saving…' : 'SECURE IDENTITY'}
              disabled={saving || !valid}
              onPress={() => void submit()}
              testID="change-password"
            />
          </View>
        </View>
      </SectionCard>
    </View>
  );
}

export function TeacherSettingsScreen() {
  const { user } = useSession();
  const t = teacherProfile(user);
  const [tab, setTab] = useState<Tab>('profile');
  return (
    <PageLayout
      title="Teacher Account Settings"
      description="Manage your professional profile and account security settings."
    >
      <Tabs value={tab} onChange={setTab} />
      {tab === 'profile' ? t ? <ProfileTab t={t} /> : null : <SecurityTab />}
    </PageLayout>
  );
}
