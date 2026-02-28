import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import DeleteConfirmationIcon from "@/components/DeleteConfimationIcon";
import Loading from "@/components/Loading";
import ErrorMessage from "@/components/ErrorMessage";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { teacherFormSchema, type TeacherFormSchemaData } from "@school/shared-schemas";
import backend from "@/lib/backend";

interface Teacher {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  designation: string;
  subject: string;
  available: boolean;
  image?: string;
}

interface PopupState {
  visible: boolean;
  type: string;
  teacher: Teacher | null;
}

const TeacherList = () => {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "",
    teacher: null,
  });
  const defaultValues = {
    name: "",
    email: "",
    phone: "",
    address: "",
    designation: "",
  };
  const {
    register,
    handleSubmit: rhfHandleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeacherFormSchemaData>({
    defaultValues,
    resolver: zodResolver(teacherFormSchema),
    criteriaMode: "firstError",
    mode: "onBlur",
  });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isloading, setIsLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/teachers/getTeachers");
      setTeachers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleEdit = (teacher: Teacher) => {
    reset({
      name: teacher.name || "",
      email: teacher.email || "",
      phone: teacher.phone || "",
      address: teacher.address || "",
      designation: teacher.designation || "",
    });
    setIsEditing(true);
    setShowForm(true);
    setPopup({ visible: false, type: "", teacher });
  };

  const handleDelete = async (teacher: Teacher) => {
    try {
      await axios.delete(`/api/teachers/deleteTeacher/${teacher.id}`);
      toast.success("Teacher deleted successfully.");
      fetchTeachers();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("Failed to delete teacher.");
    }
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", teacher: null });
  };

  const filteredTeachers = teachers
    .filter((teacher) => teacher.available)
    .filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.id - b.id);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
    }
  };

  const onValidSubmit = async (formValues: TeacherFormSchemaData) => {
    setIsSubmitting(true);
    try {
      const teacherData = { ...formValues };
      let response;

      if (isEditing && popup.teacher) {
        response = await axios.put(
          `/api/teachers/updateTeacher/${popup.teacher.id}`,
          teacherData
        );
        if (image) {
          const imageFormData = new FormData();
          imageFormData.append("image", image);
          await axios.post(
            `/api/teachers/uploadImage/${popup.teacher.id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }
      } else {
        response = await axios.post("/api/teachers/addTeacher", {
          teachers: [teacherData],
        });
        if (image) {
          const imageFormData = new FormData();
          imageFormData.append("image", image);
          await axios.post(
            `/api/teachers/uploadImage/${response.data.data[0].id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }
      }

      const data = response.data;
      if (data.success || response.status === 200) {
        toast.success(data.message || "Teacher saved successfully.");
        reset(defaultValues);
        setImage(null);
        setIsEditing(false);
        setShowForm(false);
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      const msg = axiosError.response?.data?.error || "An error occurred while submitting the form.";
      toast.error(msg);
      console.error("Error submitting form:", error);
    } finally {
      fetchTeachers();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
        <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-0">Teacher List</h1>
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
          >
            + Add Teacher
          </Button>
        )}
      </div>

      {showForm && (
        <div className="flex flex-col items-center bg-card rounded-sm mb-4 relative max-w-full">
          <div className="w-full p-4 sm:p-6 rounded-sm shadow-md">
            <h2 className="text-lg sm:text-2xl font-semibold text-center mb-4">
              {isEditing ? "Edit Teacher" : "Add Teacher"}
            </h2>
            <form onSubmit={rhfHandleSubmit(onValidSubmit)} className="space-y-6">

              {/* Image */}
              <div className="rounded-sm border border-border bg-muted/20 p-4">
                <div className="flex justify-center flex-col items-center">
                  <p className="text-sm font-medium mb-2">Profile Image</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <label
                    onClick={() => fileInputRef.current?.click()}
                    className="w-24 sm:w-32 aspect-[7/9] bg-card border border-border rounded-sm flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary transition-colors"
                  >
                    {image ? (
                      <img src={URL.createObjectURL(image)} alt="Preview" className="w-full h-full object-cover" />
                    ) : isEditing && popup.teacher?.image ? (
                      <img src={`${backend}/${popup.teacher.image}`} alt="Teacher" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-muted-foreground text-xs sm:text-sm text-center px-1">Click to upload</span>
                    )}
                  </label>
                  {image && (
                    <button
                      type="button"
                      onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                      className="mt-2 text-sm text-destructive hover:underline"
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              </div>

              {/* Info */}
              <fieldset className="rounded-sm border border-border bg-card p-4 sm:p-5">
                <legend className="px-1 text-sm sm:text-base font-semibold">Teacher Information</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Name <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's name"
                      {...register("name")}
                    />
                    {errors.name && <ErrorMessage message={errors.name.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Email <span className="text-destructive">*</span></label>
                    <Input
                      type="email"
                      placeholder="Enter teacher's email"
                      {...register("email")}
                    />
                    {errors.email && <ErrorMessage message={errors.email.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Phone <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's phone number"
                      maxLength={11}
                      {...register("phone")}
                    />
                    {errors.phone && <ErrorMessage message={errors.phone.message} />}
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium">Designation <span className="text-destructive">*</span></label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's designation"
                      {...register("designation")}
                    />
                    {errors.designation && <ErrorMessage message={errors.designation.message} />}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block text-sm font-medium">Home Town</label>
                    <Input
                      type="text"
                      placeholder="Enter teacher's home town"
                      {...register("address")}
                    />
                    {errors.address && <ErrorMessage message={errors.address.message} />}
                  </div>
                </div>
              </fieldset>

              <div className="sticky bottom-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/70 border-t border-border pt-4 flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isSubmitting}
                  className="min-w-24"
                  onClick={() => {
                    setShowForm(false);
                    setIsEditing(false);
                    reset(defaultValues);
                    setImage(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="min-w-28">
                  {isSubmitting ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update" : "Add Teacher")}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="p-4 rounded-sm shadow-md mb-4 md:mb-6">
        <Input
          type="text"
          placeholder="Search by name, subject or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="rounded-sm shadow-md overflow-hidden flex-grow">
        <div className="rounded-sm shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-popover sticky top-0">
                <tr>
                  {["Name", "Email", "Designation", "Actions"].map((header) => (
                    <th
                      key={header}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider ${header === "Actions" ? "text-right" : "text-left"
                        }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isloading ? (
                  <tr>
                    <td colSpan={4} className="py-2">
                      <div className="flex flex-col justify-center items-center gap-2 w-full h-full py-4">
                        <Loading />
                        <p className="text-sm text-muted-foreground">Loading teachers...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredTeachers.length > 0 ? (
                  filteredTeachers.map((teacher) => (
                    <tr key={teacher.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">{teacher.name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{teacher.email}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">{teacher.designation}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        <div className="flex justify-end space-x-2">
                          <button
                            onClick={() => setPopup({ visible: true, type: "view", teacher })}
                            className="text-primary hover:text-primary/80"
                            aria-label="View"
                          >
                            <Eye size={16} className="sm:w-4 sm:h-4 w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEdit(teacher)}
                            className="text-foreground hover:text-primary"
                            aria-label="Edit"
                          >
                            <Pencil size={16} className="sm:w-4 sm:h-4 w-3 h-3" />
                          </button>
                          <DeleteConfirmationIcon
                            onDelete={() => handleDelete(teacher)}
                            msg={`Are you sure you want to delete ${teacher.name}?`}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No teachers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {popup.visible && popup.teacher && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={closePopup}
        >
          <div
            className="bg-card w-full max-w-md rounded-sm shadow-2xl max-h-[90vh] overflow-y-auto border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {popup.type === "view" && (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <h2 className="text-base font-semibold">Teacher Details</h2>
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
                  {popup.teacher.image ? (
                    <img
                      src={`${backend}/${popup.teacher.image}`}
                      alt="Profile"
                      className="w-20 aspect-[7/9] object-cover rounded-sm border border-border shadow"
                    />
                  ) : (
                    <div className="w-20 aspect-[7/9] rounded-sm border border-border bg-muted flex items-center justify-center text-2xl text-muted-foreground font-bold">
                      {popup.teacher.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-center">
                    <p className="font-semibold text-base">{popup.teacher.name}</p>
                    <p className="text-xs text-muted-foreground">{popup.teacher.designation}</p>
                  </div>
                  {popup.teacher.subject && (
                    <span className="text-xs px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">
                      {popup.teacher.subject}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="px-5 py-4 space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact & Details</p>
                  {[
                    { label: "Email", value: popup.teacher.email },
                    { label: "Phone", value: popup.teacher.phone },
                    { label: "Home Town", value: popup.teacher.address },
                  ].filter(({ value }) => value).map(({ label, value }) => (
                    <div key={label} className="flex text-sm">
                      <span className="w-28 text-muted-foreground shrink-0">{label}</span>
                      <span className="font-medium">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-border flex justify-end">
                  <Button onClick={closePopup} variant="outline" type="button">
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherList;
