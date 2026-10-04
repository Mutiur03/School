import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import {
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  admissionNoticeUploadSchema,
  admissionSettingsDefaultValues,
  admissionSettingsSchema,
  type AdmissionSettingsData,
  type AdmissionSettingsFormInput,
} from '@school/shared-schemas';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import { withUploadedKey, withoutField } from '@/lib/r2UploadPayload';
import { getFileUrl } from '@/lib/backend';
import { cn } from '@/lib/utils';
import { ConfirmationPopup, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';

const CLASSES = ['6', '7', '8', '9'] as const;

type Raw = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Maps the API row (snake_case, with legacy camelCase fallbacks) onto form values. */
const toFormValues = (data: Raw): AdmissionSettingsFormInput => {
  const pick = (snake: string, camel: string) => str(data[snake] ?? data[camel]);
  const perClass = Object.fromEntries(
    CLASSES.flatMap((c) => [
      [
        `attachment_instruction_class${c}`,
        pick(`attachment_instruction_class${c}`, `attachmentInstructionClass${c}`),
      ],
      [`list_type_class${c}`, pick(`list_type_class${c}`, `listTypeClass${c}`)],
      [`user_id_class${c}`, pick(`user_id_class${c}`, `userIdClass${c}`)],
      [`serial_no_class${c}`, pick(`serial_no_class${c}`, `serialNoClass${c}`)],
    ]),
  );
  return {
    ...admissionSettingsDefaultValues,
    ...perClass,
    admission_year:
      data.admission_year != null && data.admission_year !== 0 ? String(data.admission_year) : '',
    admission_open:
      typeof data.admission_open === 'boolean'
        ? data.admission_open
        : admissionSettingsDefaultValues.admission_open,
    instruction: (data.instruction as string) ?? admissionSettingsDefaultValues.instruction,
    ingikar: str(data.ingikar),
    class_list: pick('class_list', 'classList'),
    notice_key: noticeKeyOf(data),
  };
};

const noticeKeyOf = (data: Raw): string | null =>
  str(data.notice_key) ||
  (typeof data.public_id === 'string' && !data.public_id.startsWith('http')
    ? data.public_id
    : null);

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
    {error && <p className="text-destructive text-xs">{error}</p>}
  </div>
);

const FormSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-4">
    <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
      {title}
    </h3>
    {children}
  </section>
);

function AdmissionSettings() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<AdmissionSettingsFormInput, unknown, AdmissionSettingsData>({
    resolver: zodResolver(admissionSettingsSchema),
    defaultValues: admissionSettingsDefaultValues,
  });

  const noticeKey = watch('notice_key');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const noticeInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: ['admission-settings'],
    queryFn: async () => (await axios.get('/api/admission')).data as Raw | null,
  });
  const saved = settingsQuery.data;
  const isEdit = Boolean(saved);

  useEffect(() => {
    if (settingsQuery.isSuccess)
      reset(saved ? toFormValues(saved) : admissionSettingsDefaultValues);
  }, [saved, settingsQuery.isSuccess, reset]);

  const savedNoticeKey = saved ? noticeKeyOf(saved) : null;
  const previewUrl = saved ? str(saved.preview_url) || str(saved.previewUrl) : '';
  const currentNoticeUrl = previewUrl
    ? getFileUrl(previewUrl)
    : noticeKey
      ? getFileUrl(noticeKey)
      : null;
  const hasNotice = Boolean(previewUrl || savedNoticeKey || noticeKey);

  const pickNotice = (file: File | null | undefined) => {
    if (noticeInputRef.current) noticeInputRef.current.value = '';
    if (!file) {
      setNoticeFile(null);
      return;
    }
    const parsed = admissionNoticeUploadSchema.safeParse({
      filename: file.name,
      filetype: file.type,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Only PDF files are allowed');
      return;
    }
    setNoticeFile(file);
  };

  const onSubmit = async (values: AdmissionSettingsData) => {
    setSaving(true);
    try {
      let uploadedNoticeKey: string | undefined;

      if (noticeFile) {
        const uploadPayload = admissionNoticeUploadSchema.parse({
          filename: noticeFile.name,
          filetype: noticeFile.type,
        });
        const { data: urlData } = await axios.post('/api/admission/upload-url', uploadPayload);
        if (!urlData.success) throw new Error('Failed to get upload URL');
        await putFileToPresignedUrl(urlData.data.uploadUrl, noticeFile, noticeFile.type);
        uploadedNoticeKey = urlData.data.key;
      }

      const res = await axios.put(
        '/api/admission',
        withUploadedKey(withoutField(values, 'notice_key'), 'notice_key', uploadedNoticeKey),
      );

      if (res?.data?.success) {
        toast.success(isEdit ? 'Settings updated' : 'Settings created');
        setNoticeFile(null);
      } else {
        toast.error('Failed to save settings');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      await settingsQuery.refetch();
      setSaving(false);
    }
  };

  const removeNotice = async () => {
    setSaving(true);
    try {
      const res = await axios.delete('/api/admission');
      if (res?.data?.success) {
        setNoticeFile(null);
        await settingsQuery.refetch();
        toast.success('Notice removed');
      } else {
        toast.error('Failed to remove notice');
      }
    } catch {
      toast.error('Failed to remove notice');
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    reset();
    setNoticeFile(null);
  };

  const showBar = settingsQuery.isSuccess && (!isEdit || isDirty || Boolean(noticeFile));

  const summary = saved
    ? [
        saved.admission_year ? `Admission ${String(saved.admission_year)}` : 'Year not set',
        saved.admission_open === true ? 'Accepting applications' : 'Closed',
        hasNotice ? 'Notice uploaded' : 'No notice',
      ].join(' · ')
    : settingsQuery.isSuccess
      ? 'Not configured yet'
      : ' ';

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Admission settings</h1>
          <p className="text-muted-foreground mt-1 text-sm tabular-nums">
            {settingsQuery.isLoading ? <Skeleton className="h-4 w-56" /> : summary}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => settingsQuery.refetch()}
          disabled={settingsQuery.isFetching}
        >
          <RefreshCw className={cn(settingsQuery.isFetching && 'animate-spin')} /> Refresh
        </Button>
      </header>

      {settingsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : settingsQuery.isError ? (
        <SectionCard>
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p>Couldn't load admission settings.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => settingsQuery.refetch()}
            >
              <RefreshCw /> Try again
            </Button>
          </div>
        </SectionCard>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-1 flex-col">
          <div className="space-y-6">
            <label className="border-border bg-card flex cursor-pointer items-start gap-3 rounded-xl border p-4 shadow-sm">
              <input type="checkbox" {...register('admission_open')} className="mt-0.5 h-4 w-4" />
              <span>
                <span className="block text-sm font-medium">Accept admission applications</span>
                <span className="text-muted-foreground block text-sm">
                  Students can submit their admission forms while this is on.
                </span>
              </span>
            </label>

            <SectionCard title="General" icon={<Settings size={20} />}>
              <div className="space-y-8">
                <FormSection title="Admission">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Admission year" error={errors.admission_year?.message}>
                      <Input
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={4}
                        minLength={4}
                        {...register('admission_year')}
                        placeholder="e.g. 2025"
                        className="tabular-nums"
                      />
                    </Field>
                    <Field label="Class list" error={errors.class_list?.message}>
                      <Input
                        {...register('class_list')}
                        placeholder="e.g. Six, Seven, Eight, Nine, Ten"
                      />
                    </Field>
                  </div>
                </FormSection>

                <FormSection title="Notice">
                  <input
                    ref={noticeInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden
                    onChange={(e) => pickNotice(e.target.files?.[0])}
                  />
                  {noticeFile || hasNotice ? (
                    <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-3 sm:flex-nowrap">
                      <div className="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-md">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {noticeFile ? noticeFile.name : 'Current notice'}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {noticeFile
                            ? `${(noticeFile.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                            : 'PDF · shown to applicants on the admission page'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        {noticeFile ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => pickNotice(null)}
                          >
                            <X /> Clear
                          </Button>
                        ) : (
                          currentNoticeUrl && (
                            <Button type="button" variant="ghost" size="sm" asChild>
                              <a href={currentNoticeUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink /> View
                              </a>
                            </Button>
                          )
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => noticeInputRef.current?.click()}
                        >
                          <Upload /> Replace
                        </Button>
                        {!noticeFile && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={saving}
                            onClick={() => setRemoveOpen(true)}
                          >
                            <Trash2 /> Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => noticeInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        pickNotice(e.dataTransfer.files[0]);
                      }}
                      className="border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2"
                    >
                      <Upload size={20} className="text-muted-foreground" />
                      <span className="text-sm font-medium">Upload notice PDF</span>
                      <span className="text-muted-foreground text-xs">
                        Click or drop a file here · PDF only
                      </span>
                    </button>
                  )}
                </FormSection>

                <FormSection title="Instructions">
                  <Field
                    label="Instruction"
                    hint="What to bring, deadlines and steps for applicants."
                    error={errors.instruction?.message}
                  >
                    <Textarea {...register('instruction')} className="h-24" />
                  </Field>
                  <Field
                    label="ছাত্রের অঙ্গীকারনামা"
                    hint="Printed on generated admission PDFs."
                    error={errors.ingikar?.message}
                  >
                    <Textarea {...register('ingikar')} className="h-28" />
                  </Field>
                </FormSection>
              </div>
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              {CLASSES.map((c) => (
                <SectionCard key={c} title={`Class ${c}`}>
                  <div className="space-y-4">
                    <Field
                      label="User IDs"
                      hint="Separate IDs with commas."
                      error={errors[`user_id_class${c}`]?.message}
                    >
                      <Input
                        {...register(`user_id_class${c}`)}
                        placeholder={`User IDs for class ${c}`}
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="List type" error={errors[`list_type_class${c}`]?.message}>
                        <Input {...register(`list_type_class${c}`)} placeholder="e.g. Merit-1" />
                      </Field>
                      <Field label="Serial no." error={errors[`serial_no_class${c}`]?.message}>
                        <Input {...register(`serial_no_class${c}`)} placeholder="e.g. 1-100" />
                      </Field>
                    </div>
                    <Field
                      label="Attachment instructions"
                      error={errors[`attachment_instruction_class${c}`]?.message}
                    >
                      <Textarea
                        {...register(`attachment_instruction_class${c}`)}
                        className="h-24"
                      />
                    </Field>
                  </div>
                </SectionCard>
              ))}
            </div>
          </div>

          {showBar && <div aria-hidden className="min-h-6 flex-1" />}
          {showBar && (
            <div
              role="region"
              aria-label="Unsaved settings"
              className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
            >
              <p className="text-sm font-medium">
                {isEdit ? 'Unsaved changes' : 'Settings not created yet'}
              </p>
              <div className="flex gap-2">
                {isEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={discard}
                    disabled={saving}
                  >
                    Discard
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={saving}>
                  {saving && <Loader2 className="animate-spin" />}
                  {isEdit ? 'Save settings' : 'Create settings'}
                </Button>
              </div>
            </div>
          )}
        </form>
      )}

      <ConfirmationPopup
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={() => {
          setRemoveOpen(false);
          removeNotice();
        }}
        title="Remove notice?"
        confirmLabel="Remove notice"
        msg="The notice PDF will be deleted and no longer shown to applicants. This cannot be undone."
      />
    </div>
  );
}

export default AdmissionSettings;
