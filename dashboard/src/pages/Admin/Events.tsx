import React, { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "react-hot-toast";
import DatePicker from "@/components/DatePickerF";
import DeleteConfirmation from "@/components/DeleteConfimation";
import { format } from "date-fns";
import { getFileUrl } from "@/lib/backend";
import { useEvents, useAddEvent, useUpdateEvent, useDeleteEvent, type Event } from "@/queries/events.queries";

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
  const [popup, setPopup] = useState<PopupState>({
    visible: false,
    type: "",
    event: null,
  });
  const [showForm, setShowForm] = useState<boolean>(false);
  const fileref = useRef<HTMLInputElement>(null);
  const imageref = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | number | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({
    title: "",
    details: "",
    location: "",
    file: null,
    image: null,
    date: null,
  });
  const [dateError, setDateError] = useState<string | null>(null);

  const { data: events = [], isLoading } = useEvents();
  const addMutation = useAddEvent();
  const updateMutation = useUpdateEvent();
  const deleteMutation = useDeleteEvent();

  const submitting = addMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    if (!formValues.date) {
      setDateError("Event date is required.");
      toast.error("Please select event date.");
      return;
    }
    setDateError(null);

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editId!,
          data: {
            title: formValues.title,
            details: formValues.details,
            location: formValues.location,
            date: formValues.date,
            image: formValues.image instanceof File ? formValues.image : undefined,
            file: formValues.file instanceof File ? formValues.file : undefined,
          },
        });
      } else {
        await addMutation.mutateAsync({
          title: formValues.title,
          details: formValues.details,
          location: formValues.location,
          date: formValues.date,
          image: formValues.image instanceof File ? formValues.image : undefined,
          file: formValues.file instanceof File ? formValues.file : undefined,
        });
      }
      handleCancel();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setFormValues({
      title: "",
      details: "",
      location: "",
      file: null,
      image: null,
      date: null,
    });
    if (fileref.current) fileref.current.value = "";
    if (imageref.current) imageref.current.value = "";
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const openPopup = (type: string, event: Event) => {
    setPopup({ visible: true, type, event });
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", event: null });
  };

  const handleDelete = async (id: string | number) => {
    try {
      await deleteMutation.mutateAsync(id);
    } catch (error) {
      console.error("Error deleting event:", error);
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
                    <p className="text-sm text-muted-foreground">
                      {formValues.file instanceof File
                        ? "Selected file: " +
                        formValues.file.name.slice(0, 20) +
                        "..."
                        : "Uploaded file: " +
                        (formValues.file as string).slice(0, 20) +
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
                    ref={imageref}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        image: e.target.files?.[0] || null,
                      })
                    }
                  />
                  {formValues.image && (
                    <p className="text-sm text-muted-foreground">
                      {formValues.image instanceof File
                        ? "Selected file: " +
                        formValues.image.name.slice(0, 20) +
                        "..."
                        : "Uploaded file: " +
                        (formValues.image as string).slice(0, 20) +
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
                    onChange={(e: any) => {
                      setFormValues({ ...formValues, date: e.target.value });
                      setDateError(null);
                    }}
                    required={true}
                  />
                  {dateError && (
                    <p className="text-sm text-red-500">{dateError}</p>
                  )}
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
                  onClick={handleCancel}
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
      {isLoading ? (
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
                    src={getFileUrl(event.image) || "/placeholder.svg"}
                    alt={event.title}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
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
            <div className="text-center col-span-full text-muted-foreground">
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
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">Event Details</h2>
                  <button onClick={closePopup} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-center bg-gray-100 rounded-lg p-4">
                    <img
                      src={getFileUrl(popup.event.image) || "/placeholder.svg"}
                      alt=""
                      className="max-w-full max-h-64 object-contain rounded-md shadow-sm"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <strong className="text-gray-700">Title:</strong> 
                      <p className="mt-1">{popup.event.title}</p>
                    </div>
                    {popup.event.details && (
                      <div>
                        <strong className="text-gray-700">Details:</strong>
                        <p className="mt-1 text-gray-600 italic">"{popup.event.details}"</p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <div>
                        <strong className="text-gray-700">Date:</strong>
                        <p className="mt-1">{format(new Date(popup.event.date), "dd MMM yyyy")}</p>
                      </div>
                      {popup.event.location && (
                        <div className="text-right">
                          <strong className="text-gray-700">Location:</strong>
                          <p className="mt-1">{popup.event.location}</p>
                        </div>
                      )}
                    </div>
                    {popup.event.file && (
                      <div>
                        <strong className="text-gray-700">Notice:</strong>
                        <div className="mt-2 text-center">
                          <a
                            href={getFileUrl(popup.event.file)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold text-sm hover:bg-primary/20 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View PDF Document
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between pt-6 mt-6 border-t">
                  <div className="flex gap-3">
                    <DeleteConfirmation
                      onDelete={() => popup.event && handleDelete(popup.event.id)}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (popup.event) {
                          setFormValues({
                            title: popup.event.title,
                            details: popup.event.details || "",
                            file: popup.event.file,
                            image: popup.event.image,
                            date: popup.event.date,
                            location: popup.event.location || "",
                          });
                          setIsEditing(true);
                          setEditId(popup.event.id);
                          setShowForm(true);
                          closePopup();
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }
                      }}
                    >
                      Edit Event
                    </Button>
                  </div>
                  <Button variant="outline" onClick={closePopup}>
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
