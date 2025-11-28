import React, { useEffect, useState } from "react";
import axios from "axios";
import { RefreshCw, FileText, Loader2, Settings } from "lucide-react";

function AdmissionSettings() {
  const [formData, setFormData] = useState({
    admission_year: new Date().getFullYear(),
    admission_open: false,
    instruction: "Please follow the instructions carefully",
    attachment_instruction: "Please attach all required documents",
    class_list: "",
    list_type: "",
    user_id: "",
    serial_no: "",
  });

  const [noticeFile, setNoticeFile] = useState(null);
  const [currentNotice, setCurrentNotice] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [isEdit, setIsEdit] = useState(false);

  useEffect(() => {
    fetchAdmissionSettings();
  }, []);

  const fetchAdmissionSettings = async () => {
    try {
      const res = await axios.get("/api/admission");
      console.log(res.data);

      if (res.data) {
        const data = res.data;
        setFormData((prev) => ({
          ...prev,
          admission_year: data.admission_year ?? prev.admission_year,
          admission_open:
            typeof data.admission_open === "boolean"
              ? data.admission_open
              : prev.admission_open,
          instruction:
            data.instruction ??
            data.instruction_for_a ??
            data.instruction_for_b ??
            prev.instruction,
          attachment_instruction:
            data.attachment_instruction ?? prev.attachment_instruction,
          class_list: data.class_list ?? data.classList ?? prev.class_list,
          list_type: data.list_type ?? data.listType ?? prev.list_type,
          user_id: data.user_id ?? data.userId ?? prev.user_id,
          serial_no: data.serial_no ?? data.serialNo ?? prev.serial_no,
        }));
        if (data.preview_url) {
          setCurrentNotice({
            url: data.preview_url || data.previewUrl || null,
            download_url: data.download_url || data.downloadUrl || null,
            public_id: data.public_id || data.publicId || null,
          });
        } else {
          setCurrentNotice(null);
          setNoticeFile(null);
        }
        setIsEdit(true);
      } else {
        setIsEdit(false);
      }
    } catch (error) {
      console.error("Failed to fetch admission settings:", error);
      setFormMessage("Error: Failed to load settings");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file && file.type === "application/pdf") {
      setNoticeFile(file);
      setFormMessage("");
    } else if (file) {
      setFormMessage("Error: Only PDF files are allowed");
      e.target.value = null;
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormMessage("");

    try {
      const payload = new FormData();
      if (
        formData.admission_year !== undefined &&
        formData.admission_year !== null
      ) {
        payload.append("admission_year", String(formData.admission_year));
      }

      if (typeof formData.admission_open === "boolean") {
        payload.append("admission_open", formData.admission_open ? "1" : "0");
      }

      if (formData.instruction !== undefined && formData.instruction !== null) {
        payload.append("instruction", String(formData.instruction));
        payload.append("instruction_for_a", String(formData.instruction));
        payload.append("instruction_for_b", String(formData.instruction));
      }

      if (
        formData.attachment_instruction !== undefined &&
        formData.attachment_instruction !== null
      ) {
        payload.append(
          "attachment_instruction",
          String(formData.attachment_instruction)
        );
      }
      // additional string fields
      if (formData.class_list !== undefined && formData.class_list !== null) {
        payload.append("class_list", String(formData.class_list));
      }
      if (formData.list_type !== undefined && formData.list_type !== null) {
        payload.append("list_type", String(formData.list_type));
      }
      if (formData.user_id !== undefined && formData.user_id !== null) {
        payload.append("user_id", String(formData.user_id));
      }
      if (formData.serial_no !== undefined && formData.serial_no !== null) {
        payload.append("serial_no", String(formData.serial_no));
      }
      if (currentNotice && currentNotice.public_id) {
        payload.append("public_id", String(currentNotice.public_id));
      }

      if (noticeFile) {
        payload.append("notice", noticeFile);
      }
      console.log(payload.forEach((v, k) => console.log(k, v)));

      let res;

      res = await axios.put("/api/admission", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res?.data?.success) {
        setFormMessage("Settings saved successfully");
        setNoticeFile(null);
      } else {
        setFormMessage("Error: Failed to save settings");
        console.error("Save failed:", res?.data);
      }
    } catch (error) {
      console.error(error);
      setFormMessage("Error: An unexpected error occurred");
    } finally {
      fetchAdmissionSettings();
      setFormLoading(false);
    }
  };

  const removeNotice = async () => {
    try {
      setFormLoading(true);
      const res = await axios.delete("/api/admission");
      if (res?.data?.success) {
        await fetchAdmissionSettings();
        setNoticeFile(null);
        setFormMessage("Notice removed");
      } else {
        setFormMessage("Error: Failed to remove notice");
      }
    } catch (error) {
      console.error("Failed to remove notice:", error);
      setFormMessage("Error: Failed to remove notice");
    } finally {
      setFormLoading(false);
    }
  };
  const handleRefresh = () => {
    fetchAdmissionSettings();
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const numericPattern = /^-?\d+(?:\.\d+)?$/;
    let newValue;
    if (name === "admission_year") {
      newValue = value === "" ? "" : Number(value);
    } else if (name === "instruction") {
      const trimmed = String(value).trim();
      newValue =
        trimmed === ""
          ? ""
          : numericPattern.test(trimmed)
          ? Number(trimmed)
          : value;
    } else {
      newValue = type === "checkbox" ? checked : value;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Admission Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Configure admission options and notices
          </p>
        </div>
        <div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-300 dark:focus:ring-blue-700 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

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

      <div className="bg-card text-card-foreground rounded-xl border border-border p-6 shadow-sm dark:bg-gray-800 dark:border-gray-700 mt-4">
        <h2 className="text-lg font-medium text-foreground mb-6 dark:text-gray-100">
          <Settings size={16} className="inline mr-2" />
          {isEdit ? "Update Configuration" : "Create Configuration"}
        </h2>

        <form onSubmit={handleFormSubmit} className="space-y-6">
          <div className="bg-primary/10 border border-primary rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-700">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="admission_open"
                name="admission_open"
                checked={formData.admission_open}
                onChange={handleInputChange}
                className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <label
                htmlFor="admission_open"
                className="text-sm font-medium text-primary dark:text-blue-300"
              >
                Open Admission for Students
              </label>
            </div>
            <p className="text-xs text-primary/80 mt-2 dark:text-blue-400">
              When enabled, students can submit their admission forms
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label
                htmlFor="admission_year"
                className="block text-sm font-medium mb-2"
              >
                Admission Year
              </label>
              <input
                // type="number"
                id="admission_year"
                name="admission_year"
                value={formData.admission_year}
                onChange={handleInputChange}
                placeholder="e.g. 2025"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="instruction"
                className="block text-sm font-medium mb-2"
              >
                Instruction
              </label>
              <textarea
                id="instruction"
                name="instruction"
                value={formData.instruction}
                onChange={handleInputChange}
                placeholder="Enter admission instructions for applicants (what to bring, deadlines, steps)."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="attachment_instruction"
                className="block text-sm font-medium mb-2"
              >
                Attachment Instructions
              </label>
              <textarea
                id="attachment_instruction"
                name="attachment_instruction"
                value={formData.attachment_instruction}
                onChange={handleInputChange}
                placeholder="E.g. Upload scanned copy of birth certificate, previous transcripts and a passport-sized photo."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="class_list"
                className="block text-sm font-medium mb-2"
              >
                Class List
              </label>
              <input
                type="text"
                id="class_list"
                name="class_list"
                value={formData.class_list}
                onChange={handleInputChange}
                placeholder="e.g. Six, Seven, Eight, Nine, Ten"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="list_type"
                className="block text-sm font-medium mb-2"
              >
                List Type
              </label>
              <input
                type="text"
                id="list_type"
                name="list_type"
                value={formData.list_type}
                onChange={handleInputChange}
                placeholder="e.g. Merit-1, final, waiting-list"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="user_id"
                className="block text-sm font-medium mb-2"
              >
                User ID
              </label>
              <input
                type="text"
                id="user_id"
                name="user_id"
                value={formData.user_id}
                onChange={handleInputChange}
                placeholder="e.g. KSJDFGSKJ, SDJJFSDGF, SKDLFG"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="serial_no"
                className="block text-sm font-medium mb-2"
              >
                Serial No.
              </label>
              <input
                type="text"
                id="serial_no"
                name="serial_no"
                value={formData.serial_no}
                onChange={handleInputChange}
                placeholder="e.g. 1-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notice" className="block text-sm font-medium mb-2">
              Notice Document
            </label>

            {currentNotice && (
              <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200 dark:bg-gray-500 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-red-600" />
                    <span className="text-sm ">Current Notice PDF</span>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href={currentNotice.url}
                      target="_blank"
                      rel="noreferrer"
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
              title="Upload a PDF file for the admission notice (only .pdf allowed)"
              aria-label="Upload notice PDF file"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            <p className="text-xs text-red-500 mt-1">
              Only PDF files are allowed
            </p>
          </div>

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
      </div>
    </div>
  );
}

export default AdmissionSettings;
