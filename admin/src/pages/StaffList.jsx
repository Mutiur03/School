import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
import toast from "react-hot-toast";
import { Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import DeleteConfirmationIcon from "../components/DeleteConfimationIcon";
import Loading from "../components/Loading";

function StaffList() {
  const [staff, setStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({
    visible: false,
    type: "",
    staff: null,
  });
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    designation: "",
  });
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isloading, setIsLoading] = useState(false);
  const [image, setImage] = useState(null);
  const fileInputRef = useRef(null);
  const host = import.meta.env.VITE_BACKEND_URL || window.location.origin;

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/staffs");
      setStaff(response.data.data || []);
    } catch (error) {
      console.error("Error fetching staff:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleEdit = (item) => {
    setFormData({
      name: item.name || "",
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      designation: item.designation || "",
    });

    setIsEditing(true);
    setShowForm(true);
    setPopup({ visible: false, type: "", staff: item }); // Hide any open popup
  };

  const handleDelete = async (item) => {
    try {
      await axios.delete(`/api/staffs/delete/${item.id}`);
      toast.success("Staff deleted successfully.");
      fetchStaff();
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast.error("Failed to delete staff.");
    }
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", staff: null });
  };

  const filteredStaff = staff
    .filter((s) =>
      [s.name || "", s.phone || ""]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.id - b.id);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
    }
  };

  // helper: try POST then fallback to PUT if 404, return boolean success
  const uploadImageForId = async (id, file) => {
    if (!id || !file) return false;
    const fd = new FormData();
    fd.append("image", file);

    const url = `/api/staffs/image/${id}`;
    try {
      await axios.post(url, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return true;
    } catch (err) {
      // If endpoint not found, try PUT as a best-effort fallback
      const status = err?.response?.status;
      console.warn(`Image upload POST -> status ${status} for id ${id}`);
      if (status === 404) {
        try {
          await axios.put(url, fd, {
            headers: { "Content-Type": "multipart/form-data" },
          });
          return true;
        } catch (err2) {
          console.error(
            `Image upload PUT failed for id ${id}`,
            err2?.response || err2
          );
          return false;
        }
      }
      console.error(
        `Image upload POST failed for id ${id}`,
        err?.response || err
      );
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const staffData = { ...formData };
      let response;

      if (isEditing && popup.staff) {
        response = await axios.put(
          `/api/staffs/update/${popup.staff.id}`,
          staffData
        );
        if (image) {
          // use helper (won't throw on failure)
          await uploadImageForId(popup.staff.id, image);
        }
      } else {
        response = await axios.post("/api/staffs/add", {
          staff: [staffData],
        });

        // Normalize created IDs from response to support single or multiple created staffs
        const createdIds = [];
        if (response && response.data && response.data.data) {
          const respData = response.data.data;
          if (Array.isArray(respData)) {
            respData.forEach((s) => {
              if (s && s.id) createdIds.push(s.id);
            });
          } else if (respData && respData.id) {
            createdIds.push(respData.id);
          }

          // If an image was provided upload it for each created staff id
          if (image && createdIds.length > 0) {
            // Attempt uploads in parallel but catch errors per-item
            await Promise.all(
              createdIds.map((id) =>
                uploadImageForId(id, image).catch((err) => {
                  console.error(
                    `Failed to upload image for created id ${id}`,
                    err
                  );
                  return false;
                })
              )
            );
          }
        } else {
          // Diagnostic: no created data returned
          console.warn(
            "No data returned from create API, cannot upload image. Response:",
            response
          );
        }
      }

      const data = response?.data;
      if (data?.success || response?.status === 200) {
        toast.success(data?.message || "Staff saved successfully.");
        setFormData({
          name: "",
          email: "",
          phone: "",
          address: "",
          designation: "",
        });
        setImage(null);
        setIsEditing(false);
        setShowForm(false);
      } else {
        toast.error(data?.error || "Something went wrong.");
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || "Submission failed.");
      console.error("Error submitting form:", error);
    } finally {
      fetchStaff();
      setIsSubmitting(false);
    }
  };

  // helper to build a proper image URL only when needed
  const makeImageUrl = (img) => {
    if (!img) return null;
    if (/^https?:\/\//i.test(img)) return img;
    return `${host.replace(/\/+$/, "")}/${String(img).replace(/^\/+/, "")}`;
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Staff List</h1>
        {!showForm && (
          <Button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className={`px-4 py-2 rounded-md hover:bg-opacity-90`}
          >
            + Add Staff
          </Button>
        )}
      </div>

      {showForm && (
        <div
          className={`flex justify-center bg-card rounded-lg mb-4 items-center max-w-6xl  `}
        >
          <div className={`w-full  p-6 rounded-lg shadow-md `}>
            <h1 className={`text-2xl font-bold text-center mb-6 `}>
              {isEditing ? "Edit Staff" : "Add Staff"}
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
                    placeholder="Enter name"
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
                    placeholder="Enter email "
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
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
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Home Town:
                  </label>
                  <input
                    type="text"
                    name="address"
                    placeholder="Enter address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 md:gap-6 grid-cols-1">
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Designation:
                  </label>
                  <input
                    type="text"
                    name="designation"
                    placeholder="Enter designation"
                    value={formData.designation}
                    required
                    onChange={(e) =>
                      setFormData({ ...formData, designation: e.target.value })
                    }
                    className={`w-full px-3 py-2 dark:bg-accent border rounded-md focus:outline-none focus:ring-2 `}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 `}>
                    Profile Image:
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {image ? (
                    <div className="block mt-2">
                      <img
                        src={URL.createObjectURL(image)}
                        alt="Uploaded"
                        className="w-32 h-32 object-cover rounded-md"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="text-sm text-red-600"
                          onClick={() => {
                            setImage(null);
                            if (fileInputRef.current)
                              fileInputRef.current.value = null;
                          }}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="text-sm text-blue-600"
                          onClick={() =>
                            fileInputRef.current && fileInputRef.current.click()
                          }
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : isEditing && popup.staff && popup.staff.image ? (
                    <div className="block mt-2">
                      <img
                        src={makeImageUrl(popup.staff.image)}
                        alt="Uploaded"
                        className="w-32 h-32 object-cover rounded-md"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          className="text-sm text-blue-600"
                          onClick={() =>
                            fileInputRef.current && fileInputRef.current.click()
                          }
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() =>
                        fileInputRef.current && fileInputRef.current.click()
                      }
                      role="button"
                      tabIndex={0}
                      onKeyPress={() =>
                        fileInputRef.current && fileInputRef.current.click()
                      }
                      className="cursor-pointer w-32 h-32 flex items-center justify-center rounded-md border border-dashed text-gray-400 mt-2"
                    >
                      <span className="text-sm">Click to upload</span>
                    </div>
                  )}
                </div>
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
                      email: "",
                      phone: "",
                      address: "",
                      designation: "",
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
        placeholder="Search by name or phone..."
        className="border rounded-lg px-3 text-input py-2 mb-4 w-full"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full border divide-y divide-gray-200">
            <thead className="bg-popover">
              <tr>
                {["ID", "Name", "Email", "Actions"].map((header) => (
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
              ) : filteredStaff.length > 0 ? (
                filteredStaff.map((item) => (
                  <tr key={item.id} className="">
                    <td className=" px-4 py-2">{item.id}</td>
                    <td className=" px-4 py-2">{item.name}</td>
                    <td className=" px-4 py-2">{item.email}</td>
                    <td className=" py-2 text-center space-x-4">
                      <button
                        onClick={() =>
                          setPopup({ visible: true, type: "view", staff: item })
                        }
                        className="hover:text-blue-500"
                      >
                        <Eye className="sm:w-4 sm:h-4 w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="hover:text-green-500"
                      >
                        <Pencil className="sm:w-4 sm:h-4 w-3 h-3" />
                      </button>
                      <DeleteConfirmationIcon
                        onDelete={() => handleDelete(item)}
                        msg={`Are you sure you want to delete ${item.name}?`}
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
                    No staff found.
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
                <h2 className="text-xl font-bold">Staff Info</h2>
                {popup.staff.image && (
                  <p className="flex justify-center items-center">
                    <img
                      src={makeImageUrl(popup.staff.image)}
                      alt="Profile"
                      className="w-32 h-32 object-cover rounded-md mt-2"
                    />
                  </p>
                )}

                {/* render all fields dynamically so the backend can add fields without frontend changes */}
                <div className="mt-3 space-y-1 text-sm">
                  {Object.entries(popup.staff).map(([k, v]) => {
                    if (k === "image") return null;
                    const label = String(k)
                      .replace(/([A-Z])/g, " $1")
                      .replace(/[_-]+/g, " ")
                      .trim()
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    const value =
                      v === null || v === undefined ? "—" : String(v);
                    return (
                      <p key={k}>
                        <strong>{label}:</strong> {value}
                      </p>
                    );
                  })}
                </div>

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
}

export default StaffList;
