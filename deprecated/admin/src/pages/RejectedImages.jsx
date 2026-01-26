/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiTrash2,
  FiCalendar,
  FiTag,
  FiCheck,
  FiClock,
  FiAlertCircle,
} from "react-icons/fi";
import { Skeleton } from "@/components/ui/skeleton";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { toast } from "react-hot-toast";
import { Separator } from "@/components/ui/separator";

export default function RejectedImages() {
  const [groupedGalleries, setGroupedGalleries] = useState({
    events: {},
    categories: {},
  });
  const [selectedGroup, setSelectedGroup] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
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

  const fetchPendingGalleries = async () => {
    try {
      const response = await axios.get("/api/gallery/rejected");
      setGroupedGalleries(response.data || { events: {}, categories: {} });
    } catch (error) {
      console.error("Error fetching pending galleries:", error);
      toast.error("Failed to load pending galleries");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingGalleries();
  }, []);

  const handleApprove = async (id) => {
    try {
      await axios.patch(`/api/gallery/approve/${id}`);
      toast.success("Image approved successfully!");
      handleActionComplete(id);
    } catch (error) {
      console.error("Error approving image:", error);
      toast.error("Failed to approve image");
    }
  };
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;
    try {
      await axios.delete(`/api/gallery/deleteGallery/${id}`);
      toast.success("Image deleted successfully!");
      handleActionComplete(id);
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Failed to delete image");
    }
  };
  const handleDeleteAll = async (images) => {
    if (
      !window.confirm(
        `Are you sure you want to delete all ${images.length} images?`
      )
    )
      return;
    try {
      const ids = images.map((img) => img.id);
      await axios.post("/api/gallery/deleteMultiple", { ids });

      toast.success(`Deleted ${images.length} images successfully!`);
      fetchPendingGalleries();
    } catch (error) {
      toast.error("Failed to delete images");
    }
  };

  const handleActionComplete = (processedId) => {
    fetchPendingGalleries().then(() => {
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
  const toggleFoldCategory = (title) => {
    setFoldedCategories((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };
  const navigateImage = (direction) => {
    setDirection(direction);
    if (direction > 0) {
      // Next image
      setCurrentIndex((prev) =>
        prev < selectedGroup.length - 1 ? prev + 1 : 0
      );
    } else {
      // Previous image
      setCurrentIndex((prev) =>
        prev > 0 ? prev - 1 : selectedGroup.length - 1
      );
    }
  };

  const renderImageGroup = (title, images = []) => {
    const isFolded = foldedCategories[title] || false;
    const groupKey = images[0]?.event_id || images[0]?.category_id || title;

    return (
      <div key={groupKey} className="mb-8">
        <motion.div
          className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-4 rounded-lg cursor-pointer"
          onClick={() => toggleFoldCategory(title)}
          // whileHover={{ backgroundColor: "rgba(0, 0, 0, 0.05)" }}
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
              <FiClock className="text-red-500" />
              {title}{" "}
              <span className="text-sm text-gray-500">({images.length})</span>
            </motion.h2>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAll(images);
              }}
            >
              <FiTrash2 className="mr-1" />
              Delete All
            </Button>
            <Badge
              variant="secondary"
              className="bg-red-500/20 text-red-400 dark:text-red-200"
            >
              {/* {images.length} Pending */}
              Rejected
            </Badge>
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
                    alt={img.caption || "Pending gallery image"}
                    className="object-cover w-full h-full transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <h3 className="text-white text-lg font-semibold line-clamp-1">
                      {img.student_name || "Anonymous"}
                    </h3>
                    {img.student_batch && (
                      <span className="text-white/90 text-sm">
                        Batch {img.student_batch}
                      </span>
                    )}
                    <span className="mt-1 text-white/80 text-xs bg-red-500/90 px-2 py-1 rounded-full self-start">
                      Rejected
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

  const hasEvents = Object.keys(groupedGalleries.events).length > 0;
  const hasCategories = Object.keys(groupedGalleries.categories).length > 0;
  const hasAnyPending = hasEvents || hasCategories;
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-3xl md:text-4xl font-bold text-center md:text-left">
          Pending Gallery Approvals
        </h1>
        <div className="flex gap-3 justify-center md:justify-end w-full md:w-auto">
          {hasAnyPending && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                // Count total categories
                const totalCategories = [
                  ...Object.keys(groupedGalleries.events),
                  ...Object.keys(groupedGalleries.categories),
                ].length;

                // Count currently folded categories
                const currentlyFolded =
                  Object.values(foldedCategories).filter(Boolean).length;

                // If all or some are unfolded, hide all
                if (currentlyFolded < totalCategories) {
                  const allFolded = {};
                  [
                    ...Object.keys(groupedGalleries.events),
                    ...Object.keys(groupedGalleries.categories),
                  ].forEach((title) => {
                    allFolded[title] = true;
                  });
                  setFoldedCategories(allFolded);
                }
                // If all are folded, unfold all
                else {
                  setFoldedCategories({});
                }
              }}
            >
              {Object.values(foldedCategories).length > 0 &&
              Object.values(foldedCategories).every((v) => v) ? (
                <>
                  <FiChevronDown className="transition-transform" />
                  Show All
                </>
              ) : (
                <>
                  <FiChevronUp className="transition-transform" />
                  Hide All
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-16">
        {isLoading ? (
          renderSkeletonLoader()
        ) : hasAnyPending ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <FiCalendar className="text-red-500" />
                Event Submissions
              </h1>
              {Object.entries(groupedGalleries.events).map(([title, images]) =>
                renderImageGroup(title, images)
              )}
            </motion.div>
            <Separator className="my-8 bg-gray-200 dark:bg-gray-700" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="text-2xl md:text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100 flex items-center gap-3">
                <FiTag className="text-red-500" />
                Category Submissions
              </h1>
              {Object.entries(groupedGalleries.categories).map(
                ([title, images]) => renderImageGroup(title, images)
              )}
            </motion.div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="relative mb-6">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-lg md:text-xl font-medium mb-2">
              No rejected images found
            </h3>
            <p className="text-sm md:text-base text-muted-foreground max-w-md">
              All images have been approved or there are no submissions yet.
            </p>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedGroup.length > 0 && currentIndex !== null && (
          <Dialog
            open={true}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedGroup([]);
                setCurrentIndex(null);
                setDirection(0);
              }
            }}
          >
            <DialogContent className="p-0 md:max-w-5xl max-w-4xl rounded-xl overflow-hidden border-0 bg-transparent shadow-none">
              <div className="relative w-full h-screen max-h-[90vh] flex items-center justify-center">
                {selectedGroup.length > 1 && (
                  <>
                    <button
                      className="absolute top-4 left-4 bg-black/60 text-white p-2 rounded-full z-10 hover:bg-black/80 transition-colors"
                      onClick={() => {
                        handleDelete(selectedGroup[currentIndex].id);
                      }}
                    >
                      <FiTrash2 size={20} md:size={24} />
                    </button>
                    <button
                      className="absolute left-2 md:left-4 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-2 md:p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                      onClick={() => navigateImage(-1)}
                    >
                      <FiChevronLeft size={20} md:size={24} />
                    </button>
                    <button
                      className="absolute right-2 md:right-4 top-1/2 transform -translate-y-1/2 bg-black/60 text-white p-2 md:p-3 rounded-full z-10 hover:bg-black/80 transition-colors"
                      onClick={() => navigateImage(1)}
                    >
                      <FiChevronRight size={20} md:size={24} />
                    </button>
                  </>
                )}
                <button
                  className="absolute top-2 md:top-4 right-2 md:right-4 bg-black/60 text-white p-2 rounded-full z-10 hover:bg-black/80 transition-colors"
                  onClick={() => {
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                  }}
                >
                  <FiX size={20} />
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
                      className="flex flex-col items-center justify-center w-full h-full p-4 md:p-8"
                    >
                      <div className="relative w-full h-full max-w-full md:max-w-4xl flex flex-col">
                        <div className="flex-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${host}/${selectedGroup[currentIndex].image_path}`}
                            alt={
                              selectedGroup[currentIndex].caption ||
                              "Pending gallery image"
                            }
                            className="max-h-full max-w-full object-contain rounded-lg"
                          />
                        </div>
                        <div className="bg-white dark:bg-gray-900 p-4 rounded-b-lg">
                          {/* <h3 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-white">
                            {selectedGroup[currentIndex].caption ||
                              "No caption provided"}
                          </h3> */}
                          <div className="flex flex-wrap justify-between gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                            {selectedGroup[currentIndex].student_name && (
                              <div>
                                <span className="font-medium">
                                  Submitted by:{" "}
                                </span>
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
                              <span className="font-medium">Status: </span>
                              <Badge
                                variant="secondary"
                                className="bg-red-500/20 text-red-600 dark:text-red-400"
                              >
                                Rejected
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row justify-end gap-4 mt-4">
                            <Button
                              onClick={() =>
                                handleApprove(selectedGroup[currentIndex].id)
                              }
                            >
                              <FiCheck className="mr-2" /> Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {selectedGroup.length > 1 && (
                  <div className="absolute bottom-2 md:bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
                    {selectedGroup.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDirection(idx > currentIndex ? 1 : -1);
                          setCurrentIndex(idx);
                        }}
                        className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-all ${
                          idx === currentIndex
                            ? "bg-primary w-4 md:w-6"
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
