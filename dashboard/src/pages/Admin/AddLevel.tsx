import { useState, useEffect } from "react";
import axios, { isAxiosError } from "axios";
import { toast } from "react-hot-toast";
import { FiTrash2, FiEdit, FiX } from "react-icons/fi";

interface FormData {
  class_name: string;
  section: string;
  year: number;
  teacher_id: string;
}

interface Teacher {
  id: string;
  name: string;
}

interface Level {
  id: string;
  class_name: string;
  section: string;
  year: number;
  teacher_id: string;
}

function AddLevel() {
  const [formData, setFormData] = useState<FormData>({
    class_name: "",
    section: "",
    year: new Date().getFullYear(),
    teacher_id: "",
  });

  const [assignedLevels, setAssignedLevels] = useState<Level[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<string | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/teachers/getTeachers");
      setTeachers(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching teachers:", err);
      setLoading(false);
    }
  };

  const fetchAssignedLevels = async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/level/getLevels");
      setAssignedLevels(res.data.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching levels:", err);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.class_name || !formData.section || !formData.teacher_id) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      if (editingId) {
        await axios.put(`/api/level/updateLevel/${editingId}`, formData);
        toast.success("Assignment updated successfully");
      } else {
        await axios.post("/api/level/addLevel", formData);
        toast.success("Class teacher assigned successfully");
      }

      resetForm();
      fetchAssignedLevels();
    } catch (error) {
      if (isAxiosError(error))
        toast.error(error.response?.data?.error || "Operation failed");
      else toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      class_name: "",
      section: "",
      year: new Date().getFullYear(),
      teacher_id: "",
    });
    setEditingId(null);
    setIsFormVisible(false);
  };

  const handleEdit = (level: Level) => {
    setFormData({
      class_name: level.class_name,
      section: level.section,
      year: level.year,
      teacher_id: level.teacher_id,
    });
    setEditingId(level.id);
    setIsFormVisible(true);
  };

  const handleDelete = (id: string) => {
    setLevelToDelete(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    try {
      await axios.delete(`/api/level/deleteLevel/${levelToDelete}`);
      toast.success("Assignment deleted successfully");
      fetchAssignedLevels();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      toast.error("Failed to delete assignment");
    } finally {
      setShowDeleteModal(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchAssignedLevels();
  }, []);

  const filteredLevels = assignedLevels.filter(
    (level) => level.year === Number(filterYear)
  );

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-light">Class Teacher Assignment</h1>
        {!isFormVisible && (
          <button
            onClick={() => setIsFormVisible(!isFormVisible)}
            className="px-4 py-2 rounded-md bg-primary text-white hover:bg-opacity-90"
          >
            + Assign Teacher
          </button>
        )}
      </div>

      {isFormVisible && (
        <div className="rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-medium mb-4">
            {editingId ? "Edit Assignment" : "Create New Assignment"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal mb-1">Class</label>
                <select
                  name="class_name"
                  value={formData.class_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:bg-accent rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Class</option>
                  {["6", "7", "8", "9", "10"].map((cls) => (
                    <option key={cls} value={cls}>
                      Class {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-normal mb-1">Section</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:bg-accent rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Section</option>
                  {["A", "B"].map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal mb-1">Year</label>
                <input
                  type="number"
                  name="year"
                  value={formData.year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 dark:bg-accent rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  min="2000"
                  max="2100"
                />
              </div>

              <div>
                <label className="block text-sm font-normal mb-1">Teacher</label>
                <select
                  name="teacher_id"
                  value={formData.teacher_id}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded dark:bg-accent focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-accent text-accent-foreground text-sm rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md"
                disabled={loading}
              >
                {loading
                  ? "Processing..."
                  : editingId
                    ? "Update Assignment"
                    : "Create Assignment"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 flex justify-end">
        <div className="flex items-center space-x-2">
          <label className="block text-sm font-normal">Filter by Year:</label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="px-3 py-1 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from(
              { length: 3 },
              (_, i) => new Date().getFullYear() - i + 1
            ).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Class
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Section
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Teacher
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLevels.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm">
                    No assigned teacher found for {filterYear}
                  </td>
                </tr>
              ) : (
                filteredLevels.map((level) => (
                  <tr key={level.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium">
                        Class {level.class_name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{level.section}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">{level.year}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm">
                        {teachers.find((t) => t.id === level.teacher_id)?.name || "Not assigned"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleEdit(level)}
                        className="hover:text-sky-500 mr-3"
                      >
                        <FiEdit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(level.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center p-4 z-50">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-medium text-foreground">
                Confirm Deletion
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <FiX size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete this assignment? This action
              cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm bg-accent text-accent-foreground hover:bg-accent/80 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-md flex items-center"
              >
                <FiTrash2 className="mr-2" size={14} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddLevel;
