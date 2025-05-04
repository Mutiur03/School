/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import {
  FiTrash2,
  FiEdit,
  FiEye,
  FiEyeOff,
  FiX,
  FiCheck,
} from "react-icons/fi";
import Loading from "@/components/Loading";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import DeleteConfirmationIcon from "../components/DeleteConfimationIcon";
function AddExam() {
  const [formData, setFormData] = useState({
    exam_name: "",
    exam_year: new Date().getFullYear(),
    levels: [],
    start_date: "",
    end_date: "",
    result_date: "",
  });
  const currentYear = new Date().getFullYear();

  const [examList, setExamList] = useState([]);
  const [levelError, setLevelError] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      const level = parseInt(value);
      const updatedLevels = checked
        ? [...formData.levels, level]
        : formData.levels.filter((cls) => cls !== level);
      setFormData({ ...formData, levels: updatedLevels });
      if (updatedLevels.length > 0) setLevelError(false);
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.levels.length === 0) {
      setLevelError(true);
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingExam) {
        await axios.put(`/api/exams/updateExam/${editingExam.id}`, formData);
        toast.success("Exam updated successfully");
      } else {
        await axios.post("/api/exams/addExam", {
          exams: [formData],
        });
        toast.success("Exam added successfully");
      }

      resetForm();
      fetchExamList();
    } catch (error) {
      toast.error(error.response?.data?.error || "Operation failed");
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setFormData({
      exam_name: "",
      exam_year: new Date().getFullYear(),
      levels: [],
      start_date: "",
      end_date: "",
      result_date: "",
    });
    setEditingExam(null);
    setIsFormVisible(false);
  };

  const fetchExamList = async () => {
    setIsLoading(true);
    try {
      const { data } = await axios.get("/api/exams/getExams");

      setExamList(
        data.data
          .filter((exam) => exam.exam_year === currentYear)
          .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
      );
    } catch (error) {
      console.error("Failed to fetch exams:", error);
    }
    setIsLoading(false);
  };

  const handleVisibilityChange = async (examId, newVisibility) => {
    try {
      const result = await axios.put(`/api/exams/updateVisibility/${examId}`, {
        visible: newVisibility,
      });
      console.log(result);

      if (!result.data.success) {
        toast.error("Error in result publishing");
      }
      newVisibility
        ? toast.success("Result has been published")
        : toast.success("Result has been hidden");
      fetchExamList();
    } catch (error) {
      toast.error("Failed to update visibility");
    }
  };

  const handleEditExam = (exam) => {
    setFormData({
      exam_name: exam.exam_name,
      exam_year: exam.exam_year,
      levels: exam.levels,
      start_date: exam.start_date?.split("T")[0] || "",
      end_date: exam.end_date?.split("T")[0] || "",
      result_date: exam.result_date?.split("T")[0] || "",
    });
    setEditingExam(exam);
    setIsFormVisible(true);
  };

  const confirmDelete = async (examToDelete) => {
    try {
      await axios.delete(`/api/exams/deleteExam/${examToDelete}`);
      toast.success("Exam deleted successfully");
      fetchExamList();
    } catch (error) {
      toast.error("Failed to delete exam");
    } finally {
      fetchExamList();
    }
  };

  useEffect(() => {
    fetchExamList();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-light ">Exam Management</h1>
        <Button
          type="button"
          variant={isFormVisible ? "outline" : ""}
          onClick={() => setIsFormVisible((prev) => !prev)}
        >
          {isFormVisible ? "Cancel" : "+ Add New Exam"}
        </Button>
      </div>

      {/* Form Panel */}
      {isFormVisible && (
        <div className="bg-card rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-medium  mb-4">
            {editingExam ? "Edit Exam" : "Create New Exam"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-normal  mb-1">
                  Exam Name
                </label>
                <select
                  name="exam_name"
                  value={formData.exam_name}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select Exam</option>
                  {["Half Yearly", "Annual", "Pre Selection", "Selection"].map(
                    (exam) => (
                      <option key={exam} value={`${exam} Exam`}>
                        {exam} Exam
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-normal  mb-1">Year</label>
                <input
                  type="number"
                  name="exam_year"
                  value={formData.exam_year}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-normal  mb-1">Classes</label>
              <div className="flex flex-wrap gap-3">
                {[6, 7, 8, 9, 10].map((level) => (
                  <label key={level} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      name="levels"
                      value={level}
                      checked={formData.levels.includes(level)}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm ">Class {level}</span>
                  </label>
                ))}
              </div>
              {levelError && (
                <p className="mt-1 text-xs text-red-500">
                  Please select at least one class
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-normal  mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 dark:bg-accent py-2 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-normal  mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-normal  mb-1">
                  Result Date
                </label>
                <input
                  type="date"
                  name="result_date"
                  value={formData.result_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border dark:bg-accent border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={resetForm}
                className="px-4 py-2 text-sm  "
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 text-sm "
              >
                {editingExam ? "Update Exam" : "Create Exam"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Exams Table */}
      <div className="rounded-lg shadow-sm border min-w-fit border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium  uppercase tracking-wider">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium  uppercase tracking-wider">
                  Year
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium  uppercase tracking-wider">
                  Classes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium  uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium  uppercase tracking-wider">
                  Published
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium  uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className=" divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-2">
                    <div className="flex justify-center items-center w-full h-full">
                      <Loading />
                    </div>
                  </td>
                </tr>
              ) : examList.length > 0 ? (
                examList.map((exam) => (
                  <tr key={exam.id}>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium ">
                        {exam.exam_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm ">{exam.exam_year}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm ">
                        {exam.levels.map((l) => `Class ${l}`).join(", ")}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm  space-y-1">
                        <div>
                          Start:{" "}
                          {format(new Date(exam.start_date), "dd MMM yyyy")}
                        </div>
                        <div>
                          End: {format(new Date(exam.end_date), "dd MMM yyyy")}
                        </div>
                        <div>
                          Result:{" "}
                          {format(new Date(exam.result_date), "dd MMM yyyy")}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <button
                          onClick={() =>
                            handleVisibilityChange(exam.id, !exam.visible)
                          }
                          className={`p-1 rounded-full ${
                            exam.visible ? "text-green-500" : "text-gray-400"
                          }`}
                        >
                          {exam.visible ? (
                            <FiEye size={18} />
                          ) : (
                            <FiEyeOff size={18} />
                          )}
                        </button>
                        <span
                          className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                            exam.visible
                              ? "bg-green-100 text-green-700"
                              : "dark:bg-card bg-gray-100"
                          }`}
                        >
                          {exam.visible ? "Published" : "Hidden"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button
                        onClick={() => handleEditExam(exam)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        <FiEdit className="sm:w-4 sm:h-4 w-3 h-3" />
                      </button>

                      <DeleteConfirmationIcon
                        onDelete={() => confirmDelete(exam.id)}
                        msg="This action cannot be undone. This will permanently delete the item from your database."
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-6 py-4 whitespace-nowrap text-center"
                    colSpan={6}
                  >
                    No exams found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AddExam;
