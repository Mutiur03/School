import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Search,
  Download,
  Image,
  Eye,
  Edit,
  Trash2,
  Filter,
  Loader2,
  Plus,
  FileText,
  Settings,
  RefreshCw,
} from "lucide-react";

const SSCRegForm = () => {
  const [allRegistrations, setAllRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedRegistration, setSelectedRegistration] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filters, setFilters] = useState({
    status: "all",
    search: "",
    section: "",
    sscBatch: "", 
  });
  const [formData, setFormData] = useState({
    a_sec_roll: "",
    b_sec_roll: "",
    ssc_year: new Date().getFullYear(),
    reg_open: false,
    instruction_for_a: "Please follow the instructions carefully",
    instruction_for_b: "Please follow the instructions carefully",
    attachment_instruction: "Please attach all required documents",
  });
  const [noticeFile, setNoticeFile] = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [activeTab, setActiveTab] = useState("registrations");
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const host = import.meta.env.VITE_BACKEND_URL;

  // Only fetch when batch changes
  useEffect(() => {
    fetchAllRegistrations();
    fetchSSCReg();
  }, [filters.sscBatch]);

  const fetchAllRegistrations = async () => {
    try {
      setLoading(true);

      const sscSettingsRes = await axios.get("/api/reg/ssc");
      let targetBatch = new Date().getFullYear().toString();

      if (sscSettingsRes.data.success) {
        targetBatch = sscSettingsRes.data.data.ssc_year.toString();
      }

      setFilters((prev) => ({
        ...prev,
        sscBatch: targetBatch,
      }));

      const response = await axios.get(
        `/api/reg/ssc/form?sscBatch=${encodeURIComponent(
          targetBatch
        )}&limit=1000`
      );

      if (response.data.success) {
        setAllRegistrations(response.data.data);
      } else {
        setAllRegistrations([]);
      }
    } catch (err) {
      console.error("Failed to fetch registrations:", err);
      setError("Failed to fetch registrations");
      setAllRegistrations([]);

      // Fallback to current year
      const currentYear = new Date().getFullYear().toString();
      setFilters((prev) => ({
        ...prev,
        sscBatch: currentYear,
      }));
    } finally {
      setLoading(false);
    }
  };

  const fetchSSCReg = async () => {
    try {
      setFormLoading(true);
      const response = await axios.get("/api/reg/ssc");
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          a_sec_roll: data.a_sec_roll || "",
          b_sec_roll: data.b_sec_roll || "",
          ssc_year: data.ssc_year || new Date().getFullYear(),
          reg_open: data.reg_open || false,
          instruction_for_a:
            data.instruction_for_a ||
            "Please follow the instructions carefully",
          instruction_for_b:
            data.instruction_for_b ||
            "Please follow the instructions carefully",
          attachment_instruction:
            data.attachment_instruction ||
            "Please attach all required documents",
        });
        setCurrentNotice(
          data.notice ? { url: data.notice, download_url: data.notice } : null
        );
        setIsEdit(true);
      } else {
        // Reset to default if no settings found
        setFormData({
          a_sec_roll: "",
          b_sec_roll: "",
          ssc_year: new Date().getFullYear(),
          reg_open: false,
          instruction_for_a: "Please follow the instructions carefully",
          instruction_for_b: "Please follow the instructions carefully",
          attachment_instruction: "Please attach all required documents",
        });
        setIsEdit(false);
      }
    } catch (error) {
      console.error("Error fetching SSC registration data:", error);
      if (error.response?.status !== 404) {
        setFormMessage("Error fetching SSC registration data");
      }
      setIsEdit(false);
    } finally {
      setFormLoading(false);
    }
  };

  // Filter registrations client-side
  const filteredRegistrations = useMemo(() => {
    return allRegistrations.filter((registration) => {
      // Status filter
      if (filters.status !== "all" && registration.status !== filters.status) {
        return false;
      }

      // Section filter
      if (filters.section && registration.section !== filters.section) {
        return false;
      }

      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const searchFields = [
          registration.student_name_en,
          registration.student_name_bn,
          registration.roll,
          registration.birth_reg_no,
          registration.father_name_en,
          registration.mother_name_en,
        ];

        const matchesSearch = searchFields.some(
          (field) =>
            field && field.toString().toLowerCase().includes(searchTerm)
        );

        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });
  }, [allRegistrations, filters.status, filters.section, filters.search]);

  const stats = useMemo(() => {
    const total = allRegistrations.length;
    const pending = allRegistrations.filter(
      (r) => r.status === "pending"
    ).length;
    const approved = allRegistrations.filter(
      (r) => r.status === "approved"
    ).length;
    const rejected = allRegistrations.filter(
      (r) => r.status === "rejected"
    ).length;

    return { total, pending, approved, rejected };
  }, [allRegistrations]);

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`/api/reg/ssc/form/${id}`);
      if (response.data.success) {
        setAllRegistrations((prev) => prev.filter((reg) => reg.id !== id));
        setShowDeleteModal(false);
        setDeleteTarget(null);
      }
    } catch (err) {
      setError("Failed to delete registration");
      console.error(err);
    }
  };

  const handleEdit = async (id) => {
    try {
      // Find in local data (now contains all fields)
      const localRegistration = allRegistrations.find((reg) => reg.id === id);
      if (localRegistration) {
        setEditFormData(localRegistration);
        setShowEditModal(true);
      } else {
        setError("Registration not found in local data");
      }
    } catch (err) {
      setError("Failed to load registration for editing");
      console.error(err);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.put(
        `/api/reg/ssc/form/${editFormData.id}/status`,
        {
          status: editFormData.status,
        }
      );

      if (response.data.success) {
        // Update local state instead of refetching
        setAllRegistrations((prev) =>
          prev.map((reg) =>
            reg.id === editFormData.id
              ? { ...reg, status: editFormData.status }
              : reg
          )
        );
        setShowEditModal(false);
        setEditFormData({});
      }
    } catch (err) {
      setError("Failed to update registration status");
      console.error(err);
    }
  };

  const confirmDelete = (registration) => {
    setDeleteTarget(registration);
    setShowDeleteModal(true);
  };

  const handleViewDetails = async (id) => {
    try {
      // Find in local data (now contains all fields)
      const localRegistration = allRegistrations.find((reg) => reg.id === id);
      if (localRegistration) {
        setSelectedRegistration(localRegistration);
        setShowModal(true);
      } else {
        setError("Registration not found in local data");
      }
    } catch (err) {
      setError("Failed to load registration details");
      console.error(err);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      // Build query parameters for export
      const params = new URLSearchParams();
      if (filters.sscBatch) params.append("sscBatch", filters.sscBatch);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.section) params.append("section", filters.section);

      const response = await axios.get(`/api/reg/ssc/form/export?${params}`, {
        responseType: "blob",
      });

      // Create download link
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename
      const currentDate = new Date().toISOString().split("T")[0];
      let filename = `SSC_Registrations_${currentDate}`;
      if (filters.sscBatch) filename += `_Batch${filters.sscBatch}`;
      if (filters.section) filename += `_Section${filters.section}`;
      if (filters.status !== "all") filename += `_${filters.status}`;
      filename += ".xlsx";

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export registrations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportImages = async () => {
    try {
      setLoading(true);

      // Build query parameters for export
      const params = new URLSearchParams();
      if (filters.sscBatch) params.append("sscBatch", filters.sscBatch);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.section) params.append("section", filters.section);

      const response = await axios.get(
        `/api/reg/ssc/form/export-images?${params}`,
        {
          responseType: "blob",
        }
      );

      // Create download link
      const blob = new Blob([response.data], {
        type: "application/zip",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Generate filename
      const currentDate = new Date().toISOString().split("T")[0];
      let filename = `SSC_Photos_${currentDate}`;
      if (filters.sscBatch) filename += `_Batch${filters.sscBatch}`;
      if (filters.section) filename += `_Section${filters.section}`;
      if (filters.status !== "all") filename += `_${filters.status}`;
      filename += ".zip";

      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export images");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || "").toString().toLowerCase();
    const label = s ? s.charAt(0).toUpperCase() + s.slice(1) : "-";

    let classes = "px-3 py-1 rounded-full text-xs font-semibold";
    if (s === "approved") {
      classes = `${classes} bg-emerald-100 text-emerald-800`;
    } else if (s === "pending") {
      classes = `${classes} bg-amber-100 text-amber-800`;
    } else if (s === "rejected") {
      classes = `${classes} bg-red-100 text-red-800`;
    } else {
      classes = `${classes} bg-gray-100 text-gray-800`;
    }

    return <span className={classes}>{label}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setNoticeFile(file);
    } else {
      setFormMessage("Please select a PDF file");
      setTimeout(() => setFormMessage(""), 3000);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);

      const formDataToSend = new FormData();
      formDataToSend.append("a_sec_roll", formData.a_sec_roll);
      formDataToSend.append("b_sec_roll", formData.b_sec_roll);
      formDataToSend.append("ssc_year", formData.ssc_year);
      formDataToSend.append("reg_open", formData.reg_open);
      formDataToSend.append("instruction_for_a", formData.instruction_for_a);
      formDataToSend.append("instruction_for_b", formData.instruction_for_b);
      formDataToSend.append(
        "attachment_instruction",
        formData.attachment_instruction
      );

      if (noticeFile) {
        formDataToSend.append("notice", noticeFile);
      }

      const response = await axios.post("/api/reg/ssc", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setFormMessage("SSC Registration saved successfully!");
        setIsEdit(true);
        setNoticeFile(null);

        const data = response.data.data;
        if (data.notice) {
          setCurrentNotice({
            url: data.notice,
            download_url: data.notice,
          });
        }

        const fileInput = document.getElementById("notice");
        if (fileInput) fileInput.value = "";

        setTimeout(() => setFormMessage(""), 3000);
      }
    } catch (error) {
      setFormMessage(
        error.response?.data?.message || "Error saving SSC registration"
      );
      setTimeout(() => setFormMessage(""), 3000);
    } finally {
      setFormLoading(false);
    }
  };

  const removeNotice = async () => {
    try {
      setFormLoading(true);
      const response = await axios.delete("/api/reg/ssc");

      if (response.data.success) {
        setCurrentNotice(null);
        setNoticeFile(null);
        setFormMessage("Notice removed successfully!");
        setTimeout(() => setFormMessage(""), 3000);
      }
    } catch (error) {
      setFormMessage(error.response?.data?.message || "Error removing notice");
      setTimeout(() => setFormMessage(""), 3000);
    } finally {
      setFormLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchAllRegistrations();
    fetchSSCReg();
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header with Tabs */}
      <div className="mb-8">
        <div className="flex flex-col md:flex-row justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              SSC Registration Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Configure settings and monitor student registrations
            </p>
          </div>
        </div>
          <div className="flex justify-end mb-4 md:mt-0">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap space-x-1 bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("registrations")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "registrations"
                ? "bg-blue-500 text-white shadow-md"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            Registrations
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "settings"
                ? "bg-blue-500 text-white shadow-md"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            <Settings size={16} className="inline mr-1" />
            Settings
          </button>
        </div>
      </div>

      {activeTab === "settings" && (
        <div className="space-y-6">
          {/* Form Message */}
          {formMessage && (
            <div
              className={`p-3 rounded-lg ${
                formMessage.includes("Error")
                  ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900 dark:text-red-200 dark:border-red-700"
                  : "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-700"
              }`}
            >
              {formMessage}
            </div>
          )}

          {/* Settings Form */}
          <div className="bg-card text-card-foreground rounded-xl border border-border p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h2 className="text-lg font-medium text-foreground mb-6 dark:text-gray-100">
              {isEdit ? "Update Configuration" : "Create Configuration"}
            </h2>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="bg-primary/10 border border-primary rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-700">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="reg_open"
                    name="reg_open"
                    checked={formData.reg_open}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        reg_open: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <label
                    htmlFor="reg_open"
                    className="text-sm font-medium text-primary dark:text-blue-300"
                  >
                    Open Registration for Students
                  </label>
                </div>
                <p className="text-xs text-primary/80 mt-2 dark:text-blue-400">
                  When enabled, students can submit their SSC registration forms
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label
                    htmlFor="a_sec_roll"
                    className="block text-sm font-medium  mb-2"
                  >
                    Section A Roll Range
                  </label>
                  <input
                    type="text"
                    id="a_sec_roll"
                    name="a_sec_roll"
                    value={formData.a_sec_roll}
                    onChange={handleInputChange}
                    placeholder="e.g., 101-150"
                    className="w-full px-3 py-2 border text-input dark:dark:bg-accent border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="b_sec_roll"
                    className="block text-sm font-medium  mb-2"
                  >
                    Section B Roll Range
                  </label>
                  <input
                    type="text"
                    id="b_sec_roll"
                    name="b_sec_roll"
                    value={formData.b_sec_roll}
                    onChange={handleInputChange}
                    placeholder="e.g., 151-200"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="ssc_year"
                  className="block text-sm font-medium  mb-2"
                >
                  SSC Year
                </label>
                <input
                  type="text"
                  id="ssc_year"
                  name="ssc_year"
                  value={formData.ssc_year}
                  onChange={handleInputChange}
                  min="2020"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="instruction_for_a"
                  className="block text-sm font-medium  mb-2"
                >
                  Instructions for Section A Students
                </label>
                <textarea
                  id="instruction_for_a"
                  name="instruction_for_a"
                  value={formData.instruction_for_a}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Enter instructions for Section A students..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-red-500 mt-1">
                  These instructions will be shown to Section A students during
                  registration
                </p>
              </div>

              <div>
                <label
                  htmlFor="instruction_for_b"
                  className="block text-sm font-medium  mb-2"
                >
                  Instructions for Section B Students
                </label>
                <textarea
                  id="instruction_for_b"
                  name="instruction_for_b"
                  value={formData.instruction_for_b}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Enter instructions for Section B students..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-red-500 mt-1">
                  These instructions will be shown to Section B students during
                  registration
                </p>
              </div>

              <div>
                <label
                  htmlFor="attachment_instruction"
                  className="block text-sm font-medium  mb-2"
                >
                  Attachment Instructions
                </label>
                <textarea
                  id="attachment_instruction"
                  name="attachment_instruction"
                  value={formData.attachment_instruction}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Enter instructions for document attachments..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-red-500 mt-1">
                  These instructions will guide students on what documents to
                  attach
                </p>
              </div>

              {/* Notice Document Section - existing code */}
              <div>
                <label
                  htmlFor="notice"
                  className="block text-sm font-medium  mb-2"
                >
                  Notice Document
                </label>

                {/* Current Notice */}
                {currentNotice && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={18} className="text-red-600" />
                        <span className="text-sm ">Current Notice PDF</span>
                      </div>
                      <div className="flex gap-3">
                        <a
                          href={currentNotice.download_url}
                          target="_blank"
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={removeNotice}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <input
                  type="file"
                  id="notice"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <p className="text-xs text-red-500 mt-1">
                  Only PDF files are allowed
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={formLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  {formLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {isEdit ? "Updating..." : "Creating..."}
                    </>
                  ) : isEdit ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>

            {/* Info Box */}
            {/* <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Information
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Only one configuration is allowed at a time</li>
                <li>• Roll ranges format: start-end (e.g. 1,2,4-150)</li>
                <li>• Notice must be a PDF document</li>
                <li>
                  • Registration status controls whether students can register
                </li>
                <li>
                  • Separate instructions can be set for Section A and Section B
                  students
                </li>
              </ul>
            </div> */}
          </div>
        </div>
      )}

      {/* Registrations Tab */}
      {activeTab === "registrations" && (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="text-sm mb-1 ">Total</div>
              <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {stats.total || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="text-sm  mb-1 ">Pending</div>
              <div className="text-2xl font-semibold text-amber-600">
                {stats.pending || 0}
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm dark:bg-gray-800 dark:border-gray-700">
              <div className="text-sm  mb-1 ">Approved</div>
              <div className="text-2xl font-semibold text-emerald-600">
                {stats.approved || 0}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Filter size={18} className="text-gray-500 dark:text-gray-300" />
              <h3 className="font-medium text-gray-900 dark:text-gray-100">
                Filters
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium  mb-1">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, status: e.target.value }))
                  }
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium  mb-1">
                  Section
                </label>
                <select
                  value={filters.section}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, section: e.target.value }))
                  }
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Sections</option>
                  <option value="A">Section A</option>
                  <option value="B">Section B</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium  mb-1">
                  SSC Batch
                </label>
                <select
                  value={filters.sscBatch}
                  onChange={(e) => {
                    const newBatch = e.target.value;
                    setFilters((prev) => ({ ...prev, sscBatch: newBatch }));
                    // Refetch data when batch changes
                    if (newBatch !== filters.sscBatch) {
                      fetchAllRegistrations();
                    }
                  }}
                  className="w-full px-3 py-2 border dark:bg-accent  border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {Array.from(
                    new Set([
                      filters.sscBatch,
                      new Date().getFullYear().toString(),
                      (new Date().getFullYear() - 1).toString(),
                      (new Date().getFullYear() + 1).toString(),
                    ])
                  )
                    .filter(Boolean)
                    .sort()
                    .reverse()
                    .map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium  mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search
                    size={18}
                    className="absolute left-3 top-2.5 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Search by name, roll, birth reg..."
                    value={filters.search}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: e.target.value,
                      }))
                    }
                    className="w-full pl-10 dark:bg-accent pr-3 py-2 border text-input border-gray-300 rounded-lg focus:ring-2  focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Main Table */}
          <div className="bg-card text-card-foreground rounded-xl border border-border shadow-sm overflow-hidden dark:bg-gray-800 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    Registrations
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Showing {filteredRegistrations.length} of{" "}
                    {allRegistrations.length} students
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExport}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-blue-900/10 dark:text-blue-200 dark:border-blue-700"
                  >
                    <Download
                      size={16}
                      className="text-blue-700 dark:text-blue-200"
                    />
                    Excel
                  </button>
                  <button
                    onClick={handleExportImages}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg bg-green-50 text-green-700 border-green-200 hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:bg-emerald-900/10 dark:text-emerald-200 dark:border-green-700"
                  >
                    <Image
                      size={16}
                      className="text-green-700 dark:text-emerald-200"
                    />
                    Images
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Section
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Roll
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-300"></div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRegistrations.length === 0 ? (
                    <tr>
                      <td
                        colSpan="6"
                        className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"
                      >
                        No registrations found
                      </td>
                    </tr>
                  ) : (
                    filteredRegistrations.map((registration) => (
                      <tr
                        key={registration.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {registration.photo_path && (
                              <img
                                className="h-10 w-10 rounded-full object-cover border border-gray-200 dark:border-gray-600"
                                src={`${host}/${registration.photo_path}`}
                                alt=""
                              />
                            )}
                            <div>
                              <div className="font-medium text-gray-900 dark:text-gray-100">
                                {registration.student_name_en}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                {registration.student_name_bn}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
                            Section {registration.section}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                            {registration.roll}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {getStatusBadge(registration.status)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(registration.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewDetails(registration.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors dark:bg-blue-900/10 dark:text-blue-200 dark:hover:bg-blue-800"
                            >
                              <Eye size={12} />
                              View
                            </button>
                            <button
                              onClick={() => handleEdit(registration.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors dark:bg-emerald-900/10 dark:text-emerald-200 dark:hover:bg-emerald-800"
                            >
                              <Edit size={12} />
                              Edit
                            </button>
                            <button
                              onClick={() => confirmDelete(registration)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors dark:bg-red-900/10 dark:text-red-200 dark:hover:bg-red-800"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* View Details Modal */}
          {showModal && selectedRegistration && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white text-black rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
                {/* Updated modal header for better visual hierarchy */}
                <div className="flex justify-between items-center p-6 border-b border-gray-300 bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-t-xl">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Registration Details
                    </h3>
                    <p className="text-sm opacity-90 mt-1">
                      Complete student information
                    </p>
                  </div>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-white hover:text-gray-200 transition-colors"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-6">
                  {/* Student Photo */}
                  {selectedRegistration.photo_path && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col items-center mb-6">
                      <h4 className="text-sm font-semibold mb-2 ">
                        Student's Photo
                      </h4>
                      <img
                        src={`${host}/${selectedRegistration.photo_path}`}
                        alt="Student Photo"
                        className="w-28 h-28 object-cover border-2 border-gray-300 rounded-lg shadow"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  )}

                  {/* Basic Info Banner */}
                  <div className="text-sm font-medium text-gray-800 border border-gray-200 rounded px-3 py-2 bg-gray-50 flex flex-wrap gap-x-4 gap-y-1 shadow-sm mb-6">
                    <span>Section: {selectedRegistration.section || "-"}</span>
                    <span>Roll No: {selectedRegistration.roll || "-"}</span>
                    <span>
                      Religion: {selectedRegistration.religion || "-"}
                    </span>
                    <span>
                      JSC/JDC Regi. No: {selectedRegistration.jsc_reg_no || "-"}
                    </span>
                    <span className="ml-auto">
                      Status: {getStatusBadge(selectedRegistration.status)}
                    </span>
                  </div>

                  {/* Comprehensive Information Table */}
                  <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {/* Personal Information Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              ব্যক্তিগত তথ্য (Personal Information)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              ছাত্রের নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.student_name_bn || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Student's Name (In Capital Letter):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.student_name_en || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Birth Registration No. (In English):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.birth_reg_no || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Date of Birth (According to JSC/JDC):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.birth_date ? (
                                (() => {
                                  const formatDateLong = (dateStr) => {
                                    if (!dateStr) return "";
                                    let d, m, y;
                                    if (
                                      /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)
                                    ) {
                                      [d, m, y] = dateStr.split("/");
                                    } else if (
                                      /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
                                    ) {
                                      [y, m, d] = dateStr.split("-");
                                    } else {
                                      return dateStr;
                                    }
                                    const dateObj = new Date(`${y}-${m}-${d}`);
                                    if (isNaN(dateObj.getTime()))
                                      return dateStr;
                                    return dateObj.toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    });
                                  };
                                  return formatDateLong(
                                    selectedRegistration.birth_date
                                  );
                                })()
                              ) : (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Email Address:
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.email || "No"}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Mobile No (s):
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const phones = [
                                  selectedRegistration.father_phone,
                                  selectedRegistration.mother_phone,
                                  selectedRegistration.guardian_phone,
                                ].filter(Boolean);
                                return phones.length > 0
                                  ? phones.join(", ")
                                  : "No";
                              })()}
                            </td>
                          </tr>

                          {/* Father's Information Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              পিতার তথ্য (Father's Information)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              পিতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.father_name_bn || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Father's Name (In Capital Letter):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.father_name_en || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              National ID Number (In English):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.father_nid || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Mother's Information Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              মাতার তথ্য (Mother's Information)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              মাতার নাম (JSC/JDC রেজিস্ট্রেশন অনুযায়ী):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.mother_name_bn || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Mother's Name (In Capital Letter):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.mother_name_en || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              National ID Number (In English):
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.mother_nid || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Guardian's Information Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              অভিভাবকের তথ্য (Guardian's Information)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Guardian's Name:
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                if (
                                  !selectedRegistration.guardian_name &&
                                  !selectedRegistration.guardian_phone &&
                                  !selectedRegistration.guardian_relation &&
                                  !selectedRegistration.guardian_nid
                                ) {
                                  return "Not Applicable";
                                }
                                return (
                                  [
                                    selectedRegistration.guardian_name
                                      ? `Name: ${selectedRegistration.guardian_name}`
                                      : "",
                                    selectedRegistration.guardian_relation
                                      ? `Relation: ${selectedRegistration.guardian_relation}`
                                      : "",
                                    selectedRegistration.guardian_phone
                                      ? `Phone: ${selectedRegistration.guardian_phone}`
                                      : "",
                                    selectedRegistration.guardian_nid
                                      ? `NID: ${selectedRegistration.guardian_nid}`
                                      : "",
                                  ]
                                    .filter(Boolean)
                                    .join(", ") || "Not Applicable"
                                );
                              })()}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Guardian's Address:
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const joinAddr = (
                                  village,
                                  postOffice,
                                  postCode,
                                  upazila,
                                  district
                                ) => {
                                  return (
                                    [
                                      village || "",
                                      postOffice
                                        ? postCode
                                          ? `${postOffice} (${postCode})`
                                          : postOffice
                                        : "",
                                      upazila || "",
                                      district || "",
                                    ]
                                      .filter(Boolean)
                                      .map((s) => s.toString().trim())
                                      .filter((s) => s.length > 0)
                                      .join(", ") || null
                                  );
                                };
                                const address = joinAddr(
                                  selectedRegistration.guardian_village_road,
                                  selectedRegistration.guardian_post_office,
                                  selectedRegistration.guardian_post_code,
                                  selectedRegistration.guardian_upazila,
                                  selectedRegistration.guardian_district
                                );
                                return address || "Not Applicable";
                              })()}
                            </td>
                          </tr>

                          {/* Address Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              ঠিকানা (Address)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Permanent Address:
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const joinAddr = (
                                  village,
                                  postOffice,
                                  postCode,
                                  upazila,
                                  district
                                ) => {
                                  return (
                                    [
                                      village || "",
                                      postOffice
                                        ? postCode
                                          ? `${postOffice} (${postCode})`
                                          : postOffice
                                        : "",
                                      upazila || "",
                                      district || "",
                                    ]
                                      .filter(Boolean)
                                      .map((s) => s.toString().trim())
                                      .filter((s) => s.length > 0)
                                      .join(", ") || null
                                  );
                                };
                                return (
                                  joinAddr(
                                    selectedRegistration.permanent_village_road,
                                    selectedRegistration.permanent_post_office,
                                    selectedRegistration.permanent_post_code,
                                    selectedRegistration.permanent_upazila,
                                    selectedRegistration.permanent_district
                                  ) || (
                                    <span className="text-gray-400">
                                      Not provided
                                    </span>
                                  )
                                );
                              })()}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Present Address:
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const joinAddr = (
                                  village,
                                  postOffice,
                                  postCode,
                                  upazila,
                                  district
                                ) => {
                                  return (
                                    [
                                      village || "",
                                      postOffice
                                        ? postCode
                                          ? `${postOffice} (${postCode})`
                                          : postOffice
                                        : "",
                                      upazila || "",
                                      district || "",
                                    ]
                                      .filter(Boolean)
                                      .map((s) => s.toString().trim())
                                      .filter((s) => s.length > 0)
                                      .join(", ") || null
                                  );
                                };
                                return (
                                  joinAddr(
                                    selectedRegistration.present_village_road,
                                    selectedRegistration.present_post_office,
                                    selectedRegistration.present_post_code,
                                    selectedRegistration.present_upazila,
                                    selectedRegistration.present_district
                                  ) || (
                                    <span className="text-gray-400">
                                      Not provided
                                    </span>
                                  )
                                );
                              })()}
                            </td>
                          </tr>

                          {/* Academic Information Section */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              শিক্ষাগত তথ্য (Academic Information)
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              ৮ম শ্রেণির তথ্য:
                            </td>
                            <td className="py-2 px-4">
                              Section:{" "}
                              {selectedRegistration.section_in_class_8 || "-"},
                              Roll:{" "}
                              {selectedRegistration.roll_in_class_8 || "-"}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Previous School Name & Address:
                            </td>
                            <td className="py-2 px-4">
                              {[
                                selectedRegistration.prev_school_name,
                                selectedRegistration.prev_school_upazila,
                                selectedRegistration.prev_school_district,
                              ]
                                .filter(Boolean)
                                .join(", ") || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              জেএসসি/জেডিসি'র তথ্য:
                            </td>
                            <td className="py-2 px-4">
                              {[
                                selectedRegistration.jsc_board
                                  ? `Board: ${selectedRegistration.jsc_board}`
                                  : "",
                                selectedRegistration.jsc_passing_year
                                  ? `Passing Year: ${selectedRegistration.jsc_passing_year}`
                                  : "",
                                selectedRegistration.jsc_roll_no
                                  ? `Roll No: ${selectedRegistration.jsc_roll_no}`
                                  : "Roll No: N/A",
                              ]
                                .filter(Boolean)
                                .join(", ") || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              আবশ্যিক ও ৪র্থ বিষয়:
                            </td>
                            <td className="py-2 px-4">
                              {[
                                selectedRegistration.group_class_nine || "",
                                selectedRegistration.main_subject
                                  ? `, ${selectedRegistration.main_subject}`
                                  : "",
                                selectedRegistration.fourth_subject
                                  ? `, 4th: ${selectedRegistration.fourth_subject}`
                                  : "",
                              ]
                                .map((s) => s.trim())
                                .filter(Boolean)
                                .join(" ") || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Scholarship Information:
                            </td>
                            <td className="py-2 px-4">
                              {(() => {
                                const stipend = selectedRegistration.upobritti
                                  ? `উপবৃত্তি: ${
                                      selectedRegistration.upobritti === "Yes"
                                        ? "হ্যাঁ"
                                        : "না"
                                    }`
                                  : "";
                                const govScholarship =
                                  selectedRegistration.sorkari_brirti
                                    ? `সরকারি বৃত্তি: ${
                                        selectedRegistration.sorkari_brirti ===
                                        "No"
                                          ? "না"
                                          : selectedRegistration.sorkari_brirti ===
                                            "Talentpool"
                                          ? "মেধাবৃত্তি"
                                          : selectedRegistration.sorkari_brirti ===
                                            "General"
                                          ? "সাধারণ বৃত্তি"
                                          : selectedRegistration.sorkari_brirti
                                      }`
                                    : "";

                                const result = [stipend, govScholarship]
                                  .filter(Boolean)
                                  .join(", ");
                                return (
                                  result || (
                                    <span className="text-gray-400">
                                      Not specified
                                    </span>
                                  )
                                );
                              })()}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              বাসার নিকটবর্তী নবম শ্রেণিতে অধ্যয়নরত ছাত্রের
                              তথ্য:
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.nearby_nine_student_info || (
                                <span className="text-gray-400">
                                  Not provided
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Additional Information (if any) */}
                          {(selectedRegistration.student_nick_name_bn ||
                            selectedRegistration.blood_group) && (
                            <>
                              <tr>
                                <td
                                  colSpan="2"
                                  className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                                >
                                  অতিরিক্ত তথ্য (Additional Information)
                                </td>
                              </tr>
                              {selectedRegistration.student_nick_name_bn && (
                                <tr className="border-b">
                                  <td className="py-2 px-4 font-medium  bg-gray-50">
                                    ডাকনাম:
                                  </td>
                                  <td className="py-2 px-4">
                                    {selectedRegistration.student_nick_name_bn}
                                  </td>
                                </tr>
                              )}
                              {selectedRegistration.blood_group && (
                                <tr
                                  className={`border-b ${
                                    selectedRegistration.student_nick_name_bn
                                      ? "bg-gray-50"
                                      : ""
                                  }`}
                                >
                                  <td
                                    className={`py-2 px-4 font-medium  ${
                                      selectedRegistration.student_nick_name_bn
                                        ? "bg-gray-100"
                                        : "bg-gray-50"
                                    }`}
                                  >
                                    Blood Group:
                                  </td>
                                  <td className="py-2 px-4">
                                    {selectedRegistration.blood_group}
                                  </td>
                                </tr>
                              )}
                            </>
                          )}

                          {/* System Information */}
                          <tr>
                            <td
                              colSpan="2"
                              className="bg-blue-100 font-bold text-lg px-4 py-3 text-blue-800 border-b"
                            >
                              System Information
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              SSC Batch:
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.ssc_batch || (
                                <span className="text-gray-400">Not set</span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Registration Status:
                            </td>
                            <td className="py-2 px-4">
                              {getStatusBadge(selectedRegistration.status)}
                            </td>
                          </tr>
                          <tr className="border-b">
                            <td className="py-2 px-4 font-medium  bg-gray-50">
                              Submission Date:
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.submission_date ? (
                                formatDate(selectedRegistration.submission_date)
                              ) : (
                                <span className="text-gray-400">
                                  Not available
                                </span>
                              )}
                            </td>
                          </tr>
                          <tr className="border-b bg-gray-50">
                            <td className="py-2 px-4 font-medium  bg-gray-100">
                              Last Updated:
                            </td>
                            <td className="py-2 px-4">
                              {selectedRegistration.updated_at ? (
                                formatDate(selectedRegistration.updated_at)
                              ) : (
                                <span className="text-gray-400">
                                  Not available
                                </span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center p-6 border-t border-gray-200 bg-gray-50">
                  <div className="text-sm text-gray-600">
                    Registration ID: {selectedRegistration.id}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!selectedRegistration || pdfDownloading) return;
                        setPdfDownloading(true);
                        try {
                          const response = await axios.get(
                            `/api/reg/ssc/form/${selectedRegistration.id}/pdf`,
                            { responseType: "blob" }
                          );
                          const blob = new Blob([response.data], {
                            type: "application/pdf",
                          });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `SSC_Registration_${
                            selectedRegistration.student_name_en ||
                            selectedRegistration.roll
                          }.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          console.error(err);
                          setError("Failed to download PDF");
                        } finally {
                          setPdfDownloading(false);
                        }
                      }}
                      disabled={pdfDownloading}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {pdfDownloading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Download PDF
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowModal(false)}
                      className="px-4 py-2 bg-gray-100  rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="relative mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">
                    Update Registration Status
                  </h3>
                  <button
                    onClick={() => setShowEditModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-3">
                    <strong>Student:</strong>{" "}
                    {editFormData.student_name_en || "N/A"}
                    <br />
                    <strong>Section:</strong> {editFormData.section || "N/A"} |{" "}
                    <strong>Roll:</strong> {editFormData.roll || "N/A"}
                  </div>

                  <label className="block text-sm font-medium  mb-2">
                    Registration Status
                  </label>
                  <select
                    value={editFormData.status || "pending"}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        status: e.target.value,
                      })
                    }
                    className="w-full border dark:bg-white text-black border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                  </select>
                  <p className="text-xs text-red-500 mt-1">
                    Only status can be modified for existing registrations
                  </p>
                </div>

                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-4 py-2 border border-gray-300 bg-red-500 rounded hover:bg-red-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Update Status
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteModal && deleteTarget && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              {/* Improved delete confirmation modal styles */}
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                    <svg
                      className="h-6 w-6 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mt-2">
                    Delete Registration
                  </h3>
                  <div className="mt-2 px-7 py-3">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete the registration for{" "}
                      <strong>{deleteTarget.student_name_en}</strong>? This
                      action cannot be undone.
                    </p>
                  </div>
                  <div className="items-center px-4 py-3">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className="px-4 py-2 bg-gray-300 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDelete(deleteTarget.id)}
                        className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SSCRegForm;
