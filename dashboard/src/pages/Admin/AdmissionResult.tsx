import React, { useState, useEffect, type JSX } from 'react';
import axios, { isAxiosError } from 'axios';
import toast from 'react-hot-toast';
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Eye,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { PageHeader, SectionCard, TabNav } from '@/components';
import type { TabItem } from '@/components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AdmissionResult {
  id: number;
  class_name: string;
  admission_year: number;
  merit_list: string | null;
  waiting_list_1: string | null;
  waiting_list_2: string | null;
  created_at: string;
}

interface FormData {
  class_name: string;
  admission_year: number;
  merit_list: File | string | null;
  waiting_list_1: File | string | null;
  waiting_list_2: File | string | null;
}

interface ListType {
  key: keyof Pick<AdmissionResult, 'merit_list' | 'waiting_list_1' | 'waiting_list_2'>;
  label: string;
  color: string;
}

function AdmissionResult() {
  const { confirm, dialog } = useConfirmDialog();
  const [results, setResults] = useState<AdmissionResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>('6');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [formData, setFormData] = useState<FormData>({
    class_name: '6',
    admission_year: new Date().getFullYear(),
    merit_list: null,
    waiting_list_1: null,
    waiting_list_2: null,
  });

  const getCurrentYear = (currentYear: number): number[] => {
    return [currentYear, currentYear - 1, currentYear - 2];
  };

  const meritListRef = React.useRef<HTMLInputElement>(null);
  const waitingList1Ref = React.useRef<HTMLInputElement>(null);
  const waitingList2Ref = React.useRef<HTMLInputElement>(null);
  const classes = ['6', '7', '8', '9'];
  const listTypes: ListType[] = [
    { key: 'merit_list', label: '1st Result List', color: 'green' },
    { key: 'waiting_list_1', label: 'Waiting List 1', color: 'yellow' },
    { key: 'waiting_list_2', label: 'Waiting List 2', color: 'orange' },
  ];
  const fetchAdmissionSettings = async (): Promise<void> => {
    try {
      const res = await axios.get<{ admission_year: number }>('/api/admission');
      setFormData((prev) => ({
        ...prev,
        admission_year: res.data.admission_year,
      }));
      setAvailableYears(getCurrentYear(res.data.admission_year));
      setSelectedYear(res.data.admission_year);
      setCurrentYear(res.data.admission_year);
    } catch (error) {
      console.error('Failed to fetch admission settings:', error);
    }
  };

  useEffect(() => {
    fetchAdmissionSettings();
    fetchResults();
  }, []);

  const fetchResults = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await axios.get<AdmissionResult[]>('/api/admission-result');
      setResults(response.data);
    } catch (error) {
      console.error('Error fetching results:', error);
      toast.error('Failed to fetch admission results');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      admission_year: currentYear,
    }));
  }, [showForm, currentYear]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof FormData,
  ): void => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload only PDF files');
        e.target.value = '';
        setFormData((prev) => ({ ...prev, [fieldName]: null }));
        return;
      }
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
    } else {
      setFormData((prev) => ({ ...prev, [fieldName]: null }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const hasAnyFile =
      !!formData.merit_list || !!formData.waiting_list_1 || !!formData.waiting_list_2;

    if (!hasAnyFile) {
      toast.error('Please upload at least one PDF file');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Preparing upload...');

    try {
      const payload: Record<string, any> = {
        class_name: formData.class_name,
        admission_year: formData.admission_year,
      };

      const filesToUpload: { file: File; type: string }[] = [];
      if (formData.merit_list instanceof File)
        filesToUpload.push({ file: formData.merit_list, type: 'merit_list' });
      else if (typeof formData.merit_list === 'string') payload.merit_list = formData.merit_list;

      if (formData.waiting_list_1 instanceof File)
        filesToUpload.push({
          file: formData.waiting_list_1,
          type: 'waiting_list_1',
        });
      else if (typeof formData.waiting_list_1 === 'string')
        payload.waiting_list_1 = formData.waiting_list_1;

      if (formData.waiting_list_2 instanceof File)
        filesToUpload.push({
          file: formData.waiting_list_2,
          type: 'waiting_list_2',
        });
      else if (typeof formData.waiting_list_2 === 'string')
        payload.waiting_list_2 = formData.waiting_list_2;

      if (filesToUpload.length > 0) {
        toast.loading(`Initializing upload for ${filesToUpload.length} files...`, {
          id: toastId,
        });

        const { data: uploadResponse } = await axios.post('/api/admission-result/upload', {
          files: filesToUpload.map((f) => ({
            filename: f.file.name,
            contentType: f.file.type || 'application/pdf',
            fileSize: f.file.size,
            type: f.type,
          })),
          className: formData.class_name,
          admissionYear: formData.admission_year,
        });

        if (!uploadResponse.success) {
          throw new Error('Failed to initialize uploads');
        }

        await Promise.all(
          uploadResponse.data.map(async (item: any) => {
            const fileObj = filesToUpload.find((f) => f.type === item.type);
            if (!fileObj) return;

            if (!item.success) {
              throw new Error(
                `Error initializing ${item.filename}: ${item.error || 'Unknown error'}`,
              );
            }

            if (item.mode === 'simple') {
              toast.loading(`Uploading ${item.type}...`, { id: toastId });
              await axios.put(item.uploadUrl, fileObj.file, {
                headers: { 'Content-Type': fileObj.file.type },
                withCredentials: false,
              });
              payload[item.type] = item.key;
            } else if (item.mode === 'multipart') {
              const { uploadId, key, endpoints, chunkSize } = item;
              const PART_SIZE = chunkSize || 10 * 1024 * 1024;
              const totalParts = Math.ceil(fileObj.file.size / PART_SIZE);
              const parts: { ETag: string; PartNumber: number }[] = [];

              for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
                const start = (partNumber - 1) * PART_SIZE;
                const end = Math.min(start + PART_SIZE, fileObj.file.size);
                const chunk = fileObj.file.slice(start, end);

                const { data: signData } = await axios.post(endpoints.signPart, {
                  key,
                  uploadId,
                  partNumber,
                });
                if (!signData.success)
                  throw new Error(`Failed to sign part ${partNumber} for ${item.type}`);

                const uploadRes = await axios.put(signData.url, chunk, {
                  headers: { 'Content-Type': fileObj.file.type },
                  withCredentials: false,
                });

                const etag = uploadRes.headers['etag']?.replace(/"/g, '');
                if (!etag) throw new Error(`Missing ETag for part ${partNumber} of ${item.type}`);
                parts.push({ ETag: etag, PartNumber: partNumber });

                toast.loading(
                  `Uploading ${item.type}: ${((partNumber / totalParts) * 100).toFixed(0)}%`,
                  { id: toastId },
                );
              }

              const { data: completeData } = await axios.post(endpoints.complete, {
                key,
                uploadId,
                parts,
              });
              if (!completeData.success)
                throw new Error(`Failed to complete upload for ${item.type}`);

              payload[item.type] = key;
            }
          }),
        );
      }

      toast.loading('Saving changes...', { id: toastId });

      if (isEditing) {
        await axios.put(`/api/admission-result/${editId}`, payload);
        toast.success('Admission result updated successfully', { id: toastId });
      } else {
        await axios.post('/api/admission-result', payload);
        toast.success('Admission result uploaded successfully', {
          id: toastId,
        });
      }

      resetForm();
      fetchResults();
      setShowForm(false);
    } catch (error) {
      console.error('Error submitting form:', error);
      if (isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to upload admission result', {
          id: toastId,
        });
      } else {
        toast.error(
          'Failed to upload admission result: ' +
            (error instanceof Error ? error.message : 'Unknown error'),
          { id: toastId },
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (result: AdmissionResult): void => {
    setFormData({
      class_name: result.class_name,
      admission_year: result.admission_year,
      merit_list: result.merit_list,
      waiting_list_1: result.waiting_list_1,
      waiting_list_2: result.waiting_list_2,
    });
    setIsEditing(true);
    setEditId(result.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: number): Promise<void> => {
    const ok = await confirm({
      title: 'Delete result?',
      msg: 'Are you sure you want to delete this result?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/admission-result/${id}`);
      toast.success('Result deleted successfully');
      fetchResults();
    } catch (error) {
      console.error('Error deleting result:', error);
      toast.error('Failed to delete result');
    }
  };

  const resetForm = (): void => {
    setFormData({
      class_name: '6',
      admission_year: new Date().getFullYear(),
      merit_list: null,
      waiting_list_1: null,
      waiting_list_2: null,
    });
    setIsEditing(false);
    setEditId(null);
  };

  const getResultsByClass = (className: string): AdmissionResult[] => {
    return results.filter(
      (result) => result.class_name === className && result.admission_year === selectedYear,
    );
  };

  const getFileStatus = (fileUrl: string | null): JSX.Element => {
    return fileUrl ? (
      <div className="flex items-center gap-1 text-emerald-600">
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-xs">Uploaded</span>
      </div>
    ) : (
      <div className="text-muted-foreground flex items-center gap-1">
        <XCircle className="h-4 w-4" />
        <span className="text-xs">Not uploaded</span>
      </div>
    );
  };

  const classTabs: TabItem[] = classes.map((cls) => ({
    id: cls,
    label: `Class ${cls}`,
  }));

  const renderFileField = (
    label: string,
    field: 'merit_list' | 'waiting_list_1' | 'waiting_list_2',
    inputRef: React.RefObject<HTMLInputElement | null>,
  ) => {
    const value = formData[field];
    return (
      <div className="border-border bg-muted/40 rounded-lg border p-4">
        <label className="mb-2 block text-sm font-medium">{label}</label>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          onChange={(e) => handleFileChange(e, field)}
          className="border-border bg-background file:bg-muted file:text-foreground w-full cursor-pointer rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        {value && (
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {typeof value === 'string'
              ? `Current file: ${value.split('/').pop()}`
              : `Selected: ${value.name}`}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Admission Results"
        description="Upload 1st Result List and waiting lists for classes 6-9."
      >
        {!showForm && (
          <Button type="button" onClick={() => setShowForm(true)}>
            <Upload className="h-4 w-4" />
            Upload Result
          </Button>
        )}
      </PageHeader>

      {showForm && (
        <SectionCard
          title={isEditing ? 'Edit Admission Result' : 'Upload Admission Result'}
          icon={<FileText size={20} />}
          className="mb-6"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Class *</label>
                <select
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                  value={formData.class_name}
                  onChange={(e) => {
                    setFormData((prev) => ({
                      ...prev,
                      class_name: e.target.value,
                      merit_list: null,
                      waiting_list_1: null,
                      waiting_list_2: null,
                    }));
                    if (meritListRef.current) meritListRef.current.value = '';
                    if (waitingList1Ref.current) waitingList1Ref.current.value = '';
                    if (waitingList2Ref.current) waitingList2Ref.current.value = '';
                  }}
                  required
                >
                  {classes.map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Admission Year *</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={4}
                  minLength={4}
                  value={formData.admission_year}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      admission_year: parseInt(e.target.value),
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="border-border space-y-4 border-t pt-4">
              <div>
                <h3 className="text-base font-semibold">Upload PDF Files</h3>
                <p className="text-muted-foreground text-sm">
                  Upload one or more result lists (PDF format, max 10MB each)
                </p>
              </div>
              {renderFileField('1st Result List', 'merit_list', meritListRef)}
              {renderFileField('Waiting List 1', 'waiting_list_1', waitingList1Ref)}
              {renderFileField('Waiting List 2', 'waiting_list_2', waitingList2Ref)}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isEditing ? 'Updating...' : 'Uploading...'}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {isEditing ? 'Update Result' : 'Upload Result'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard
        title="Uploaded Results"
        headerAction={
          <div>
            <label className="mb-1 block text-sm font-medium">Filter by Admission Year</label>
            <select
              className="border-input bg-background rounded-md border px-3 py-2 text-sm"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <TabNav
          tabs={classTabs}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          className="mb-6"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
          </div>
        ) : getResultsByClass(activeTab).length === 0 ? (
          <div className="text-muted-foreground py-10 text-center">
            <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>No results uploaded for Class {activeTab}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {getResultsByClass(activeTab).map((result) => (
              <div key={result.id} className="border-border rounded-xl border p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="mb-1 text-lg font-semibold">
                      Class {result.class_name} - {result.admission_year}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      Uploaded on: {new Date(result.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      onClick={() => handleEdit(result)}
                      aria-label="Edit result"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="border-destructive text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(result.id)}
                      aria-label="Delete result"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {listTypes.map((listType) => (
                    <div
                      key={listType.key}
                      className="border-border bg-muted/40 rounded-lg border p-4"
                    >
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium">{listType.label}</h4>
                        {getFileStatus(result[listType.key])}
                      </div>
                      {result[listType.key] && (
                        <a
                          href={getFileUrl(result[listType.key])}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary mt-2 inline-flex items-center gap-2 text-sm hover:underline"
                        >
                          <Eye className="h-4 w-4" />
                          View PDF
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default AdmissionResult;
