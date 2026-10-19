/**
 * Admission settings, replicating dashboard/src/pages/Admin/AdmissionSettings.tsx: year,
 * accepting-applications switch, class list, notice PDF, instructions, the pledge text and the
 * per-class (6–9) user IDs / list type / serial / attachment instructions, with an unsaved-changes
 * bar. Validated with the shared admissionSettingsSchema (the server runs the same schema).
 * Live data: GET/PUT/DELETE /api/admission, POST /api/admission/upload-url.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  admissionSettingsDefaultValues,
  admissionSettingsSchema,
  type AdmissionSettingsData,
  type AdmissionSettingsFormInput,
} from '@school/shared-schemas';
import { useEffect, useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, FieldRow, FormSection } from '@/components/ui/Field';
import { FilePicker } from '@/components/ui/FilePicker';
import { Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { openStoredFile } from '@/features/admin/open-file';
import { TextField } from '@/features/admin/TextField';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { ADMISSION_CLASSES, isPdf, type AdmissionSettings, type PickedFile } from '@/lib/api';
import { useLeaveGuard } from '@/navigation/LeaveGuard';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { fileNameOf } from './model';

type Values = AdmissionSettingsFormInput;

const toForm = (s: AdmissionSettings | null | undefined): Values =>
  s
    ? { ...admissionSettingsDefaultValues, ...s.values, notice_key: null }
    : { ...admissionSettingsDefaultValues };

function AreaField({
  control,
  name,
  label,
  hint,
  rows = 4,
}: {
  control: Control<Values>;
  name: keyof Values;
  label: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} hint={hint} error={fieldState.error?.message}>
          <Input
            value={field.value == null ? '' : String(field.value)}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            accessibilityLabel={label}
            multiline
            numberOfLines={rows}
            rows={4}
          />
        </Field>
      )}
    />
  );
}

export function AdmissionSettingsScreen() {
  const { admission } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [notice, setNotice] = useState<PickedFile | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'admission', 'settings'),
    queryFn: ({ signal }) => admission.settings(signal),
  });
  const { control, handleSubmit, reset, formState } = useForm<
    Values,
    unknown,
    AdmissionSettingsData
  >({
    resolver: zodResolver(admissionSettingsSchema),
    defaultValues: toForm(q.data),
    mode: 'onBlur',
  });
  useEffect(() => {
    if (q.data !== undefined) reset(toForm(q.data));
  }, [q.data, reset]);
  const dirty = formState.isDirty || notice !== null;
  useLeaveGuard(dirty, {
    title: 'Leave without saving?',
    message: 'Your admission settings changes have not been saved.',
  });

  const isEdit = !!q.data;
  const save = useAdminMutation({
    mutationFn: (v: AdmissionSettingsData) => admission.saveSettings(v, notice),
    invalidate: [['admission', 'settings']],
    success: () => (isEdit ? 'Settings updated' : 'Settings created'),
    failure: 'Failed to save settings',
    onSuccess: () => setNotice(null),
  });
  const removeNotice = useAdminMutation({
    mutationFn: () => admission.removeNotice(),
    invalidate: [['admission', 'settings']],
    success: 'Notice removed',
    failure: 'Failed to remove notice',
    onSuccess: () => setRemoveOpen(false),
  });
  const submit = () =>
    void handleSubmit(
      (v) => save.mutate(v),
      () => toast.error('Fix the highlighted fields'),
    )();
  const discard = () => {
    reset(toForm(q.data));
    setNotice(null);
  };
  const pick = (f: PickedFile | null) => {
    if (f && !isPdf(f)) {
      toast.error('Only PDF files are allowed');
      return;
    }
    setNotice(f);
  };

  const s = q.data;
  const summary = q.isPending
    ? 'Loading…'
    : s
      ? [
          `Admission ${s.year ?? '—'}`,
          s.open ? 'Accepting applications' : 'Closed',
          s.notice ? 'Notice uploaded' : 'No notice',
        ].join(' · ')
      : 'No settings yet. Fill in the form and create them.';

  return (
    <PageLayout
      title="Admission settings"
      description={summary}
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
      footer={
        dirty ? (
          <ActionBar label="Unsaved settings" testID="admission-unsaved">
            <Button
              variant="ghost"
              size="sm"
              label="Discard"
              onPress={discard}
              disabled={save.isPending}
            />
            <Button
              size="sm"
              label={save.isPending ? 'Saving…' : isEdit ? 'Save settings' : 'Create settings'}
              onPress={submit}
              disabled={save.isPending}
              testID="admission-save"
            />
          </ActionBar>
        ) : null
      }
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load admission settings"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={320} />
      ) : (
        <>
          <Controller
            control={control}
            name="admission_open"
            render={({ field }) => (
              <Checkbox
                boxed
                checked={field.value === true || field.value === 'true'}
                onChange={field.onChange}
                label="Accepting applications"
                description="When on, the public admission form is open on the website."
                testID="admission-open"
              />
            )}
          />
          <SectionCard title="General">
            <View className="gap-5">
              <FormSection title="Admission">
                <FieldRow>
                  <TextField
                    control={control}
                    name="admission_year"
                    label="Admission year"
                    placeholder="e.g. 2025"
                    keyboardType="number-pad"
                    required
                  />
                  <TextField
                    control={control}
                    name="class_list"
                    label="Class list"
                    placeholder="e.g. Six, Seven, Eight, Nine, Ten"
                  />
                </FieldRow>
              </FormSection>
              <FormSection title="Notice">
                {s?.notice ? (
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text size="sm" className="min-w-0 flex-1" numberOfLines={1}>
                      {notice
                        ? `${notice.name} replaces ${fileNameOf(s.notice)} when you save`
                        : fileNameOf(s.notice)}
                    </Text>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Trash2}
                      label="Remove"
                      onPress={() => setRemoveOpen(true)}
                    />
                  </View>
                ) : null}
                <FilePicker
                  label="Notice PDF"
                  accept="application/pdf,.pdf"
                  value={notice}
                  onChange={pick}
                  currentLabel={s?.notice ? 'Current notice' : undefined}
                  onOpenCurrent={s?.notice ? () => void openStoredFile(s.notice) : undefined}
                />
              </FormSection>
              <FormSection title="Instructions">
                <AreaField
                  control={control}
                  name="instruction"
                  label="Instruction"
                  hint="What to bring, deadlines and steps for applicants."
                />
                <AreaField
                  control={control}
                  name="ingikar"
                  label="ছাত্রের অঙ্গীকারনামা"
                  hint="Printed on generated admission PDFs."
                />
              </FormSection>
            </View>
          </SectionCard>
          <View className="flex-row flex-wrap gap-4">
            {ADMISSION_CLASSES.map((c) => (
              <View key={c} className="min-w-[300px] flex-1 basis-[45%]">
                <SectionCard title={`Class ${c}`}>
                  <View className="gap-4">
                    <TextField
                      control={control}
                      name={`user_id_class${c}`}
                      label="User IDs"
                      hint="Separate IDs with commas."
                      placeholder={`User IDs for class ${c}`}
                    />
                    <FieldRow>
                      <TextField
                        control={control}
                        name={`list_type_class${c}`}
                        label="List type"
                        placeholder="e.g. Merit-1"
                      />
                      <TextField
                        control={control}
                        name={`serial_no_class${c}`}
                        label="Serial no."
                        placeholder="e.g. 1-100"
                      />
                    </FieldRow>
                    <AreaField
                      control={control}
                      name={`attachment_instruction_class${c}`}
                      label="Attachment instructions"
                      rows={3}
                    />
                  </View>
                </SectionCard>
              </View>
            ))}
          </View>
        </>
      )}
      <ConfirmDialog
        open={removeOpen}
        title="Remove notice?"
        message="The admission notice PDF is deleted and disappears from the website."
        confirmLabel="Remove notice"
        busy={removeNotice.isPending}
        onClose={() => setRemoveOpen(false)}
        onConfirm={() => removeNotice.mutate(undefined)}
      />
    </PageLayout>
  );
}
