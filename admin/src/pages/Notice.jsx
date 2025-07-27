import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiTrash2, FiEdit } from "react-icons/fi";
import { FiEye } from "react-icons/fi";
import { Loading } from "@/components";
import { useNoticeStore } from "@/store";
import { Loader2 } from "lucide-react";
const NoticeUploadPage = () => {
  const [popup, setPopup] = useState({
    visible: false,
    type: "",
    notice: null,
  });
  const [showForm, setShowForm] = useState(false);
  const fileref = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formValues, setFormValues] = useState({
    title: "",
    file: null,
  });
  const {
    notices,
    fetchNotices,
    deleteNotice,
    isDeleting,
    isSubmitting,
    addNotice,
    updateNotice,
    isLoading,
  } = useNoticeStore();

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    try {
      if (isEditing) {
        await updateNotice(editId, formData);
      } else {
        await addNotice(formData);
      }
      // Only reset and hide form on successful submission
      setFormValues({ title: "", file: null });
      if (fileref.current) {
        fileref.current.value = "";
      }
      setIsEditing(false);
      setEditId(null);
      setShowForm(false);
    } catch (error) {
      console.error("Error submitting form:", error);
      // Don't hide form on error - let user see the error and retry
      openPopup("error", { message: error.message || "An error occurred" });
    }
  };

  const openPopup = (type, notice) => {
    setPopup({ visible: true, type, notice });
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", notice: null });
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Notices</h1>
        {!showForm && (
          <Button
            onClick={() => setShowForm((prev) => !prev)}
            className={`px-4 py-2 rounded-md bg-primary text-white hover:bg-opacity-90`}
          >
            + Upload Notice
          </Button>
        )}
      </div>

      {(showForm || isEditing) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Notice" : "Upload Notice"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="title">Notice Title</Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter notice title"
                  value={formValues.title}
                  onChange={(e) =>
                    setFormValues({ ...formValues, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="file">Upload File</Label>
                <Input
                  id="file"
                  type="file"
                  name="file"
                  accept=".pdf"
                  ref={fileref}
                  onChange={(e) =>
                    setFormValues({
                      ...formValues,
                      file: e.target.files?.[0] || null,
                    })
                  }
                  {...(!isEditing && { required: true })}
                />
                {(formValues.file ||
                  (isEditing && typeof formValues.file === "string")) && (
                  <p className="text-sm text-gray-500">
                    {formValues.file && typeof formValues.file === "object"
                      ? "Selected file: " +
                        formValues.file.name.slice(0, 20) +
                        "..."
                      : isEditing && typeof formValues.file === "string"
                      ? "Current file: " +
                        formValues.file.split("/").pop().slice(0, 20) +
                        "..."
                      : ""}
                  </p>
                )}
              </div>
              <div className="flex justify-between gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isEditing ? (
                    isSubmitting ? (
                      <>
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin h-4 w-4" />
                          Updating...
                        </span>
                      </>
                    ) : (
                      "Update Notice"
                    )
                  ) : isSubmitting ? (
                    <>
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin h-4 w-4" />
                        Uploading...
                      </span>
                    </>
                  ) : (
                    "Publish Notice"
                  )}
                </Button>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditId(null);
                    setFormValues({ title: "", file: null });
                    if (fileref.current) {
                      fileref.current.value = "";
                    }
                    setShowForm(false);
                  }}
                >
                  {isEditing ? "Cancel Update" : "Cancel"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className=" rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full  divide-y divide-gray-200">
            <thead className="bg-popover  ">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3  text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Published Date
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className=" divide-y divide-gray-200">
              {notices.length === 0 ? (
                <tr>
                  <td colSpan="3" className="py-2">
                    <div className="flex justify-center items-center w-full h-full">
                      {isLoading ? (
                        <Loading />
                      ) : (
                        <p className="text-gray-500">No notices found</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                notices.map((notice) => {
                  return (
                    <tr key={notice.id} className="">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium ">
                        {notice.title}
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap text-sm font-medium">
                        {notice.created_at.split("T")[0]}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          className="text-blue-600 mr-3"
                          onClick={() => openPopup("view", notice)}
                        >
                          <FiEye size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setFormValues({
                              title: notice.title,
                              file: notice.file,
                            });
                            setIsEditing(true);
                            setEditId(notice.id);
                            setShowForm(true);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="hover:text-sky-500 mr-3"
                        >
                          <FiEdit size={18} />
                        </button>
                        <button
                          onClick={() => openPopup("delete", notice)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <FiTrash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {popup.visible && popup.notice && (
        <div className="fixed inset-0 backdrop-blur-2xl bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg bg-card shadow-lg w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {popup.type === "view" && (
              <>
                <h2 className="text-xl font-bold mb-4">Notice Details</h2>
                <div className="space-y-2">
                  <div>
                    <strong>Title:</strong> {popup.notice.title}
                  </div>
                  <div>
                    <a
                      href={`${popup.notice.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      View PDF
                    </a>
                    {/* <iframe
                      src="http://localhost:3001/pdf/notice/1753181378922-645960636-Fundit.pdf"
                      width="100%"
                      height="600px"
                    ></iframe> */}
                    {/* <iframe
                      src={`${popup.notice.file}`}
                      width="100%"
                      height="600px"
                    ></iframe> */}
                  </div>
                  <div>
                    <a
                      href={`${popup.notice.download_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={closePopup}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
            {popup.type === "delete" && (
              <>
                <h2 className="text-xl font-bold text-red-600 mb-4">
                  Confirm Delete
                </h2>
                <p>
                  Are you sure you want to delete{" "}
                  <span className="font-semibold">{popup.notice.title}</span>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={closePopup}
                    className="px-4 py-2 border border-gray-300 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeleting}
                    onClick={async () => {
                      await deleteNotice(popup.notice.id);
                      closePopup();
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? (
                      <>
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin h-4 w-4" />
                          Deleting...
                        </span>
                      </>
                    ) : (
                      "Delete"
                    )}
                  </button>
                </div>
              </>
            )}
            {popup.type === "error" && (
              <>
                <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
                <p>{popup.notice?.message || "An unexpected error occurred"}</p>
                <div className="flex justify-end pt-4">
                  <button
                    onClick={closePopup}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NoticeUploadPage;
