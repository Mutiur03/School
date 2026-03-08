import axios from "axios";
import React, { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import Loading from "@/components/Loading";
import { PageHeader, SectionCard, StatsCard, Popup, ConfirmationPopup } from "@/components";
import DeleteConfirmation from "@/components/DeleteConfimation";
import ActionButton from "@/components/ActionButton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  studentFormSchema,
  VALID_DEPARTMENTS,
  toExcelString,
  normalizeExcelDate,
  formatDobForDateInput,
  type StudentFormSchemaData,
} from "@school/shared-schemas";
import { Input } from "@/components/ui/input";
import ErrorMessage from "@/components/ErrorMessage";
import { getFileUrl } from "@/lib/backend";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Student {
  id: number;
  login_id: number;
  name: string;
  father_name: string;
  mother_name: string;
  father_phone?: string;
  mother_phone?: string;
  village?: string;
  post_office?: string;
  upazila?: string;
  district?: string;
  roll: number;
  section: string;
  dob: string;
  class: number;
  department: string;
  has_stipend: boolean;
  available: boolean;
  image?: string;
  enrollment_id: number;
}

type StudentFormData = StudentFormSchemaData;

const defaultFormValues: StudentFormData = {
  name: "",
  father_name: "",
  mother_name: "",
  father_phone: "",
  mother_phone: "",
  roll: "",
  section: "",
  village: "",
  post_office: "",
  upazila: "",
  district: "",
  dob: "",
  class: "",
  department: "",
  has_stipend: false,
  available: true,
};

const excelRequiredHeaders = [
  "name",
  "father_name",
  "mother_name",
  "father_phone",
  "dob",
  "class",
  "roll",
  "section",
];

const demoExcelColumns = [
  "name",
  "father_name",
  "mother_name",
  "father_phone",
  "mother_phone",
  "village",
  "post_office",
  "upazila",
  "district",
  "dob",
  "class",
  "roll",
  "section",
  "department",
  "has_stipend",
];

function StudentList() {
  const queryClient = useQueryClient();
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const currentYear = new Date().getFullYear();
  const [popup, setPopup] = useState<{
    visible: boolean;
    type: string;
    student: Student | null;
  }>({
    visible: false,
    type: "",
    student: null,
  });
  const [showForm, setShowForm] = useState(false);
  const [isExcelUpload, setIsExcelUpload] = useState(false);
  const [jsonData, setJsonData] = useState<Record<string, unknown>[] | null>(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [excelfile, setexcelfile] = useState<File | null>(null);
  const fileref = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkRotateOpen, setBulkRotateOpen] = useState(false);

  const {
    register,
    handleSubmit: handleFormSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StudentFormData>({
    defaultValues: defaultFormValues,
    resolver: zodResolver(studentFormSchema),
    criteriaMode: "firstError",
    mode: "onBlur",
  });

  const watchedClass = Number(watch("class") || "0");

  useEffect(() => {
    if (watchedClass !== 9 && watchedClass !== 10) {
      setValue("department", "");
    }
  }, [watchedClass, setValue]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const invalidateStudents = () =>
    queryClient.invalidateQueries({ queryKey: ["students", year] });

  const { data: studentsData, isLoading: loading, error: studentsError } = useQuery({
    queryKey: ["students", year],
    queryFn: async () => {
      const response = await axios.get(`/api/students`, {
        params: { year },
      });
      return (response.data.data || []).filter(
        (student: Student) => student.class >= 1 && student.class <= 10
      ) as Student[];
    },
  });
  const students = useMemo(() => studentsData ?? [], [studentsData]);
  const errorMessage = studentsError
    ? ((studentsError as { response?: { status?: number } }).response?.status === 404
      ? "No students found for the selected year."
      : "An error occurred while fetching students.")
    : "";

  const uploadImageToR2 = async (file: File, studentId: number) => {
    const key = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { data } = await axios.post(`/api/students/${studentId}/image/upload-url`, {
      key,
      contentType: file.type,
    });
    await fetch(data.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    await axios.put(`/api/students/${studentId}/image`, {
      key: data.key,
    });
  };

  const imageUploadMutation = useMutation({
    mutationFn: async ({ file, student }: { file: File; student: Student }) => {
      await uploadImageToR2(file, student.id);
    },
    onSuccess: () => invalidateStudents(),
    onError: () => toast.error("Failed to upload image."),
  });

  const handleIndivisualImageUpload = (e: React.ChangeEvent<HTMLInputElement>, student: Student) => {
    const file = e.target.files?.[0];
    if (!file) return;
    imageUploadMutation.mutate({ file, student });
  };

  const handleEdit = (student: Student) => {
    if (isExcelUpload) setIsExcelUpload(false);
    setIsEditing(true);
    setSelectedStudent(student);
    reset({
      name: student.name,
      father_name: student.father_name,
      mother_name: student.mother_name,
      father_phone: student.father_phone || "",
      mother_phone: student.mother_phone || "",
      village: student.village || "",
      post_office: student.post_office || "",
      upazila: student.upazila || "",
      district: student.district || "",
      dob: formatDobForDateInput(student.dob),
      class: student.class.toString(),
      roll: student.roll.toString(),
      section: student.section,
      department: student.department || "",
      has_stipend: Boolean(student.has_stipend),
      available: student.available,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteMutation = useMutation({
    mutationFn: (student: Student) =>
      axios.delete(`/api/students/${student.id}`),
    onSuccess: (_, student) => {
      toast.success("Student deleted successfully.");
      setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
      invalidateStudents();
    },
    onError: () => toast.error("Failed to delete student. Please try again."),
  });

  const handleDelete = (student: Student) => deleteMutation.mutate(student);

  const closePopup = () =>
    setPopup({ visible: false, type: "", student: null });

  const filteredStudents = students
    .filter((student) =>
      searchQuery
        ? student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        student.father_phone?.toString().includes(searchQuery) ||
        student.mother_phone?.toString().includes(searchQuery)
        : true
    )
    .filter((student) =>
      classFilter ? student.class === Number(classFilter) : true
    )
    .filter((student) =>
      sectionFilter ? student.section === sectionFilter : true
    )
    .sort((a, b) => a.roll - b.roll)
    .sort((a, b) => a.section.localeCompare(b.section))
    .sort((a, b) => a.class - b.class);

  const uniqueClasses = [...new Set(students.map((student) => student.class))];
  const uniqueSections = [
    ...new Set(students.map((student) => student.section)),
  ];

  const visibleStudentIds = filteredStudents.map((student) => student.id);
  const hasSelectedStudents = selectedStudentIds.length > 0;
  const selectedVisibleCount = selectedStudentIds.filter((id) =>
    visibleStudentIds.includes(id)
  ).length;
  const allVisibleSelected =
    visibleStudentIds.length > 0 && selectedVisibleCount === visibleStudentIds.length;

  const handleRowSelect = (studentId: number) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedStudentIds((prev) =>
        prev.filter((id) => !visibleStudentIds.includes(id))
      );
      return;
    }

    setSelectedStudentIds((prev) => [
      ...new Set([...prev, ...visibleStudentIds]),
    ]);
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: (studentIds: number[]) =>
      axios.delete("/api/students", { data: { studentIds } }),
    onSuccess: (response) => {
      toast.success(response.data?.message || "Selected students deleted successfully.");
      setSelectedStudentIds([]);
      invalidateStudents();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to delete selected students. Please try again.");
    },
  });

  const bulkRotateMutation = useMutation({
    mutationFn: async (studentIds: number[]) => {
      const response = await axios.post(
        "/api/students/password-rotations",
        { studentIds },
        { responseType: "blob" }
      );
      return response.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "rotated_passwords.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Passwords rotated successfully. Excel downloaded.");
      setSelectedStudentIds([]);
      invalidateStudents();
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to rotate passwords. Please try again.");
    },
  });

  const handleBulkDelete = () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student.");
      return;
    }
    setBulkDeleteOpen(true);
  };

  useEffect(() => {
    setSelectedStudentIds((prev) =>
      prev.filter((id) => students.some((student) => student.id === id))
    );
  }, [students]);

  const formMutation = useMutation({
    mutationFn: async (formValues: StudentFormData) => {
      const parsedForm = studentFormSchema.safeParse(formValues);
      if (!parsedForm.success) {
        console.error("[Student Form Validation Failed]", { input: formValues, issues: parsedForm.error.issues });
        throw new Error(parsedForm.error.issues[0]?.message || "Invalid form data");
      }
      const parsedValues = parsedForm.data as StudentFormData;
      const classNumber = Number(parsedValues.class);
      const requiresDepartment = classNumber === 9 || classNumber === 10;

      const basicDeatils: Record<string, string | boolean> = {
        name: parsedValues.name || "",
        father_name: parsedValues.father_name || "",
        mother_name: parsedValues.mother_name || "",
        father_phone: parsedValues.father_phone || "",
        mother_phone: parsedValues.mother_phone || "",
        village: parsedValues.village || "",
        post_office: parsedValues.post_office || "",
        upazila: parsedValues.upazila || "",
        district: parsedValues.district || "",
        dob: parsedValues.dob || "",
        available: Boolean(parsedValues.available),
        has_stipend: Boolean(parsedValues.has_stipend),
      };
      const academicDetails: Record<string, string> = {
        roll: parsedValues.roll || "",
        class: parsedValues.class || "",
        section: parsedValues.section || "",
        department: requiresDepartment ? parsedValues.department || "" : "",
      };

      if (isEditing && selectedStudent) {
        await axios.put(`/api/students/${selectedStudent.id}`, basicDeatils);
        await axios.patch(`/api/enrollments/${selectedStudent.enrollment_id}`, academicDetails);
        if (image) await uploadImageToR2(image, selectedStudent.id);
        return { message: "Student updated successfully." };
      } else {
        const response = await axios.post(
          "/api/students/bulk",
          {
            students: [
              {
                ...basicDeatils,
                roll: parsedValues.roll,
                class: parsedValues.class,
                section: parsedValues.section,
                department: requiresDepartment ? parsedValues.department : "",
              },
            ],
          },
          { responseType: "blob" }
        );

        if (image) await uploadImageToR2(image, response.data.data?.[0]?.id);
        return response.data;
      }
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "students_credentials.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      handleCancel();
      toast.success("Student added successfully. Credentials downloaded.");
      invalidateStudents();
    },
    onError: async (err: any) => {
      let errorMessage = "An error occurred";
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          errorMessage = json.error || json.message || errorMessage;
        } catch (e) {
          errorMessage = text || errorMessage;
        }
      } else {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      }
      toast.error(errorMessage);
    },
  });

  const onSubmit = (formValues: StudentFormData) => formMutation.mutate(formValues);
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setexcelfile(file);
    setFileUploaded(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawData = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
      }) as unknown[][];

      const headers = rawData[0]?.map((header) =>
        String(header).toLowerCase().trim()
      );

      const missingHeaders = excelRequiredHeaders.filter((field) => !headers.includes(field));
      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(", ")}`);
        setFileUploaded(false);
        setexcelfile(null);
        setJsonData(null);
        return;
      }

      const formattedData = rawData.slice(1).map((row: unknown[]) => {
        const student: Record<string, unknown> = {};
        headers.forEach((header: string, index: number) => {
          student[header] = row[index];
        });

        return {
          name: toExcelString(student.name),
          father_name: toExcelString(student.father_name),
          mother_name: toExcelString(student.mother_name),
          father_phone: toExcelString(student.father_phone),
          mother_phone: toExcelString(student.mother_phone),
          village: toExcelString(student.village),
          post_office: toExcelString(student.post_office),
          upazila: toExcelString(student.upazila),
          district: toExcelString(student.district),
          dob: normalizeExcelDate(student.dob),
          class: toExcelString(student.class),
          roll: toExcelString(student.roll),
          section: toExcelString(student.section).toUpperCase(),
          department: toExcelString(student.department),
          has_stipend: toExcelString(student.has_stipend).toLowerCase() === "yes",
          available: true,
        };
      });

      const validationErrors: string[] = [];
      formattedData.forEach((row, index) => {
        const parsed = studentFormSchema.safeParse(row);

        if (!parsed.success) {
          const issueText = parsed.error.issues
            .map((issue: { path: PropertyKey[]; message: string }) => `${issue.path.join(".") || "row"}: ${issue.message}`)
            .join(" | ");
          console.error("[Excel Row Validation Failed]", {
            rowNumber: index + 2,
            input: row,
            issues: parsed.error.issues,
          });
          validationErrors.push(
            `Row ${index + 2}: ${issueText || "Invalid data"}`
          );
        }

        const classNum = Number((row.class as string) || 0);
        if ((classNum === 9 || classNum === 10) && !(row.department as string)?.trim()) {
          console.error("[Excel Row Validation Failed]", {
            rowNumber: index + 2,
            input: row,
            issues: [{ path: ["department"], message: "Department is required for class 9-10" }],
          });
          validationErrors.push(`Row ${index + 2}: Department is required for class 9-10`);
        }
      });

      if (validationErrors.length > 0) {
        toast.error(validationErrors[0]);
        setJsonData(null);
        setFileUploaded(false);
        setexcelfile(null);
        return;
      }

      setJsonData(formattedData);

      if (formattedData.length > 500) {
        toast.error(`Maximum 500 students allowed per upload. Your file has ${formattedData.length}.`);
        setJsonData(null);
        setFileUploaded(false);
        setexcelfile(null);
        return;
      }

      toast.success(`Loaded ${formattedData.length} students successfully.`);
    };
    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
    };
  };

  const handleDownloadDemoExcel = () => {
    const demoData = [
      {
        name: "Rahim Uddin",
        father_name: "Karim Uddin",
        mother_name: "Ayesha Begum",
        father_phone: "01712345678",
        mother_phone: "01812345678",
        village: "Shantinagar",
        post_office: "Sadar",
        upazila: "Sadar",
        district: "Dhaka",
        dob: "15/08/2008",
        class: "8",
        roll: "12",
        section: "A",
        department: "",
        has_stipend: "No",
      },
      {
        name: "Nusrat Jahan",
        father_name: "Mizanur Rahman",
        mother_name: "Shirin Akter",
        father_phone: "01912345678",
        mother_phone: "01612345678",
        village: "Uttar Para",
        post_office: "Town",
        upazila: "Kotwali",
        district: "Chattogram",
        dob: "20/01/2007",
        class: "9",
        roll: "5",
        section: "B",
        department: "Science",
        has_stipend: "Yes",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(demoData, {
      header: demoExcelColumns,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "student_upload_demo.xlsx");
    toast.success("Demo Excel downloaded.");
  };

  const excelMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>[]) => {
      const response = await axios.post(
        "/api/students/bulk",
        { students: data },
        { responseType: "blob" },
      );
      return response.data;
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "students_credentials.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success("Students uploaded successfully. Credentials downloaded.");
      setJsonData(null);
      setFileUploaded(false);
      setexcelfile(null);
      setIsExcelUpload(false);
      setShowForm(false);
      const excelInput = document.querySelector('input[name="excelFile"]') as HTMLInputElement;
      if (excelInput) excelInput.value = "";
      invalidateStudents();
    },
    onError: async (err: any) => {
      let errorMessage = "Failed to upload students.";
      if (err.response?.data instanceof Blob) {
        const text = await err.response.data.text();
        try {
          const json = JSON.parse(text);
          errorMessage = json.message || json.error || errorMessage;
        } catch (e) {
          errorMessage = text || errorMessage;
        }
      } else {
        errorMessage = err.response?.data?.message || err.message || errorMessage;
      }
      toast.error(errorMessage);
    },
  });

  const sendToBackend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!jsonData || jsonData.length === 0) {
      toast.error("No data to upload. Please check your Excel file.");
      return;
    }
    const failedRow = jsonData.findIndex((row) => !studentFormSchema.safeParse(row).success);
    if (failedRow !== -1) {
      const failed = studentFormSchema.safeParse(jsonData[failedRow]);
      if (!failed.success) {
        console.error("[Excel Submit Validation Failed]", {
          rowNumber: failedRow + 2,
          input: jsonData[failedRow],
          issues: failed.error.issues,
        });
      }
      toast.error(`Row ${failedRow + 2}: Invalid data. Please fix and upload again.`);
      return;
    }
    excelMutation.mutate(jsonData);
  };
  const handleCancel = () => {
    setFileUploaded(false);
    if (isExcelUpload) setJsonData(null);
    reset(defaultFormValues);
    setSelectedStudent(null);
    if (isExcelUpload && fileref.current) {
      fileref.current.value = "";
    }
    if (isExcelUpload) setexcelfile(null);
    if (isExcelUpload) setFileUploaded(false);
    setImage(null);
    setPreview(null);
    setShowForm(false);
    if (isEditing) setIsEditing(false);
  };

  const removeImageMutation = useMutation({
    mutationFn: (studentId: number) =>
      axios.put(`/api/students/${studentId}/image`, { key: null }),
    onSuccess: (response) => {
      if (response.data.success) {
        toast.success("Image removed successfully.");
        setSelectedStudent((prev) => prev ? { ...prev, image: undefined } : prev);
        setShowForm(false);
        invalidateStudents();
      } else {
        toast.error(response.data.error || "Failed to remove image.");
      }
    },
    onError: (error) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "An error occurred while removing the image.");
    },
  });

  const removeImage = () => {
    if (!selectedStudent) return;
    setImage(null);
    setPreview(null);
    removeImageMutation.mutate(selectedStudent.id);
  };
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Student List"
        description="Manage student records, add new students or upload via Excel."
      >
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            disabled={loading}
          >
            {loading ? "Loading..." : "+ Add Student"}
          </Button>
        )}
      </PageHeader>
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-6 overflow-hidden">
          <div className="w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              {isEditing ? "Update Student Info" : "Add New Student"}
            </h2>
            {!isEditing && (
              <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(false)}
                  className={`pb-2 px-3 text-sm font-medium transition-colors relative ${!isExcelUpload
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(true)}
                  className={`pb-2 px-3 text-sm font-medium transition-colors relative ${isExcelUpload
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                    }`}
                >
                  Excel Upload
                </button>
              </div>
            )}
            <div className="space-y-4 sm:space-y-6">
              {!isExcelUpload ? (
                <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
                    <div className="flex justify-center flex-col items-center">
                      <p className="text-sm font-medium mb-2">Student Image</p>
                      <label className="w-24 sm:w-32 aspect-7/9 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden hover:border-blue-500 transition-colors">
                        {preview ? (
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : isEditing && selectedStudent?.image ? (
                          <img
                            src={getFileUrl(selectedStudent.image)}
                            alt="Student"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs sm:text-sm text-center">
                            Click to upload
                          </span>
                        )}
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                      {isEditing && selectedStudent?.image && (
                        <button
                          onClick={removeImage}
                          type="button"
                          className="mt-2 flex items-center justify-center hover:underline hover:cursor-pointer gap-2 text-sm text-destructive"
                        >
                          Remove Image
                        </button>
                      )}
                    </div>
                  </div>

                  <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Personal Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Name <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Full Name"
                          {...register("name")}
                        />
                        {errors.name && <ErrorMessage message={errors.name.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Father Name <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Father's Name"
                          {...register("father_name")}
                        />
                        {errors.father_name && <ErrorMessage message={errors.father_name.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Mother Name <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Mother's Name"
                          {...register("mother_name")}
                        />
                        {errors.mother_name && <ErrorMessage message={errors.mother_name.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Date of Birth <span className="text-destructive">*</span></label>
                        <Input
                          type="date"
                          lang="en-GB"
                          placeholder="dd/mm/yyyy"
                          {...register("dob")}
                        />
                        {errors.dob && <ErrorMessage message={errors.dob.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Father Phone <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Father's Phone"
                          maxLength={11}
                          {...register("father_phone")}
                        />
                        {errors.father_phone && <ErrorMessage message={errors.father_phone.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Mother Phone</label>
                        <Input
                          type="text"
                          placeholder="Mother's Phone"
                          maxLength={11}
                          {...register("mother_phone")}
                        />
                        {errors.mother_phone && <ErrorMessage message={errors.mother_phone.message} />}
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Academic Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Class <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Class"
                          {...register("class")}
                        />
                        {errors.class && <ErrorMessage message={errors.class.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Roll <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Roll"
                          {...register("roll")}
                        />
                        {errors.roll && <ErrorMessage message={errors.roll.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Section <span className="text-destructive">*</span></label>
                        <Input
                          type="text"
                          placeholder="Section"
                          {...register("section")}
                        />
                        {errors.section && <ErrorMessage message={errors.section.message} />}
                      </div>
                      {(watchedClass === 9 || watchedClass === 10) && (
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium">Department <span className="text-destructive">*</span></label>
                          <select
                            {...register("department")}
                            disabled={!(watchedClass === 9 || watchedClass === 10)}
                            className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="">Select Department</option>
                            {(VALID_DEPARTMENTS as readonly string[]).map((department: string) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                          {errors.department && <ErrorMessage message={errors.department.message} />}
                        </div>
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Address Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Village</label>
                        <Input
                          type="text"
                          placeholder="Village"
                          {...register("village")}
                        />
                        {errors.village && <ErrorMessage message={errors.village.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Post Office</label>
                        <Input
                          type="text"
                          placeholder="Post Office"
                          {...register("post_office")}
                        />
                        {errors.post_office && <ErrorMessage message={errors.post_office.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Upazila</label>
                        <Input
                          type="text"
                          placeholder="Upazila"
                          {...register("upazila")}
                        />
                        {errors.upazila && <ErrorMessage message={errors.upazila.message} />}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">District</label>
                        <Input
                          type="text"
                          placeholder="District"
                          {...register("district")}
                        />
                        {errors.district && <ErrorMessage message={errors.district.message} />}
                      </div>
                    </div>
                  </fieldset>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-xs text-muted-foreground">Fields marked with <span className="text-destructive">*</span> are mandatory.</p>
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-5">
                      <label className="flex items-center space-x-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          {...register("has_stipend")}
                          className="w-4 h-4"
                        />
                        <span>Has Stipend</span>
                      </label>
                      {isEditing && (
                        <label className="flex items-center space-x-2 text-sm font-medium">
                          <input
                            type="checkbox"
                            {...register("available")}
                            className="w-4 h-4"
                          />
                          <span>Active Student</span>
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="sticky bottom-0 bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/70 border-t border-border pt-4 flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      type="button"
                      disabled={formMutation.isPending}
                      className="min-w-24"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={formMutation.isPending} className="min-w-28">
                      {formMutation.isPending
                        ? (isEditing ? "Updating Student..." : "Adding Student...")
                        : (isEditing ? "Update" : "Add Student")}
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={sendToBackend} className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Excel File Upload</h3>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadDemoExcel}
                        className="h-8 px-3"
                      >
                        Download Demo Excel
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowFormatInfo(true)}
                        className="w-6 h-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                        title="View Excel format requirements"
                      >
                        i
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      id="excelFile"
                      name="excelFile"
                      accept=".xlsx, .xls"
                      onClick={(e) => {
                        const target = e.target as HTMLInputElement;
                        target.value = '';
                        setFileUploaded(false);
                        setJsonData(null);
                        setexcelfile(null);
                      }}
                      onChange={(e) => {
                        handleFileUpload(e);
                      }}
                      className="absolute w-full h-full opacity-0 cursor-pointer"
                      required
                      ref={fileref}
                    />
                    <label
                      htmlFor="excelFile"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors"
                    >
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        {fileUploaded ? (
                          <svg
                            className="w-8 h-8 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-8 h-8 text-primary"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="text-muted-foreground font-medium">
                        {fileUploaded
                          ? `File Uploaded: ${excelfile?.name}`
                          : "Upload Excel File"}
                      </span>
                      {!fileUploaded && (
                        <span className="text-sm text-muted-foreground">
                          .xlsx or .xls files only
                        </span>
                      )}
                    </label>
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      type="button"
                      onClick={handleCancel}
                      disabled={excelMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!fileUploaded || excelMutation.isPending}
                    >
                      {excelMutation.isPending ? "Uploading Students..." : "Upload"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <StatsCard label="Total Students" value={students.length} loading={loading} />
        <StatsCard
          label="Showing"
          value={filteredStudents.length !== students.length ? `${filteredStudents.length} / ${students.length}` : students.length}
          color="blue"
          loading={loading}
        />
        <StatsCard label="With Stipend" value={filteredStudents.filter(s => s.has_stipend).length} color="emerald" loading={loading} />
      </div>
      <SectionCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-60">
            <label className="block text-sm font-medium mb-1">Search</label>
            <div className="relative">
              <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or phone..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Class</label>
            <select
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">All Classes</option>
              {uniqueClasses.map((classNum) => (
                <option key={classNum} value={classNum}>
                  Class {classNum}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Section</label>
            <select
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
            >
              <option value="">All Sections</option>
              {uniqueSections.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 3 }, (_, i) => (
                <option key={i} value={currentYear - 1 + i}>
                  {currentYear - 1 + i}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionCard>
      <SectionCard noPadding className="mb-6">
        {hasSelectedStudents && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 border-b border-red-200 dark:border-red-900/20">
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {selectedStudentIds.length} student(s) selected
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkRotateOpen(true)}
              disabled={bulkRotateMutation.isPending}
              className="w-full sm:w-auto"
            >
              {bulkRotateMutation.isPending ? "Rotating..." : `Rotate ${selectedStudentIds.length} Passwords`}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="w-full sm:w-auto"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : `Delete ${selectedStudentIds.length} Selected`}
            </Button>
            <ConfirmationPopup
              open={bulkDeleteOpen}
              onOpenChange={setBulkDeleteOpen}
              onConfirm={() => { setBulkDeleteOpen(false); bulkDeleteMutation.mutate(selectedStudentIds); }}
              confirmLabel="Confirm Delete"
              msg={`This will permanently delete ${selectedStudentIds.length} selected student(s). This action cannot be undone.`}
            />
            <ConfirmationPopup
              open={bulkRotateOpen}
              onOpenChange={setBulkRotateOpen}
              onConfirm={() => { setBulkRotateOpen(false); bulkRotateMutation.mutate(selectedStudentIds); }}
              confirmLabel="Rotate Passwords"
              variant="default"
              msg={`This will regenerate new passwords for ${selectedStudentIds.length} selected student(s). An Excel file with new credentials will be downloaded. This action cannot be undone.`}
            />
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleSelectAllVisible}
                    aria-label="Select all students"
                    className="h-4 w-4"
                  />
                </th>
                {[
                  "Student",
                  "Roll",
                  "Class",
                  "Section",
                  "Department",
                  "Actions",
                ].map((header) => (
                  <th
                    key={header}
                    className={`px-4 py-3 text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider ${header === "Actions" ? "text-center" : "text-center sm:text-left"}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Loading />
                  </td>
                </tr>
              ) : filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className={selectedStudentIds.includes(student.id) ? "bg-muted/20" : ""}
                  >
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm text-center">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.includes(student.id)}
                        onChange={() => handleRowSelect(student.id)}
                        aria-label={`Select ${student.name}`}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 flex items-center gap-3 whitespace-nowrap text-sm font-medium">
                      {student.image ? (
                        <img
                          src={getFileUrl(student.image)}
                          alt="Student"
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      {student.name}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                      {student.roll}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                      {student.class}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                      {student.section}
                    </td>
                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                      {student.department || ""}
                    </td>

                    <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm text-right">
                      <div className="flex justify-end flex-wrap gap-1.5">
                        <ActionButton
                          action="photo"
                          asLabel
                          htmlFor={`file-upload-${student.id}`}
                        />
                        <input
                          type="file"
                          id={`file-upload-${student.id}`}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) =>
                            handleIndivisualImageUpload(e, student)
                          }
                        />
                        <ActionButton
                          action="view"
                          onClick={() =>
                            setPopup({
                              visible: true,
                              type: "view",
                              student,
                            })
                          }
                        />
                        <ActionButton
                          action="edit"
                          onClick={() => handleEdit(student)}
                        />
                        <DeleteConfirmation
                          onDelete={() => handleDelete(student)}
                          msg={`Are you sure you want to delete ${student.name}?`}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    {errorMessage ||
                      "No students found matching your criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
      {popup.visible && popup.student && (
        <Popup open onOpenChange={(o) => !o && closePopup()} size="md">
          {popup.type === "view" && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-base font-semibold">Student Details</h2>
                <button
                  onClick={closePopup}
                  className="text-muted-foreground hover:text-foreground transition-colors text-xl leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>

              {/* Profile */}
              <div className="flex flex-col items-center gap-2 py-5 border-b border-border bg-muted/20">
                {popup.student.image ? (
                  <img
                    src={getFileUrl(popup.student.image)}
                    alt="Student"
                    className="w-20  sm:w-24 aspect-7/9 object-cover rounded-sm border border-border shadow"
                  />
                ) : (
                  <div className="w-20 aspect-7/9 rounded-sm border border-border bg-muted flex items-center justify-center text-2xl text-muted-foreground font-bold">
                    {popup.student.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="text-center">
                  <p className="font-semibold text-base">{popup.student.name}</p>
                  <p className="text-xs text-muted-foreground">Login ID: {popup.student.login_id}</p>
                </div>
                <div className="flex gap-2 mt-1 flex-wrap justify-center">
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">Class {popup.student.class}</span>
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">Section {popup.student.section}</span>
                  <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">Roll {popup.student.roll}</span>
                  {popup.student.department && (
                    <span className="text-xs px-2 py-0.5 rounded-sm bg-accent text-accent-foreground font-medium">{popup.student.department}</span>
                  )}
                  {popup.student.has_stipend && (
                    <span className="text-xs px-2 py-0.5 rounded-sm bg-green-500/10 text-green-600 dark:text-green-400 font-medium">Stipend</span>
                  )}
                </div>
              </div>

              {/* Info sections */}
              <div className="px-5 py-4 space-y-4">
                {/* Personal */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Personal</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Date of Birth", value: format(new Date(popup.student.dob), "dd MMM yyyy") },
                      { label: "Father's Name", value: popup.student.father_name },
                      { label: "Mother's Name", value: popup.student.mother_name },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex text-sm">
                        <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                    <div className="flex text-sm items-center">
                      <span className="w-36 text-muted-foreground shrink-0">Stipend</span>
                      {popup.student.has_stipend ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">Yes</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">No</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</p>
                  <div className="space-y-1.5">
                    {[
                      { label: "Father's Phone", value: popup.student.father_phone || "N/A" },
                      { label: "Mother's Phone", value: popup.student.mother_phone || "N/A" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex text-sm">
                        <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Address */}
                {(popup.student.village || popup.student.post_office || popup.student.upazila || popup.student.district) && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Address</p>
                    <div className="space-y-1.5">
                      {[
                        { label: "Village", value: popup.student.village },
                        { label: "Post Office", value: popup.student.post_office },
                        { label: "Upazila", value: popup.student.upazila },
                        { label: "District", value: popup.student.district },
                      ].filter(({ value }) => value).map(({ label, value }) => (
                        <div key={label} className="flex text-sm">
                          <span className="w-36 text-muted-foreground shrink-0">{label}</span>
                          <span className="font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 border-t border-border flex justify-end">
                <Button onClick={closePopup} variant="outline" type="button">
                  Close
                </Button>
              </div>
            </>
          )}
        </Popup>
      )}

      {showFormatInfo && (
        <Popup open onOpenChange={(o) => !o && setShowFormatInfo(false)} size="2xl">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">
                Excel File Format Requirements
              </h2>
              <button
                onClick={() => setShowFormatInfo(false)}
                className="text-muted-foreground hover:text-foreground text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Use one standard format with required columns. Each row is validated before upload.
              </p>

              <div className="bg-muted/40 border border-border rounded-sm p-4">
                <h3 className="font-medium mb-2">Required Excel Format</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Required columns for every upload:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="font-medium">Required Columns:</div>
                  <div></div>

                  <div>• name</div>
                  <div>• father_name</div>

                  <div>• mother_name</div>
                  <div>• father_phone</div>

                  <div>• has_stipend (optional)</div>
                  <div>• village</div>

                  <div>• mother_phone (optional)</div>
                  <div>• post_office</div>
                  <div>• upazila</div>

                  <div>• district</div>
                  <div>• dob</div>

                  <div>• class</div>

                  <div>• roll</div>
                  <div>• section</div>

                  <div>• department</div>
                  <div></div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Important Notes:</h3>
                <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                  <li>
                    <strong>Date Format:</strong> Use DD/MM/YYYY format for date of birth (e.g., 15/08/2005)
                  </li>
                  <li>
                    <strong>Father Phone:</strong> Mandatory and should be 11 digits in Bangladesh format (e.g., 01XXXXXXXXX)
                  </li>
                  <li>
                    <strong>Mother Phone:</strong> Optional and should be 10 digits (without country code)
                  </li>
                  <li>
                    <strong>has_stipend:</strong> Use "Yes" or "No"
                  </li>
                  <li>
                    <strong>department:</strong> Required only for classes 9 and 10 (Science/Commerce/Humanities)
                  </li>
                  <li>
                    <strong>File Format:</strong> Only .xlsx or .xls files are accepted
                  </li>
                  <li>First row should contain column headers (case-insensitive)</li>
                </ul>
              </div>

              <div className="bg-muted/40 border border-border rounded-sm p-3">
                <p className="text-sm text-foreground">
                  <strong>💡 Tip:</strong> Keep column names exactly as shown above and ensure required fields are filled for every row.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowFormatInfo(false)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </Popup>
      )}
    </div>
  );
}
export default StudentList;
