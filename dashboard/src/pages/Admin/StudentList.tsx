import axios from "axios";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Eye, Upload, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import Loading from "@/components/Loading";
import DeleteConfirmationIcon from "@/components/DeleteConfimationIcon";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  studentFormSchema,
  VALID_DEPARTMENTS,
  type StudentFormSchemaData,
} from "@school/shared-schemas";

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

const toExcelString = (value: unknown) => (value == null ? "" : String(value).trim());

const normalizeExcelDate = (value: unknown) => {
  if (value == null || value === "") return "";

  const toIso = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  if (!Number.isNaN(Number(value))) {
    const excelDate = new Date((Number(value) - 25569) * 86400 * 1000);
    return excelDate.toISOString().split("T")[0];
  }

  const raw = String(value).trim();
  const dateToken = raw.match(/\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}/)?.[0] || raw;
  const normalized = dateToken
    .replace(/[^0-9/.-]/g, "")
    .replace(/[.]/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/-{2,}/g, "-");

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(normalized)) {
    const [day, month, year] = normalized.split(/[/-]/).map(Number);
    return toIso(year, month, day) || raw;
  }

  if (/^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(normalized)) {
    const [year, month, day] = normalized.split(/[/-]/).map(Number);
    return toIso(year, month, day) || raw;
  }

  return raw;
};

const formatDobForDateInput = (value: string | null | undefined) => {
  if (!value) return "";
  const raw = String(value).split("T")[0].trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split(/[/-]/);
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return raw;
};

function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const host = import.meta.env.VITE_BACKEND_URL;

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

  const handleIndivisualImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    student: Student
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const imageFormData = new FormData();
    imageFormData.append("image", file);

    await axios.post(
      `/api/students/updateStudentImage/${student.id}`,
      imageFormData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );
    getStudentList();
  };
  const getStudentList = async () => {
    try {
      const response = await axios.get(`/api/students/getStudents/${year}`);
      const filteredStudents = (response.data.data || []).filter(
        (student: Student) => student.class >= 1 && student.class <= 10
      );
      setStudents(filteredStudents);
      setErrorMessage("");
    } catch (error) {
      setStudents([]);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 404) {
          setErrorMessage("No students found for the selected year.");
        } else {
          setErrorMessage("An error occurred while fetching students.");
        }
      } else {
        setErrorMessage("An error occurred while fetching students.");
      }
    } finally {
      setLoading(false);
    }
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

  const handleDelete = async (student: Student) => {
    try {
      const response = await axios.delete(
        `/api/students/deleteStudent/${student.id}`
      );
      if (response.status === 200) {
        toast.success("Student deleted successfully.");
        setSelectedStudentIds((prev) => prev.filter((id) => id !== student.id));
      }
    } catch {
      toast.error("Failed to delete student. Please try again.");
    }
    getStudentList();
  };

  const closePopup = () =>
    setPopup({ visible: false, type: "", student: null });

  useEffect(() => {
    getStudentList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

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

  const handleBulkDelete = async () => {
    if (selectedStudentIds.length === 0) {
      toast.error("Please select at least one student.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedStudentIds.length} selected student(s)?`
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const response = await axios.delete("/api/students/deleteStudentsBulk", {
        data: { studentIds: selectedStudentIds },
      });

      toast.success(
        response.data?.message || "Selected students deleted successfully."
      );
      setSelectedStudentIds([]);
      await getStudentList();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(
        err.response?.data?.error ||
        "Failed to delete selected students. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    setSelectedStudentIds((prev) =>
      prev.filter((id) => students.some((student) => student.id === id))
    );
  }, [students]);

  const onSubmit = async (formValues: StudentFormData) => {
    setIsSubmitting(true);
    try {
      const parsedForm = studentFormSchema.safeParse(formValues);
      if (!parsedForm.success) {
        console.error("[Student Form Validation Failed]", {
          input: formValues,
          issues: parsedForm.error.issues,
        });
        toast.error(parsedForm.error.issues[0]?.message || "Invalid form data");
        return;
      }

      const parsedValues = parsedForm.data as StudentFormData;
      const imageFormData = new FormData();
      if (image) {
        imageFormData.append("image", image);
      }

      const basicDeatils: Record<string, string | boolean> = {};
      basicDeatils.name = parsedValues.name || "";
      basicDeatils.father_name = parsedValues.father_name || "";
      basicDeatils.mother_name = parsedValues.mother_name || "";
      basicDeatils.father_phone = parsedValues.father_phone || "";
      basicDeatils.mother_phone = parsedValues.mother_phone || "";
      basicDeatils.village = parsedValues.village || "";
      basicDeatils.post_office = parsedValues.post_office || "";
      basicDeatils.upazila = parsedValues.upazila || "";
      basicDeatils.district = parsedValues.district || "";
      basicDeatils.dob = parsedValues.dob || "";
      basicDeatils.available = Boolean(parsedValues.available);
      basicDeatils.has_stipend = Boolean(parsedValues.has_stipend);

      const academicDetails: Record<string, string> = {};
      academicDetails.roll = parsedValues.roll || "";
      academicDetails.class = parsedValues.class || "";
      academicDetails.section = parsedValues.section || "";
      const classNumber = Number(parsedValues.class);
      const requiresDepartment = classNumber === 9 || classNumber === 10;
      academicDetails.department = requiresDepartment ? parsedValues.department || "" : "";

      const studentsArray = [
        {
          name: parsedValues.name,
          father_name: parsedValues.father_name,
          mother_name: parsedValues.mother_name,
          father_phone: parsedValues.father_phone,
          mother_phone: parsedValues.mother_phone,
          village: parsedValues.village,
          post_office: parsedValues.post_office,
          upazila: parsedValues.upazila,
          district: parsedValues.district,
          dob: parsedValues.dob,
          class: parsedValues.class,
          roll: parsedValues.roll,
          section: parsedValues.section,
          department: requiresDepartment ? parsedValues.department : "",
          has_stipend: Boolean(parsedValues.has_stipend),
        },
      ];

      if (isEditing && selectedStudent) {
        await axios.put(
          `/api/students/updateStudent/${selectedStudent.id}`,
          basicDeatils
        );
        await axios.put(
          `/api/students/updateacademic/${selectedStudent.enrollment_id}`,
          academicDetails
        );
        if (image) {
          await axios.post(
            `/api/students/updateStudentImage/${selectedStudent.id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }

        handleCancel();
        toast.success("Student updated successfully.");
        return;
      } else {
        const response = await axios.post("/api/students/addStudents", {
          students: studentsArray,
        });
        if (image) {
          await axios.post(
            `/api/students/updateStudentImage/${response.data.data[0].id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }

        if (response.data.success === false) {
          toast.error(response.data.message);
          return;
        }

        handleCancel();
        toast.success(response.data.message);
      }
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      toast.error(error.response?.data?.error || error.message || 'An error occurred');
    } finally {
      getStudentList();
      setIsSubmitting(false);
    }
  };
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
            .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
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
      toast.success(`Loaded ${formattedData.length} students successfully.`);
    };
    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
    };
  };
  const sendToBackend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
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

      const response = await axios.post("/api/students/addStudents", {
        students: jsonData,
      });
      if (response.data.success === false) {
        toast.error(response.data.message);
        return;
      }
      toast.success(response.data.message);
      setJsonData(null);
      setFileUploaded(false);
      setexcelfile(null);
      setIsExcelUpload(false);
      setShowForm(false);
      const excelInput = document.querySelector(
        'input[name="excelFile"]'
      ) as HTMLInputElement;
      if (excelInput) excelInput.value = "";
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error("Error adding student");
      toast.error(error.response?.data?.message || "Failed to upload students.");
    } finally {
      getStudentList();
      setIsSubmitting(false);
    }
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

  const removeImage = async () => {
    if (!selectedStudent) return;
    try {
      setImage(null);
      setPreview(null);
      const response = await axios.post(
        `/api/students/updateStudentImage/${selectedStudent.id}`,
        {},
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (response.data.success) {
        toast.success("Image removed successfully.");
        setSelectedStudent((prev) =>
          prev
            ? {
              ...prev,
              image: undefined,
            }
            : prev
        );
        setShowForm(false);
      } else {
        toast.error(response.data.error || "Failed to remove image.");
      }
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(
        err.response?.data?.error ||
        "An error occurred while removing the image."
      );
    }
    getStudentList();
  };
  return (
    <div className="max-w-6xl  mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-0">
          Student List
        </h1>
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            + Add Student
          </Button>
        )}
      </div>
      {showForm && (
        <div className="flex flex-col items-center bg-card rounded-md mb-4 relative max-w-full">
          <div className="w-full p-4 sm:p-6 rounded-md shadow-md">
            <h2 className="text-lg sm:text-2xl font-semibold text-center mb-4">
              {isEditing ? "Update Student Info" : "Add New Student"}
            </h2>
            {!isEditing && (
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(false)}
                  className={`px-4 sm:px-6 py-2 rounded-l-lg font-semibold transition-all duration-300 ${!isExcelUpload
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-accent text-accent-foreground hover:bg-accent/80"
                    }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(true)}
                  className={`px-4 sm:px-6 py-2 rounded-r-lg font-semibold transition-all duration-300 ${isExcelUpload
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-accent text-accent-foreground hover:bg-accent/80"
                    }`}
                >
                  Excel Upload
                </button>
              </div>
            )}
            <div className="space-y-4 sm:space-y-6">
              {!isExcelUpload ? (
                <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
                  <div className="rounded-md border border-border bg-muted/20 p-4">
                    <div className="flex justify-center flex-col items-center">
                      <p className="text-sm font-medium mb-2">Student Image</p>
                      <label className="w-24 h-24 sm:w-32 sm:h-32 bg-card border border-border rounded-md flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-colors">
                        {preview ? (
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : isEditing && selectedStudent?.image ? (
                          <img
                            src={`${host}/${selectedStudent.image}`}
                            alt="Student"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs sm:text-sm text-center">
                            Click to upload
                          </span>
                        )}
                        <input
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

                  <fieldset className="rounded-md border border-border bg-card p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Personal Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Name <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Full Name"
                          {...register("name")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.name && (
                          <p className="text-destructive text-xs">{errors.name.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Father Name <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Father's Name"
                          {...register("father_name")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.father_name && (
                          <p className="text-destructive text-xs">{errors.father_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Mother Name <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Mother's Name"
                          {...register("mother_name")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.mother_name && (
                          <p className="text-destructive text-xs">{errors.mother_name.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Date of Birth <span className="text-destructive">*</span></label>
                        <input
                          type="date"
                          lang="en-GB"
                          placeholder="dd/mm/yyyy"
                          {...register("dob")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.dob && (
                          <p className="text-destructive text-xs">{errors.dob.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Father Phone <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Father's Phone"
                          maxLength={11}
                          {...register("father_phone")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.father_phone && (
                          <p className="text-destructive text-xs">{errors.father_phone.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Mother Phone</label>
                        <input
                          type="text"
                          placeholder="Mother's Phone"
                          maxLength={11}
                          {...register("mother_phone")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.mother_phone && (
                          <p className="text-destructive text-xs">{errors.mother_phone.message}</p>
                        )}
                      </div>
                    </div>
                  </fieldset>

                  <fieldset className="rounded-md border border-border bg-card p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Academic Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Class <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Class"
                          {...register("class")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.class && (
                          <p className="text-destructive text-xs">{errors.class.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Roll <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Roll"
                          {...register("roll")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.roll && (
                          <p className="text-destructive text-xs">{errors.roll.message}</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Section <span className="text-destructive">*</span></label>
                        <input
                          type="text"
                          placeholder="Section"
                          {...register("section")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.section && (
                          <p className="text-destructive text-xs">{errors.section.message}</p>
                        )}
                      </div>
                      {(watchedClass === 9 || watchedClass === 10) && (
                        <div className="space-y-1.5">
                          <label className="block text-sm font-medium">Department <span className="text-destructive">*</span></label>
                          <select
                            {...register("department")}
                            disabled={!(watchedClass === 9 || watchedClass === 10)}
                            className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                          >
                            <option value="">Select Department</option>
                            {VALID_DEPARTMENTS.map((department) => (
                              <option key={department} value={department}>
                                {department}
                              </option>
                            ))}
                          </select>
                          {errors.department && (
                            <p className="text-destructive text-xs">{errors.department.message}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-md border border-border bg-card p-4 sm:p-5">
                    <legend className="px-1 text-sm sm:text-base font-semibold">Address Information</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Village</label>
                        <input
                          type="text"
                          placeholder="Village"
                          {...register("village")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.village && <p className="text-destructive text-xs">{errors.village.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Post Office</label>
                        <input
                          type="text"
                          placeholder="Post Office"
                          {...register("post_office")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.post_office && <p className="text-destructive text-xs">{errors.post_office.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">Upazila</label>
                        <input
                          type="text"
                          placeholder="Upazila"
                          {...register("upazila")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.upazila && <p className="text-destructive text-xs">{errors.upazila.message}</p>}
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-sm font-medium">District</label>
                        <input
                          type="text"
                          placeholder="District"
                          {...register("district")}
                          className="w-full px-2.5 sm:px-3 py-2 border border-border bg-background rounded-md focus:ring-2 focus:ring-primary/30 focus:border-primary focus:outline-none"
                        />
                        {errors.district && <p className="text-destructive text-xs">{errors.district.message}</p>}
                      </div>
                    </div>
                  </fieldset>

                  <div className="rounded-md border border-border bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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

                  <div className="sticky bottom-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70 border-t border-border pt-4 flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      type="button"
                      className="min-w-24"
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="min-w-28">
                      {isSubmitting ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update" : "Add Student")}
                    </Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={sendToBackend} className="space-y-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Excel File Upload</h3>
                    <button
                      type="button"
                      onClick={() => setShowFormatInfo(true)}
                      className="w-6 h-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold transition-colors"
                      title="View Excel format requirements"
                    >
                      i
                    </button>
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
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-md cursor-pointer hover:border-primary"
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
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!fileUploaded || isSubmitting}
                    >
                      Upload
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="p-4 rounded-md shadow-md mb-4 md:mb-6">
        <input
          type="text"
          placeholder="Search by name or phone..."
          className="border border-border bg-background text-foreground rounded-md px-4 py-2 mb-4 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
          <select
            className="border border-border bg-background rounded-md px-3 py-2 w-full"
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
          <select
            className="border border-border bg-background rounded-md px-3 py-2 w-full"
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
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-border bg-background rounded-md px-3 py-2 w-full"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={currentYear - 1 + i}>
                {currentYear - 1 + i}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rounded-md  shadow-md overflow-hidden flex-grow">
        {hasSelectedStudents && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 px-2 py-2  bg-muted/30">
            <p className="text-sm font-medium text-foreground">
              {selectedStudentIds.length} student(s) selected
            </p>
            <Button
              type="button"
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? "Deleting..." : "Delete Selected"}
            </Button>
          </div>
        )}
        <div className="rounded-md shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border ">
              <thead className="bg-popover sticky top-0">
                <tr>
                  <th className="w-12 px-2 py-2 sm:px-4 sm:py-3 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={handleSelectAllVisible}
                      aria-label="Select all students"
                      className="h-4 w-4"
                    />
                  </th>
                  {[
                    "Name",
                    "Roll",
                    "Class",
                    "Section",
                    "Department",
                    "",
                    "Actions",
                  ].map((header) => (
                    <th
                      key={header}
                      className={`px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold uppercase tracking-wider ${header === "Actions" ? "text-right" : "text-left"
                        }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border overflow-y-auto">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-2">
                      <div className="flex justify-center items-center w-full h-full">
                        <Loading />
                      </div>
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
                      <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm font-medium">
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
                      <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                        {student.image && (
                          <img
                            src={`${host}/${student.image}`}
                            alt="Student"
                            className="w-10 h-10 rounded-xs object-cover"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm text-right">
                        <div className="flex justify-end space-x-1 sm:space-x-2">
                          <label htmlFor={`file-upload-${student.id}`}>
                            <Upload
                              size={16}
                              className="sm:w-4 sm:h-4 w-3 h-3"
                            />
                          </label>
                          <input
                            type="file"
                            id={`file-upload-${student.id}`}
                            accept="image/*"
                            className="hidden"
                            onChange={(e) =>
                              handleIndivisualImageUpload(e, student)
                            }
                          />
                          <button
                            onClick={() =>
                              setPopup({
                                visible: true,
                                type: "view",
                                student,
                              })
                            }
                            className="text-primary hover:text-primary/80"
                            aria-label="View"
                          >
                            <Eye size={16} className="sm:w-4 sm:h-4 w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEdit(student)}
                            className="text-foreground hover:text-primary"
                            aria-label="Edit"
                          >
                            <Pencil
                              size={16}
                              className="sm:w-4 sm:h-4 w-3 h-3"
                            />
                          </button>

                          <DeleteConfirmationIcon
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
                      colSpan={9}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      {errorMessage ||
                        "No students found matching your criteria."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {popup.visible && popup.student && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md sm:max-w-lg rounded-md shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:px-6">
              {popup.type === "view" && (
                <>
                  <h2 className="text-xl font-bold">Student Details</h2>
                  <div className="space-y-3">
                    {popup.student.image && (
                      <div className="flex justify-center mb-4">
                        <img
                          src={`${host}/${popup.student.image}`}
                          alt="Student"
                          className="w-32 h-32 object-cover rounded-full"
                        />
                      </div>
                    )}
                    {Object.entries({
                      Name: popup.student.name,
                      "Login ID": popup.student.login_id,
                      "Father's Name": popup.student.father_name,
                      "Mother's Name": popup.student.mother_name,
                      "Father's Phone": popup.student.father_phone || "N/A",
                      "Mother's Phone": popup.student.mother_phone || "N/A",
                      "Has Stipend": popup.student.has_stipend ? "Yes" : "No",
                      Class: popup.student.class,
                      Section: popup.student.section,
                      Roll: popup.student.roll,
                      Department: popup.student.department || "N/A",
                      Village: popup.student.village || "N/A",
                      "Post Office": popup.student.post_office || "N/A",
                      Upazila: popup.student.upazila || "N/A",
                      District: popup.student.district || "N/A",
                      "Date of Birth": format(
                        new Date(popup.student.dob),
                        "dd MMM yyyy"
                      ),
                    }).map(([key, value]) => (
                      <div key={key} className="flex flex-wrap">
                        <span className="font-medium w-1/3">{key}:</span>
                        <span className="flex-1">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={closePopup}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showFormatInfo && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-2xl rounded-md shadow-xl max-h-[90vh] overflow-y-auto">
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

                <div className="bg-muted/40 border border-border rounded-md p-4">
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

                <div className="bg-muted/40 border border-border rounded-md p-3">
                  <p className="text-sm text-foreground">
                    <strong>💡 Tip:</strong> Keep column names exactly as shown above and ensure required fields are filled for every row.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowFormatInfo(false)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default StudentList;
