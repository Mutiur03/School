import axios from "axios";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Eye, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import Loading from "../components/Loading";
import DeleteConfirmationIcon from "../components/DeleteConfimationIcon";
function convertToISO(dateStr) {
  const [day, month, year] = dateStr.split("/");
  console.log("Converted date:", `${year}-${month}-${day}`);

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
function StudentList() {
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [popup, setPopup] = useState({
    visible: false,
    type: "",
    student: null,
  });
  const [showForm, setShowForm] = useState(false);
  const [data, setData] = useState({
    name: "",
    father_name: "",
    mother_name: "",
    phone: "",
    parent_phone: "",
    blood_group: "",
    roll: "",
    section: "",
    address: "",
    dob: "",
    class: "",
    department: "",
    has_stipend: false,
    available: true,
  });
  const [isExcelUpload, setIsExcelUpload] = useState(false);
  const [jsonData, setJsonData] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [excelfile, setexcelfile] = useState(null);
  const fileref = React.useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const host = import.meta.env.VITE_BACKEND_URL;
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      console.log(file);

      setImage(file);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(file);
    }
  };
  const handleIndivisualImageUpload = async (e, student) => {
    const imageFormData = new FormData();
    imageFormData.append("image", e.target.files[0]);
    const file = e.target.files[0];
    console.log(student.name);

    if (file) {
      const imageResponse = await axios.post(
        `/api/students/updateStudentImage/${student.id}`,
        imageFormData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Image upload response:", imageResponse.data);
    }
    getStudentList();
  };
  const getStudentList = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/students/getStudents/${year}`);
      console.log("Students:", response.data.data);
      const filteredStudents = (response.data.data || []).filter(
        (student) => student.class >= 1 && student.class <= 10
      );
      // .filter((student) => student.available === true);
      setStudents(filteredStudents);
      setErrorMessage("");
    } catch (error) {
      setStudents([]);
      if (error.response?.status === 404) {
        setErrorMessage("No students found for the selected year.");
      } else {
        console.error("Error fetching students:", error);
        setErrorMessage("An error occurred while fetching students.");
      }
    } finally {
      setLoading(false);
    }
  };
  const handleEdit = (student) => {
    isExcelUpload && setIsExcelUpload(false);
    setIsEditing(true);
    setSelectedStudent(student);
    setData(student);
    console.log(student);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (student) => {
    try {
      const response = await axios.delete(
        `/api/students/deleteStudent/${student.id}`
      );
      if (response.status === 200) {
        toast.success("Student deleted successfully.");
      }
    } catch (error) {
      console.error("Error deleting student:", error);
      toast.error("Failed to delete student. Please try again.");
    }
    getStudentList();
  };
  const closePopup = () =>
    setPopup({ visible: false, type: "", student: null });
  useEffect(() => {
    getStudentList();
  }, [year]);
  const filteredStudents = students
    .filter((student) =>
      searchQuery
        ? student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.phone?.toString().includes(searchQuery)
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
  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      let students = {};
      formData.forEach((value, key) => {
        students[key] = value;
      });
      console.log(students);
      const imageFormData = new FormData();
      if (image) {
        imageFormData.append("image", image);
      }
      const basicDeatils = {};
      basicDeatils.name = students.name || "";
      basicDeatils.father_name = students.father_name || "";
      basicDeatils.mother_name = students.mother_name || "";
      basicDeatils.parent_phone = students.parent_phone || "";
      basicDeatils.phone = students.phone || "";
      basicDeatils.blood_group = students.blood_group || "";
      basicDeatils.has_stipend = students.has_stipend || false;
      basicDeatils.dob = students.dob || "";
      basicDeatils.address = students.address || "";
      basicDeatils.available = students.available ? true : false;
      console.log(basicDeatils.available);

      const academicDetails = {};
      academicDetails.roll = students.roll || "";
      academicDetails.class = students.class || "";
      academicDetails.section = students.section || "";
      academicDetails.department = students.department || "";
      students = [students];
      console.log("Submitting data:", students);
      console.log(selectedStudent);
      let response;
      if (isEditing) {
        response = await axios.put(
          `/api/students/updateStudent/${selectedStudent.id}`,
          basicDeatils // Pass 'basicDeatils' including 'available'
        );
        response = await axios.put(
          `/api/students/updateacademic/${selectedStudent.enrollment_id}`,
          academicDetails
        );
        if (image) {
          const imageResponse = await axios.post(
            `/api/students/updateStudentImage/${selectedStudent.id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
          console.log("Image upload response:", imageResponse.data);
        }
      } else {
        response = await axios.post("/api/students/addStudents", {
          students: students,
        });
        if (image) {
          const imageResponse = await axios.post(
            `/api/students/updateStudentImage/${response.data.data[0].id}`,
            imageFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
          console.log("Image upload response:", imageResponse.data);
        }
      }
      if (response.success === false) {
        toast.error(response.message);
        return;
      } else {
        handleCancel();
        toast.success(response.data.message);
      }
    } catch (err) {
      console.error(
        "Error adding student:",
        err.response?.data?.error || err.message
      );
      toast.error(err.response?.data?.error || err.message);
    } finally {
      getStudentList();
      setIsSubmitting(false);
    }
  };
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setexcelfile(file);
    setFileUploaded(true);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log("Raw Data from Excel:", rawData);

      const requiredFields = [
        "name",
        "father_name",
        "mother_name",
        "phone",
        "parent_phone",
        "blood_group",
        "has_stipend",
        "address",
        "dob",
        "class",
        "roll",
        "section",
        "department",
      ];

      const headers = rawData[0]?.map((header) => header.toLowerCase().trim());
      const missingFields = requiredFields.filter(
        (field) => !headers.includes(field)
      );

      if (missingFields.length > 0) {
        toast.error(
          `Missing required fields: ${missingFields.join(
            ", "
          )}. Please check your file.`
        );
        setFileUploaded(false);
        setexcelfile(null);
        return;
      }

      const formattedData = rawData.slice(1).map((row) => {
        const student = {};
        headers.forEach((header, index) => {
          student[header] = row[index];
        });
        return {
          name: student.name?.trim() || null,
          father_name: student.father_name?.trim() || null,
          mother_name: student.mother_name?.trim() || null,
          phone:
            student.phone?.toString().replace(/\D/g, "").slice(-10) || null,
          parent_phone:
            student.parent_phone?.toString().replace(/\D/g, "").slice(-10) ||
            null,
          blood_group: student.blood_group?.trim() || null,
          has_stipend:
            student.has_stipend?.toString().toLowerCase() === "yes" || false,
          address: student.address?.trim() || null,
          dob: student.dob ? convertToISO(student.dob) : null,
          class: parseInt(student.class, 10) || null,
          roll: parseInt(student.roll, 10) || null,
          section: student.section?.toString().trim() || null,
          department: student.department?.trim() || null,
        };
      });

      console.log("Formatted Data:", formattedData);
      setJsonData(formattedData);
    };
    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
    };
  };
  const sendToBackend = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      console.log("Data being sent to backend:", jsonData);
      if (!jsonData || jsonData.length === 0) {
        toast.error("No data to upload. Please check your Excel file.");
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
      document.querySelector('input[name="excelFile"]').value = "";
    } catch (err) {
      console.error(
        "Error adding student:",
        err.response?.data?.message || err.message
      );
      toast.error("Error adding student");
      toast.error(err.response?.data?.message || "Failed to upload students.");
    } finally {
      getStudentList();
      setIsSubmitting(false);
    }
  };
  const handleCancel = () => {
    setFileUploaded(false);
    isExcelUpload && setJsonData(null);
    setData({
      name: "",
      father_name: "",
      mother_name: "",
      parent_phone: "",
      phone: "",
      blood_group: "",
      has_stipend: false,
      roll: "",
      section: "",
      address: "",
      dob: "",
      class: "",
      department: "",
      available: true,
    });
    setSelectedStudent(null);
    isExcelUpload && (fileref.current.value = "");
    isExcelUpload && setexcelfile(null);
    isExcelUpload && setFileUploaded(false);
    setImage(null);
    setPreview(null);
    setShowForm(false);
    isEditing && setIsEditing(false);
  };
  const removeImage = async () => {
    try {
      setImage(null);
      setPreview(null);
      const response = await axios.post(
        `/api/students/updateStudentImage/${selectedStudent.id}`,
        {}, // No file is sent for removal
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      console.log("Image removed response:", response.data);
      if (response.data.success) {
        toast.success("Image removed successfully.");
        // handleEdit(response.data.data);
        data.image = null;
      } else {
        toast.error(response.data.error || "Failed to remove image.");
      }
    } catch (error) {
      console.error("Error removing image:", error);
      toast.error(
        error.response?.data?.error ||
          "An error occurred while removing the image."
      );
    }
    getStudentList();
    // handleCancel();
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
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-opacity-90"
          >
            + Add Student
          </Button>
        )}
      </div>
      {showForm && (
        <div className="flex flex-col items-center bg-card rounded-lg mb-4 relative max-w-full">
          <div className="w-full p-4 sm:p-6 rounded-lg shadow-md">
            <h2 className="text-lg sm:text-2xl font-semibold text-center mb-4">
              {isEditing ? "Update Student Info" : "Add New Student"}
            </h2>
            {!isEditing && (
              <div className="flex justify-center mb-4">
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(false)}
                  className={`px-4 sm:px-6 py-2 rounded-l-lg font-semibold transition-all duration-300 ${
                    !isExcelUpload
                      ? "bg-sky-500 text-white shadow-lg"
                      : "bg-accent hover:bg-gray-400 hover:text-gray-900"
                  }`}
                >
                  Form
                </button>
                <button
                  type="button"
                  onClick={() => setIsExcelUpload(true)}
                  className={`px-4 sm:px-6 py-2 rounded-r-lg font-semibold transition-all duration-300 ${
                    isExcelUpload
                      ? "bg-sky-500 text-white shadow-lg"
                      : "bg-accent hover:bg-gray-400 hover:text-gray-900"
                  }`}
                >
                  Excel Upload
                </button>
              </div>
            )}
            <div className="space-y-4 sm:space-y-6">
              {!isExcelUpload ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex justify-center flex-col items-center mb-4">
                    <label className="w-24 h-24 sm:w-32 sm:h-32 dark:bg-accent border border-gray-300 rounded-lg flex items-center justify-center cursor-pointer overflow-hidden">
                      {preview ? (
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : isEditing && data?.image ? (
                        <img
                          src={`${host}/${data.image}`}
                          alt="Student"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-500 text-xs sm:text-sm text-center">
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
                    {isEditing && data?.image && (
                      <button
                        onClick={removeImage}
                        type="button"
                        className="flex items-center justify-center hover:underline hover:cursor-pointer gap-2 text-sm text-red-500"
                      >
                        Remove Image
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="name"
                      placeholder="Full Name"
                      value={data.name}
                      onChange={handleChange}
                      className="w-full p-2 sm:p-3 border border-gray-300 dark:bg-accent rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      required
                    />
                    <input
                      type="text"
                      name="phone"
                      placeholder="Phone"
                      maxLength={11}
                      value={data.phone}
                      onChange={handleChange}
                      className="w-full p-2 sm:p-3 border border-gray-300 dark:bg-accent rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="father_name"
                      placeholder="Father's Name"
                      value={data.father_name}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                      required
                    />
                    <input
                      type="text"
                      name="mother_name"
                      placeholder="Mother's Name"
                      value={data.mother_name}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="parent_phone"
                      placeholder="Parent's Phone"
                      value={data.parent_phone}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                      required
                    />
                    <input
                      type="text"
                      name="blood_group"
                      placeholder="Blood Group"
                      value={data.blood_group}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="class"
                      placeholder="Class"
                      value={data.class}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                    />
                    <input
                      type="text"
                      name="roll"
                      placeholder="Roll"
                      value={data.roll}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="section"
                      placeholder="Section"
                      value={data.section}
                      required
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                    />
                    <input
                      type="text"
                      name="address"
                      placeholder="Address"
                      value={data.address}
                      onChange={handleChange}
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input
                      type="date"
                      name="dob"
                      placeholder="Date of Birth"
                      value={data.dob || ""}
                      onChange={handleChange}
                      required
                      className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                    />
                    {data.class >= 9 && (
                      <select
                        name="department"
                        onChange={handleChange}
                        disabled={data.class < 9}
                        required={data.class >= 9}
                        value={data.department}
                        className="w-full p-3 border border-gray-300 rounded-lg dark:bg-accent dark:text-accent-foreground text-input focus:ring-2 focus:ring-sky-500 focus:outline-none "
                      >
                        <option value="">Select Department</option>
                        {["Science", "Commerce", "Arts"].map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          name="has_stipend"
                          checked={data.has_stipend}
                          onChange={(e) =>
                            setData((prevData) => ({
                              ...prevData,
                              has_stipend: e.target.checked,
                            }))
                          }
                          className="w-4 h-4"
                        />
                        <span>Has Stipend</span>
                      </label>
                    </div>
                    {isEditing && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            name="available"
                            checked={data.available}
                            onChange={(e) =>
                              setData((prevData) => ({
                                ...prevData,
                                available: e.target.checked,
                              }))
                            }
                            className="w-4 h-4"
                          />
                          <span>Active Student</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      type="button"
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {isEditing ? "Update" : "Add Student"}
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
                      className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold transition-colors"
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
                        e.target.value = null;
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
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-sky-500 "
                    >
                      <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                        {fileUploaded ? (
                          <svg
                            className="w-8 h-8 text-green-500"
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
                            className="w-8 h-8 text-sky-500"
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
                      <span className="text-gray-400 font-medium">
                        {fileUploaded ? "File Uploaded" : "Upload Excel File"}
                        {fileUploaded && `: ${excelfile.name}`}
                      </span>
                      {!fileUploaded && (
                        <span className="text-sm text-gray-500">
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
      <div className="p-4 rounded-lg shadow-md mb-4 md:mb-6">
        <input
          type="text"
          placeholder="Search by name or phone..."
          className="border border-gray-300 dark:bg-accent text-accent-foreground rounded-lg px-4 py-2 mb-4 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
          <select
            className="border border-gray-300 dark:bg-accent rounded-lg px-3 py-2 w-full"
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
            className="border border-gray-300 dark:bg-accent rounded-lg px-3 py-2 w-full"
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
            onChange={(e) => setYear(e.target.value)}
            className="border border-gray-300 dark:bg-accent rounded-lg px-3 py-2 w-full"
          >
            {Array.from({ length: 3 }, (_, i) => (
              <option key={i} value={currentYear - 1 + i}>
                {currentYear - 1 + i}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="rounded-lg  shadow-md overflow-hidden flex-grow">
        <div className="rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 ">
              <thead className="bg-popover sticky top-0">
                <tr>
                  {[
                    "Name",
                    "Phone",
                    "Roll",
                    "Class",
                    "Section",
                    "Department",
                    "",
                    "Actions",
                  ].map((header) => (
                    <th
                      key={header}
                      className={`px-2 py-2 sm:px-4 sm:py-3 text-xs font-semibold uppercase tracking-wider ${
                        header === "Actions" ? "text-right" : "text-left"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 overflow-y-auto">
                {loading ? (
                  <td colSpan="8" className="py-2">
                    <div className="flex justify-center items-center w-full h-full">
                      <Loading />
                    </div>
                  </td>
                ) : filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm font-medium">
                        {student.name}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3 whitespace-nowrap text-sm">
                        {student.phone}
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
                            className="text-blue-600 hover:text-blue-900"
                            aria-label="View"
                          >
                            <Eye size={16} className="sm:w-4 sm:h-4 w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleEdit(student)}
                            className="text-green-600 hover:text-green-900"
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
                      colSpan="8"
                      className="px-4 py-6 text-center text-sm text-gray-500"
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
      {popup.visible && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-md sm:max-w-lg rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
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
                      "Father's Name": popup.student.father_name,
                      "Mother's Name": popup.student.mother_name,
                      Phone: popup.student.phone,
                      "Parent's Phone": popup.student.parent_phone,
                      "Blood Group": popup.student.blood_group || "N/A",
                      "Has Stipend": popup.student.has_stipend ? "Yes" : "No",
                      Class: popup.student.class,
                      Section: popup.student.section,
                      Roll: popup.student.roll,
                      Department: popup.student.department || "N/A",
                      Address: popup.student.address,
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
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
      
      {/* Excel Format Info Popup */}
      {showFormatInfo && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-2xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">Excel File Format Requirements</h2>
                <button
                  onClick={() => setShowFormatInfo(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your Excel file must contain the following columns with exact names (case-insensitive):
                </p>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Required Columns:</div>
                    <div></div>
                    
                    <div>• name</div>
                    <div>• father_name</div>
                    
                    <div>• mother_name</div>
                    <div>• phone</div>
                    
                    <div>• parent_phone</div>
                    <div>• blood_group</div>
                    
                    <div>• has_stipend</div>
                    <div>• address</div>
                    
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
                  <ul className="text-sm space-y-1 list-disc list-inside text-gray-600 dark:text-gray-300">
                    <li><strong>Date Format:</strong> Use DD/MM/YYYY format for date of birth (e.g., 15/08/2005)</li>
                    <li><strong>Phone Numbers:</strong> Enter without country code (10 digits)</li>
                    <li><strong>has_stipend:</strong> Use "Yes" or "No"</li>
                    <li><strong>department:</strong> Required only for classes 9 and 10 (Science/Commerce/Arts)</li>
                    <li><strong>File Format:</strong> Only .xlsx or .xls files are accepted</li>
                    <li>First row should contain column headers</li>
                    <li>All required fields must be present, even if some cells are empty</li>
                  </ul>
                </div>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Tip:</strong> Make sure your Excel file has all the required column headers in the first row exactly as listed above.
                  </p>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowFormatInfo(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
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
