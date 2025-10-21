import React, { useState, useEffect } from "react";
import axios from "axios";
import { Eye, Download, Pencil, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

function Syllabus() {
  const currentYear = new Date().getFullYear();
  const [syllabuses, setSyllabuses] = useState([]);
  const [form, setForm] = useState({
    class: "",
    year: String(currentYear),
    pdf: null,
  });
  const [editingId, setEditingId] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [yearFilter, setYearFilter] = useState(String(currentYear));
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSyllabuses();
  }, []);

  const fetchSyllabuses = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/api/syllabus");
      setSyllabuses(res.data);
    } catch {
      setError("Failed to fetch syllabuses.");
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    setForm((f) => ({
      ...f,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (editingId) setUpdating(true);
    else setUploading(true);

    const data = new FormData();
    data.append("class", form.class);
    data.append("year", form.year);
    if (form.pdf) data.append("pdf", form.pdf);

    try {
      if (editingId) {
        await axios.put(`/api/syllabus/${editingId}`, data);
        setEditingId(null);
      } else {
        await axios.post("/api/syllabus/upload", data);
      }
      setForm({ class: "", year: String(currentYear), pdf: null });
      setIsFormVisible(false);
      fetchSyllabuses();
    } catch {
      setError("Failed to upload/update syllabus.");
    }
    setUploading(false);
    setUpdating(false);
  };

  const handleEdit = (s) => {
    setEditingId(s.id);
    setForm({
      class: s.class,
      year: s.year,
      pdf: null,
    });
    setIsFormVisible(true);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    setError(null);
    try {
      await axios.delete(`/api/syllabus/${id}`);
      fetchSyllabuses();
    } catch {
      setError("Failed to delete syllabus.");
    }
    setDeletingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm({ class: "", year: String(currentYear), pdf: null });
    setIsFormVisible(false);
  };

  const limitedYears = [
    String(currentYear - 1),
    String(currentYear),
    String(currentYear + 1),
  ];

  const filteredSyllabuses = syllabuses.filter(
    (s) => String(s.year) === String(yearFilter)
  );

  return (
    <div className="max-w-6xl mx-auto p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-light">Syllabus Management</h1>
        {!isFormVisible && (
          <Button
            type="button"
            variant={isFormVisible ? "outline" : "default"}
            onClick={() => setIsFormVisible((prev) => !prev)}
            disabled={uploading || updating}
            className="w-full sm:w-auto"
          >
            {isFormVisible ? "Cancel" : "+ Add New Syllabus"}
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      {isFormVisible && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-100 p-4 sm:p-6 mb-8">
          <h2 className="text-base sm:text-lg font-medium mb-4">
            {editingId ? "Edit Syllabus" : "Upload Syllabus PDF"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal mb-1">Class</label>
                <Select
                  name="class"
                  value={String(form.class)}
                  onValueChange={(val) =>
                    setForm((f) => ({ ...f, class: val }))
                  }
                  disabled={uploading || updating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Show classes 6 to 10 */}
                    {[6, 7, 8, 9, 10].map((cls) => (
                      <SelectItem key={cls} value={String(cls)}>
                        {cls}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-normal mb-1">Year</label>
                <Select
                  name="year"
                  value={String(form.year)}
                  onValueChange={(val) => setForm((f) => ({ ...f, year: val }))}
                  disabled={uploading || updating}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {limitedYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-normal mb-1">PDF File</label>
              <Input
                name="pdf"
                type="file"
                accept="application/pdf"
                onChange={handleChange}
                disabled={uploading || updating}
              />
              {/* Show uploaded file title when editing */}
              {editingId &&
                syllabuses.length > 0 &&
                (() => {
                  const editingSyllabus = syllabuses.find(
                    (s) => s.id === editingId
                  );
                  if (editingSyllabus && editingSyllabus.pdf_url) {
                    return (
                      <div className="mt-1 text-xs text-gray-500">
                        Current file:{" "}
                        <span className="font-medium">
                          {editingSyllabus.pdf_url.split("/").pop()}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
            </div>
            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                className="px-4 py-2 text-sm"
                disabled={uploading || updating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="px-4 py-2 text-sm flex items-center"
                disabled={uploading || updating}
              >
                {(uploading || updating) && (
                  <Loader2 className="animate-spin w-4 h-4 mr-2" />
                )}
                {editingId
                  ? updating
                    ? "Updating..."
                    : "Update"
                  : uploading
                  ? "Uploading..."
                  : "Upload"}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center mb-4 gap-2">
        <label className="mr-2 text-sm font-medium">Filter by Year:</label>
        <Select
          value={String(yearFilter)}
          onValueChange={setYearFilter}
          disabled={loading}
        >
          <SelectTrigger className="w-full sm:w-[120px]">
            <SelectValue placeholder="Select year" />
          </SelectTrigger>
          <SelectContent>
            {limitedYears.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg shadow-sm border min-w-fit border-gray-100 overflow-x-auto">
        {/* Table for sm and up */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-[400px] w-full divide-y divide-gray-200 text-sm table-fixed">
            <thead>
              <tr>
                <th className="w-1/4 px-3 sm:px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Class
                </th>
                <th className="w-1/4 px-3 sm:px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
                <th className="w-2/4 px-3 sm:px-6 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center">
                    <Loader2 className="animate-spin w-6 h-6 mx-auto text-gray-400" />
                  </td>
                </tr>
              ) : filteredSyllabuses.length > 0 ? (
                filteredSyllabuses.map((s) => (
                  <tr key={s.id}>
                    <td className="w-1/4 px-3 sm:px-6 py-4 text-center">
                      {s.class}
                    </td>
                    <td className="w-1/4 px-3 sm:px-6 py-4 text-center">
                      {s.year}
                    </td>
                    <td className="w-2/4 px-3 sm:px-6 py-4 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <a
                          href={s.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </a>
                        <a
                          href={s.download_url}
                          download
                          className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => handleEdit(s)}
                          className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                          title="Edit"
                          disabled={uploading || updating || deletingId}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className={`text-red-600 hover:bg-red-100 px-2 py-1 rounded border border-red-100 bg-red-50 text-xs flex items-center ${
                            deletingId === s.id
                              ? "opacity-50 pointer-events-none"
                              : ""
                          }`}
                          title="Delete"
                          disabled={
                            deletingId === s.id || uploading || updating
                          }
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="animate-spin w-4 h-4" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-center"
                    colSpan={3}
                  >
                    No syllabuses found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Card layout for mobile */}
        <div className="block sm:hidden">
          {loading ? (
            <div className="py-8 text-center">
              <Loader2 className="animate-spin w-6 h-6 mx-auto text-gray-400" />
            </div>
          ) : filteredSyllabuses.length > 0 ? (
            filteredSyllabuses.map((s) => (
              <div
                key={s.id}
                className="border-b last:border-b-0 px-2 py-4 flex flex-col gap-2"
              >
                <div className="flex justify-between">
                  <span className="font-medium">Class:</span>
                  <span>{s.class}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Year:</span>
                  <span>{s.year}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <a
                    href={s.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                    title="View"
                  >
                    <Eye className="w-4 h-4" />
                  </a>
                  <a
                    href={s.download_url}
                    download
                    className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleEdit(s)}
                    className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded border border-blue-100 bg-blue-50 text-xs flex items-center"
                    title="Edit"
                    disabled={uploading || updating || deletingId}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    className={`text-red-600 hover:bg-red-100 px-2 py-1 rounded border border-red-100 bg-red-50 text-xs flex items-center ${
                      deletingId === s.id
                        ? "opacity-50 pointer-events-none"
                        : ""
                    }`}
                    title="Delete"
                    disabled={deletingId === s.id || uploading || updating}
                  >
                    {deletingId === s.id ? (
                      <Loader2 className="animate-spin w-4 h-4" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-sm text-gray-500">
              No syllabuses found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Syllabus;
