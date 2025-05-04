import axios from "axios";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import DeleteConfirmationIcon from "../components/DeleteConfimationIcon";
import { format } from "date-fns";
import Loading from "../components/Loading";
const TeacherList = () => {
  const [teachers, setTeachers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({
    visible: false,
    type: "",
    teacher: null,
  });
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    email: "",
    phone: "",
    address: "",
    dob: "",
    blood_group: "",
    academic_qualification: "",
    designation: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isloading, setIsLoading] = useState(false);
  const [image, setImage] = useState(null);
  const host = import.meta.env.VITE_BACKEND_URL;
  const fetchTeachers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/teachers/getTeachers");
      setTeachers(response.data.data || []);
    } catch (error) {
      console.error("Error fetching teachers:", error);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleEdit = (teacher) => {
    setFormData({
      name: teacher.name || "",
      subject: teacher.subject || "",
      email: teacher.email || "",
      phone: teacher.phone || "",
      address: teacher.address || "",
      dob: teacher.dob || "",
      blood_group: teacher.blood_group || "",
      academic_qualification: teacher.academic_qualification || "",
      designation: teacher.designation || "",
    });
    console.log(teacher);

    setIsEditing(true);
    setShowForm(true);
    setPopup({ visible: false, type: "", teacher }); // Hide any open popup
  };

  const handleDelete = async (teacher) => {
    try {
      await axios.delete(`/api/teachers/deleteTeacher/${teacher.id}`);
      toast.success("Teacher deleted successfully.");
      fetchTeachers();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("Failed to delete teacher.");
    }
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", teacher: null });
  };

  const filteredTeachers = teachers
    .filter((teacher) => teacher.available)
    .filter(
      (teacher) =>
        teacher.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        teacher.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.id - b.id);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const teacherData = { ...formData };
      let response;

      if (isEditing && popup.teacher) {
        response = await axios.put(
          `/api/teachers/updateTeacher/${popup.teacher.id}`,
          teacherData
        );
        if (image) {
          const formData = new FormData();
          formData.append("image", image);
          await axios.post(
            `/api/teachers/uploadImage/${popup.teacher.id}`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }
      } else {
        response = await axios.post("/api/teachers/addTeacher", {
          teachers: [teacherData],
        });
        if (image) {
          const formData = new FormData();
          formData.append("image", image);
          await axios.post(
            `/api/teachers/uploadImage/${response.data.data[0].id}`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
        }
      }

      const data = response.data;
      if (data.success || response.status === 200) {
        toast.success(data.message || "Teacher saved successfully.");
        setFormData({
          name: "",
          subject: "",
          email: "",
          phone: "",
          address: "",
          dob: "",
          blood_group: "",
          academic_qualification: "",
          designation: "",
        });
        setImage(null);
        setIsEditing(false);
        setShowForm(false);
      } else {
        toast.error(data.error || "Something went wrong.");
      }
    } catch (error) {
      toast.error("An error occurred while submitting the form.");
      console.error("Error submitting form:", error);
    } finally {
      fetchTeachers();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Teacher List</h1>
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={`px-4 py-2 rounded-md hover:bg-opacity-90`}
          >
            + Add Teacher
          </Button>
        )}
      </div>
      {showForm && (
        <div
          className={`flex justify-center bg-card rounded-lg mb-4 items-center max-w-6xl  `}
        >
          <div className={`w-full  p-6 rounded-lg shadow-md `}>
            <h1 className={`text-2xl font-bold text-center mb-6 `}>
              {isEditing ? "Edit Teacher" : "Add Teacher"}
            </h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4 md:gap-6 grid-cols-1">
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Name:
                  </label>
                  <input
                    type="text"
                    name="name"
                    placeholder="Enter teacher's name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent  border rounded-md focus:outline-none focus:ring-2 `}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Email:
                  </label>
                  <input
                    type="email"
                    name="email"
                    placeholder="Enter teacher's email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                    required
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 md:gap-6 grid-cols-1">
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Phone:
                  </label>
                  <input
                    type="number"
                    name="phone"
                    placeholder="Enter teacher's phone number"
                    maxLength="11"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                    required
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Subject:
                  </label>
                  <input
                    type="text"
                    name="subject"
                    placeholder="Enter teacher's subject"
                    value={formData.subject}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                    required
                    className={`w-full px-3 py-2 border dark:bg-accent rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 md:gap-6 grid-cols-1">
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Address:
                  </label>
                  <input
                    type="text"
                    name="address"
                    placeholder="Enter teacher's address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Date of Birth:
                  </label>
                  <input
                    type="date"
                    name="dob"
                    // placeholder="Enter teacher's date of birth"
                    value={formData.dob}
                    onChange={(e) =>
                      setFormData({ ...formData, dob: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4 md:gap-6 grid-cols-1">
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Blood Group:
                  </label>
                  <input
                    type="text"
                    name="bloodGroup"
                    placeholder="Enter teacher's blood group"
                    value={formData.blood_group}
                    onChange={(e) =>
                      setFormData({ ...formData, blood_group: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Designation:
                  </label>
                  <input
                    type="text"
                    name="designation"
                    placeholder="Enter teacher's designation"
                    value={formData.designation}
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 `}>
                  Academic Qualification:
                </label>
                <textarea
                  type="text"
                  name="academicQualification"
                  value={formData.academic_qualification}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      academic_qualification: e.target.value,
                    })
                  }
                  required
                  placeholder="Enter academic qualification"
                  className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 resize-none`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 `}>
                  Profile Image:
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2`}
                />
                {image && (
                  <label className="block mt-2">
                    <img
                      src={image ? URL.createObjectURL(image) : ""}
                      alt="Uploaded"
                      className="w-32 h-32 object-cover rounded-md"
                    />
                  </label>
                )}
                {!image && isEditing && (
                  <label className="block mt-2">
                    <img
                      src={`${host}/${popup.teacher.image}`}
                      alt="Uploaded"
                      className="w-32 h-32 object-cover rounded-md"
                    />
                  </label>
                )}
              </div>
              <div className="flex justify-between md:flex-row flex-col gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setIsEditing(false);
                    setFormData({
                      name: "",
                      subject: "",
                      email: "",
                      phone: "",
                      address: "",
                      dob: "",
                      blood_group: "",
                    });
                    setImage(null);
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className={`py-2  font-medium rounded-md  focus:outline-none focus:ring-2 `}
                >
                  Submit
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      <input
        type="text"
        placeholder="Search by name, subject, or email..."
        className="border rounded-lg px-3 text-input py-2 mb-4 w-full"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr>
                {["ID", "Name", "Subject", "Email", "Actions"].map((header) => (
                  <th key={header} className="  px-4 py-2 text-left">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isloading ? (
                <tr>
                  <td colSpan="5" className="py-2">
                    <div className="flex justify-center items-center w-full h-full">
                      <Loading />
                      
                    </div>
                  </td>
                </tr>
              ) : filteredTeachers.length > 0 ? (
                filteredTeachers.map((teacher) => (
                  <tr key={teacher.id} className="">
                    <td className=" px-4 py-2">{teacher.id}</td>
                    <td className=" px-4 py-2">{teacher.name}</td>
                    <td className=" px-4 py-2">{teacher.subject}</td>
                    <td className=" px-4 py-2">{teacher.email}</td>
                    <td className=" py-2 text-center space-x-4">
                      <button
                        onClick={() =>
                          setPopup({ visible: true, type: "view", teacher })
                        }
                        className="hover:text-blue-500"
                      >
                        <Eye className="sm:w-4 sm:h-4 w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleEdit(teacher)}
                        className="hover:text-green-500"
                      >
                        <Pencil className="sm:w-4 sm:h-4 w-3 h-3" />
                      </button>
                      <DeleteConfirmationIcon
                        onDelete={() => handleDelete(teacher)}
                        msg={`Are you sure you want to delete ${teacher.name}?`}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan="5"
                    className="border px-4 py-2 text-center text-gray-500"
                  >
                    No teachers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {popup.visible && (
        <div className="fixed inset-0 backdrop-blur-xl backdrop-filter  flex items-center justify-center z-50">
          <div className=" p-6 rounded-lg shadow-lg w-96 bg-card max-h-[90vh] overflow-y-auto">
            {popup.type === "view" && (
              <>
                <h2 className="text-xl font-bold">Teacher Info</h2>
                {popup.teacher.image && (
                  <p className="flex justify-center items-center">
                    {/* <strong>Profile Image:</strong> */}
                    <img
                      src={`${host}/${popup.teacher.image}`}
                      alt="Profile"
                      className="w-32 h-32 object-cover rounded-md mt-2"
                    />
                  </p>
                )}
                <p>
                  <strong>ID:</strong> {popup.teacher.id}
                </p>
                <p>
                  <strong>Name:</strong> {popup.teacher.name}
                </p>
                <p>
                  <strong>Subject:</strong> {popup.teacher.subject}
                </p>

                <p>
                  <strong>Email:</strong> {popup.teacher.email}
                </p>
                <p>
                  <strong>Phone:</strong> {popup.teacher.phone}
                </p>
                <p>
                  <strong>Address:</strong> {popup.teacher.address}
                </p>
                <p>
                  <strong>Blood Group:</strong> {popup.teacher.blood_group}
                </p>
                <p>
                  <strong>DOB:</strong>{" "}
                  {popup.teacher.dob &&
                    format(new Date(popup.teacher.dob), "dd MMM yyyy")}
                </p>
                <p>
                  <strong>Designation:</strong> {popup.teacher.designation}
                </p>
                <p>
                  <strong>Academic Qualification:</strong>{" "}
                  {popup.teacher.academic_qualification}
                </p>

                <div className="mt-4 text-right">
                  <Button
                    variant="outline"
                    className=" px-4 py-2 rounded-lg"
                    onClick={closePopup}
                  >
                    Close
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherList;
