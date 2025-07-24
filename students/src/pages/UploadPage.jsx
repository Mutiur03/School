/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import toast from "react-hot-toast";
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
} from "react-icons/fi";
import { Skeleton } from "@/components/ui/skeleton";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
export default function UploadPage() {
  const [files, setFiles] = useState([]);
  const [events, setEvents] = useState([]);
  const [galleryData, setGalleryData] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const fileref = useRef(null);
  const [categories, setCategories] = useState([]);
  const [formValues, setFormValues] = useState({
    category: "",
    eventId: "",
    caption: "",
    image: null,
  });
  const [foldedCategories, setFoldedCategories] = useState({});
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
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
      toast.error("Failed to load events");
    }
  };
  const fetchGallery = async () => {
    try {
      const res = await axios.get("/api/gallery/approvedStudents");
      console.log(res.data);
      setGalleryData(res.data);
    } catch (err) {
      console.error("Error fetching gallery:", err);
      toast.error("Failed to load gallery");
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
      toast.error("Failed to load categories");
    }
  };
  useEffect(() => {
    fetchEvents();
    fetchGallery();
    fetchCategories();
  }, []);
  const handleFileChange = (e) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      if (filesArray.length > 10) {
        toast.error("You can only upload a maximum of 10 images at a time");
        setFiles([]);
        e.target.value = null;
        return;
      }
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
    setShowForm(false);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length) {
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
    formData.append("status", "pending");
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
      fetchGallery();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload images");
    }
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
  const renderImageGroup = (title, images = []) => {
    const isFolded = foldedCategories[title] || false;
    const groupKey = images[0]?.event_id || images[0]?.category_id || title;

    return (
      <div key={groupKey} className="mb-8">
        <motion.div
          className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 sm:p-4 rounded-lg cursor-pointer"
          onClick={() =>
            setFoldedCategories((prev) => ({
              ...prev,
              [title]: !prev[title],
            }))
          }
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              animate={{ rotate: isFolded ? 0 : 180 }}
              transition={{ duration: 0.2 }}
            >
              <FiChevronDown className="text-gray-600 dark:text-gray-300 text-lg" />
            </motion.div>
            <motion.h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <FiImage className="text-primary" />
              {title}{" "}
              <span className="text-xs sm:text-sm text-gray-500">
                ({images.length})
              </span>
            </motion.h2>
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
                className="group relative overflow-hidden md:rounded-lg rounded-sm sm:rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
              >
                <div className="relative aspect-square">
                  <img
                    src={`${host}/${img.image_path}${isMobile ? "?w=300" : ""}`} // Optional: Add mobile-optimized image
                    alt={img.caption || "Gallery image"}
                    className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  };

  const renderModal = () => (
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
                className={`absolute ${
                  isMobile ? "left-2" : "left-4"
                } top-1/2 transform -translate-y-1/2 bg-black/60 text-white ${
                  isMobile ? "p-2" : "p-3"
                } rounded-full z-10 hover:bg-black/80 transition-colors`}
                onClick={() => {
                  setDirection(-1);
                  setCurrentIndex((prev) =>
                    prev === 0 ? selectedGroup.length - 1 : prev - 1
                  );
                }}
              >
                <FiChevronLeft size={isMobile ? 20 : 24} />
              </button>
              <button
                className={`absolute ${
                  isMobile ? "right-2" : "right-4"
                } top-1/2 transform -translate-y-1/2 bg-black/60 text-white ${
                  isMobile ? "p-2" : "p-3"
                } rounded-full z-10 hover:bg-black/80 transition-colors`}
                onClick={() => {
                  setDirection(1);
                  setCurrentIndex((prev) =>
                    prev === selectedGroup.length - 1 ? 0 : prev + 1
                  );
                }}
              >
                <FiChevronRight size={isMobile ? 20 : 24} />
              </button>
            </>
          )}
          <button
            className={`absolute ${
              isMobile ? "top-3 right-3" : "top-4 right-4"
            } bg-black/60 text-white ${
              isMobile ? "p-1.5" : "p-2"
            } rounded-full z-10 hover:bg-black/80 transition-colors`}
            onClick={() => {
              setSelectedGroup([]);
              setCurrentIndex(null);
              setDirection(0);
            }}
          >
            <FiX size={isMobile ? 16 : 20} />
          </button>
          <div
            className={`relative w-full h-full flex items-center justify-center bg-card ${
              isMobile ? "p-2" : ""
            }`}
          >
            <AnimatePresence custom={direction}>
              <motion.div
                key={selectedGroup[currentIndex].id}
                custom={direction}
                variants={modalVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={`flex flex-col items-center justify-center w-full h-full ${
                  isMobile ? "p-2" : "p-8"
                }`}
              >
                <div
                  className={`relative w-full h-full ${
                    isMobile ? "" : "max-w-4xl"
                  } flex flex-col`}
                >
                  <div className="flex-1 flex items-center justify-center overflow-hidden">
                    <img
                      src={`${host}/${selectedGroup[currentIndex].image_path}`}
                      alt={
                        selectedGroup[currentIndex].caption || "Gallery image"
                      }
                      className={`${
                        isMobile ? "max-h-[70vh]" : "max-h-full"
                      } max-w-full object-contain rounded-lg`}
                    />
                  </div>
                  <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-b-lg">
                    <h3
                      className={`${
                        isMobile ? "text-lg" : "text-xl"
                      } font-semibold text-gray-800 dark:text-white`}
                    >
                      {selectedGroup[currentIndex].caption &&
                        selectedGroup[currentIndex].caption}
                    </h3>
                    <div
                      className={`flex ${
                        isMobile ? "flex-col" : "flex-wrap justify-between"
                      } gap-2 sm:gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300`}
                    >
                      {selectedGroup[currentIndex].student_name && (
                        <div>
                          <span className="font-medium">Submitted by: </span>
                          {selectedGroup[currentIndex].student_name}
                          {selectedGroup[currentIndex].student_batch && (
                            <span>
                              {" "}
                              (Batch {selectedGroup[currentIndex].student_batch}
                              )
                            </span>
                          )}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Category: </span>
                        {selectedGroup[currentIndex].category || "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          {selectedGroup.length > 1 && (
            <div
              className={`absolute ${
                isMobile ? "bottom-3" : "bottom-4"
              } left-0 right-0 flex justify-center gap-2 z-10`}
            >
              {selectedGroup.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDirection(idx > currentIndex ? 1 : -1);
                    setCurrentIndex(idx);
                  }}
                  className={`${
                    isMobile ? "w-2 h-2" : "w-3 h-3"
                  } rounded-full transition-all ${
                    idx === currentIndex
                      ? "bg-primary w-4 sm:w-6"
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
  );

  // Update the main return with responsive classes
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
                    Upload Images
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
                      multiple
                      required
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
                    {uploadProgress > 0 && uploadProgress < 100
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
                  <p className="text-gray-500">
                    No gallery data of campus available
                  </p>
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
                  <p className="text-gray-500">
                    No gallery data of campus available
                  </p>
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
        {selectedGroup.length > 0 && currentIndex !== null && renderModal()}
      </AnimatePresence>
    </div>
  );
}
