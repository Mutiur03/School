import React, { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { toast } from "react-hot-toast";
import DatePicker from "../components/DatePickerF";
import DeleteConfirmation from "../components/DeleteConfimation";
import {format} from "date-fns";
const Events = () => {
  const [events, setEvents] = useState([]);
  const [popup, setPopup] = useState({
    visible: false,
    type: "",
    event: null,
  });
  const [showForm, setShowForm] = useState(false);
  const fileref = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formValues, setFormValues] = useState({
    title: "",
    details: "",
    location: "",
    file: null,
    image: null,
    date: null,
  });
  const [loading, setLoading] = useState(false);
  const host = import.meta.env.VITE_BACKEND_URL;

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/events/getEvents");
      console.log(response.data);

      setEvents(response.data || []);
    } catch (error) {
      console.error("Error fetching notices:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    console.log(...formData.entries());

    try {
      console.log(isEditing);

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
    }
  };

  const openPopup = (type, event) => {
    setPopup({ visible: true, type, event });
  };

  const closePopup = () => {
    setPopup({ visible: false, type: "", event: null });
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/events/deleteEvent/${id}`);
      fetchEvents();
      toast.success("Notice deleted successfully!");
    } catch (error) {
      console.error("Error deleting notice:", error);
      toast.error("Failed to delete notice.");
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
                <Label htmlFor="title">Event Title</Label>
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
                <Label htmlFor="details">Event Details</Label>
                <Textarea
                  id="details"
                  name="details"
                  placeholder="Enter detailed event text"
                  required
                  value={formValues.details}
                  onChange={(e) =>
                    setFormValues({ ...formValues, details: e.target.value })
                  }
                  className="resize-none"
                />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="file">Upload PDF Notice</Label>
                  <Input
                    id="file"
                    type="file"
                    name="file"
                    accept=".pdf"
                    ref={fileref}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        file: e.target.files?.[0],
                      })
                    }
                    {...(!isEditing && { required: true })}
                  />
                  {formValues.file && (
                    <p className="text-sm text-gray-500">
                      {formValues.file.name
                        ? "Selected file: " +
                          formValues.file.name.slice(0, 20) +
                          "..."
                        : "Uploaded file: " +
                          formValues.file
                            .split("\\")
                            .pop()
                            .split("-")
                            .slice(2)
                            .join("-")
                            .slice(0, 20) +
                          "..."}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="image">Upload Photo</Label>
                  <Input
                    id="image"
                    type="file"
                    name="image"
                    accept="image/*"
                    ref={fileref}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        image: e.target.files?.[0],
                      })
                    }
                    {...(!isEditing && { required: true })}
                  />
                  {formValues.image && (
                    <p className="text-sm text-gray-500">
                      {formValues.file.name
                        ? "Selected file: " +
                          formValues.file.name.slice(0, 20) +
                          "..."
                        : "Uploaded file: " +
                          formValues.file
                            .split("\\")
                            .pop()
                            .split("-")
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
                  <Label htmlFor="date">Event Date</Label>
                  {/* <Input
                    type="date"
                    name="date"
                    required
                    hidden
                    value={formValues.date || ""}
                    onChange={(e) =>
                      setFormValues({ ...formValues, date: e.target.value })
                    }
                  /> */}
                  <DatePicker
                    value={formValues.date}
                    onChange={(e) =>
                      setFormValues({ ...formValues, date: e.target.value })
                    }
                      
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="location">Event Location</Label>
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
                    required
                  />
                </div>
              </div>
              <div className="flex justify-between gap-4">
                <Button type="submit" className="">
                  {isEditing ? "Update Event" : "Creat Event"}
                </Button>

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
                    fileref.current.value = null;
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
                    event.image ? `${host}/${event.image}` : "/placeholder.svg"
                  }
                  alt={event.title}
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1">{event.title}</h3>
                <p className="text-sm text-gray-500 mb-2">{format(new Date(event.date), "dd MMM yyyy")}</p>
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
                  <div>
                    <strong>Details:</strong> {popup.event.details}
                  </div>
                  <div>
                    <strong>Date:</strong> {format(new Date(popup.event.date), "dd MMM yyyy")}
                  </div>
                  <div>
                    <strong>Location:</strong> {popup.event.location}
                  </div>
                  <div>
                    <strong>File:</strong>{" "}
                    {/* <a
                      href={`${host}/${popup.notice.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      View/Download PDF
                    </a> */}
                    <a
                      href={`${host}/${popup.event.file}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Download PDF
                    </a>
                    {/* <iframe
                      src={`${host}/${popup.notice.file}`}
                      width="100%"
                      height="600px"
                      title="PDF Preview"
                    /> */}
                  </div>
                </div>
                <div className="flex justify-between pt-4">
                  <div className="flex gap-2">
                    <DeleteConfirmation
                      onDelete={() => handleDelete(popup.event.id)}
                    />
                    <Button
                      type="button"
                      onClick={() => {
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
