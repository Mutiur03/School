import React, { useEffect, useState } from "react";
import axios from "axios";
import { RefreshCw, FileText, Loader2, Settings } from "lucide-react";
import toast from "react-hot-toast";

function AdmissionSettings() {
  const [formData, setFormData] = useState({
    admission_year: new Date().getFullYear(),
    admission_open: false,
    instruction: "Please follow the instructions carefully",
    attachment_instruction: "Please attach all required documents",
    attachment_instruction_class6: "",
    attachment_instruction_class7: "",
    attachment_instruction_class8: "",
    attachment_instruction_class9: "",
    ingikar: "",
    class_list: "",
    list_type_class6: "",
    list_type_class7: "",
    list_type_class8: "",
    list_type_class9: "",
    user_id_class6: "",
    user_id_class7: "",
    user_id_class8: "",
    user_id_class9: "",
    serial_no_class6: "",
    serial_no_class7: "",
    serial_no_class8: "",
    serial_no_class9: "",
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
          instruction: data.instruction,
          attachment_instruction_class6:
            data.attachment_instruction_class6 ??
            data.attachmentInstructionClass6 ??
            "",
          attachment_instruction_class7:
            data.attachment_instruction_class7 ??
            data.attachmentInstructionClass7 ??
            "",
          attachment_instruction_class8:
            data.attachment_instruction_class8 ??
            data.attachmentInstructionClass8 ??
            "",
          attachment_instruction_class9:
            data.attachment_instruction_class9 ??
            data.attachmentInstructionClass9 ??
            "",
          ingikar: data.ingikar ?? prev.ingikar,
          class_list: data.class_list ?? data.classList ?? prev.class_list,
          list_type_class6:
            data.list_type_class6 ??
            data.listTypeClass6 ??
            prev.list_type_class6,
          list_type_class7:
            data.list_type_class7 ??
            data.listTypeClass7 ??
            prev.list_type_class7,
          list_type_class8:
            data.list_type_class8 ??
            data.listTypeClass8 ??
            prev.list_type_class8,
          list_type_class9:
            data.list_type_class9 ??
            data.listTypeClass9 ??
            prev.list_type_class9,
          user_id_class6:
            data.user_id_class6 ?? data.userIdClass6 ?? prev.user_id_class6,
          user_id_class7:
            data.user_id_class7 ?? data.userIdClass7 ?? prev.user_id_class7,
          user_id_class8:
            data.user_id_class8 ?? data.userIdClass8 ?? prev.user_id_class8,
          user_id_class9:
            data.user_id_class9 ?? data.userIdClass9 ?? prev.user_id_class9,
          serial_no_class6:
            data.serial_no_class6 ??
            data.serialNoClass6 ??
            prev.serial_no_class6,
          serial_no_class7:
            data.serial_no_class7 ??
            data.serialNoClass7 ??
            prev.serial_no_class7,
          serial_no_class8:
            data.serial_no_class8 ??
            data.serialNoClass8 ??
            prev.serial_no_class8,
          serial_no_class9:
            data.serial_no_class9 ??
            data.serialNoClass9 ??
            prev.serial_no_class9,
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
        formData.user_id_class6 !== undefined &&
        formData.user_id_class6 !== null
      ) {
        payload.append("user_id_class6", String(formData.user_id_class6));
      }
      if (
        formData.user_id_class7 !== undefined &&
        formData.user_id_class7 !== null
      ) {
        payload.append("user_id_class7", String(formData.user_id_class7));
      }
      if (
        formData.user_id_class8 !== undefined &&
        formData.user_id_class8 !== null
      ) {
        payload.append("user_id_class8", String(formData.user_id_class8));
      }
      if (
        formData.user_id_class9 !== undefined &&
        formData.user_id_class9 !== null
      ) {
        payload.append("user_id_class9", String(formData.user_id_class9));
      }

      if (
        formData.attachment_instruction_class6 !== undefined &&
        formData.attachment_instruction_class6 !== null
      ) {
        payload.append(
          "attachment_instruction_class6",
          String(formData.attachment_instruction_class6)
        );
      }
      if (
        formData.attachment_instruction_class7 !== undefined &&
        formData.attachment_instruction_class7 !== null
      ) {
        payload.append(
          "attachment_instruction_class7",
          String(formData.attachment_instruction_class7)
        );
      }
      if (
        formData.attachment_instruction_class8 !== undefined &&
        formData.attachment_instruction_class8 !== null
      ) {
        payload.append(
          "attachment_instruction_class8",
          String(formData.attachment_instruction_class8)
        );
      }
      if (
        formData.attachment_instruction_class9 !== undefined &&
        formData.attachment_instruction_class9 !== null
      ) {
        payload.append(
          "attachment_instruction_class9",
          String(formData.attachment_instruction_class9)
        );
      }
      if (formData.ingikar !== undefined && formData.ingikar !== null) {
        payload.append("ingikar", String(formData.ingikar));
      }
      if (formData.class_list !== undefined && formData.class_list !== null) {
        payload.append("class_list", String(formData.class_list));
      }

      // Append per-class list type and serial no for classes 6-9
      [6, 7, 8, 9].forEach((c) => {
        const ltKey = `list_type_class${c}`;
        const snKey = `serial_no_class${c}`;
        const ltVal = formData[ltKey];
        const snVal = formData[snKey];
        if (ltVal !== undefined && ltVal !== null) {
          payload.append(ltKey, String(ltVal));
        }
        if (snVal !== undefined && snVal !== null) {
          payload.append(snKey, String(snVal));
        }
      });
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
        toast.success(isEdit ? "Settings updated" : "Settings created");
        setFormMessage("Settings saved successfully");
        setNoticeFile(null);
      } else {
        toast.error("Failed to save settings");
        setFormMessage("Error: Failed to save settings");
        console.error("Save failed:", res?.data);
      }
    } catch (error) {
      console.error(error);
      toast.error("An unexpected error occurred");
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
      newValue = value.replace(/\D/g, "");
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
                type="text"
                inputMode="numeric"
                pattern="\d*"
                maxLength={4}
                minLength={4}
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
              <div className="mt-3">
                <h3 className="text-sm font-medium mb-2">
                  Attachment instructions per class (6 - 9)
                </h3>
                <div className="gap-3">
                  <div>
                    <label
                      htmlFor="attachment_instruction_class6"
                      className="block text-xs font-medium mb-1"
                    >
                      Class 6
                    </label>
                    <textarea
                      id="attachment_instruction_class6"
                      name="attachment_instruction_class6"
                      value={formData.attachment_instruction_class6}
                      onChange={handleInputChange}
                      placeholder="Attachment instructions for Class 6"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class7"
                      className="block text-xs font-medium mb-1"
                    >
                      Class 7
                    </label>
                    <textarea
                      id="attachment_instruction_class7"
                      name="attachment_instruction_class7"
                      value={formData.attachment_instruction_class7}
                      onChange={handleInputChange}
                      placeholder="Attachment instructions for Class 7"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class8"
                      className="block text-xs font-medium mb-1"
                    >
                      Class 8
                    </label>
                    <textarea
                      id="attachment_instruction_class8"
                      name="attachment_instruction_class8"
                      value={formData.attachment_instruction_class8}
                      onChange={handleInputChange}
                      placeholder="Attachment instructions for Class 8"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="attachment_instruction_class9"
                      className="block text-xs font-medium mb-1"
                    >
                      Class 9
                    </label>
                    <textarea
                      id="attachment_instruction_class9"
                      name="attachment_instruction_class9"
                      value={formData.attachment_instruction_class9}
                      onChange={handleInputChange}
                      placeholder="Attachment instructions for Class 9"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <label
                htmlFor="ingikar"
                className="block text-sm font-medium mb-2"
              >
                ছাত্রের অঙ্গীকারনামা
              </label>
              <textarea
                id="ingikar"
                name="ingikar"
                value={formData.ingikar}
                onChange={handleInputChange}
                placeholder="Enter the ছাত্রের অঙ্গীকারনামা text that will appear on generated admission PDFs."
                rows={4}
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
                htmlFor="user_id_class6"
                className="block text-sm font-medium mb-2"
              >
                User IDs for Class 6
              </label>
              <input
                type="text"
                id="user_id_class6"
                name="user_id_class6"
                value={formData.user_id_class6}
                onChange={handleInputChange}
                placeholder="Comma separated user ids for class 6"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label
                    htmlFor="list_type_class6"
                    className="block text-xs font-medium mb-1"
                  >
                    List Type (Class 6)
                  </label>
                  <input
                    type="text"
                    id="list_type_class6"
                    name="list_type_class6"
                    value={formData.list_type_class6}
                    onChange={handleInputChange}
                    placeholder="e.g. Merit-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="serial_no_class6"
                    className="block text-xs font-medium mb-1"
                  >
                    Serial No. (Class 6)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class6"
                    name="serial_no_class6"
                    value={formData.serial_no_class6}
                    onChange={handleInputChange}
                    placeholder="e.g. 1-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="user_id_class7"
                className="block text-sm font-medium mb-2"
              >
                User IDs for Class 7
              </label>
              <input
                type="text"
                id="user_id_class7"
                name="user_id_class7"
                value={formData.user_id_class7}
                onChange={handleInputChange}
                placeholder="Comma separated user ids for class 7"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label
                    htmlFor="list_type_class7"
                    className="block text-xs font-medium mb-1"
                  >
                    List Type (Class 7)
                  </label>
                  <input
                    type="text"
                    id="list_type_class7"
                    name="list_type_class7"
                    value={formData.list_type_class7}
                    onChange={handleInputChange}
                    placeholder="e.g. Merit-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="serial_no_class7"
                    className="block text-xs font-medium mb-1"
                  >
                    Serial No. (Class 7)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class7"
                    name="serial_no_class7"
                    value={formData.serial_no_class7}
                    onChange={handleInputChange}
                    placeholder="e.g. 1-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="user_id_class8"
                className="block text-sm font-medium mb-2"
              >
                User IDs for Class 8
              </label>
              <input
                type="text"
                id="user_id_class8"
                name="user_id_class8"
                value={formData.user_id_class8}
                onChange={handleInputChange}
                placeholder="Comma separated user ids for class 8"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label
                    htmlFor="list_type_class8"
                    className="block text-xs font-medium mb-1"
                  >
                    List Type (Class 8)
                  </label>
                  <input
                    type="text"
                    id="list_type_class8"
                    name="list_type_class8"
                    value={formData.list_type_class8}
                    onChange={handleInputChange}
                    placeholder="e.g. Merit-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="serial_no_class8"
                    className="block text-xs font-medium mb-1"
                  >
                    Serial No. (Class 8)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class8"
                    name="serial_no_class8"
                    value={formData.serial_no_class8}
                    onChange={handleInputChange}
                    placeholder="e.g. 1-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="user_id_class9"
                className="block text-sm font-medium mb-2"
              >
                User IDs for Class 9
              </label>
              <input
                type="text"
                id="user_id_class9"
                name="user_id_class9"
                value={formData.user_id_class9}
                onChange={handleInputChange}
                placeholder="Comma separated user ids for class 9"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <label
                    htmlFor="list_type_class9"
                    className="block text-xs font-medium mb-1"
                  >
                    List Type (Class 9)
                  </label>
                  <input
                    type="text"
                    id="list_type_class9"
                    name="list_type_class9"
                    value={formData.list_type_class9}
                    onChange={handleInputChange}
                    placeholder="e.g. Merit-1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="serial_no_class9"
                    className="block text-xs font-medium mb-1"
                  >
                    Serial No. (Class 9)
                  </label>
                  <input
                    type="text"
                    id="serial_no_class9"
                    name="serial_no_class9"
                    value={formData.serial_no_class9}
                    onChange={handleInputChange}
                    placeholder="e.g. 1-100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* per-class list type and serial numbers are provided next to each class's user ids */}
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
