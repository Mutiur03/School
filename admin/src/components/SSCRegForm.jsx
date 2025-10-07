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
    sscBatch: new Date().getFullYear().toString(),
  });
  const host = import.meta.env.VITE_BACKEND_URL;

  // Only fetch when batch changes
  useEffect(() => {
    fetchAllRegistrations();
  }, [filters.sscBatch]);

  const fetchAllRegistrations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `/api/student-registration?sscBatch=${filters.sscBatch}&limit=1000`
      );
      if (response.data.success) {
        setAllRegistrations(response.data.data);
        console.log(response.data.data);
      }
    } catch (err) {
      setError("Failed to fetch registrations");
      console.error(err);
    } finally {
      setLoading(false);
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

  // Calculate stats from filtered data
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
      const response = await axios.delete(`/api/student-registration/${id}`);
      if (response.data.success) {
        // Update local state instead of refetching
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
      const formData = new FormData();
      Object.keys(editFormData).forEach((key) => {
        if (editFormData[key] !== null && editFormData[key] !== undefined) {
          formData.append(key, editFormData[key]);
        }
      });

      const response = await axios.put(
        `/api/student-registration/${editFormData.id}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        // Update local state instead of refetching
        setAllRegistrations((prev) =>
          prev.map((reg) =>
            reg.id === editFormData.id ? { ...reg, ...response.data.data } : reg
          )
        );
        setShowEditModal(false);
        setEditFormData({});
      }
    } catch (err) {
      setError("Failed to update registration");
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

      const response = await axios.get(
        `/api/student-registration/export?${params}`,
        {
          responseType: "blob",
        }
      );

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
        `/api/student-registration/export-images?${params}`,
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
    const statusStyles = {
      pending: "bg-amber-100 text-amber-800 border border-amber-200",
      approved: "bg-emerald-100 text-emerald-800 border border-emerald-200",
      rejected: "bg-rose-100 text-rose-800 border border-rose-200",
    };
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Registration Management
        </h1>
        <p className="text-gray-600">
          Monitor and manage student registrations
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Total</div>
          <div className="text-2xl font-semibold text-gray-900">
            {stats.total || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Pending</div>
          <div className="text-2xl font-semibold text-amber-600">
            {stats.pending || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Approved</div>
          <div className="text-2xl font-semibold text-emerald-600">
            {stats.approved || 0}
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="text-sm text-gray-500 mb-1">Rejected</div>
          <div className="text-2xl font-semibold text-rose-600">
            {stats.rejected || 0}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-gray-500" />
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <select
              value={filters.section}
              onChange={(e) =>
                setFilters({ ...filters, section: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Sections</option>
              <option value="A">Section A</option>
              <option value="B">Section B</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch
            </label>
            <select
              value={filters.sscBatch}
              onChange={(e) =>
                setFilters({ ...filters, sscBatch: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={new Date().getFullYear().toString()}>
                {new Date().getFullYear()}
              </option>
              <option value={(new Date().getFullYear() - 1).toString()}>
                {new Date().getFullYear() - 1}
              </option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  setFilters({ ...filters, search: e.target.value })
                }
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium text-gray-900">Registrations</h3>
              <p className="text-sm text-gray-500 mt-1">
                Showing {filteredRegistrations.length} of{" "}
                {allRegistrations.length} students
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 disabled:opacity-50 transition-colors"
              >
                <Download size={16} />
                Excel
              </button>
              <button
                onClick={handleExportImages}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50 transition-colors"
              >
                <Image size={16} />
                Images
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Section
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Roll
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredRegistrations.length === 0 ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No registrations found
                  </td>
                </tr>
              ) : (
                filteredRegistrations.map((registration) => (
                  <tr key={registration.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {registration.photo_path && (
                          <img
                            className="h-10 w-10 rounded-full object-cover border border-gray-200"
                            src={`${host}/${registration.photo_path}`}
                            alt=""
                          />
                        )}
                        <div>
                          <div className="font-medium text-gray-900">
                            {registration.student_name_en}
                          </div>
                          <div className="text-sm text-gray-500">
                            {registration.student_name_bn}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Section {registration.section}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {registration.roll}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(registration.status)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(registration.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(registration.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors"
                        >
                          <Eye size={12} />
                          View
                        </button>
                        <button
                          onClick={() => handleEdit(registration.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-emerald-700 bg-emerald-100 rounded hover:bg-emerald-200 transition-colors"
                        >
                          <Edit size={12} />
                          Edit
                        </button>
                        <button
                          onClick={() => confirmDelete(registration)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
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
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Registration Details
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">
                    Personal Information
                  </h4>
                  {selectedRegistration.photo_path && (
                    <img
                      src={`${host}/${selectedRegistration.photo_path}`}
                      alt="Student"
                      className="w-24 h-24 object-cover rounded-lg mb-3 border border-gray-200"
                    />
                  )}
                  <p>
                    <strong>Name (EN):</strong>{" "}
                    {selectedRegistration.student_name_en}
                  </p>
                  <p>
                    <strong>Name (BN):</strong>{" "}
                    {selectedRegistration.student_name_bn}
                  </p>
                  <p>
                    <strong>Nick Name:</strong>{" "}
                    {selectedRegistration.student_nick_name_bn}
                  </p>
                  <p>
                    <strong>Section:</strong> {selectedRegistration.section}
                  </p>
                  <p>
                    <strong>Roll:</strong> {selectedRegistration.roll}
                  </p>
                  <p>
                    <strong>Religion:</strong> {selectedRegistration.religion}
                  </p>
                  <p>
                    <strong>Birth Reg:</strong>{" "}
                    {selectedRegistration.birth_reg_no}
                  </p>
                  <p>
                    <strong>Birth Date:</strong>{" "}
                    {selectedRegistration.birth_date}
                  </p>
                  <p>
                    <strong>Blood Group:</strong>{" "}
                    {selectedRegistration.blood_group}
                  </p>
                  <p>
                    <strong>Email:</strong> {selectedRegistration.email}
                  </p>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">
                    Parents Information
                  </h4>
                  <p>
                    <strong>Father (EN):</strong>{" "}
                    {selectedRegistration.father_name_en}
                  </p>
                  <p>
                    <strong>Father (BN):</strong>{" "}
                    {selectedRegistration.father_name_bn}
                  </p>
                  <p>
                    <strong>Father NID:</strong>{" "}
                    {selectedRegistration.father_nid}
                  </p>
                  <p>
                    <strong>Father Phone:</strong>{" "}
                    {selectedRegistration.father_phone}
                  </p>
                  <p>
                    <strong>Mother (EN):</strong>{" "}
                    {selectedRegistration.mother_name_en}
                  </p>
                  <p>
                    <strong>Mother (BN):</strong>{" "}
                    {selectedRegistration.mother_name_bn}
                  </p>
                  <p>
                    <strong>Mother NID:</strong>{" "}
                    {selectedRegistration.mother_nid}
                  </p>
                  <p>
                    <strong>Mother Phone:</strong>{" "}
                    {selectedRegistration.mother_phone}
                  </p>

                  <h4 className="font-semibold mb-2 mt-4">Address</h4>
                  <p>
                    <strong>Present:</strong>{" "}
                    {selectedRegistration.present_village_road},{" "}
                    {selectedRegistration.present_post_office},{" "}
                    {selectedRegistration.present_upazila},{" "}
                    {selectedRegistration.present_district}
                  </p>
                  <p>
                    <strong>Permanent:</strong>{" "}
                    {selectedRegistration.permanent_village_road},{" "}
                    {selectedRegistration.permanent_post_office},{" "}
                    {selectedRegistration.permanent_upazila},{" "}
                    {selectedRegistration.permanent_district}
                  </p>

                  <h4 className="font-semibold mb-2 mt-4">
                    Academic Information
                  </h4>
                  <p>
                    <strong>Previous School:</strong>{" "}
                    {selectedRegistration.prev_school_name}
                  </p>
                  <p>
                    <strong>JSC Year:</strong>{" "}
                    {selectedRegistration.jsc_passing_year}
                  </p>
                  <p>
                    <strong>JSC Board:</strong> {selectedRegistration.jsc_board}
                  </p>
                  <p>
                    <strong>JSC Reg:</strong> {selectedRegistration.jsc_reg_no}
                  </p>
                  <p>
                    <strong>JSC Roll:</strong>{" "}
                    {selectedRegistration.jsc_roll_no}
                  </p>
                  <p>
                    <strong>Group:</strong>{" "}
                    {selectedRegistration.group_class_nine}
                  </p>
                  <p>
                    <strong>Main Subject:</strong>{" "}
                    {selectedRegistration.main_subject}
                  </p>
                  <p>
                    <strong>4th Subject:</strong>{" "}
                    {selectedRegistration.fourth_subject}
                  </p>

                  {/* Guardian Information - Only show if guardian data exists */}
                  {(selectedRegistration.guardian_name ||
                    selectedRegistration.guardian_phone ||
                    selectedRegistration.guardian_relation ||
                    selectedRegistration.guardian_nid) && (
                    <>
                      <h4 className="font-semibold mb-2 mt-4">
                        Guardian Information
                      </h4>
                      {selectedRegistration.guardian_name && (
                        <p>
                          <strong>Guardian Name:</strong>{" "}
                          {selectedRegistration.guardian_name}
                        </p>
                      )}
                      {selectedRegistration.guardian_phone && (
                        <p>
                          <strong>Guardian Phone:</strong>{" "}
                          {selectedRegistration.guardian_phone}
                        </p>
                      )}
                      {selectedRegistration.guardian_relation && (
                        <p>
                          <strong>Guardian Relation:</strong>{" "}
                          {selectedRegistration.guardian_relation}
                        </p>
                      )}
                      {selectedRegistration.guardian_nid && (
                        <p>
                          <strong>Guardian NID:</strong>{" "}
                          {selectedRegistration.guardian_nid}
                        </p>
                      )}
                      {(selectedRegistration.guardian_district ||
                        selectedRegistration.guardian_village_road ||
                        selectedRegistration.guardian_address_same_as_permanent) && (
                        <p>
                          <strong>Guardian Address:</strong>{" "}
                          {selectedRegistration.guardian_address_same_as_permanent
                            ? "Same as permanent address"
                            : [
                                selectedRegistration.guardian_village_road,
                                selectedRegistration.guardian_post_office,
                                selectedRegistration.guardian_upazila,
                                selectedRegistration.guardian_district,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end p-6 border-t border-gray-200">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">
                Edit Registration
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

            <form
              onSubmit={handleEditSubmit}
              className="max-h-96 overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student Name (English)
                  </label>
                  <input
                    type="text"
                    value={editFormData.student_name_en || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        student_name_en: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Student Name (Bangla)
                  </label>
                  <input
                    type="text"
                    value={editFormData.student_name_bn || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        student_name_bn: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Section
                  </label>
                  <select
                    value={editFormData.section || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        section: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Section</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Roll
                  </label>
                  <input
                    type="text"
                    value={editFormData.roll || ""}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        roll: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </form>

            <div className="flex justify-end space-x-2 mt-4">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                  <strong>{deleteTarget.student_name_en}</strong>? This action
                  cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300"
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
    </div>
  );
};

export default SSCRegForm;
