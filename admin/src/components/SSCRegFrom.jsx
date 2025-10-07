import React, { useState, useEffect } from "react";
import axios from "axios";
import { Loader2, Plus, Edit, FileText, Trash2 } from "lucide-react";

function SSCRegForm() {
  const [formData, setFormData] = useState({
    a_sec_roll: "",
    b_sec_roll: "",
    ssc_year: new Date().getFullYear(),
  });
  const [noticeFile, setNoticeFile] = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isEdit, setIsEdit] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchSSCReg();
  }, []);

  const fetchSSCReg = async () => {
    try {
      setLoading(true);
      const response = await axios.get("/api/reg/ssc");
      if (response.data.success) {
        const data = response.data.data;
        setFormData({
          a_sec_roll: data.a_sec_roll || "",
          b_sec_roll: data.b_sec_roll || "",
          ssc_year: data.ssc_year || new Date().getFullYear(),
        });
        setCurrentNotice(
          data.notice
            ? {
                url: data.notice,
                download_url: data.notice, // Use same URL for download
              }
            : null
        );
        setIsEdit(true);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        setMessage("Error fetching SSC registration data");
      }
    } finally {
      setLoading(false);
    }
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
      setMessage("Please select a PDF file");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);

      const formDataToSend = new FormData();
      formDataToSend.append("a_sec_roll", formData.a_sec_roll);
      formDataToSend.append("b_sec_roll", formData.b_sec_roll);
      formDataToSend.append("ssc_year", formData.ssc_year);

      if (noticeFile) {
        formDataToSend.append("notice", noticeFile);
      }

      const response = await axios.post("/api/reg/ssc", formDataToSend, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data.success) {
        setMessage("SSC Registration saved successfully!");
        setIsEdit(true);
        setNoticeFile(null);

        // Update current notice from response
        const data = response.data.data;
        if (data.notice) {
          setCurrentNotice({
            url: data.notice,
            download_url: data.notice,
          });
        }

        // Reset file input
        const fileInput = document.getElementById("notice");
        if (fileInput) fileInput.value = "";

        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Error saving SSC registration"
      );
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      a_sec_roll: "",
      b_sec_roll: "",
      ssc_year: new Date().getFullYear(),
    });
    setCurrentNotice(null);
    setNoticeFile(null);
    setIsEdit(false);
  };

  const removeNotice = async () => {
    try {
      setLoading(true);
      const response = await axios.delete("/api/reg/ssc");

      if (response.data.success) {
        setCurrentNotice(null);
        setNoticeFile(null);
        setMessage("Notice removed successfully!");
        setTimeout(() => setMessage(""), 3000);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Error removing notice");
      setTimeout(() => setMessage(""), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            SSC Registration Settings
          </h1>
          <p className="text-gray-600">
            Configure roll ranges and upload notices for SSC registration
          </p>
        </div>

        {/* Action Button */}
        {!showForm && (
          <div className="mb-6">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isEdit ? <Edit size={16} /> : <Plus size={16} />}
              {isEdit ? "Edit Settings" : "Create Settings"}
            </button>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div
          className={`mb-6 p-3 rounded-lg ${
            message.includes("Error")
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-medium text-gray-900 mb-6">
            {isEdit ? "Update Configuration" : "Create Configuration"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="a_sec_roll"
                  className="block text-sm font-medium text-gray-700 mb-2"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="b_sec_roll"
                  className="block text-sm font-medium text-gray-700 mb-2"
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
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                SSC Year
              </label>
              <input
                type="number"
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
                htmlFor="notice"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Notice Document
              </label>

              {/* Current Notice */}
              {currentNotice && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText size={18} className="text-red-600" />
                      <span className="text-sm text-gray-700">
                        Current Notice PDF
                      </span>
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
              <p className="text-xs text-gray-500 mt-1">
                Only PDF files are allowed
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
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

              <button
                type="button"
                onClick={() => {
                  handleReset();
                  setShowForm(false);
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Information
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Only one configuration is allowed at a time</li>
              <li>• Roll ranges format: start-end (e.g., 101-150)</li>
              <li>• Notice must be a PDF document</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default SSCRegForm;
