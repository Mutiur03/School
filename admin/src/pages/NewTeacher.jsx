import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

function NewTeacher() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "General",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        "/api/teachers/addTeacher",
        { teachers: [formData] }
      );
      const data = response.data;
      if (data.success) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
      setFormData({ name: "", email: "", phone: "", department: "General" });
      console.log("Form submitted:", formData);
    } catch (error) {
      toast.error("An error occurred while submitting the form.");
      console.error("Error submitting form:", error);
    }
  };

  return (
    <div className={`flex justify-center items-center h-[85vh] `}>
      <div className={`w-full max-w-md p-6 rounded-lg shadow-md `}>
        <h1 className={`text-2xl font-bold text-center mb-6 `}>New Teacher</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-1 `}>Name:</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2   border rounded-md focus:outline-none focus:ring-2 `}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 `}>Email:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`w-full px-3 py-2  border rounded-md focus:outline-none focus:ring-2 `}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 `}>Phone:</label>
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              maxLength="11"
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 `}
              required
            />
          </div>
          <div>
            <label className={`block text-sm font-medium mb-1 `}>
              Department:
            </label>
            <select
              name="department"
              value={formData.department}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 `}
            >
              {["General", "Science", "Arts", "Commerce"].map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className={`w-full py-2  text-white font-medium rounded-md  focus:outline-none focus:ring-2 `}
          >
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

export default NewTeacher;
