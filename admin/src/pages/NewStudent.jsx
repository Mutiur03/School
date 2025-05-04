import React, { useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const excelDateToJSDate = (serial) => {
  if (!serial || isNaN(serial)) return null;
  const utcDays = Math.floor(serial - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().split("T")[0];
};

const NewStudent = () => {
  const [data, setData] = useState({
    name: "",
    phone: "",
    roll: "",
    section: "",
    address: "",
    dob: "",
    class: "",
    department: "",
  });

  const [isExcelUpload, setIsExcelUpload] = useState(false);
  const [jsonData, setJsonData] = useState(null);
  const [fileUploaded, setFileUploaded] = useState(false); // New state for file upload status

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (data.password !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const students = [
        {
          name: data.name,
          phone: data.phone,
          roll: data.roll,
          section: data.section,
          address: data.address,
          dob: data.dob,
          class: data.class,
          department: data.department,
        },
      ];

      console.log("Submitting data:", students);

      const response = await axios.post(
        "/api/students/addStudents",
        { students: students }
      );

      if (response.success === false) {
        toast.error(response.message);
        return;
      }

      setData({
        name: "",
        phone: "",
        roll: "",
        section: "",
        address: "",
        dob: "",
        class: "",
        department: "",
      });

      toast.success(response.data.message);
    } catch (err) {
      console.error(
        "Error adding student:",
        err.response?.data?.error || err.message
      );
      toast.error("Error adding student");
      toast.error(err.response?.data?.error || err.message);
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileUploaded(true); // Set fileUploaded to true when a file is selected

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);

    reader.onload = (e) => {
      const arrayBuffer = e.target.result;
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet);

      console.log("Raw Data from Excel:", rawData);

      const formattedData = rawData.map((student) => ({
        name: student.name?.trim() || null,
        phone: student.phone?.toString().replace(/\D/g, "").slice(-10) || null,
        address: student.address?.trim() || null,
        dob: excelDateToJSDate(student.dob),
        class: parseInt(student.class, 10) || null,
        roll: parseInt(student.roll, 10) || null,
        section: student.section?.toString().trim() || null,
        department: student.department?.trim() || null,
      }));

      console.log("Formatted Data:", formattedData);
      setJsonData(formattedData);
    };

    reader.onerror = () => {
      toast.error("Error reading the file. Please try again.");
    };
  };

  // Send Excel data to backend
  const sendToBackend = async (e) => {
    e.preventDefault();

    try {
      console.log("Data being sent to backend:", jsonData);

      if (!jsonData || jsonData.length === 0) {
        toast.error("No data to upload. Please check your Excel file.");
        return;
      }

      const response = await axios.post(
        "/api/students/addStudents",
        { students: jsonData }
      );

      if (response.data.success === false) {
        toast.error(response.data.message);
        return;
      }

      toast.success(response.data.message);
      setJsonData(null);
      setFileUploaded(false); // Reset fileUploaded state
      document.querySelector('input[name="excelFile"]').value = ""; // Clear file input
    } catch (err) {
      console.error(
        "Error adding student:",
        err.response?.data?.message || err.message
      );
      toast.error("Error adding student");
      toast.error(err.response?.data?.message || "Failed to upload students.");
    }
  };

  return (
    <div className={`min-h-fit flex items-center justify-center p-4 `}>
      <div className={`p-8 rounded-lg shadow-2xl w-full max-w-2xl `}>
        <h2 className={`text-3xl font-extrabold text-center mb-6 `}>
          Add New Student
        </h2>
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setIsExcelUpload(false)}
            className={`px-6 py-3 rounded-l-lg font-semibold transition-all duration-300 ${
              !isExcelUpload
                ? "bg-sky-500 text-white shadow-lg"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Form
          </button>
          <button
            onClick={() => setIsExcelUpload(true)}
            className={`px-6 py-3 rounded-r-lg font-semibold transition-all duration-300 ${
              isExcelUpload
                ? "bg-sky-500 text-white shadow-lg"
                : "bg-gray-200 hover:bg-gray-300"
            }`}
          >
            Excel Upload
          </button>
        </div>
        <div className="space-y-6">
          {!isExcelUpload ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="name"
                  placeholder="Full Name"
                  value={data.name}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                  required
                />
                <input
                  type="text"
                  name="phone"
                  placeholder="Phone"
                  maxLength={11}
                  value={data.phone}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="class"
                  placeholder="Class"
                  value={data.class}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                />
                <input
                  type="text"
                  name="roll"
                  placeholder="Roll"
                  value={data.roll}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  name="section"
                  placeholder="Section"
                  value={data.section}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                />
                <input
                  type="text"
                  name="address"
                  placeholder="Address"
                  value={data.address}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="date"
                  name="dob"
                  placeholder="Date of Birth"
                  value={data.dob}
                  onChange={handleChange}
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                />
                <input
                  type="text"
                  name="department"
                  placeholder="Department"
                  value={data.department}
                  onChange={handleChange}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:outline-none transition-all duration-300"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white py-3 rounded-lg font-bold hover:shadow-xl transition-all duration-300"
              >
                Submit
              </button>
            </form>
          ) : (
            <form onSubmit={sendToBackend} className="space-y-4">
              <div className="relative">
                <input
                  type="file"
                  id="excelFile"
                  name="excelFile"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="absolute w-full h-full opacity-0 cursor-pointer"
                  required
                />

                <label
                  htmlFor="excelFile"
                  className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-sky-500 transition-all duration-300"
                >
                  <div className="w-16 h-16 bg-sky-100 rounded-full flex items-center justify-center mb-4">
                    {fileUploaded ? (
                      <svg
                        className="w-8 h-8 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-8 h-8 text-sky-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-400 font-medium">
                    {fileUploaded ? "File Uploaded" : "Upload Excel File"}
                  </span>
                  <span className="text-sm text-gray-500">
                    .xlsx or .xls files only
                  </span>
                </label>
              </div>
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-sky-500 to-sky-600 text-white py-3 rounded-lg font-bold hover:shadow-xl transition-all duration-300"
              >
                Upload
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewStudent;
