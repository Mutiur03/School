import React, { useState, useEffect } from "react";
import axios from "axios";
import toast from "react-hot-toast";

function AdmissionResult() {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [activeTab, setActiveTab] = useState("6");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    class_name: "6",
    admission_year: new Date().getFullYear(),
    merit_list: null,
    waiting_list_1: null,
    waiting_list_2: null,
  });
  function getCurrentYear(currentYear) {
    const availableYears = [currentYear, currentYear - 1, currentYear - 2];
    return availableYears;
  }

  const meritListRef = React.useRef();
  const waitingList1Ref = React.useRef();
  const waitingList2Ref = React.useRef();

  const classes = ["6", "7", "8", "9"];
  const listTypes = [
    { key: "merit_list", label: "Merit List", color: "green" },
    { key: "waiting_list_1", label: "Waiting List 1", color: "yellow" },
    { key: "waiting_list_2", label: "Waiting List 2", color: "orange" },
  ];
  const fetchAdmissionSettings = async () => {
    try {
      const res = await axios.get("/api/admission");
      setFormData((prev) => ({
        ...prev,
        admission_year: res.data.admission_year,
      }));
      setAvailableYears(getCurrentYear(res.data.admission_year));
      setSelectedYear(res.data.admission_year);
      setCurrentYear(res.data.admission_year);
    } catch (error) {
      console.error("Failed to fetch admission settings:", error);
    }
  };
  useEffect(() => {
    fetchAdmissionSettings();
    fetchResults();
  }, []);

  const fetchResults = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/admission-result");
      setResults(response.data);
    } catch (error) {
      console.error("Error fetching results:", error);
      toast.error("Failed to fetch admission results");
    } finally {
      setIsLoading(false);
    }
  };
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      admission_year: currentYear,
    }));
  }, [showForm]);
  const handleFileChange = (e, fieldName) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please upload only PDF files");
        e.target.value = "";
        setFormData((prev) => ({ ...prev, [fieldName]: null }));
        return;
      }
      // if (file.size > 10 * 1024 * 1024) {
      //   toast.error("File size must be less than 10MB");
      //   e.target.value = "";
      //   setFormData((prev) => ({ ...prev, [fieldName]: null }));
      //   return;
      // }
      setFormData((prev) => ({ ...prev, [fieldName]: file }));
    } else {
      setFormData((prev) => ({ ...prev, [fieldName]: null }));
    }
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const submitData = new FormData();
    submitData.append("class_name", formData.class_name);
    submitData.append("admission_year", formData.admission_year);

    if (formData.merit_list) {
      submitData.append("merit_list", formData.merit_list);
    }
    if (formData.waiting_list_1) {
      submitData.append("waiting_list_1", formData.waiting_list_1);
    }
    if (formData.waiting_list_2) {
      submitData.append("waiting_list_2", formData.waiting_list_2);
    }
    try {
      if (isEditing) {
        await axios.put(`/api/admission-result/${editId}`, submitData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Admission result updated successfully");
      } else {
        await axios.post("/api/admission-result", submitData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Admission result uploaded successfully");
      }

      resetForm();
      fetchResults();
      setShowForm(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error(
        error.response?.data?.message || "Failed to upload admission result"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (result) => {
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this result?")) {
      return;
    }

    try {
      await axios.delete(`/api/admission-result/${id}`);
      toast.success("Result deleted successfully");
      fetchResults();
    } catch (error) {
      console.error("Error deleting result:", error);
      toast.error("Failed to delete result");
    }
  };

  const resetForm = () => {
    setFormData({
      class_name: "6",
      admission_year: new Date().getFullYear(),
      merit_list: null,
      waiting_list_1: null,
      waiting_list_2: null,
    });
    setIsEditing(false);
    setEditId(null);
  };

  const getResultsByClass = (className) => {
    return results.filter(
      (result) =>
        result.class_name === className &&
        result.admission_year === selectedYear
    );
  };

  const getFileStatus = (fileUrl) => {
    return fileUrl ? (
      <div className="flex items-center gap-1 text-chart-4">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span className="text-xs">Uploaded</span>
      </div>
    ) : (
      <div className="flex items-center gap-1 text-muted-foreground">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span className="text-xs">Not uploaded</span>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4 pb-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-1">Admission Results</h1>
          <p className="text-sm text-muted-foreground">
            Upload merit list and waiting lists for classes 6-9
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
            Upload Result
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card border border-border rounded-lg shadow mb-6">
          <div className="p-5 border-b border-border">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              {isEditing ? "Edit Admission Result" : "Upload Admission Result"}
            </h2>
          </div>
          <div className="p-5">
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Class *
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-border rounded-md bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={formData.class_name}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        class_name: e.target.value,
                        merit_list: null,
                        waiting_list_1: null,
                        waiting_list_2: null,
                      }));
                      if (meritListRef.current) meritListRef.current.value = "";
                      if (waitingList1Ref.current)
                        waitingList1Ref.current.value = "";
                      if (waitingList2Ref.current)
                        waitingList2Ref.current.value = "";
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
                  <label className="block text-sm font-medium mb-1.5">
                    Admission Year *
                  </label>
                  <input
                    className="w-full px-3 py-2 border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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

              {/* File Uploads */}
              <div className="border-t border-border pt-4 mb-6">
                <h3 className="text-lg font-semibold mb-2">Upload PDF Files</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload one or more result lists (PDF format, max 10MB each)
                </p>

                <div className="border border-border rounded-lg p-4 bg-accent mb-4">
                  <label className="block text-base font-medium mb-2">
                    Merit List
                  </label>
                  <input
                    ref={meritListRef}
                    className="w-full px-3 py-2 border-2 border-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, "merit_list")}
                  />
                  {formData.merit_list && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      {typeof formData.merit_list === "string" ? (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Current file: {formData.merit_list.split("/").pop()}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Selected: {formData.merit_list.name}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="border border-border rounded-lg p-4 bg-accent mb-4">
                  <label className="block text-base font-medium mb-2">
                    Waiting List 1
                  </label>
                  <input
                    ref={waitingList1Ref}
                    className="w-full px-3 py-2 border-2 border-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, "waiting_list_1")}
                  />
                  {formData.waiting_list_1 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      {typeof formData.waiting_list_1 === "string" ? (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Current file:{" "}
                          {formData.waiting_list_1.split("/").pop()}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Selected: {formData.waiting_list_1.name}
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="border border-border rounded-lg p-4 bg-accent mb-4">
                  <label className="block text-base font-medium mb-2">
                    Waiting List 2
                  </label>
                  <input
                    ref={waitingList2Ref}
                    className="w-full px-3 py-2 border-2 border-background rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-ring mb-2"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleFileChange(e, "waiting_list_2")}
                  />
                  {formData.waiting_list_2 && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      {typeof formData.waiting_list_2 === "string" ? (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Current file:{" "}
                          {formData.waiting_list_2.split("/").pop()}
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4 text-chart-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                            <polyline points="22 4 12 14.01 9 11.01"></polyline>
                          </svg>
                          Selected: {formData.waiting_list_2.name}
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg
                        className="h-4 w-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="12" y1="2" x2="12" y2="6"></line>
                        <line x1="12" y1="18" x2="12" y2="22"></line>
                        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                        <line
                          x1="16.24"
                          y1="16.24"
                          x2="19.07"
                          y2="19.07"
                        ></line>
                        <line x1="2" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="22" y2="12"></line>
                        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                      </svg>
                      {isEditing ? "Updating..." : "Uploading..."}
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      {isEditing ? "Update Result" : "Upload Result"}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 border border-border rounded-md bg-card text-card-foreground hover:bg-accent transition-colors"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Results Display - Tabs by Class */}
      <div className="bg-card border border-border rounded-lg shadow">
        <div className="p-5 border-b border-border">
          <div className="flex justify-between items-center gap-4">
            <h2 className="text-xl font-semibold">Uploaded Results</h2>
            <div>
              <label className="block text-sm font-medium mb-2">
                Filter by Admission Year
              </label>
              <select
                className="px-4 py-2 border border-border rounded-md bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
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
          </div>
        </div>
        <div className="p-5">
          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <div className="flex">
              {classes.map((cls) => (
                <button
                  key={cls}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === cls
                      ? "text-primary border-primary"
                      : "text-muted-foreground border-transparent hover:text-foreground"
                  }`}
                  onClick={() => setActiveTab(cls)}
                >
                  Class {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <svg
                className="h-8 w-8 animate-spin text-primary"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
              </svg>
            </div>
          ) : getResultsByClass(activeTab).length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              <svg
                className="h-12 w-12 mx-auto mb-3 opacity-50"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <p>No results uploaded for Class {activeTab}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {getResultsByClass(activeTab).map((result) => (
                <div
                  key={result.id}
                  className="bg-card border border-border rounded-lg shadow border-l-4 border-l-primary"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">
                          Class {result.class_name} - {result.admission_year}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Uploaded on:{" "}
                          {new Date(result.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          className="p-2 border border-border rounded-md bg-card hover:bg-accent transition-colors"
                          onClick={() => handleEdit(result)}
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          className="p-2 border border-destructive text-destructive rounded-md hover:bg-accent transition-colors"
                          onClick={() => handleDelete(result.id)}
                        >
                          <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {listTypes.map((listType) => (
                        <div
                          key={listType.key}
                          className="border border-border rounded-lg p-4 bg-accent"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="text-sm font-medium">
                              {listType.label}
                            </h4>
                            {getFileStatus(result[listType.key])}
                          </div>
                          {result[listType.key] && (
                            <a
                              href={result[listType.key]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 text-primary hover:underline text-sm mt-2"
                            >
                              <svg
                                className="h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                              View PDF
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdmissionResult;
