import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ChangeEvent, FormEvent } from "react";
import axios, { AxiosError } from "axios";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard, StatsCard, Popup } from "@/components";
import DeleteConfirmation from "@/components/DeleteConfimation";
import ActionButton from "@/components/ActionButton";
import Loading from "@/components/Loading";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { subjectFormSchema, type SubjectFormSchemaData, VALID_DEPARTMENTS } from "@school/shared-schemas";
import ErrorMessage from "@/components/ErrorMessage";

interface Subject {
  id: number;
  name: string;
  class: number;
  full_mark: number;
  pass_mark: number;
  cq_mark?: number;
  mcq_mark?: number;
  practical_mark?: number;
  cq_pass_mark?: number;
  mcq_pass_mark?: number;
  practical_pass_mark?: number;
  department: string;
  year: number;
  subject_type: "main" | "paper" | "single";
  parent_id?: number | null;
  assessment_type: "exam" | "continuous";
  priority: number;
  created_at: string;
}

// FormData interface removed in favor of SubjectFormSchemaData from shared-schemas

const NewSubject: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterClass, setFilterClass] = useState<number | "all">("all");
  const [filterDepartment, setFilterDepartment] = useState<string | "all">("all");
  const [filterType, setFilterType] = useState<string | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {
    register,
    handleSubmit: handleSub,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SubjectFormSchemaData>({
    resolver: zodResolver(subjectFormSchema) as any,
    defaultValues: {
      id: null,
      name: "",
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      department: "",
      year: filterYear,
      subject_type: "single",
      parent_id: null as any,
      assessment_type: "exam",
      priority: 0,
    },
  });

  const formData = watch();
  const [uploadMethod, setUploadMethod] = useState<"form" | "file">("form");
  const [jsonData, setJsonData] = useState<Subject[] | null>(null);
  const [fileUploaded, setFileUploaded] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showFormatInfo, setShowFormatInfo] = useState<boolean>(false);
  const [showSubjectDetails, setShowSubjectDetails] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const excelFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    setValue("year", filterYear);
  }, [filterYear, setValue]);


  const fetchSubjects = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/sub/getSubjects");
      setSubjects(response.data.data);
    } catch {
      toast.error("Error fetching subjects");
    }
    setIsLoading(false);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;

    if (name === "class") {
      const classNum = Number(value);
      if (classNum > 0 && classNum < 9) {
        setValue("class", classNum as any);
        setValue("department", "");
        return;
      }
    }

    if (name === "assessment_type") {
      const val = value as "exam" | "continuous";
      setValue("assessment_type", val);
      return;
    }

    // For other fields, use register or manual setValue if needed
    const numericFields = ["class", "full_mark", "pass_mark", "cq_mark", "mcq_mark", "practical_mark", "cq_pass_mark", "mcq_pass_mark", "practical_pass_mark", "year", "priority", "parent_id"];
    if (numericFields.includes(name)) {
      setValue(name as any, value === "" ? null : Number(value));
    } else {
      setValue(name as any, value);
    }
  };

  const handleMethodChange = (method: "form" | "file"): void => {
    setUploadMethod(method);
    if (method === "form") {
      resetFormData();
    }
  };

  const resetFormData = (): void => {
    reset({
      id: null,
      name: "",
      class: null as any,
      full_mark: null as any,
      pass_mark: 0,
      cq_mark: 0,
      mcq_mark: 0,
      practical_mark: 0,
      cq_pass_mark: 0,
      mcq_pass_mark: 0,
      practical_pass_mark: 0,
      department: "",
      year: filterYear,
      subject_type: "single",
      parent_id: null as any,
      assessment_type: "exam",
      priority: 0,
    });
  };

  const onSubmit = async (data: SubjectFormSchemaData): Promise<void> => {
    if (uploadMethod === "form") {
      try {
        if (data.id) {
          const originalSubject = subjects.find(s => s.id === data.id);
          await axios.put(`/api/sub/updateSubject/${data.id}`, {
            ...data,
            old_parent_id: originalSubject?.parent_id
          });
          toast.success("Subject updated successfully.");
        } else {
          const response = await axios.post("/api/sub/addSubject", {
            subjects: [data],
          });
          toast.success(response.data.message);
        }
        fetchSubjects();
        resetFormData();
        setShowForm(false);
      } catch (error) {
        const axiosError = error as AxiosError<{ error: string }>;
        console.log(axiosError.response?.data?.error);
        toast.error(
          axiosError.response?.data?.error || "Error adding subject"
        );
      }
    }
  };

  const onError = (errors: any) => {
    console.error("Form validation errors:", errors);
    toast.error("Please fix the validation errors in the form.");
  };


  // Improved Excel upload pipeline
  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileUploaded(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result;
      if (!arrayBuffer) return;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      const mandatoryColumns = ["name", "class", "full_mark", "year", "assessment_type", "priority"];
      const sheetHeaders = (rawData[0] || []) as string[];
      const missingColumns = mandatoryColumns.filter((col) => !sheetHeaders.includes(col));
      if (missingColumns.length > 0) {
        toast.error(`Excel file is missing required columns: ${missingColumns.join(", ")}`);
        setFileUploaded(false);
        return;
      }
      const data = XLSX.utils.sheet_to_json(sheet) as any[];
      const errors: string[] = [];
      // Step 1: Normalize rows
      const normalizedRows = data.map((row) => {
        const deptKey = Object.keys(row).find(k => String(k).toLowerCase() === 'department');
        const deptRaw = deptKey ? String(row[deptKey as keyof typeof row] || "").trim() : "";
        const dept = deptRaw ? deptRaw.charAt(0).toUpperCase() + deptRaw.slice(1).toLowerCase() : "";
        return {
          ...row,
          name: String(row.name || "").trim(),
          class: Number(row.class),
          full_mark: Number(row.full_mark),
          pass_mark: row.assessment_type?.toLowerCase() === "continuous" ? null : Number(row.pass_mark),
          department: dept,
          year: Number(row.year) || new Date().getFullYear(),
          assessment_type: String(row.assessment_type || "exam").toLowerCase(),
          subject_group: row.subject_group ? String(row.subject_group).trim() : null,
          priority: Number(row.priority) || 0,
          cq_mark: Number(row.cq_mark) || 0,
          mcq_mark: Number(row.mcq_mark) || 0,
          practical_mark: Number(row.practical_mark) || 0,
          cq_pass_mark: Number(row.cq_pass_mark) || 0,
          mcq_pass_mark: Number(row.mcq_pass_mark) || 0,
          practical_pass_mark: Number(row.practical_pass_mark) || 0,
        };
      });
      // Step 2: Validate rows
      const seen = new Set();
      normalizedRows.forEach((row, index) => {
        const rowNum = index + 2;
        const key = `${row.name}|${row.class}|${row.department}|${row.year}`;
        if (!row.name) errors.push(`Row ${rowNum}: Subject name required.`);
        if (!row.class || isNaN(row.class) || row.class < 6 || row.class > 10) errors.push(`Row ${rowNum}: Class must be 6-10.`);
        if (!row.full_mark || isNaN(row.full_mark) || row.full_mark <= 0) errors.push(`Row ${rowNum}: Full mark required.`);
        if (row.assessment_type === "exam" && (row.pass_mark === null || isNaN(row.pass_mark) || row.pass_mark < 0)) errors.push(`Row ${rowNum}: Pass mark required for exam.`);
        if (!row.year || isNaN(row.year) || row.year < 2000) errors.push(`Row ${rowNum}: Invalid year.`);
        if (!["exam", "continuous"].includes(row.assessment_type)) errors.push(`Row ${rowNum}: Invalid assessment type.`);
        if (row.priority < 0) errors.push(`Row ${rowNum}: Priority must be non-negative.`);
        if (seen.has(key)) errors.push(`Row ${rowNum}: Duplicate subject in file.`);
        seen.add(key);
        // Check DB duplicate
        const isDuplicateInDB = subjects.some(
          (s) => s.name === row.name && s.class === row.class && (s.department || "") === row.department && s.year === row.year
        );
        if (isDuplicateInDB) errors.push(`Row ${rowNum}: Subject already exists in database.`);
      });
      if (errors.length > 0) {
        errors.slice(0, 5).forEach((err) => toast.error(err, { duration: 4000 }));
        if (errors.length > 5) toast.error(`...and ${errors.length - 5} more rows have errors.`);
        setFileUploaded(false);
        setJsonData(null);
        if (excelFileRef.current) excelFileRef.current.value = "";
        return;
      }
      // Step 3: Only upload papers and singles, do not generate main subjects
      const subjectsToUpload: any[] = [];
      Object.values(normalizedRows).forEach(row => {
        // If subject_group exists and there are other papers in same group/class/year, mark as paper
        if (row.subject_group) {
          const groupCount = normalizedRows.filter(r => r.subject_group === row.subject_group && r.class === row.class && r.year === row.year).length;
          if (groupCount > 1) {
            subjectsToUpload.push({
              ...row,
              subject_type: "paper",
              parent_id: null,
            });
          } else {
            subjectsToUpload.push({
              ...row,
              subject_type: "single",
              parent_id: null,
            });
          }
        } else {
          subjectsToUpload.push({
            ...row,
            subject_type: "single",
            parent_id: null,
          });
        }
      });
      // Step 4: CAS subjects
      subjectsToUpload.forEach(s => {
        if (s.assessment_type === "continuous") {
          s.exclude_from_gpa = true;
          s.pass_mark = null;
        }
      });
      setJsonData(subjectsToUpload);
    };
    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
      setFileUploaded(false);
    };
  };

  const handleDownloadDemoExcel = () => {
    const link = document.createElement("a");
    link.href = "/subject_upload_demo.xlsx";
    link.download = "demo_subjects.xlsx";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Demo Excel downloaded.");
  };

  const onSubmitFile = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!jsonData || jsonData.length === 0) {
      toast.error("No data to upload. Please check your Excel file.");
      return;
    }

    try {
      const response = await axios.post("/api/sub/addSubject", {
        subjects: jsonData,
      });
      if (!response.data.success) {
        toast.error(response.data.message);
        return;
      }

      toast.success(response.data.message);
      setJsonData(null);
      setFileUploaded(false);
      if (excelFileRef.current) {
        excelFileRef.current.value = "";
      }
      fetchSubjects();
      setShowForm(false);
    } catch (err) {

      const axiosError = err as AxiosError<{ error: string }>;
      toast.error(axiosError.response?.data?.error || "Failed to upload Subjects.");
    }
  };

  const deleteSubject = async (id: number): Promise<void> => {
    try {
      await axios.delete(`/api/sub/deleteSubject/${id}`);
      toast.success("Subject deleted successfully.");
      fetchSubjects();
    } catch (error) {
      const axiosError = error as AxiosError<{ error: string }>;
      toast.error(axiosError.response?.data?.error || "Failed to delete subject.");
    }
  };

  const editSubject = (subject: Subject): void => {
    reset({
      id: subject.id,
      name: subject.name,
      class: subject.class as any,
      full_mark: subject.full_mark as any,
      pass_mark: subject.pass_mark as any,
      cq_mark: (subject.cq_mark || 0) as any,
      mcq_mark: (subject.mcq_mark || 0) as any,
      practical_mark: (subject.practical_mark || 0) as any,
      cq_pass_mark: (subject.cq_pass_mark || 0) as any,
      mcq_pass_mark: (subject.mcq_pass_mark || 0) as any,
      practical_pass_mark: (subject.practical_pass_mark || 0) as any,
      department: subject.department || "",
      year: subject.year,
      subject_type: subject.subject_type,
      parent_id: (subject.parent_id || null) as any,
      assessment_type: subject.assessment_type,
      priority: subject.priority as any,
    });
    setUploadMethod("form");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = (): void => {
    resetFormData();
    setUploadMethod("form");
    setFileUploaded(false);
    setJsonData(null);
    if (excelFileRef.current) {
      excelFileRef.current.value = "";
    }
    setShowForm(false);
  };

  const showSubjectInfo = (subject: Subject): void => {
    setSelectedSubject(subject);
    setShowSubjectDetails(true);
  };

  const stats = useMemo(() => {
    const yearSubjects = subjects.filter(s => s.year === filterYear);
    return {
      total: yearSubjects.length,
      // classes: new Set(subjects.map((s) => s.class)).size,
      // avgPassMark: subjects.length > 0
      //   ? Math.round(subjects.reduce((acc, s) => acc + s.pass_mark, 0) / subjects.length)
      //   : 0,
    };
  }, [subjects, filterYear]);

  const filteredSubjects = useMemo(() => {
    let baseFilter = subjects.filter((subject) => subject.year === filterYear);

    if (filterClass !== "all") {
      baseFilter = baseFilter.filter((s) => s.class === filterClass);
    }
    if (filterDepartment !== "all") {
      baseFilter = baseFilter.filter((s) => (s.department || "") === filterDepartment);
    }
    if (filterType !== "all") {
      baseFilter = baseFilter.filter((s) => s.subject_type === filterType);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      baseFilter = baseFilter.filter((s) => s.name.toLowerCase().includes(term));
    }

    // Enhanced sorting logic:
    // 1. Class (ascending)
    // 2. Priority (descending) 
    // 3. Subject type: main/single first, then papers
    // 4. Name alphabetical
    const sorted = [...baseFilter].sort((a, b) => {
      // First sort by class
      if (a.class !== b.class) return a.class - b.class;

      // Then by priority (higher priority first)
      if (a.priority !== b.priority) return a.priority - b.priority;

      // Then by subject type (main/single before papers)
      const typeOrder = { main: 0, single: 1, paper: 2 };
      const aTypeOrder = typeOrder[a.subject_type] || 2;
      const bTypeOrder = typeOrder[b.subject_type] || 2;
      if (aTypeOrder !== bTypeOrder) return aTypeOrder - bTypeOrder;

      // Finally by name
      return a.name.localeCompare(b.name);
    });

    // Build hierarchy: Papers follow their parents, maintaining sort order
    const result: Subject[] = [];
    const processedIds = new Set<number>();

    // First, add main and single subjects in their sorted order
    sorted.forEach(subject => {
      if (subject.subject_type === "main" || subject.subject_type === "single") {
        result.push(subject);
        processedIds.add(subject.id);

        // Add any papers that belong to this main subject
        if (subject.subject_type === "main") {
          const childPapers = sorted
            .filter(p => p.subject_type === "paper" && p.parent_id === subject.id)
            .sort((a, b) => {
              // Papers sorted by priority ascending (1, then 2, etc.)
              if (a.priority !== b.priority) return a.priority - b.priority;
              return a.name.localeCompare(b.name);
            });
          result.push(...childPapers);
          childPapers.forEach(p => processedIds.add(p.id));
        }
      }
    });

    // Add any remaining orphaned papers at the end
    sorted.forEach(subject => {
      if (!processedIds.has(subject.id)) {
        result.push(subject);
      }
    });

    return result;
  }, [subjects, filterYear, filterClass, filterDepartment, filterType, searchTerm]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Subject Management"
        description="Manage school subjects, marks, and departments."
      >
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "+ Add New Subject"}
          </Button>
        )}
      </PageHeader>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
        <StatsCard label="Total Subjects" value={filteredSubjects.length === stats.total ? `${stats.total}` : `${filteredSubjects.length}/${stats.total}`} loading={isLoading} />
        {/* <StatsCard label="Unique Classes" value={stats.classes} loading={isLoading} /> */}
        {/* <StatsCard label="Avg. Pass Mark" value={stats.avgPassMark} color="emerald" loading={isLoading} /> */}
      </div>

      {showForm && (
        <SectionCard className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6">
            <h2 className="text-xl font-bold">
              {formData.id ? "Edit Subject" : "Add New Subject"}
            </h2>
            {!formData.id && (
              <div className="flex gap-1 border-b border-border">
                <button
                  onClick={() => handleMethodChange("form")}
                  className={`pb-2 px-3 text-sm font-medium transition-colors relative ${uploadMethod === "form"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Form
                </button>
                <button
                  onClick={() => handleMethodChange("file")}
                  className={`pb-2 px-3 text-sm font-medium transition-colors relative ${uploadMethod === "file"
                    ? "text-primary border-b-2 border-primary"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Excel Upload
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {uploadMethod === "form" ? (
              <form onSubmit={handleSub(onSubmit as any, onError)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Subject Name <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      {...register("name")}
                      placeholder="e.g. Mathematics"
                    />
                    <ErrorMessage message={errors.name?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Class (6-10) <span className="text-destructive">*</span></label>
                    <Input
                      type="number"
                      {...register("class")}
                      placeholder="e.g. 9"
                      min={6}
                      max={10}
                      onChange={(e) => {
                        handleChange(e);
                        register("class").onChange(e);
                      }}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                    <ErrorMessage message={errors.class?.message} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Full Mark <span className="text-destructive">*</span></label>
                    <Input
                      type="number"
                      {...register("full_mark")}
                      placeholder={formData.subject_type === "main" ? "Auto-calculated" : "e.g. 100"}
                      disabled={formData.subject_type === "main"}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                      className={formData.subject_type === "main" ? "bg-muted cursor-not-allowed" : ""}
                    />
                    <ErrorMessage message={errors.full_mark?.message} />
                    {formData.subject_type === "main" && (
                      <p className="text-[10px] text-primary mt-1 animate-pulse font-medium">✨ Automatically calculated from child subjects</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Pass Mark {formData.assessment_type === "exam" && <span className="text-destructive">*</span>}</label>
                    <Input
                      type="number"
                      {...register("pass_mark")}
                      placeholder={formData.assessment_type === "continuous" ? "Optional for CAS" : "e.g. 33"}
                      onWheel={(e) => (e.target as HTMLInputElement).blur()}
                    />
                    <ErrorMessage message={errors.pass_mark?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Subject Type <span className="text-destructive">*</span></label>
                    <select
                      {...register("subject_type")}
                      onChange={(e) => {
                        handleChange(e);
                        register("subject_type").onChange(e);
                      }}
                      className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                    >
                      <option value="single">Single Subject</option>
                      <option value="main">Main Subject (Group)</option>
                      <option value="paper">Paper (Child Subject)</option>
                    </select>
                    <ErrorMessage message={errors.subject_type?.message} />
                  </div>
                  {formData.subject_type === "paper" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2 duration-200">
                      <label className="text-sm font-medium">Parent Subject <span className="text-destructive">*</span></label>
                      <select
                        {...register("parent_id")}
                        className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
                      >
                        <option value="">Select Parent Subject</option>
                        {subjects
                          .filter(s => s.subject_type === "main" && s.class === Number(formData.class))
                          .map(s => (
                            <option key={s.id} value={s.id}>{s.name} (Class {s.class})</option>
                          ))
                        }
                      </select>
                      <ErrorMessage message={errors.parent_id?.message} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Priority (Sort Order)</label>
                    <Input
                      type="number"
                      {...register("priority")}
                      placeholder="e.g. 10"
                    />
                    <ErrorMessage message={errors.priority?.message} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Assessment Type</label>
                    <div className="flex gap-4 items-center h-10 px-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="exam"
                          {...register("assessment_type")}
                          checked={formData.assessment_type === "exam"}
                          onChange={(e) => {
                            handleChange(e);
                            register("assessment_type").onChange(e);
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm">Exam Based</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="continuous"
                          {...register("assessment_type")}
                          checked={formData.assessment_type === "continuous"}
                          onChange={(e) => {
                            handleChange(e);
                            register("assessment_type").onChange(e);
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm">Continuous</span>
                      </label>
                    </div>
                    <ErrorMessage message={errors.assessment_type?.message} />
                  </div>
                </div>

                <fieldset className="p-4 border border-border rounded-lg bg-muted/30">
                  <legend className="px-2 text-sm font-semibold">Optional Marks Breakdown</legend>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">CQ Mark</label>
                      <Input
                        type="number"
                        {...register("cq_mark")}
                      />
                      <ErrorMessage message={errors.cq_mark?.message} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">MCQ Mark</label>
                      <Input
                        type="number"
                        {...register("mcq_mark")}
                      />
                      <ErrorMessage message={errors.mcq_mark?.message} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">Practical Mark</label>
                      <Input
                        type="number"
                        {...register("practical_mark")}
                      />
                      <ErrorMessage message={errors.practical_mark?.message} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">CQ Pass</label>
                      <Input
                        type="number"
                        {...register("cq_pass_mark")}
                      />
                      <ErrorMessage message={errors.cq_pass_mark?.message} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">MCQ Pass</label>
                      <Input
                        type="number"
                        {...register("mcq_pass_mark")}
                      />
                      <ErrorMessage message={errors.mcq_pass_mark?.message} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground uppercase">Practical Pass</label>
                      <Input
                        type="number"
                        {...register("practical_pass_mark")}
                      />
                      <ErrorMessage message={errors.practical_pass_mark?.message} />
                    </div>
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className={`space-y-1.5 transition-all duration-300 ${Number(formData.class) >= 9 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <label className="text-sm font-medium">Department</label>
                    <select
                      {...register("department")}
                      disabled={Number(formData.class) < 9}
                      className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-muted/50"
                    >
                      <option value="">{Number(formData.class) >= 9 ? "General (Common for all)" : "Not Required for Class 6-8"}</option>
                      {VALID_DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                    <ErrorMessage message={errors.department?.message} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Year</label>
                    <Input
                      type="number"
                      {...register("year")}
                      readOnly
                      className="bg-muted opacity-80"
                    />
                    <ErrorMessage message={errors.year?.message} />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-border mt-6">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button disabled={isSubmitting} type="submit">
                    {isSubmitting ? "Processing..." : (formData.id ? "Update Subject" : "Submit Subject")}
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={onSubmitFile} className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium">Excel File Upload</h3>
                    <p className="text-xs text-muted-foreground italic">Required columns: name, class, full_mark, pass_mark, year</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleDownloadDemoExcel}
                      className="h-8 px-3 text-xs"
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
                    accept=".xlsx, .xls"
                    ref={excelFileRef}
                    onChange={handleFileUpload}
                    className="absolute w-full h-full opacity-0 cursor-pointer"
                    required
                  />
                  <label
                    htmlFor="excelFile"
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                      {fileUploaded ? (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {fileUploaded ? "File Ready to Upload" : "Drop Excel file here or click to browse"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">.xlsx or .xls files only</span>
                  </label>
                </div>
                <div className="flex justify-between pt-4">
                  <Button type="button" variant="outline" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={!fileUploaded || isSubmitting}>
                    {isSubmitting ? "Uploading..." : "Upload Subjects"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </SectionCard>
      )}

      <SectionCard className="mb-6">
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-full sm:w-40">
            <label className="text-sm font-medium mb-1.5 block">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value={new Date().getFullYear() + 1}>{new Date().getFullYear() + 1}</option>
              <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
              <option value={new Date().getFullYear() - 1}>{new Date().getFullYear() - 1}</option>
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label className="text-sm font-medium mb-1.5 block">Class</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value="all">All Classes</option>
              {[6, 7, 8, 9, 10].map(c => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label className="text-sm font-medium mb-1.5 block">Department</label>
            <select
              value={filterDepartment}
              disabled={filterClass !== "all" && (filterClass as number) < 9}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:bg-muted/50"
            >
              <option value="all">All Departments</option>
              <option value="">General</option>
              {VALID_DEPARTMENTS.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="w-full sm:w-40">
            <label className="text-sm font-medium mb-1.5 block">Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="w-full px-3 py-2 border rounded-md bg-card border-border text-foreground text-sm focus:ring-2 focus:ring-primary/30 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="main">Main (Groups)</option>
              <option value="paper">Paper (Parts)</option>
              <option value="single">Single Subject</option>
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="text-sm font-medium mb-1.5 block">Search Subject</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
          </div>

          <div className="flex items-end h-10 pb-0.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilterYear(new Date().getFullYear());
                setFilterClass("all");
                setFilterDepartment("all");
                setFilterType("all");
                setSearchTerm("");
              }}
              className="text-xs h-9"
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {["Subject", "Type", "Class", "Full Mark", "Pass Mark", "Actions"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${h === "Actions" ? "text-center" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-muted-foreground">
                    <Loading />
                  </td>
                </tr>
              ) : filteredSubjects.length > 0 ? (
                filteredSubjects.map((subject, index) => {
                  const isFirstChild = index === 0 ||
                    filteredSubjects[index - 1].class !== subject.class ||
                    (filteredSubjects[index - 1].subject_type === "main" && subject.subject_type === "paper" && filteredSubjects[index - 1].id === subject.parent_id);

                  return (
                    <tr
                      key={subject.id}
                      className={`hover:bg-muted/30 transition-colors ${subject.subject_type === "paper" ? "bg-muted/10" : ""
                        } ${isFirstChild && subject.subject_type !== "paper" ? "border-t-2 border-border/50" : ""
                        }`}
                    >
                      <td className="px-4 py-3 font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {subject.subject_type === "paper" && (
                            <div className="w-4 h-4 border-l-2 border-b-2 border-border/50 rounded-bl-md ml-2 shrink-0" />
                          )}
                          <div className="flex flex-col">
                            <span>{subject.name}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {subject.priority > 0 && (
                                <span className="text-[10px] text-muted-foreground font-normal">Priority: {subject.priority}</span>
                              )}
                              {subject.assessment_type === "continuous" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold uppercase tracking-tighter">CAS</span>
                              )}
                              {subject.subject_type === "paper" && !subject.parent_id && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 font-bold uppercase tracking-tighter animate-pulse">Orphan</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {subject.subject_type === "main" ? (
                          <span className="text-primary font-bold uppercase tracking-wider">Main</span>
                        ) : subject.subject_type === "paper" ? (
                          <span className="text-muted-foreground uppercase tracking-wider">Paper</span>
                        ) : (
                          <span className="text-muted-foreground/50 italic capitalize">Single</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex flex-col">
                          <span>Class {subject.class}</span>
                          {subject.department && (
                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{subject.department}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium">{subject.full_mark}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{subject.pass_mark}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex justify-end flex-wrap gap-1.5">
                          <ActionButton
                            action="view"
                            onClick={() => showSubjectInfo(subject)}
                          />
                          <ActionButton
                            action="edit"
                            onClick={() => editSubject(subject)}
                          />
                          <DeleteConfirmation
                            onDelete={() => deleteSubject(subject.id)}
                            msg={`Permanently delete "${subject.name}" for class ${subject.class}? This action cannot be undone.`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No subjects found with the selected filters. Try adjusting your filters or adding a new subject.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>


      <Popup
        open={showSubjectDetails}
        onOpenChange={setShowSubjectDetails}
        size="md"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <h2 className="text-xl font-bold font-heading">Subject Details</h2>
            <button
              onClick={() => setShowSubjectDetails(false)}
              className="text-muted-foreground hover:text-foreground text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          {selectedSubject && (
            <div className="space-y-6">
              <div className="bg-primary/5 p-5 rounded-xl border border-primary/10 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-primary tracking-tight">{selectedSubject.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground px-2 py-0.5 rounded">
                      Class {selectedSubject.class}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {selectedSubject.department || 'General'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">Academic Year</span>
                  <span className="text-lg font-bold">{selectedSubject.year}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/30 border border-border rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest block mb-1">Full Mark</span>
                  <span className="text-2xl font-bold">{selectedSubject.full_mark}</span>
                </div>
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest block mb-1">Pass Mark</span>
                  <span className="text-2xl font-bold text-emerald-600">{selectedSubject.pass_mark}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full"></span>
                  Marks Distribution
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted/40 rounded-lg text-center border border-border/50">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">CQ</span>
                    <span className="text-sm font-bold">{selectedSubject.cq_mark || 0}</span>
                    <div className="h-px bg-border my-1 mx-2"></div>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-tighter">Pass: {selectedSubject.cq_pass_mark || 0}</span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg text-center border border-border/50">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">MCQ</span>
                    <span className="text-sm font-bold">{selectedSubject.mcq_mark || 0}</span>
                    <div className="h-px bg-border my-1 mx-2"></div>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-tighter">Pass: {selectedSubject.mcq_pass_mark || 0}</span>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg text-center border border-border/50">
                    <span className="text-[9px] font-bold uppercase text-muted-foreground tracking-wider block">Practical</span>
                    <span className="text-sm font-bold">{selectedSubject.practical_mark || 0}</span>
                    <div className="h-px bg-border my-1 mx-2"></div>
                    <span className="text-[8px] text-muted-foreground uppercase tracking-tighter">Pass: {selectedSubject.practical_pass_mark || 0}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={() => setShowSubjectDetails(false)} className="w-full sm:w-auto">
                  Close Details
                </Button>
              </div>
            </div>
          )}
        </div>
      </Popup>

      <Popup
        open={showFormatInfo}
        onOpenChange={setShowFormatInfo}
        size="lg"
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-border pb-4">
            <h2 className="text-xl font-bold font-heading">Excel Format Guide</h2>
            <button
              onClick={() => setShowFormatInfo(false)}
              className="text-muted-foreground hover:text-foreground text-2xl transition-colors"
            >
              ×
            </button>
          </div>

          <div className="space-y-6">
            <div className="bg-muted/50 p-5 rounded-xl border border-border border-dashed">
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                Required Columns
              </h3>
              <div className="flex flex-wrap gap-2">
                {["name", "class", "full_mark", "pass_mark", "year"].map((col) => (
                  <span key={col} className="bg-background px-3 py-1.5 rounded-md border border-border text-xs font-mono shadow-sm">{col}</span>
                ))}
                <span className="bg-primary/5 px-3 py-1.5 rounded-md border border-primary/20 text-xs font-mono shadow-sm text-primary">department</span>
                <span className="bg-primary/5 px-3 py-1.5 rounded-md border border-primary/20 text-xs font-mono shadow-sm text-primary">subject_group</span>
                <span className="bg-primary/5 px-3 py-1.5 rounded-md border border-primary/20 text-xs font-mono shadow-sm text-primary">priority</span>
                <span className="bg-primary/5 px-3 py-1.5 rounded-md border border-primary/20 text-xs font-mono shadow-sm text-primary">assessment_type</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">1</div>
                  <p><strong>name:</strong> The full title of the subject (e.g. Mathematics, Physics).</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">2</div>
                  <p><strong>class:</strong> Only numeric values between 6 and 10 are accepted.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">3</div>
                  <p><strong>full_mark:</strong> Total assignable marks for the subject.</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">4</div>
                  <p><strong>pass_mark:</strong> Minimum marks required to pass.</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">5</div>
                  <p><strong>department:</strong> Optional. Science/Humanities/Commerce (Common for all if empty).</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center text-primary text-[10px] font-bold shrink-0 mt-0.5">6</div>
                  <p><strong>year:</strong> Four-digit academic year (e.g. {new Date().getFullYear()}).</p>
                </div>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex gap-3 items-start">
              <Search className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-700 dark:text-yellow-400 font-medium">
                <strong>Pro Tip:</strong> Optional fields like `cq_mark`, `mcq_mark`, and `practical_mark` (and their respective pass marks) can also be added as columns for automatic breakdown.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setShowFormatInfo(false)} variant="default" className="w-full sm:w-auto">
                Understood
              </Button>
            </div>
          </div>
        </div>
      </Popup>
    </div>
  );
};

export default NewSubject;
