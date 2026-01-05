import { useState, useEffect, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { toast } from "react-hot-toast";
import {
  FiEdit,
  FiEye,
  FiEyeOff,
  FiX,
  FiDownload,
  FiFileText,
  FiExternalLink,
  FiRefreshCw,
  FiTrash2,
} from "react-icons/fi";
import Loading from "@/components/Loading";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import DeleteConfirmationIcon from "@/components/DeleteConfimationIcon";

interface ExamFormData {
  exam_name: string;
  exam_year: number;
  levels: number[];
  start_date: string;
  end_date: string;
  result_date: string;
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
  const [formData, setFormData] = useState<ExamFormData>({
    exam_name: "",
    exam_year: new Date().getFullYear(),
    levels: [],
    start_date: "",
    end_date: "",
    result_date: "",
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    if (type === "checkbox") {
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
        toast.success("Exam updated successfully");
      } else {
        await axios.post("/api/exams/addExam", {
          exams: [formData],
        });
        toast.success("Exam added successfully");
      }

      resetForm();
      fetchExamList();
    } catch (error) {
      const err = error as AxiosError<{ error: string }>;
      toast.error(err.response?.data?.error || "Operation failed");
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      exam_name: "",
      exam_year: new Date().getFullYear(),
      levels: [],
      start_date: "",
      end_date: "",
      result_date: "",
    });
    setEditingExam(null);
    setIsFormVisible(false);
  };

  const fetchExamList = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get<{ data: Exam[] }>("/api/exams/getExams");

      setExamList(
        data.data
          .filter((exam) => exam.exam_year === currentYear)
          .sort(
            (a, b) =>
              new Date(a.start_date).getTime() -
              new Date(b.start_date).getTime()
          )
      );
    } catch (error) {
      console.error("Failed to fetch exams:", error);
    }
    setIsLoading(false);
  }, [currentYear]);

  const handleVisibilityChange = async (
    examId: number,
    newVisibility: boolean
  ) => {
    try {
      const result = await axios.put<{ success: boolean }>(
        `/api/exams/updateVisibility/${examId}`,
        {
          visible: newVisibility,
        }
      );

      if (!result.data.success) {
        toast.error("Error in result publishing");
        return;
      }
      if (newVisibility) {
        toast.success("Result has been published");
      } else {
        toast.success("Result has been hidden");
      }
      fetchExamList();
    } catch {
      toast.error("Failed to update visibility");
    }
  };

  const handleEditExam = (exam: Exam) => {
    setFormData({
      exam_name: exam.exam_name,
      exam_year: exam.exam_year,
      levels: exam.levels,
      start_date: exam.start_date?.split("T")[0] || "",
      end_date: exam.end_date?.split("T")[0] || "",
      result_date: exam.result_date?.split("T")[0] || "",
    });
    setEditingExam(exam);
    setIsFormVisible(true);
  };

  const confirmDelete = async (examToDelete: number) => {
    try {
      await axios.delete(`/api/exams/deleteExam/${examToDelete}`);
      toast.success("Exam deleted successfully");
      fetchExamList();
    } catch {
      toast.error("Failed to delete exam");
    }
  };

  const handlePDFUpload = async (examId: number, file: File) => {
    if (!file) return;
    setUploadingExamId(examId);
    setUploadProgress((prev) => ({ ...prev, [examId]: 0 }));
    setUploadSuccess((prev) => ({ ...prev, [examId]: false }));
    setUploadError((prev) => ({ ...prev, [examId]: null }));
    setSelectedFiles((prev) => ({ ...prev, [examId]: file.name }));

    const formData = new FormData();
    formData.append("pdf", file);

    try {
      await axios.post(`/api/exams/uploadRoutinePDF/${examId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || 1;
          const percent = Math.round((progressEvent.loaded * 100) / total);
          setUploadProgress((prev) => ({ ...prev, [examId]: percent }));
        },
      });
      setUploadSuccess((prev) => ({ ...prev, [examId]: true }));
      toast.success("PDF uploaded successfully");
      setTimeout(() => {
        setSelectedFiles((prev) => ({ ...prev, [examId]: null }));
        fetchExamList();
      }, 2000);
    } catch (err) {
      const error = err as AxiosError<{ error: string }>;
      setUploadError((prev) => ({
        ...prev,
        [examId]: error.response?.data?.error || "Upload failed",
      }));
      toast.error("PDF upload failed");
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
    if (!window.confirm("Are you sure you want to remove the PDF routine?"))
      return;
    try {
      await axios.delete(`/api/exams/removeRoutinePDF/${examId}`);
      toast.success("PDF routine removed");
      fetchExamList();
    } catch {
      toast.error("Failed to remove PDF routine");
    }
  };

  useEffect(() => {
    fetchExamList();
  }, [fetchExamList]);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-light ">Exam Management</h1>
        <Button
          type="button"
          variant={isFormVisible ? "outline" : undefined}
          onClick={() => setIsFormVisible((prev) => !prev)}
        >
          {isFormVisible ? "Cancel" : "+ Add New Exam"}
        </Button>
      </div>

      {isFormVisible && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-medium mb-4">
            {editingExam ? "Edit Exam" : "Create New Exam"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal mb-1">
                  Exam Name
                </label>
                <select
                  name="exam_name"
                  value={formData.exam_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Exam</option>
                  {[
                    "Half Yearly",
                    "Annual",
                    "Pre Test",
                    "Annual/Test",
                    "Test",
                  ].map((exam) => (
                    <option key={exam} value={`${exam} Exam`}>
                      {exam} Exam
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-normal mb-1">Year</label>
                <input
                  type="number"
                  name="exam_year"
                  value={formData.exam_year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-normal mb-1">Classes</label>
              <div className="flex flex-wrap gap-3">
                {[6, 7, 8, 9, 10].map((level) => (
                  <label key={level} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="levels"
                      value={level}
                      checked={formData.levels.includes(level)}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm">Class {level}</span>
                  </label>
                ))}
              </div>
              {levelError && (
                <p className="mt-1 text-xs text-red-500">
                  Please select at least one class
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-normal mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 dark:bg-accent py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-normal mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-normal mb-1">
                  Result Date
                </label>
                <input
                  type="date"
                  name="result_date"
                  value={formData.result_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
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
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm"
              >
                {editingExam ? "Update Exam" : "Create Exam"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-lg shadow-sm border min-w-fit border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Published
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  PDF Routine
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-2">
                    <div className="flex justify-center items-center w-full h-full">
                      <Loading />
                    </div>
                  </td>
                </tr>
              ) : examList.length > 0 ? (
                examList.map((exam) => (
                  <tr key={exam.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium">
                        {exam.exam_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{exam.exam_year}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        {exam.levels.map((l) => (
                          <span
                            key={l}
                            className="inline-flex items-center mr-2"
                          >
                            Class {l}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm space-y-1">
                        <div>
                          Start:{" "}
                          {format(new Date(exam.start_date), "dd MMM yyyy")}
                        </div>
                        <div>
                          End: {format(new Date(exam.end_date), "dd MMM yyyy")}
                        </div>
                        <div>
                          Result:{" "}
                          {format(new Date(exam.result_date), "dd MMM yyyy")}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            handleVisibilityChange(exam.id, !exam.visible)
                          }
                          className={`p-1 rounded-full ${exam.visible ? "text-green-500" : "text-gray-400"
                            }`}
                        >
                          {exam.visible ? (
                            <FiEye size={18} />
                          ) : (
                            <FiEyeOff size={18} />
                          )}
                        </button>
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${exam.visible
                              ? "bg-green-100 text-green-700"
                              : "dark:bg-card bg-gray-100"
                            }`}
                        >
                          {exam.visible ? "Published" : "Hidden"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {exam.routine ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={exam.routine}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 flex items-center"
                              title="View PDF"
                            >
                              <FiExternalLink size={18} />
                            </a>
                            <a
                              href={
                                exam.download_url ||
                                exam.routine.replace(
                                  "/upload/",
                                  "/upload/fl_attachment/"
                                )
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-green-600 hover:text-green-800 flex items-center"
                              title="Download PDF"
                            >
                              <FiDownload size={18} />
                            </a>
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.target as HTMLFormElement;
                                const fileInput = form.elements.namedItem(`pdf-${exam.id}`) as HTMLInputElement;
                                const file = fileInput.files?.[0];
                                if (file) handlePDFUpload(exam.id, file);
                              }}
                              className="flex items-center"
                            >
                              <label
                                htmlFor={`pdf-${exam.id}`}
                                className="cursor-pointer text-gray-500 hover:text-blue-600 flex items-center"
                                title="Replace PDF"
                              >
                                <FiRefreshCw size={18} />
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
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </label>
                              {uploadingExamId === exam.id && (
                                <span className="text-xs text-blue-500 ml-2">
                                  {uploadProgress[exam.id] || 0}%
                                </span>
                              )}
                              {uploadSuccess[exam.id] && (
                                <span className="text-xs text-green-600 ml-2">
                                  ✓
                                </span>
                              )}
                              {uploadError[exam.id] && (
                                <span className="text-xs text-red-500 ml-2">
                                  {uploadError[exam.id]}
                                </span>
                              )}
                            </form>
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 ml-1"
                              title="Remove PDF"
                              onClick={() => handleRemovePDF(exam.id)}
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.target as HTMLFormElement;
                              const fileInput = form.elements.namedItem(`pdf-${exam.id}`) as HTMLInputElement;
                              const file = fileInput.files?.[0];
                              if (file) handlePDFUpload(exam.id, file);
                            }}
                            className="flex items-center gap-2"
                          >
                            {selectedFiles[exam.id] ? (
                              <div className="flex items-center gap-2 bg-gray-100 dark:bg-card px-2 py-1 rounded text-xs">
                                <FiFileText className="text-blue-500" />
                                <span
                                  className="truncate max-w-[120px]"
                                  title={typeof selectedFiles[exam.id] === "string" ? (selectedFiles[exam.id] as string) : undefined}
                                >
                                  {selectedFiles[exam.id] &&
                                    typeof selectedFiles[exam.id] === "string" &&
                                    (selectedFiles[exam.id] as string).length > 25
                                    ? (selectedFiles[exam.id] as string).slice(0, 12) +
                                    "..." +
                                    (selectedFiles[exam.id] as string).slice(-10)
                                    : selectedFiles[exam.id] || ""}
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
                                  <FiX />
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
                                    e.target.value = "";
                                  }
                                }}
                              />
                            )}
                            {uploadingExamId === exam.id && (
                              <span className="text-xs text-blue-500 ml-2">
                                {uploadProgress[exam.id] || 0}%
                              </span>
                            )}
                            {uploadSuccess[exam.id] && (
                              <span className="text-xs text-green-600 ml-2">
                                ✓
                              </span>
                            )}
                            {uploadError[exam.id] && (
                              <span className="text-xs text-red-500 ml-2">
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
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <FiEdit className="sm:w-4 sm:h-4 w-3 h-3" />
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
                  <td
                    className="px-6 py-4 whitespace-nowrap text-center"
                    colSpan={7}
                  >
                    No exams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ExamPDFRoutine;
