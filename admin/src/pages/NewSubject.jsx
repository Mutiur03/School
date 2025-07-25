import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import * as XLSX from "xlsx";
import { Edit } from "lucide-react";
import { Button } from "../components/ui/button";
import DeleteConfirmationIcon from "../components/DeleteConfimationIcon";
import Loading from "../components/Loading";
function NewSubject() {
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [formData, setFormData] = useState({
    id: null,
    name: "",
    class: "",
    full_mark: "",
    pass_mark: "",
    cq_mark: "",
    mcq_mark: "",
    practical_mark: "",
    cq_pass_mark: "",
    mcq_pass_mark: "",
    practical_pass_mark: "",
    department: "",
    year: new Date().getFullYear(),
    teacher_id: "",
  });
  const [uploadMethod, setUploadMethod] = useState("form");
  const [jsonData, setJsonData] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showFormatInfo, setShowFormatInfo] = useState(false);
  const [showSubjectDetails, setShowSubjectDetails] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const excelFileRef = React.useRef(null);
  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
  }, []);

  const fetchTeachers = async () => {
    await axios
      .get("/api/teachers/getTeachers")
      .then((response) => setTeachers(response.data.data))
      .catch((error) => console.error("Error fetching teachers:", error));
  };

  const fetchSubjects = async () => {
    setIsLoading(true);
    await axios
      .get("/api/sub/getSubjects")
      .then((response) => {
        setSubjects(response.data.data);
      })
      .catch((error) => {
        console.error("Error fetching subjects:", error);
      });
    setIsLoading(false);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleMethodChange = (method) => {
    setUploadMethod(method);
    if (method === "form") {
      setFormData({
        id: null,
        name: "",
        class: "",
        full_mark: "",
        pass_mark: "",
        cq_mark: "",
        mcq_mark: "",
        practical_mark: "",
        cq_pass_mark: "",
        mcq_pass_mark: "",
        practical_pass_mark: "",
        department: "",
        year: new Date().getFullYear(),
        teacher_id: "",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    if (uploadMethod === "form") {
      if (formData.id) {
        await axios
          .put(`/api/sub/updateSubject/${formData.id}`, formData)
          .then((response) => {
            toast.success("Subject updated successfully.");
            console.log(response.data);

            fetchSubjects();
            setFormData({
              id: null,
              name: "",
              class: "",
              full_mark: "",
              pass_mark: "",
              cq_mark: "",
              mcq_mark: "",
              practical_mark: "",
              cq_pass_mark: "",
              mcq_pass_mark: "",
              practical_pass_mark: "",
              department: "",
              year: new Date().getFullYear(),
              teacher_id: "",
            });
            setShowForm(false);
          })
          .catch((error) => {
            console.error("Error updating subject:", error);
            toast.error(
              error.response?.data?.error || "Error updating subject"
            );
          });
      } else {
        await axios
          .post("/api/sub/addSubject", {
            subjects: [formData],
          })
          .then((response) => {
            toast.success(response.data.message);
            fetchSubjects();
            setFormData({
              id: null,
              name: "",
              class: "",
              full_mark: "",
              pass_mark: "",
              cq_mark: "",
              mcq_mark: "",
              practical_mark: "",
              cq_pass_mark: "",
              mcq_pass_mark: "",
              practical_pass_mark: "",
              department: "",
              year: new Date().getFullYear(),
              teacher_id: "",
            });
            setShowForm(false);
          })
          .catch((error) => {
            console.error("Error adding subject:", error);
            toast.error(error.response?.data?.error || "Error adding subject");
          });
      }
    }
    setIsSubmitting(false);
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileUploaded(true);

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(sheet, rawData);
      const requiredColumns = [
        "name",
        "class",
        "full_mark",
        "pass_mark",
        "cq_mark",
        "mcq_mark",
        "practical_mark",
        "cq_pass_mark",
        "mcq_pass_mark",
        "practical_pass_mark",
        "department",
        "year",
        "teacher_id",
      ];
      const sheetHeaders = rawData[0] || [];
      const hasRequiredColumns = requiredColumns.every((col) =>
        sheetHeaders.includes(col)
      );

      if (!hasRequiredColumns) {
        toast.error(
          "Excel file is missing required columns. Please check the format."
        );
        setFileUploaded(false);
        return;
      }

      setJsonData(XLSX.utils.sheet_to_json(sheet));
    };

    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
      setFileUploaded(false);
    };
  };

  const sendToBackend = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
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
      document.querySelector('input[name="excelFile"]').value = "";
      fetchSubjects();
      setShowForm(false);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to upload Subjects.");
    }
    setIsSubmitting(false);
  };

  const deleteSubject = (id) => {
    axios
      .delete(`/api/sub/deleteSubject/${id}`)
      .then(() => {
        toast.success("Subject deleted successfully.");
        fetchSubjects();
      })
      .catch((error) => {
        console.error("Error deleting subject:", error);
        toast.error(error.response?.data?.error || "Failed to delete subject.");
      });
  };

  const editSubject = (subject) => {
    setUploadMethod("form");
    setShowForm(true);
    setFormData({
      id: subject.id,
      name: subject.name,
      class: subject.class,
      full_mark: subject.full_mark,
      pass_mark: subject.pass_mark,
      cq_mark: subject.cq_mark || "",
      mcq_mark: subject.mcq_mark || "",
      practical_mark: subject.practical_mark || "",
      cq_pass_mark: subject.cq_pass_mark || "",
      mcq_pass_mark: subject.mcq_pass_mark || "",
      practical_pass_mark: subject.practical_pass_mark || "",
      department: subject.department,
      year: subject.year,
      teacher_id: subject.teacher_id,
    });
    // Scroll to the form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancel = () => {
    setFormData({
      id: null,
      name: "",
      class: "",
      full_mark: "",
      pass_mark: "",
      cq_mark: "",
      mcq_mark: "",
      practical_mark: "",
      cq_pass_mark: "",
      mcq_pass_mark: "",
      practical_pass_mark: "",
      department: "",
      year: new Date().getFullYear(),
      teacher_id: "",
    });
    setUploadMethod("form");
    setFileUploaded(false);
    setJsonData(null);
    if (excelFileRef.current) {
      excelFileRef.current.value = null;
    }
    setShowForm(false); // Ensure this is called to hide the form
  };

  const showSubjectInfo = (subject) => {
    setSelectedSubject(subject);
    setShowSubjectDetails(true);
  };

  const filteredSubjects = subjects
    .filter((subject) => subject.year === filterYear)
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort((a, b) => a.class - b.class);

  return (
    <>
      <div className={"max-w-6xl  mx-auto mt-10 px-4 sm:px-6 lg:px-8"}>
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
          <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-0">
            Subject List
          </h1>
          <Button
            type="button"
            variant={`${showForm ? "outline" : ""}`}
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "Cancel" : "+ Add New Subject"}
          </Button>
        </div>
        {showForm && (
          <div className={`p-8 rounded-lg shadow-2xl w-full max-w-6xl `}>
            <h2 className={`text-3xl font-semibold text-center mb-6 `}>
              {formData.id ? "Edit Subject" : "Add New Subject"}
            </h2>
            {!formData.id && (
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => handleMethodChange("form")}
                  className={`px-4 sm:px-6 py-2 rounded-l-lg font-semibold transition-all duration-300 ${
                    uploadMethod === "form"
                      ? "bg-sky-500 text-white shadow-lg"
                      : "bg-accent hover:bg-gray-400 hover:text-gray-900"
                  }`}
                >
                  Form
                </button>
                <button
                  onClick={() => handleMethodChange("file")}
                  className={`px-4 sm:px-6 py-2 rounded-r-lg font-semibold transition-all duration-300 ${
                    uploadMethod === "file"
                      ? "bg-sky-500 text-white shadow-lg"
                      : "bg-accent hover:bg-gray-400 hover:text-gray-900"
                  }`}
                >
                  Excel Upload
                </button>
              </div>
            )}

            <div className="space-y-6">
              {uploadMethod === "form" ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="text"
                      name="name"
                      placeholder="Subject Name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                      required
                    />
                    <input
                      type="number"
                      name="class"
                      placeholder="Class"
                      min={6}
                      max={10}
                      value={formData.class}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      name="full_mark"
                      placeholder="Full Mark"
                      value={formData.full_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                      required
                    />
                    <input
                      type="number"
                      name="pass_mark"
                      placeholder="Pass Mark"
                      value={formData.pass_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="number"
                      name="cq_mark"
                      placeholder="CQ Mark (Optional)"
                      value={formData.cq_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      name="mcq_mark"
                      placeholder="MCQ Mark (Optional)"
                      value={formData.mcq_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      name="practical_mark"
                      placeholder="Practical Mark (Optional)"
                      value={formData.practical_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <input
                      type="number"
                      name="cq_pass_mark"
                      placeholder="CQ Pass Mark (Optional)"
                      value={formData.cq_pass_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      name="mcq_pass_mark"
                      placeholder="MCQ Pass Mark (Optional)"
                      value={formData.mcq_pass_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                    <input
                      type="number"
                      name="practical_pass_mark"
                      placeholder="Practical Pass Mark (Optional)"
                      value={formData.practical_pass_mark}
                      onChange={handleChange}
                      onWheel={(e) => e.target.blur()}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full p-3 border text-input dark:bg-accent border-gray-300 rounded-lg"
                    >
                      <option value="">Select a Department</option>
                      {["Science", "Arts", "Commerce"].map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button disabled={isSubmitting} type="submit">
                      {formData.id ? "Update" : "Submit"}
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
                      ref={excelFileRef}
                      onChange={handleFileUpload}
                      onClick={(e) => {
                        e.target.value = null;
                        setFileUploaded(false);
                      }}
                      className="absolute w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <label
                      htmlFor="excelFile"
                      className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer"
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
                        {fileUploaded &&
                          ` (${excelFileRef.current?.files[0]?.name})`}
                      </span>
                      <span className="text-sm text-gray-500">
                        .xlsx or .xls files only
                      </span>
                    </label>
                  </div>
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
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
        )}
      </div>

      <div className="mt-6 p-4">
        <div className="mb-4 flex items-center">
          <label htmlFor="filterYear" className="font-semibold mr-2">
            Filter by Year:
          </label>
          <select
            id="filterYear"
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="p-2 border text-input dark:bg-accent border-gray-300 rounded-lg"
          >
            <option value={new Date().getFullYear() + 1}>
              {new Date().getFullYear() + 1}
            </option>
            <option value={new Date().getFullYear()}>
              {new Date().getFullYear()}
            </option>
            <option value={new Date().getFullYear() - 1}>
              {new Date().getFullYear() - 1}
            </option>
            <option value={new Date().getFullYear() - 2}>
              {new Date().getFullYear() - 2}
            </option>
          </select>
        </div>
        <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full border divide-y divide-gray-200">
              <thead className="bg-popover">
                <tr>
                  {[
                    "Name",
                    "Class",
                    "Full Mark",
                    "Pass Mark",
                    "Department",
                    "Teacher",
                    "Actions",
                  ].map((header) => (
                    <th key={header} className="px-4 py-2 text-left">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr>
                    <td colSpan="7" className="py-2">
                      <div className="flex justify-center items-center w-full h-full">
                        <Loading />
                      </div>
                    </td>
                  </tr>
                ) : filteredSubjects.length > 0 ? (
                  filteredSubjects.map((subject) => (
                    <tr key={subject.id} className={``}>
                      <td className=" px-4 py-2">{subject.name}</td>
                      <td className=" px-4 py-2">{subject.class}</td>
                      <td className=" px-4 py-2">{subject.full_mark}</td>
                      <td className=" px-4 py-2">{subject.pass_mark}</td>
                      <td className=" px-4 py-2">{subject.department}</td>
                      <td className=" px-4 py-2">
                        {teachers.find(
                          (teacher) => teacher.id === subject.teacher_id
                        )?.name || "N/A"}
                      </td>
                      <td className=" px-4 py-2">
                        <div className="flex space-x-2 justify-center items-center">
                          <button
                            onClick={() => showSubjectInfo(subject)}
                            className="p-1 text-green-500 hover:text-green-700 transition-colors"
                            title="Show Details"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button onClick={() => editSubject(subject)}>
                            <Edit className="sm:w-4 sm:h-4 w-3 h-3 text-blue-500 hover:text-blue-700" />
                          </button>

                          <DeleteConfirmationIcon
                            onDelete={() => deleteSubject(subject.id)}
                            msg={`Are you sure you want to delete this subject (${
                              subject.name
                            }) for ${subject.class} which is assigned to ${
                              teachers.find(
                                (teacher) => teacher.id === subject.teacher_id
                              )?.name || "N/A"
                            } ?`}
                            className="px-3 py-1 bg-red-500 text-white rounded-lg"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="border px-4 py-2 text-center">
                      No subjects found for the selected year
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Subject Details Popup */}
      {showSubjectDetails && selectedSubject && (
        <div className="fixed inset-0 backdrop-blur-xl flex items-center justify-center z-50 p-4">
          <div className="bg-card w-full max-w-2xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Subject Details</h2>
                <button
                  onClick={() => setShowSubjectDetails(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Basic Information
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <strong>Name:</strong> {selectedSubject.name}
                      </div>
                      <div>
                        <strong>Class:</strong> {selectedSubject.class}
                      </div>
                      <div>
                        <strong>Department:</strong>{" "}
                        {selectedSubject.department || "Not specified"}
                      </div>
                      <div>
                        <strong>Year:</strong> {selectedSubject.year}
                      </div>
                      <div>
                        <strong>Teacher:</strong>{" "}
                        {teachers.find(
                          (teacher) => teacher.id === selectedSubject.teacher_id
                        )?.name || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Main Marks
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <strong>Full Mark:</strong> {selectedSubject.full_mark}
                      </div>
                      <div>
                        <strong>Pass Mark:</strong> {selectedSubject.pass_mark}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Detailed Mark Distribution
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-2">
                        Mark Allocation
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div>
                          <strong>CQ Mark:</strong>{" "}
                          {selectedSubject.cq_mark || "Not set"}
                        </div>
                        <div>
                          <strong>MCQ Mark:</strong>{" "}
                          {selectedSubject.mcq_mark || "Not set"}
                        </div>
                        <div>
                          <strong>Practical Mark:</strong>{" "}
                          {selectedSubject.practical_mark || "Not set"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-green-600 dark:text-green-400 mb-2">
                        Pass Mark Requirements
                      </h4>
                      <div className="space-y-1 text-sm">
                        <div>
                          <strong>CQ Pass Mark:</strong>{" "}
                          {selectedSubject.cq_pass_mark || "Not set"}
                        </div>
                        <div>
                          <strong>MCQ Pass Mark:</strong>{" "}
                          {selectedSubject.mcq_pass_mark || "Not set"}
                        </div>
                        <div>
                          <strong>Practical Pass Mark:</strong>{" "}
                          {selectedSubject.practical_pass_mark || "Not set"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Created:</span>
                    <span className="text-sm">
                      {new Date(
                        selectedSubject.created_at
                      ).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowSubjectDetails(false);
                    editSubject(selectedSubject);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Edit Subject
                </button>
                <button
                  onClick={() => setShowSubjectDetails(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
                >
                  Close
                </button>
              </div>
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
                <h2 className="text-xl font-bold">
                  Excel File Format Requirements
                </h2>
                <button
                  onClick={() => setShowFormatInfo(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Your Excel file must contain the following columns with exact
                  names (case-sensitive):
                </p>

                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="font-medium">Required Columns:</div>
                    <div></div>

                    <div>• name</div>
                    <div>• class</div>

                    <div>• full_mark</div>
                    <div>• pass_mark</div>

                    <div>• department</div>
                    <div>• year</div>

                    <div>• teacher_id</div>
                    <div></div>

                    <div className="font-medium col-span-2 mt-2">
                      Optional Columns:
                    </div>

                    <div>• cq_mark</div>
                    <div>• mcq_mark</div>

                    <div>• practical_mark</div>
                    <div>• cq_pass_mark</div>

                    <div>• mcq_pass_mark</div>
                    <div>• practical_pass_mark</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-medium">Important Notes:</h3>
                  <ul className="text-sm space-y-1 list-disc list-inside text-gray-600 dark:text-gray-300">
                    <li>
                      <strong>name:</strong> Subject name (e.g., Mathematics,
                      Physics)
                    </li>
                    <li>
                      <strong>class:</strong> Class number (6-10)
                    </li>
                    <li>
                      <strong>full_mark:</strong> Maximum marks for the subject
                    </li>
                    <li>
                      <strong>pass_mark:</strong> Minimum marks required to pass
                    </li>
                    <li>
                      <strong>cq_mark:</strong> Creative Question marks
                      (optional)
                    </li>
                    <li>
                      <strong>mcq_mark:</strong> Multiple Choice Question marks
                      (optional)
                    </li>
                    <li>
                      <strong>practical_mark:</strong> Practical examination
                      marks (optional)
                    </li>
                    <li>
                      <strong>cq_pass_mark:</strong> Minimum CQ marks to pass
                      (optional)
                    </li>
                    <li>
                      <strong>mcq_pass_mark:</strong> Minimum MCQ marks to pass
                      (optional)
                    </li>
                    <li>
                      <strong>practical_pass_mark:</strong> Minimum practical
                      marks to pass (optional)
                    </li>
                    <li>
                      <strong>department:</strong> Science/Arts/Commerce (leave
                      empty for classes 6-8)
                    </li>
                    <li>
                      <strong>year:</strong> Academic year (e.g., 2024)
                    </li>
                    <li>
                      <strong>teacher_id:</strong> ID of the assigned teacher
                    </li>
                    <li>
                      <strong>File Format:</strong> Only .xlsx or .xls files are
                      accepted
                    </li>
                    <li>First row should contain column headers</li>
                    <li>All required fields must be present</li>
                    <li>Optional mark fields can be left empty or omitted</li>
                  </ul>
                </div>

                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Tip:</strong> To find teacher IDs, check the
                    Teachers section in the admin panel. Make sure the column
                    headers in your Excel file match exactly as listed above.
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
    </>
  );
}

export default NewSubject;
