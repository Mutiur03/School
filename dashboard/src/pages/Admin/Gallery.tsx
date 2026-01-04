/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import toast from "react-hot-toast";
import DeleteConfirmationIcon from "@/components/DeleteConfimationIcon";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiUpload,
  FiImage,
  FiCalendar,
  FiTag,
  FiEdit3,
  FiTrash2,
} from "react-icons/fi";
import { Skeleton } from "@/components/ui/skeleton";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";

export default function Gallery() {
  const [files, setFiles] = useState([]);
  const [events, setEvents] = useState([]);
  const [galleryData, setGalleryData] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const fileref = useRef(null);
  const [categories, setCategories] = useState([]);
  const [formValues, setFormValues] = useState({
    category: "",
    eventId: "",
    caption: "",
    image: null,
  });
  const [foldedCategories, setFoldedCategories] = useState({});
  const host = import.meta.env.VITE_BACKEND_URL;
  const modalVariants = {
    enter: (dir) => ({
      x: dir > 0 ? 500 : -500,
      opacity: 0,
      position: "absolute",
    }),
    center: {
      x: 0,
      opacity: 1,
      position: "relative",
      transition: {
        x: { type: "spring", stiffness: 400, damping: 30 },
        opacity: { duration: 0.3 },
      },
    },
    exit: (dir) => ({
      x: dir > 0 ? -500 : 500,
      opacity: 0,
      position: "absolute",
      transition: {
        x: { type: "spring", stiffness: 400, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };
  const foldVariants = {
    open: {
      opacity: 1,
      height: "auto",
      transition: {
        height: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.2, delay: 0.1 },
      },
    },
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        height: { duration: 0.3, ease: "easeInOut" },
        opacity: { duration: 0.1 },
      },
    },
  };
  const fetchEvents = async () => {
    try {
      const response = await axios.get("/api/events/getEvents");
      setEvents(response.data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      // toast.error("Failed to load events");
    }
  };
  const fetchGallery = async () => {
    try {
      const res = await axios.get("/api/gallery/getGalleries");
      console.log(res.data);
      setGalleryData(res.data);
    } catch (err) {
      console.error("Error fetching gallery:", err);
      // toast.error("Failed to load gallery");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get("/api/gallery/getCategories");
      setCategories(response.data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      // toast.error("Failed to load categories");
    }
  };
  useEffect(() => {
    fetchCategories();
    fetchEvents();
    fetchGallery();
  }, []);
  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const validFiles = filesArray.filter((file) => {
        if (!file.type.match("image.*")) {
          toast.error(`File ${file.name} is not an image`);
          return false;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`File ${file.name} is too large (max 5MB)`);
          return false;
        }
        return true;
      });
      setFiles(validFiles);
    }
  };
  const resetForm = () => {
    setFormValues({
      category: "",
      eventId: "",
      caption: "",
      image: null,
    });
    setFiles([]);
    if (fileref.current) {
      fileref.current.value = null;
    }
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isEditing) {
      await handleUpdate();
    } else {
      await handleUpload(e);
    }
  };
  const handleUpload = async (e) => {
    if (!files.length && !isEditing) {
      toast.error("Please select at least one image");
      return;
    }
    if (!formValues.category && !formValues.eventId) {
      toast.error("Please select either a category or an event");
      return;
    }
    if (Number(formValues.category) === 1 && !formValues.eventId) {
      toast.error("Please select an event for event category");
      return;
    }
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.append("status", "approved");
    console.log(...formData.entries());

    try {
      setUploadProgress(0);
      await axios.post("/api/gallery/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      resetForm();
      toast.success("Images uploaded successfully!");
      toast(
        "Note: Images may take a few moments to appear while it finishes processing.",
        { icon: "⏳" }
      );
      fetchGallery();
      setTimeout(fetchGallery, 3000);
      setTimeout(fetchGallery, 8000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload images");
    }
  };
  const handleUpdate = async () => {
    if (!formValues.category && !formValues.eventId) {
      toast.error("Please select either a category or an event");
      return;
    }
    if (Number(formValues.category) === 1 && !formValues.eventId) {
      toast.error("Please select an event for event category");
      return;
    }
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    formData.append("caption", formValues.caption);
    formData.append("status", "approved");
    if (formValues.eventId) {
      formData.append("eventId", formValues.eventId);
      formData.append("category", 1);
    } else {
      formData.append("category", formValues.category);
    }
    console.log(...formData.entries());
    try {
      setUploadProgress(0);
      await axios.put(`/api/gallery/updateGallery/${editId}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
        },
      });
      toast.success("Image updated successfully!");
      // Inform user that backend processing may take some time
      toast(
        "Note: Changes may take a few moments to appear while the backend finishes processing.",
        { icon: "⏳" }
      );
      resetForm();
      fetchGallery();
      setTimeout(fetchGallery, 3000);
      setTimeout(fetchGallery, 8000);
    } catch (error) {
      console.error("Error updating image:", error);
      toast.error("Failed to update image");
    }
  };
  const handleReject = async (id) => {
    try {
      await axios.patch(`/api/gallery/reject/${id}`);
      toast.success("Image rejected successfully!");
      handleActionComplete(id);
    } catch (error) {
      console.error("Error rejecting image:", error);
      toast.error("Failed to reject image");
    }
  };
  const handleActionComplete = (processedId) => {
    // Refetch the latest pending images
    fetchGallery().then(() => {
      // Find the next image to show
      const currentGroupIndex = selectedGroup.findIndex(
        (img) => img.id === processedId
      );
      let nextIndex = null;

      // Try to find next image in current group
      if (currentGroupIndex !== -1) {
        if (currentGroupIndex < selectedGroup.length - 1) {
          nextIndex = currentGroupIndex;
        } else if (currentGroupIndex > 0) {
          nextIndex = currentGroupIndex - 1;
        }
      }

      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
        setSelectedGroup((prev) =>
          prev.filter((img) => img.id !== processedId)
        );
      } else {
        // No more images in this group, close the dialog
        setSelectedGroup([]);
        setCurrentIndex(null);
      }
    });
  };
  const handleRejectAll = async (images) => {
    if (
      !window.confirm(
        `Are you sure you want to delete all ${images.length} images?`
      )
    )
      return;

    try {
      const ids = images.map((img) => img.id);
      await axios.post("/api/gallery/rejectMultiple", { ids });

      toast.success(`Deleted ${images.length} images successfully!`);
      fetchGallery(); // Refresh the list
    } catch (error) {
      console.error("Error deleting images:", error);
      toast.error("Failed to delete images");
    }
  };
  const handleCategoryDelete = async (category_id) => {
    console.log(category_id);
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;
    try {
      await axios.delete(`/api/gallery/deleteCategoryGallery/${category_id}`);
      toast.success("Images deleted successfully!");
      //It will just update status to rejected
      resetForm();
      fetchGallery();
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete images");
    }
  };

  const handleThumbnailChange = async (id) => {
    console.log(id, selectedGroup);
    if (selectedGroup[0].event_id) {
      try {
        await axios.put(
          `/api/gallery/setEventThumbnail/${selectedGroup[0].event_id}/${id}`
        );
        toast.success("Thumbnail changed successfully!");
      } catch (error) {
        console.error("Error changing thumbnail:", error);
        toast.error("Failed to change thumbnail");
      }
    } else {
      try {
        await axios.put(
          `/api/gallery/setCategoryThumbnail/${selectedGroup[0].category_id}/${id}`
        );
        toast.success("Thumbnail changed successfully!");
      } catch (error) {
        console.error("Error changing thumbnail:", error);
        toast.error("Failed to change thumbnail");
      }
    }
    // try {
    //   await axios.patch(`/api/gallery/setThumbnail/${id}`);
    //   toast.success("Thumbnail changed successfully!");
    //   fetchGallery();
    // } catch (error) {
    //   console.error("Error changing thumbnail:", error);
    //   toast.error("Failed to change thumbnail");
    // }
  };

  const renderImageGroup = (title, images = []) => {
    const isFolded = foldedCategories[title] || false;
    const groupKey = images[0]?.event_id || images[0]?.category_id || title;

    return (
      <div key={groupKey} className="mb-8">
        <motion.div
          className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-4 rounded-lg cursor-pointer"
          onClick={() =>
            setFoldedCategories((prev) => ({
              ...prev,
              [title]: !prev[title],
            }))
          }
          // whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: isFolded ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              <FiChevronDown className="text-gray-600 dark:text-gray-300" />
            </motion.div>
            <motion.h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FiImage className="text-primary" />
              {title}{" "}
              <span className="text-sm text-gray-500">({images.length})</span>
            </motion.h2>
          </div>
          <div className="flex items-center gap-4">
            <FiTrash2
              onClick={(e) => {
                e.stopPropagation();
                images[0].event_id
                  ? handleRejectAll(images)
                  : handleCategoryDelete(images[0].category_id);
              }}
              className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            />
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={isFolded ? "closed" : "open"}
          variants={foldVariants}
          className="overflow-hidden"
        >
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mt-4 sm:mt-6">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.03 }}
                onClick={() => {
                  setSelectedGroup(images);
                  setCurrentIndex(index);
                }}
                className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-square">
                  <img
                    src={`${host}/${img.image_path}`}
                    alt={img.caption || "Gallery image"}
                    className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="text-white text-lg font-semibold line-clamp-1">
                      {img.student_name}
                    </h3>
                    {img.student_batch && (
                      <span className="text-white/90 text-sm">
                        Batch {img.student_batch}
                      </span>
                    )}
                    <span className="mt-1 text-white/80 text-xs bg-primary/90 px-2 py-1 rounded-full self-start">
                      {img.category}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  };
  const renderSkeletonLoader = () => (
    <div className="space-y-12">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="space-y-6">
          <Skeleton className="h-8 w-48 rounded-full" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">Gallery</h1>
        <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
          {galleryData && (
            <Button
              variant="outline"
              className="flex items-center gap-2 flex-1 sm:flex-none"
              onClick={() => {
                const totalCategories = [
                  ...Object.keys(galleryData.events),
                  ...Object.keys(galleryData.categories),
                ].length;
                const currentlyFolded =
                  Object.values(foldedCategories).filter(Boolean).length;
                if (currentlyFolded < totalCategories) {
                  const allFolded = {};
                  [
                    ...Object.keys(galleryData.events),
                    ...Object.keys(galleryData.categories),
                  ].forEach((title) => {
                    allFolded[title] = true;
                  });
                  setFoldedCategories(allFolded);
                } else {
                  setFoldedCategories({});
                }
              }}
            >
              {Object.values(foldedCategories).length > 0 &&
              Object.values(foldedCategories).every((v) => v) ? (
                <>
                  <FiChevronDown className="transition-transform" />
                  <span className="hidden sm:inline">Show All</span>
                </>
              ) : (
                <>
                  <FiChevronUp className="transition-transform" />
                  <span className="hidden sm:inline">Hide All</span>
                </>
              )}
            </Button>
          )}
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="flex-1 sm:flex-none"
            >
              <FiUpload className="mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Upload Image</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          )}
        </div>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 sm:mb-16"
        >
          <Card className="w-full mx-auto border-0 shadow-lg rounded-xl sm:rounded-2xl overflow-hidden">
            <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <FiUpload className="text-lg sm:text-xl" />
                  <h2 className="text-lg sm:text-xl font-bold">
                    {isEditing ? "Edit Image" : "Upload Images"}
                  </h2>
                </div>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="images" className="flex items-center gap-2">
                    <FiImage /> Select Images
                  </Label>
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Input
                      id="images"
                      name="images"
                      type="file"
                      accept="image/*"
                      multiple={!isEditing}
                      ref={fileref}
                      onChange={handleFileChange}
                      className="cursor-pointer border-2 border-dashed border-gray-300 hover:border-primary transition-colors rounded-lg"
                    />
                  </div>
                  {files.length > 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      {files.length} file{files.length !== 1 ? "s" : ""}{" "}
                      selected
                    </p>
                  )}
                  {isEditing && formValues.image && (
                    <div className="mt-2">
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Current image:
                      </p>
                      <img
                        src={`${host}/${formValues.image}`}
                        alt="Current"
                        className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-md mt-1"
                      />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="caption" className="flex items-center gap-2">
                    <FiImage /> Caption (optional)
                  </Label>
                  <Input
                    id="caption"
                    name="caption"
                    type="text"
                    value={formValues.caption}
                    onChange={(e) => {
                      setFormValues({
                        ...formValues,
                        caption: e.target.value,
                      });
                    }}
                    placeholder="Enter caption"
                    className="w-full dark:bg-accent border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="eventId"
                      className="flex items-center gap-2"
                    >
                      <FiCalendar /> Event (optional)
                    </Label>
                    <select
                      id="eventId"
                      name="eventId"
                      value={formValues.eventId}
                      onChange={(e) => {
                        setFormValues({
                          ...formValues,
                          eventId: e.target.value,
                          category: e.target.value ? 1 : "",
                        });
                      }}
                      className="w-full dark:bg-accent border rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base"
                    >
                      <option value="">Select an event</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="category"
                      className="flex items-center gap-2"
                    >
                      <FiTag /> Category
                    </Label>
                    <select
                      id="category"
                      name="category"
                      value={formValues.category}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          category: e.target.value,
                          eventId:
                            e.target.value === 1 ? formValues.eventId : "",
                        })
                      }
                      className="w-full border dark:bg-accent rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base"
                    >
                      <option value="">Select a category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <Label>Upload Progress</Label>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground text-right">
                      {uploadProgress}% complete
                    </p>
                  </div>
                )}
                <div className="flex justify-between gap-3">
                  <Button
                    variant="outline"
                    type="button"
                    onClick={resetForm}
                    className="flex-1 sm:flex-none"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={uploadProgress > 0 && uploadProgress < 100}
                    className="flex-1 sm:flex-none"
                  >
                    {isEditing
                      ? "Update Image"
                      : uploadProgress > 0 && uploadProgress < 100
                      ? "Uploading..."
                      : "Upload Images"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="space-y-1">
        {isLoading ? (
          renderSkeletonLoader()
        ) : galleryData ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2 sm:gap-3">
                <FiCalendar className="text-primary" />
                Event Galleries
              </h1>
              {galleryData.events &&
              Object.keys(galleryData.events).length > 0 ? (
                Object.entries(galleryData.events).map(([title, images]) =>
                  renderImageGroup(title, images)
                )
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-gray-500">No gallery data available</p>
                </div>
              )}
            </motion.div>
            <Separator className="my-6 sm:my-8 bg-gray-200 dark:bg-gray-700" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100 flex items-center gap-2 sm:gap-3">
                <FiTag className="text-primary" />
                Category Galleries
              </h1>
              {galleryData.categories &&
              Object.keys(galleryData.categories).length > 0 ? (
                Object.entries(galleryData.categories).map(([title, images]) =>
                  renderImageGroup(title, images)
                )
              ) : (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-gray-500">No gallery data available</p>
                </div>
              )}
            </motion.div>
          </>
        ) : (
          <div className="text-center py-8 sm:py-12">
            <p className="text-gray-500">No gallery data available</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedGroup.length > 0 && currentIndex !== null && (
          <Dialog
            open={true}
            onOpenChange={() => {
              setSelectedGroup([]);
              setCurrentIndex(null);
              setDirection(0);
            }}
          >
            <DialogContent className="p-0 max-w-4xl rounded-xl overflow-hidden border-0 bg-transparent shadow-none">
              <div className="relative w-full h-screen max-h-[90vh] flex items-center justify-center">
                {selectedGroup.length > 1 && (
                  <>
                    <button
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                      onClick={() => {
                        setDirection(-1);
                        setCurrentIndex((prev) =>
                          prev === 0 ? selectedGroup.length - 1 : prev - 1
                        );
                      }}
                    >
                      <FiChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                      onClick={() => {
                        setDirection(1);
                        setCurrentIndex((prev) =>
                          prev === selectedGroup.length - 1 ? 0 : prev + 1
                        );
                      }}
                    >
                      <FiChevronRight size={24} />
                    </button>
                  </>
                )}
                <button
                  className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full z-10 hover:bg-black/80 transition-colors"
                  onClick={() => {
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                  }}
                >
                  <FiX size={20} />
                </button>
                <button
                  className="absolute top-4 left-4 bg-black/60 text-white p-2 rounded-full z-10 hover:bg-black/80 transition-colors"
                  onClick={() => {
                    const currentImage = selectedGroup[currentIndex];
                    setIsEditing(true);
                    setEditId(currentImage.id);
                    setFormValues({
                      category: currentImage.category_id || "",
                      eventId: currentImage.event_id || "",
                      caption: currentImage.caption,
                      image: currentImage.image_path,
                    });
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                    setShowForm(true);
                    window.scrollTo(0, 0, { behavior: "smooth" });
                  }}
                >
                  <FiEdit3 size={20} />
                </button>
                <div className="relative w-full h-full flex items-center justify-center bg-card">
                  <AnimatePresence custom={direction}>
                    <motion.div
                      key={selectedGroup[currentIndex].id}
                      custom={direction}
                      variants={modalVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="flex flex-col items-center justify-center w-full h-full p-8"
                    >
                      <div className="relative w-full h-full max-w-3xl flex flex-col">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${host}/${selectedGroup[currentIndex].image_path}`}
                            alt={
                              selectedGroup[currentIndex].caption ||
                              "Gallery image"
                            }
                            className="max-h-full max-w-full object-contain rounded-lg"
                          />
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-b-lg">
                          {/* <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                            {selectedGroup[currentIndex].caption &&
                              selectedGroup[currentIndex].caption}
                          </h3> */}
                          <div className="flex flex-wrap justify-between gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {selectedGroup[currentIndex].student_name && (
                              <div>
                                <span className="font-medium">Student: </span>
                                {selectedGroup[currentIndex].student_name}
                                {selectedGroup[currentIndex].student_batch && (
                                  <span>
                                    {" "}
                                    (Batch{" "}
                                    {selectedGroup[currentIndex].student_batch})
                                  </span>
                                )}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Category: </span>
                              {selectedGroup[currentIndex].category || "N/A"}
                            </div>
                            <div>
                              <button
                                className="text-primary hover:underline"
                                onClick={() => {
                                  handleThumbnailChange(
                                    selectedGroup[currentIndex].id
                                  );
                                }}
                              >
                                Set as Thumbnail
                              </button>
                            </div>
                            {/* <div>
                              <FiTrash2
                                size={20}
                                onClick={() =>
                                  handleReject(selectedGroup[currentIndex].id)
                                }
                              />
                            </div> */}
                            <DeleteConfirmationIcon
                              onDelete={() =>
                                handleReject(selectedGroup[currentIndex].id)
                              }
                              msg={
                                "Are you sure you want to reject this image?"
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {selectedGroup.length > 1 && (
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                    {selectedGroup.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDirection(idx > currentIndex ? 1 : -1);
                          setCurrentIndex(idx);
                        }}
                        className={`w-3 h-3 rounded-full transition-all ${
                          idx === currentIndex
                            ? "bg-primary w-6"
                            : "bg-white/50 hover:bg-white/80"
                        }`}
                        aria-label={`Go to image ${idx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
