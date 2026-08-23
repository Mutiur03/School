import { useState, useEffect, useCallback, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import { toast } from 'react-hot-toast';
import {
  Pencil,
  Eye,
  EyeOff,
  X,
  Download,
  FileText,
  ExternalLink,
  RefreshCw,
  Trash2,
  ClipboardList,
} from 'lucide-react';
import Loading from '@/components/Loading';
import { MarksheetGenProgress } from '@/components/MarksheetGenProgress';
import { BundleStalePreview } from '@/components/BundleStalePreview';
import {
  isMarksheetGenComplete,
  MARKSHEET_GEN_POLL_MS,
  type MarksheetGenStatus,
} from '@/queries/marks.queries';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import DeleteConfirmationIcon from '@/components/DeleteConfimationIcon';
import { uploadToR2 } from '@/lib/uploadToR2';
import { getFileUrl } from '@/lib/backend';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { PageHeader, SectionCard } from '@/components';

interface ExamFormData {
  exam_name: string;
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
  return_date: string;
}

interface Exam extends ExamFormData {
  id: number;
  visible: boolean;
  routine?: string;
  download_url?: string;
}

interface UploadState {
  [key: number]: number | boolean | string | null;
}

function ExamPDFRoutine() {
  const { confirm, dialog } = useConfirmDialog();
  const [formData, setFormData] = useState<ExamFormData>({
    exam_name: '',
    exam_year: new Date().getFullYear(),
    levels: [],
    start_date: '',
    end_date: '',
    result_date: '',
    return_date: '',
  });
  const currentYear = new Date().getFullYear();

  const [examList, setExamList] = useState<Exam[]>([]);
  const [levelError, setLevelError] = useState<boolean>(false);
  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isFormVisible, setIsFormVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [uploadingExamId, setUploadingExamId] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadState>({});
  const [uploadSuccess, setUploadSuccess] = useState<UploadState>({});
  const [uploadError, setUploadError] = useState<UploadState>({});
  const [selectedFiles, setSelectedFiles] = useState<UploadState>({});

  // Marksheet pre-generation progress, keyed by exam id.
  const [genStatus, setGenStatus] = useState<Record<number, MarksheetGenStatus>>({});
  const pollRefs = useRef<Record<number, ReturnType<typeof setInterval>>>({});

  const stopPolling = (examId: number) => {
    const handle = pollRefs.current[examId];
    if (handle) {
      clearInterval(handle);
      delete pollRefs.current[examId];
    }
  };

  const fetchGenStatus = async (examId: number) => {
    try {
      const { data } = await axios.get<{ data: MarksheetGenStatus }>(
        `/api/marks/generation-status/${examId}`,
      );
      setGenStatus((prev) => ({ ...prev, [examId]: data.data }));
      if (isMarksheetGenComplete(data.data)) stopPolling(examId);
      return data.data;
    } catch {
      return undefined;
    }
  };

  const startPolling = (examId: number) => {
    stopPolling(examId);
    let ticks = 0;
    pollRefs.current[examId] = setInterval(async () => {
      ticks += 1;
      const status = await fetchGenStatus(examId);
      // Stop when everything is generated, or after a safety cap (~10 min).
      if (isMarksheetGenComplete(status) || ticks > 75) stopPolling(examId);
    }, MARKSHEET_GEN_POLL_MS);
  };

  // Clear any live intervals on unmount.
  useEffect(() => {
    const refs = pollRefs.current;
    return () => {
      Object.values(refs).forEach((h) => clearInterval(h));
    };
  }, []);

  // When the exam list loads, fetch status for published exams or any with active jobs.
  useEffect(() => {
    examList.forEach(async (e) => {
      const status = await fetchGenStatus(e.id);
      const active =
        !!status &&
        (status.pending > 0 ||
          status.generating > 0 ||
          status.bundles.pending > 0 ||
          status.bundles.generating > 0);
      if (
        status &&
        status.total > 0 &&
        (e.visible || active) &&
        !isMarksheetGenComplete(status) &&
        !pollRefs.current[e.id]
      ) {
        startPolling(e.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examList]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (type === 'checkbox') {
      const level = parseInt(value);
      const updatedLevels = checked
        ? [...formData.levels, level]
        : formData.levels.filter((cls) => cls !== level);
      setFormData({ ...formData, levels: updatedLevels });
      if (updatedLevels.length > 0) setLevelError(false);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (formData.levels.length === 0) {
      setLevelError(true);
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingExam) {
        await axios.put(`/api/exams/updateExam/${editingExam.id}`, formData);
        toast.success('Exam updated successfully');
      } else {
        await axios.post('/api/exams/addExam', {
          exams: [formData],
        });
        toast.success('Exam added successfully');
      }

      resetForm();
      fetchExamList();
    } catch (error) {
      const err = error as AxiosError<{ error: string }>;
      toast.error(err.response?.data?.error || 'Operation failed');
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      exam_name: '',
      exam_year: new Date().getFullYear(),
      levels: [],
      start_date: '',
      end_date: '',
      result_date: '',
      return_date: '',
    });
    setEditingExam(null);
    setIsFormVisible(false);
  };

  const fetchExamList = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get<{ data: Exam[] }>('/api/exams/getExams');

      setExamList(
        data.data
          .filter((exam) => exam.exam_year === currentYear)
          .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()),
      );
    } catch (error) {
      console.error('Failed to fetch exams:', error);
    }
    setIsLoading(false);
  }, [currentYear]);

  const handleVisibilityChange = async (examId: number, newVisibility: boolean) => {
    try {
      const result = await axios.put<{ success: boolean; queued?: number }>(
        `/api/exams/updateVisibility/${examId}`,
        {
          visible: newVisibility,
        },
      );

      if (!result.data.success) {
        toast.error('Error in result publishing');
        return;
      }
      if (newVisibility) {
        const queued = result.data.queued ?? 0;
        toast.success(
          queued > 0
            ? `Result published — generating ${queued} marksheet${queued === 1 ? '' : 's'}…`
            : 'Result has been published',
        );
        const status = await fetchGenStatus(examId);
        if (status && !isMarksheetGenComplete(status)) startPolling(examId);
      } else {
        toast.success('Result has been hidden');
        const status = await fetchGenStatus(examId);
        if (status && !isMarksheetGenComplete(status)) {
          if (!pollRefs.current[examId]) startPolling(examId);
        } else {
          stopPolling(examId);
          setGenStatus((prev) => {
            const next = { ...prev };
            delete next[examId];
            return next;
          });
        }
      }
      fetchExamList();
    } catch {
      toast.error('Failed to update visibility');
    }
  };

  const handleEditExam = (exam: Exam) => {
    setFormData({
      exam_name: exam.exam_name,
      exam_year: exam.exam_year,
      levels: exam.levels,
      start_date: exam.start_date?.split('T')[0] || '',
      end_date: exam.end_date?.split('T')[0] || '',
      result_date: exam.result_date?.split('T')[0] || '',
      return_date: exam.return_date?.split('T')[0] || '',
    });
    setEditingExam(exam);
    setIsFormVisible(true);
  };

  const confirmDelete = async (examToDelete: number) => {
    try {
      await axios.delete(`/api/exams/deleteExam/${examToDelete}`);
      toast.success('Exam deleted successfully');
      fetchExamList();
    } catch {
      toast.error('Failed to delete exam');
    }
  };

  const handlePDFUpload = async (examId: number, file: File) => {
    if (!file) return;
    setUploadingExamId(examId);
    setUploadProgress((prev) => ({ ...prev, [examId]: 0 }));
    setUploadSuccess((prev) => ({ ...prev, [examId]: false }));
    setUploadError((prev) => ({ ...prev, [examId]: null }));
    setSelectedFiles((prev) => ({ ...prev, [examId]: file.name }));

    try {
      // Step 1: upload directly to R2
      const key = await uploadToR2('/api/exams/presigned-url', file, (pct) =>
        setUploadProgress((prev) => ({ ...prev, [examId]: pct })),
      );

      // Step 2: save key to exam record
      await axios.post(`/api/exams/uploadRoutinePDF/${examId}`, { key });

      setUploadSuccess((prev) => ({ ...prev, [examId]: true }));
      toast.success('PDF uploaded successfully');
      setTimeout(() => {
        setSelectedFiles((prev) => ({ ...prev, [examId]: null }));
        fetchExamList();
      }, 2000);
    } catch (err) {
      const error = err as AxiosError<{ error: string }>;
      setUploadError((prev) => ({
        ...prev,
        [examId]: error.response?.data?.error || 'Upload failed',
      }));
      toast.error('PDF upload failed');
    } finally {
      setUploadingExamId(null);
      setTimeout(() => {
        setUploadProgress((prev) => ({ ...prev, [examId]: 0 }));
        setUploadSuccess((prev) => ({ ...prev, [examId]: false }));
        setUploadError((prev) => ({ ...prev, [examId]: null }));
      }, 2000);
    }
  };

  const handleRemovePDF = async (examId: number) => {
    const ok = await confirm({
      title: 'Remove PDF routine?',
      msg: 'Are you sure you want to remove the PDF routine?',
      confirmLabel: 'Remove PDF',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/exams/removeRoutinePDF/${examId}`);
      toast.success('PDF routine removed');
      fetchExamList();
    } catch {
      toast.error('Failed to remove PDF routine');
    }
  };

  useEffect(() => {
    fetchExamList();
  }, [fetchExamList]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader
        title="Exam Management"
        description="Create exams, publish results, and manage PDF routines."
      >
        <Button
          type="button"
          variant={isFormVisible ? 'outline' : undefined}
          onClick={() => setIsFormVisible((prev) => !prev)}
        >
          {isFormVisible ? 'Cancel' : '+ Add New Exam'}
        </Button>
      </PageHeader>

      {isFormVisible && (
        <SectionCard
          title={editingExam ? 'Edit Exam' : 'Create New Exam'}
          icon={<ClipboardList size={20} />}
          className="mb-8"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-normal">Exam Name</label>
                <select
                  name="exam_name"
                  value={formData.exam_name}
                  onChange={handleChange}
                  required
                  className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                >
                  {['Half Yearly', 'Annual', 'Pretest', 'Annual/Test', 'Test'].map((exam) => (
                    <option key={exam} value={`${exam} Examination`}>
                      {exam} Examination
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-normal">Year</label>
                <input
                  type="number"
                  name="exam_year"
                  value={formData.exam_year}
                  onChange={handleChange}
                  required
                  className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-normal">Classes</label>
              <div className="flex flex-wrap gap-3">
                {[6, 7, 8, 9, 10].map((level) => (
                  <label key={level} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="levels"
                      value={level}
                      checked={formData.levels.includes(level)}
                      onChange={handleChange}
                      className="text-primary border-border focus:ring-primary/20 h-4 w-4 rounded"
                    />
                    <span className="ml-2 text-sm">Class {level}</span>
                  </label>
                ))}
              </div>
              {levelError && (
                <p className="mt-1 text-xs text-red-500">Please select at least one class</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-normal">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-normal">End Date</label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-normal">Result Date</label>
                <input
                  type="date"
                  name="result_date"
                  value={formData.result_date}
                  onChange={handleChange}
                  required
                  className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-normal">
                  Marksheet Return Date <span className="text-muted-foreground">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    name="return_date"
                    value={formData.return_date}
                    onChange={handleChange}
                    className="dark:bg-accent border-border focus:ring-primary/20 w-full rounded border px-3 py-2 focus:border-blue-500 focus:ring-1"
                  />
                  {formData.return_date && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormData({ ...formData, return_date: '' })}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="px-4 py-2 text-sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="px-4 py-2 text-sm">
                {editingExam ? 'Update Exam' : 'Create Exam'}
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title="Exams" noPadding>
        {/* Desktop table */}
        <div className="hidden max-w-full overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] lg:block">
          <table className="w-full min-w-[640px] divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="bg-card border-border/50 sticky left-0 z-20 border-r px-6 py-3 text-left text-xs font-medium tracking-wider uppercase shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  PDF Routine
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-2">
                    <div className="flex h-full w-full items-center justify-center">
                      <Loading />
                    </div>
                  </td>
                </tr>
              ) : examList.length > 0 ? (
                examList.map((exam) => (
                  <tr key={exam.id}>
                    <td className="bg-card border-border/50 sticky left-0 z-10 border-r px-6 py-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                      <div className="text-sm font-medium">{exam.exam_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{exam.exam_year}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {exam.levels.map((l) => (
                          <span key={l} className="mr-2 inline-flex items-center">
                            Class {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-sm">
                        <div>Start: {format(new Date(exam.start_date), 'dd MMM yyyy')}</div>
                        <div>End: {format(new Date(exam.end_date), 'dd MMM yyyy')}</div>
                        <div>Result: {format(new Date(exam.result_date), 'dd MMM yyyy')}</div>
                        <div>
                          Return:{' '}
                          {exam.return_date
                            ? format(new Date(exam.return_date), 'dd MMM yyyy')
                            : '-'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <button
                          onClick={() => handleVisibilityChange(exam.id, !exam.visible)}
                          className={`rounded-full p-1 ${
                            exam.visible ? 'text-green-500' : 'text-gray-400'
                          }`}
                        >
                          {exam.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                        </button>
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                            exam.visible ? 'bg-green-100 text-green-700' : 'dark:bg-card bg-muted'
                          }`}
                        >
                          {exam.visible ? 'Published' : 'Hidden'}
                        </span>
                      </div>
                      {(() => {
                        const status = genStatus[exam.id];
                        const active =
                          !!status &&
                          (status.pending > 0 ||
                            status.generating > 0 ||
                            status.bundles.pending > 0 ||
                            status.bundles.generating > 0);
                        if (!exam.visible) {
                          return (
                            <p className="text-muted-foreground mt-2 max-w-44 text-[10px] leading-tight">
                              {active
                                ? 'Finishing background jobs…'
                                : 'Hidden — marksheets refresh on publish or download'}
                            </p>
                          );
                        }
                        if (!status) return null;
                        return (
                          <div className="flex flex-col gap-1">
                            <MarksheetGenProgress status={status} compact />
                            <BundleStalePreview
                              items={status.bundles.staleItems}
                              variant="inline"
                            />
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {exam.routine ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={getFileUrl(exam.routine)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary flex items-center hover:text-blue-800"
                              title="View PDF"
                            >
                              <ExternalLink size={18} />
                            </a>
                            <a
                              href={getFileUrl(exam.download_url || exam.routine)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-green-600 hover:text-green-800"
                              title="Download PDF"
                            >
                              <Download size={18} />
                            </a>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const fileInput = form.elements.namedItem(
                                  `pdf-${exam.id}`,
                                ) as HTMLInputElement;
                                const file = fileInput.files?.[0];
                                if (file) handlePDFUpload(exam.id, file);
                              }}
                              className="flex items-center"
                            >
                              <label
                                htmlFor={`pdf-${exam.id}`}
                                className="text-muted-foreground hover:text-primary flex cursor-pointer items-center"
                                title="Replace PDF"
                              >
                                <RefreshCw size={18} />
                                <input
                                  type="file"
                                  id={`pdf-${exam.id}`}
                                  name={`pdf-${exam.id}`}
                                  accept="application/pdf"
                                  className="hidden"
                                  disabled={uploadingExamId === exam.id}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handlePDFUpload(exam.id, file);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                              {uploadingExamId === exam.id && (
                                <span className="text-primary ml-2 text-xs">
                                  {uploadProgress[exam.id] || 0}%
                                </span>
                              )}
                              {uploadSuccess[exam.id] && (
                                <span className="ml-2 text-xs text-green-600">✓</span>
                              )}
                              {uploadError[exam.id] && (
                                <span className="ml-2 text-xs text-red-500">
                                  {uploadError[exam.id]}
                                </span>
                              )}
                            </form>
                            <button
                              type="button"
                              className="ml-1 text-red-500 hover:text-red-700"
                              title="Remove PDF"
                              onClick={() => handleRemovePDF(exam.id)}
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const fileInput = form.elements.namedItem(
                                `pdf-${exam.id}`,
                              ) as HTMLInputElement;
                              const file = fileInput.files?.[0];
                              if (file) handlePDFUpload(exam.id, file);
                            }}
                            className="flex items-center gap-2"
                          >
                            {selectedFiles[exam.id] ? (
                              <div className="bg-muted dark:bg-card flex items-center gap-2 rounded px-2 py-1 text-xs">
                                <FileText className="text-primary" />
                                <span
                                  className="max-w-30 truncate"
                                  title={
                                    typeof selectedFiles[exam.id] === 'string'
                                      ? (selectedFiles[exam.id] as string)
                                      : undefined
                                  }
                                >
                                  {selectedFiles[exam.id] &&
                                  typeof selectedFiles[exam.id] === 'string' &&
                                  (selectedFiles[exam.id] as string).length > 25
                                    ? (selectedFiles[exam.id] as string).slice(0, 12) +
                                      '...' +
                                      (selectedFiles[exam.id] as string).slice(-10)
                                    : selectedFiles[exam.id] || ''}
                                </span>
                                <button
                                  type="button"
                                  className="ml-2 text-gray-400 hover:text-red-500"
                                  title="Remove"
                                  onClick={() =>
                                    setSelectedFiles((prev) => ({
                                      ...prev,
                                      [exam.id]: null,
                                    }))
                                  }
                                >
                                  <X />
                                </button>
                              </div>
                            ) : (
                              <input
                                type="file"
                                name={`pdf-${exam.id}`}
                                accept="application/pdf"
                                className="block w-full text-xs"
                                disabled={uploadingExamId === exam.id}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setSelectedFiles((prev) => ({
                                      ...prev,
                                      [exam.id]: file.name,
                                    }));
                                    handlePDFUpload(exam.id, file);
                                    e.target.value = '';
                                  }
                                }}
                              />
                            )}
                            {uploadingExamId === exam.id && (
                              <span className="text-primary ml-2 text-xs">
                                {uploadProgress[exam.id] || 0}%
                              </span>
                            )}
                            {uploadSuccess[exam.id] && (
                              <span className="ml-2 text-xs text-green-600">✓</span>
                            )}
                            {uploadError[exam.id] && (
                              <span className="ml-2 text-xs text-red-500">
                                {uploadError[exam.id]}
                              </span>
                            )}
                          </form>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditExam(exam)}
                        className="text-primary mr-3 hover:text-blue-900"
                      >
                        <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
                      </button>

                      <DeleteConfirmationIcon
                        onDelete={() => confirmDelete(exam.id)}
                        msg="This action cannot be undone. This will permanently delete the item from your database."
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-6 py-4 text-center whitespace-nowrap" colSpan={7}>
                    No exams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="lg:hidden">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loading />
            </div>
          ) : examList.length > 0 ? (
            <ul className="space-y-3 p-4">
              {examList.map((exam) => {
                const status = genStatus[exam.id];
                const active =
                  !!status &&
                  (status.pending > 0 ||
                    status.generating > 0 ||
                    status.bundles.pending > 0 ||
                    status.bundles.generating > 0);
                return (
                  <li
                    key={exam.id}
                    className="border-border bg-card space-y-3 rounded-xl border p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold wrap-break-word">{exam.exam_name}</p>
                        <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                          Year {exam.exam_year}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditExam(exam)}
                          aria-label={`Edit ${exam.exam_name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DeleteConfirmationIcon
                          onDelete={() => confirmDelete(exam.id)}
                          msg="This action cannot be undone. This will permanently delete the item from your database."
                        />
                      </div>
                    </div>

                    <p className="text-muted-foreground text-xs">
                      {exam.levels.map((l) => `Class ${l}`).join(', ')}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVisibilityChange(exam.id, !exam.visible)}
                        className={`rounded-full p-1 ${
                          exam.visible ? 'text-green-500' : 'text-gray-400'
                        }`}
                        aria-label={exam.visible ? 'Hide result' : 'Publish result'}
                      >
                        {exam.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          exam.visible ? 'bg-green-100 text-green-700' : 'dark:bg-card bg-muted'
                        }`}
                      >
                        {exam.visible ? 'Published' : 'Hidden'}
                      </span>
                    </div>

                    {!exam.visible ? (
                      <p className="text-muted-foreground text-[10px] leading-tight">
                        {active
                          ? 'Finishing background jobs…'
                          : 'Hidden — marksheets refresh on publish or download'}
                      </p>
                    ) : status ? (
                      <div className="flex flex-col gap-1">
                        <MarksheetGenProgress status={status} compact />
                        <BundleStalePreview items={status.bundles.staleItems} variant="inline" />
                      </div>
                    ) : null}

                    {exam.routine ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <a
                          href={getFileUrl(exam.routine)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 text-xs"
                        >
                          <ExternalLink size={16} /> View
                        </a>
                        <a
                          href={getFileUrl(exam.download_url || exam.routine)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-green-600"
                        >
                          <Download size={16} /> Download
                        </a>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-red-500"
                          onClick={() => handleRemovePDF(exam.id)}
                        >
                          <Trash2 size={16} /> Remove PDF
                        </button>
                      </div>
                    ) : (
                      <label className="text-muted-foreground block text-xs">
                        Upload PDF routine
                        <input
                          type="file"
                          accept="application/pdf"
                          className="mt-1 block w-full text-xs"
                          disabled={uploadingExamId === exam.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handlePDFUpload(exam.id, file);
                              e.target.value = '';
                            }
                          }}
                        />
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground px-4 py-12 text-center text-sm">No exams found</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

export default ExamPDFRoutine;
