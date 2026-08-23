import { useEffect, useState, type ChangeEvent } from 'react';
import axios from 'axios';
import { RefreshCw, FileText, Loader2, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  admissionNoticeUploadSchema,
  admissionSettingsDefaultValues,
  admissionSettingsSchema,
  type AdmissionSettingsData,
} from '@school/shared-schemas';
import { putFileToPresignedUrl } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';

interface Notice {
  notice_key: string | null;
  url: string | null;
}

function AdmissionSettings() {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm<AdmissionSettingsData>({
    resolver: zodResolver(admissionSettingsSchema),
    defaultValues: admissionSettingsDefaultValues,
  });

  const noticeKey = watch('notice_key');
  const [noticeFile, setNoticeFile] = useState<File | null>(null);
  const [currentNotice, setCurrentNotice] = useState<Notice | null>(null);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [formMessage, setFormMessage] = useState<string>('');
  const [isEdit, setIsEdit] = useState<boolean>(false);

  useEffect(() => {
    fetchAdmissionSettings();
  }, []);

  const fetchAdmissionSettings = async () => {
    try {
      const res = await axios.get('/api/admission');

      if (res.data) {
        const data = res.data;
        const resolvedNoticeKey =
          data.notice_key ||
          (typeof data.public_id === 'string' && !data.public_id.startsWith('http')
            ? data.public_id
            : null);

        reset({
          admission_year: data.admission_year ?? admissionSettingsDefaultValues.admission_year,
          admission_open:
            typeof data.admission_open === 'boolean'
              ? data.admission_open
              : admissionSettingsDefaultValues.admission_open,
          instruction: data.instruction ?? admissionSettingsDefaultValues.instruction,
          attachment_instruction_class6:
            data.attachment_instruction_class6 ?? data.attachmentInstructionClass6 ?? '',
          attachment_instruction_class7:
            data.attachment_instruction_class7 ?? data.attachmentInstructionClass7 ?? '',
          attachment_instruction_class8:
            data.attachment_instruction_class8 ?? data.attachmentInstructionClass8 ?? '',
          attachment_instruction_class9:
            data.attachment_instruction_class9 ?? data.attachmentInstructionClass9 ?? '',
          ingikar: data.ingikar ?? '',
          class_list: data.class_list ?? data.classList ?? '',
          list_type_class6: data.list_type_class6 ?? data.listTypeClass6 ?? '',
          list_type_class7: data.list_type_class7 ?? data.listTypeClass7 ?? '',
          list_type_class8: data.list_type_class8 ?? data.listTypeClass8 ?? '',
          list_type_class9: data.list_type_class9 ?? data.listTypeClass9 ?? '',
          user_id_class6: data.user_id_class6 ?? data.userIdClass6 ?? '',
          user_id_class7: data.user_id_class7 ?? data.userIdClass7 ?? '',
          user_id_class8: data.user_id_class8 ?? data.userIdClass8 ?? '',
          user_id_class9: data.user_id_class9 ?? data.userIdClass9 ?? '',
          serial_no_class6: data.serial_no_class6 ?? data.serialNoClass6 ?? '',
          serial_no_class7: data.serial_no_class7 ?? data.serialNoClass7 ?? '',
          serial_no_class8: data.serial_no_class8 ?? data.serialNoClass8 ?? '',
          serial_no_class9: data.serial_no_class9 ?? data.serialNoClass9 ?? '',
          notice_key: resolvedNoticeKey,
        });

        if (data.preview_url || resolvedNoticeKey) {
          const noticeUrl = getFileUrl(
            data.preview_url || data.previewUrl || getFileUrl(resolvedNoticeKey),
          );

          setCurrentNotice({
            notice_key: resolvedNoticeKey,
            url: noticeUrl || null,
          });
        } else {
          setCurrentNotice(null);
          setNoticeFile(null);
        }
        setIsEdit(true);
      } else {
        reset(admissionSettingsDefaultValues);
        setIsEdit(false);
      }
    } catch (error) {
      console.error('Failed to fetch admission settings:', error);
      setFormMessage('Error: Failed to load settings');
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const parsed = admissionNoticeUploadSchema.safeParse({
      filename: file.name,
      filetype: file.type,
    });

    if (!parsed.success) {
      setFormMessage(parsed.error.issues[0]?.message ?? 'Error: Only PDF files are allowed');
      e.target.value = '';
      return;
    }

    setNoticeFile(file);
    setFormMessage('');
  };

  const onSubmit = async (values: AdmissionSettingsData) => {
    setFormLoading(true);
    setFormMessage('');

    try {
      let nextNoticeKey = values.notice_key ?? currentNotice?.notice_key ?? null;

      if (noticeFile) {
        const uploadPayload = admissionNoticeUploadSchema.parse({
          filename: noticeFile.name,
          filetype: noticeFile.type,
        });

        const { data: urlData } = await axios.post('/api/admission/upload-url', uploadPayload);

        if (!urlData.success) {
          throw new Error('Failed to get upload URL');
        }

        await putFileToPresignedUrl(urlData.data.uploadUrl, noticeFile, noticeFile.type);
        nextNoticeKey = urlData.data.key;
      }

      const res = await axios.put('/api/admission', {
        ...values,
        notice_key: nextNoticeKey,
      });

      if (res?.data?.success) {
        toast.success(isEdit ? 'Settings updated' : 'Settings created');
        setFormMessage('Settings saved successfully');
        setNoticeFile(null);
        setValue('notice_key', nextNoticeKey);
      } else {
        toast.error('Failed to save settings');
        setFormMessage('Error: Failed to save settings');
      }
    } catch {
      toast.error('An unexpected error occurred');
      setFormMessage('Error: An unexpected error occurred');
    } finally {
      fetchAdmissionSettings();
      setFormLoading(false);
    }
  };

  const removeNotice = async () => {
    try {
      setFormLoading(true);
      const res = await axios.delete('/api/admission');
      if (res?.data?.success) {
        await fetchAdmissionSettings();
        setNoticeFile(null);
        reset({ ...getValues(), notice_key: null });
        setCurrentNotice(null);
        setFormMessage('Notice removed');
      } else {
        setFormMessage('Error: Failed to remove notice');
      }
    } catch {
      setFormMessage('Error: Failed to remove notice');
    } finally {
      setFormLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAdmissionSettings();
  };

  const currentNoticeUrl = currentNotice?.url || (noticeKey ? getFileUrl(noticeKey) : null);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Admission Settings
          </h1>
          <p className="text-muted-foreground text-sm dark:text-gray-400">
            Configure admission options and notices
          </p>
        </div>
        <div>
          <button
            onClick={handleRefresh}
            className="bg-primary hover:bg-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-white transition-colors focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {formMessage && (
        <div
          className={`rounded-lg p-3 ${
            formMessage.includes('Error')
              ? 'border border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900 dark:text-red-200'
              : 'border border-green-200 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900 dark:text-green-200'
          }`}
        >
          {formMessage}
        </div>
      )}

      <div className="bg-card text-card-foreground border-border mt-4 rounded-xl border p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-foreground mb-6 text-lg font-medium dark:text-gray-100">
          <Settings size={16} className="mr-2 inline" />
          {isEdit ? 'Update Configuration' : 'Create Configuration'}
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-primary/10 border-primary rounded-lg border p-4 dark:border-blue-700 dark:bg-blue-900/20">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="admission_open"
                {...register('admission_open')}
                className="text-primary bg-input border-border focus:ring-primary h-4 w-4 rounded focus:ring-2 dark:border-gray-600 dark:bg-gray-700"
              />
              <label
                htmlFor="admission_open"
                className="text-primary text-sm font-medium dark:text-blue-300"
              >
                Open Admission for Students
              </label>
            </div>
            <p className="text-primary/80 dark:text-primary/70 mt-2 text-xs">
              When enabled, students can submit their admission forms
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label htmlFor="admission_year" className="mb-2 block text-sm font-medium">
                Admission Year
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                minLength={4}
                id="admission_year"
                {...register('admission_year')}
                placeholder="e.g. 2025"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              {errors.admission_year && (
                <p className="mt-1 text-xs text-red-500">{errors.admission_year.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="instruction" className="mb-2 block text-sm font-medium">
                Instruction
              </label>
              <textarea
                id="instruction"
                {...register('instruction')}
                placeholder="Enter admission instructions for applicants (what to bring, deadlines, steps)."
                rows={3}
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
            </div>

            <div>
              <div className="mt-3">
                <h3 className="mb-2 text-sm font-medium">
                  Attachment instructions per class (6 - 9)
                </h3>
                <div className="gap-3">
                  <div>
                    <label
                      htmlFor="attachment_instruction_class6"
                      className="mb-1 block text-xs font-medium"
                    >
                      Class 6
                    </label>
                    <textarea
                      id="attachment_instruction_class6"
                      {...register('attachment_instruction_class6')}
                      placeholder="Attachment instructions for Class 6"
                      rows={3}
                      className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class7"
                      className="mb-1 block text-xs font-medium"
                    >
                      Class 7
                    </label>
                    <textarea
                      id="attachment_instruction_class7"
                      {...register('attachment_instruction_class7')}
                      placeholder="Attachment instructions for Class 7"
                      rows={3}
                      className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class8"
                      className="mb-1 block text-xs font-medium"
                    >
                      Class 8
                    </label>
                    <textarea
                      id="attachment_instruction_class8"
                      {...register('attachment_instruction_class8')}
                      placeholder="Attachment instructions for Class 8"
                      rows={3}
                      className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class9"
                      className="mb-1 block text-xs font-medium"
                    >
                      Class 9
                    </label>
                    <textarea
                      id="attachment_instruction_class9"
                      {...register('attachment_instruction_class9')}
                      placeholder="Attachment instructions for Class 9"
                      rows={3}
                      className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label htmlFor="ingikar" className="mb-2 block text-sm font-medium">
                ছাত্রের অঙ্গীকারনামা
              </label>
              <textarea
                id="ingikar"
                {...register('ingikar')}
                placeholder="Enter the ছাত্রের অঙ্গীকারনামা text that will appear on generated admission PDFs."
                rows={4}
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
            </div>
            <div>
              <label htmlFor="class_list" className="mb-2 block text-sm font-medium">
                Class List
              </label>
              <input
                type="text"
                id="class_list"
                {...register('class_list')}
                placeholder="e.g. Six, Seven, Eight, Nine, Ten"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
            </div>

            <div>
              <label htmlFor="user_id_class6" className="mb-2 block text-sm font-medium">
                User IDs for Class 6
              </label>
              <input
                type="text"
                id="user_id_class6"
                {...register('user_id_class6')}
                placeholder="Comma separated user ids for class 6"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="list_type_class6" className="mb-1 block text-xs font-medium">
                    List Type (Class 6)
                  </label>
                  <input
                    type="text"
                    id="list_type_class6"
                    {...register('list_type_class6')}
                    placeholder="e.g. Merit-1"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="serial_no_class6" className="mb-1 block text-xs font-medium">
                    Serial No. (Class 6)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class6"
                    {...register('serial_no_class6')}
                    placeholder="e.g. 1-100"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="user_id_class7" className="mb-2 block text-sm font-medium">
                User IDs for Class 7
              </label>
              <input
                type="text"
                id="user_id_class7"
                {...register('user_id_class7')}
                placeholder="Comma separated user ids for class 7"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="list_type_class7" className="mb-1 block text-xs font-medium">
                    List Type (Class 7)
                  </label>
                  <input
                    type="text"
                    id="list_type_class7"
                    {...register('list_type_class7')}
                    placeholder="e.g. Merit-1"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="serial_no_class7" className="mb-1 block text-xs font-medium">
                    Serial No. (Class 7)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class7"
                    {...register('serial_no_class7')}
                    placeholder="e.g. 1-100"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="user_id_class8" className="mb-2 block text-sm font-medium">
                User IDs for Class 8
              </label>
              <input
                type="text"
                id="user_id_class8"
                {...register('user_id_class8')}
                placeholder="Comma separated user ids for class 8"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="list_type_class8" className="mb-1 block text-xs font-medium">
                    List Type (Class 8)
                  </label>
                  <input
                    type="text"
                    id="list_type_class8"
                    {...register('list_type_class8')}
                    placeholder="e.g. Merit-1"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="serial_no_class8" className="mb-1 block text-xs font-medium">
                    Serial No. (Class 8)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class8"
                    {...register('serial_no_class8')}
                    placeholder="e.g. 1-100"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="user_id_class9" className="mb-2 block text-sm font-medium">
                User IDs for Class 9
              </label>
              <input
                type="text"
                id="user_id_class9"
                {...register('user_id_class9')}
                placeholder="Comma separated user ids for class 9"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="list_type_class9" className="mb-1 block text-xs font-medium">
                    List Type (Class 9)
                  </label>
                  <input
                    type="text"
                    id="list_type_class9"
                    {...register('list_type_class9')}
                    placeholder="e.g. Merit-1"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
                <div>
                  <label htmlFor="serial_no_class9" className="mb-1 block text-xs font-medium">
                    Serial No. (Class 9)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class9"
                    {...register('serial_no_class9')}
                    placeholder="e.g. 1-100"
                    className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="notice" className="mb-2 block text-sm font-medium">
                Notice Document
              </label>

              {(currentNotice || noticeKey) && (
                <div className="bg-muted/50 border-border dark:bg-muted/500 mb-3 rounded-lg border p-3 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-red-600" />
                      <span className="text-sm">Current Notice PDF</span>
                    </div>
                    <div className="flex gap-3">
                      <a
                        href={currentNoticeUrl || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary text-sm hover:text-blue-700"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={removeNotice}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <input
                type="file"
                id="notice"
                accept=".pdf"
                onChange={handleFileChange}
                title="Upload a PDF file for the admission notice (only .pdf allowed)"
                aria-label="Upload notice PDF file"
                className="border-border focus:ring-primary/20 w-full rounded-lg border px-3 py-2 transition-colors focus:border-blue-500 focus:ring-2"
              />
              <p className="mt-1 text-xs text-red-500">Only PDF files are allowed</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={formLoading}
                className="bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {formLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {isEdit ? 'Updating...' : 'Creating...'}
                  </>
                ) : isEdit ? (
                  'Update'
                ) : (
                  'Create'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdmissionSettings;
