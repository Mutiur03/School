import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "react-hot-toast";
import DatePicker from "@/components/DatePickerF";
import DeleteConfirmation from "@/components/DeleteConfimation";
import { format } from "date-fns";
import backend from "@/lib/backend";

interface Event {
  id: string;
  title: string;
  details: string;
  location: string;
  file: string;
  image: string;
  date: string;
}

interface FormValues {
  title: string;
  details: string;
  location: string;
  file: File | null | string;
  image: File | null | string;
  date: string | null;
}

interface PopupState {
  visible: boolean;
  type: string;
  event: Event | null;
}

const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "",
    event: null,
  });
  const [showForm, setShowForm] = useState<boolean>(false);
  const fileref = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({
    title: "",
    details: "",
    location: "",
    file: null,
    image: null,
    date: null,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const host = backend;;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axios.get<Event[]>("/api/events/getEvents");
      setEvents(response.data || []);
    } catch (error) {
      console.error("Error fetching notices:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      if (isEditing) {
        await axios.put(`/api/events/updateEvent/${editId}`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Notice updated successfully!");
      } else {
        await axios.post("/api/events/addEvent", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        toast.success("Notice uploaded successfully!");
      }
      setFormValues({
        title: "",
        details: "",
        location: "",
        file: null,
        image: null,
        date: null,
      });
      form.reset();
      setIsEditing(false);
      setEditId(null);
      setShowForm(false);
      fetchEvents();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload notice.");
    } finally {
      setSubmitting(false);
    }
  };

  const openPopup = (type: string, event: Event) => {
    setPopup({ visible: true, type, event });
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", event: null });
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;

    setDeleting(true);
    try {
      await axios.delete(`/api/events/deleteEvent/${id}`);
      fetchEvents();
      toast.success("Notice deleted successfully!");
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice.");
    } finally {
      setDeleting(false);
    }
    closePopup();
  };

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Events</h1>
        {!showForm && (
          <Button
            onClick={() => setShowForm((prev) => !prev)}
            className={`px-4 py-2 rounded-md bg-primary text-white hover:bg-opacity-90`}
          >
            + Create Event
          </Button>
        )}
      </div>

      {(showForm || isEditing) && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>{isEditing ? "Edit Event" : "Upload Event"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="title">Event Title <span className="text-red-500">*</span></Label>
                <Input
                  id="title"
                  name="title"
                  placeholder="Enter event title"
                  value={formValues.title}
                  onChange={(e) =>
                    setFormValues({ ...formValues, title: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="details">Event Details <span className="text-gray-400 font-normal">(Optional)</span></Label>
                <Textarea
                  id="details"
                  name="details"
                  placeholder="Enter detailed event text"
                  maxLength={100}
                  value={formValues.details}
                  onChange={(e) =>
                    setFormValues({ ...formValues, details: e.target.value })
                  }
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="file">Upload PDF Notice <span className="text-gray-400 font-normal">(Optional)</span></Label>
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
                  />
                  {formValues.file && (
                    <p className="text-sm text-gray-500">
                      {formValues.file instanceof File
                        ? "Selected file: " +
                        formValues.file.name.slice(0, 20) +
                        "..."
                        : "Uploaded file: " +
                        formValues.file.slice(0, 20) +
                        "..."}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="image">Upload Photo <span className="text-gray-400 font-normal">(Optional)</span></Label>
                  <Input
                    id="image"
                    type="file"
                    name="image"
                    accept="image/*"
                    ref={fileref}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        image: e.target.files?.[0] || null,
                      })
                    }
                  />
                  {formValues.image && (
                    <p className="text-sm text-gray-500">
                      {formValues.image instanceof File
                        ? "Selected file: " +
                        formValues.image.name.slice(0, 20) +
                        "..."
                        : "Uploaded file: " +
                        formValues.image
                          .split("\\")
                          .pop()
                          ?.split("-")
                          .slice(2)
                          .join("-")
                          .slice(0, 20) +
                        "..."}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="date">Event Date <span className="text-red-500">*</span></Label>
                  <DatePicker
                    value={formValues.date}
                    onChange={(e) =>
                      setFormValues({ ...formValues, date: e.target.value })
                    }
                    required={true}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="location">Event Location <span className="text-gray-400 font-normal">(Optional)</span></Label>
                  <Input
                    id="location"
                    name="location"
                    placeholder="Enter event location"
                    value={formValues.location}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        location: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditId(null);
                    setFormValues({
                      title: "",
                      details: "",
                      location: "",
                      file: null,
                      image: null,
                      date: "",
                    });
                    if (fileref.current) {
                      fileref.current.value = "";
                    }
                    setShowForm(false);
                  }}
                >
                  {isEditing ? "Cancel Update" : "Cancel"}
                </Button>
                <Button type="submit" disabled={submitting} className="">
                  {submitting
                    ? isEditing
                      ? "Updating..."
                      : "Creating..."
                    : isEditing
                      ? "Update Event"
                      : "Create Event"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <div className="max-w-6xl mx-auto mt-10 px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="bg-card rounded-lg shadow-md text-center overflow-hidden hover:shadow-lg transition-shadow animate-pulse"
              >
                <div className="relative h-40 bg-gray-300"></div>
                <div className="p-4">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {events.length > 0 ? (
            events.map((event) => (
              <div
                key={event.id}
                className="bg-card rounded-lg shadow-md text-center overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="relative h-40">
                  <img
                    src={
                      event.image
                        ? `${host}/${event.image}`
                        : "/placeholder.svg"
                    }
                    alt={event.title}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                  <p className="text-sm text-gray-500 mb-2">
                    {format(new Date(event.date), "dd MMM yyyy")}
                  </p>
                  <button
                    className="text-primary text-sm hover:underline"
                    onClick={() => openPopup("view", event)}
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center col-span-full text-gray-500">
              No events available.
            </div>
          )}
        </div>
      )}
      {popup.visible && popup.event && (
        <div className="fixed inset-0 backdrop-blur-2xl bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="rounded-lg bg-card shadow-lg w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {popup.type === "view" && (
              <>
                <h2 className="text-xl font-bold mb-4">Event Details</h2>
                <div className="space-y-2 ">
                  <div className=" flex justify-center ">
                    <img
                      src={`${host}/${popup.event.image}`}
                      alt=""
                      className="max-w-40 max-h-40"
                    />
                  </div>
                  <div>
                    <strong>Title:</strong> {popup.event.title}
                  </div>
                  {popup.event.details && (
                    <div>
                      <strong>Details:</strong> {popup.event.details}
                    </div>
                  )}
                  <div>
                    <strong>Date:</strong>{" "}
                    {format(new Date(popup.event.date), "dd MMM yyyy")}
                  </div>
                  {popup.event.location && (
                    <div>
                      <strong>Location:</strong> {popup.event.location}
                    </div>
                  )}
                  {popup.event.file && (
                    <div>
                      <strong>File:</strong>{" "}
                      <a
                        href={`${popup.event.file}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        View PDF
                      </a>
                    </div>
                  )}

                </div>
                <div className="flex justify-between pt-4">
                  <div className="flex gap-2">
                    <DeleteConfirmation
                      onDelete={() => popup.event && handleDelete(popup.event.id)}
                    />
                    <Button
                      type="button"
                      disabled={deleting}
                      onClick={() => {
                        if (popup.event) {
                          setFormValues({
                            title: popup.event.title,
                            details: popup.event.details || "",
                            file: popup.event.file,
                            image: popup.event.image,
                            date: popup.event.date,
                            location: popup.event.location,
                          });
                          setIsEditing(true);
                          setEditId(popup.event.id);
                          setShowForm(true);
                          closePopup();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                      className=""
                    >
                      Edit
                    </Button>
                  </div>
                  <Button variant="outline" onClick={closePopup} className="">
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

export default Events;
