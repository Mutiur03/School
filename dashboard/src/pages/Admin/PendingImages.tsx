import { useState, useEffect } from 'react';
import axios from 'axios';
import { getFileUrl } from '@/lib/backend';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
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
  FiChevronDown,
  FiChevronUp,
} from 'react-icons/fi';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { Separator } from '@/components/ui/separator';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface GalleryImage {
  id: number;
  image_path: string;
  caption?: string;
  student_name?: string;
  student_batch?: string;
  event_id?: number;
  category_id?: number;
}

interface GroupedGalleries {
  events: Record<string, GalleryImage[]>;
  categories: Record<string, GalleryImage[]>;
}

export default function PendingGalleries() {
  const { confirm, dialog } = useConfirmDialog();
  const [groupedGalleries, setGroupedGalleries] = useState<GroupedGalleries>({
    events: {},
    categories: {},
  });
  const [selectedGroup, setSelectedGroup] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [foldedCategories, setFoldedCategories] = useState<Record<string, boolean>>({});

  const modalVariants: Variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 500 : -500,
      opacity: 0,
      position: 'absolute' as const,
    }),
    center: {
      x: 0,
      opacity: 1,
      position: 'relative' as const,
      transition: {
        x: { type: 'spring', stiffness: 400, damping: 30 },
        opacity: { duration: 0.3 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -500 : 500,
      opacity: 0,
      position: 'absolute' as const,
      transition: {
        x: { type: 'spring', stiffness: 400, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' },
    },
  };

  const foldVariants: Variants = {
    open: {
      opacity: 1,
      height: 'auto',
      transition: {
        height: { duration: 0.3, ease: 'easeInOut' },
        opacity: { duration: 0.2, delay: 0.1 },
      },
    },
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        height: { duration: 0.3, ease: 'easeInOut' },
        opacity: { duration: 0.1 },
      },
    },
  };

  const fetchPendingGalleries = async () => {
    try {
      const response = await axios.get('/api/gallery/pending');
      setGroupedGalleries(response.data || { events: {}, categories: {} });
    } catch (error) {
      console.error('Error fetching pending galleries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingGalleries();
  }, []);

  const handleApprove = async (id: number) => {
    try {
      await axios.patch(`/api/gallery/approve/${id}`);
      toast.success('Image approved successfully!');
      handleActionComplete(id);
    } catch (error) {
      console.error('Error approving image:', error);
      toast.error('Failed to approve image');
    }
  };

  const handleReject = async (id: number) => {
    try {
      await axios.patch(`/api/gallery/reject/${id}`);
      toast.success('Image rejected successfully!');
      handleActionComplete(id);
    } catch (error) {
      console.error('Error rejecting image:', error);
      toast.error('Failed to reject image');
    }
  };
  const handleRejectAll = async (images: GalleryImage[]) => {
    const ok = await confirm({
      title: 'Reject all images?',
      msg: `Are you sure you want to reject all ${images.length} images?`,
      confirmLabel: 'Reject All',
    });
    if (!ok) return;

    try {
      const ids = images.map((img) => img.id);
      await axios.post('/api/gallery/rejectMultiple', { ids });

      toast.success(`Rejected ${images.length} images successfully!`);
      fetchPendingGalleries();
    } catch (error) {
      console.error('Error rejecting images:', error);
      toast.error('Failed to reject images');
    }
  };

  const handleActionComplete = (processedId: number) => {
    fetchPendingGalleries().then(() => {
      const currentGroupIndex = selectedGroup.findIndex((img) => img.id === processedId);
      let nextIndex: number | null = null;

      if (currentGroupIndex !== -1) {
        if (currentGroupIndex < selectedGroup.length - 1) {
          nextIndex = currentGroupIndex;
        } else if (currentGroupIndex > 0) {
          nextIndex = currentGroupIndex - 1;
        }
      }

      if (nextIndex !== null) {
        setCurrentIndex(nextIndex);
        setSelectedGroup((prev) => prev.filter((img) => img.id !== processedId));
      } else {
        setSelectedGroup([]);
        setCurrentIndex(null);
      }
    });
  };
  const toggleFoldCategory = (title: string) => {
    setFoldedCategories((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };
  const navigateImage = (dir: number) => {
    setDirection(dir);
    if (dir > 0) {
      setCurrentIndex((prev) => (prev !== null && prev < selectedGroup.length - 1 ? prev + 1 : 0));
    } else {
      setCurrentIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : selectedGroup.length - 1));
    }
  };
  const renderImageGroup = (title: string, images: GalleryImage[] = []) => {
    const isFolded = foldedCategories[title] || false;
    const groupKey = images[0]?.event_id || images[0]?.category_id || title;

    return (
      <div key={groupKey} className="mb-8">
        <motion.div
          className="bg-muted flex cursor-pointer items-center justify-between rounded-lg p-4 dark:bg-gray-800"
          onClick={() => toggleFoldCategory(title)}
        >
          <div className="flex items-center gap-4">
            <motion.div animate={{ rotate: isFolded ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <FiChevronDown className="text-muted-foreground dark:text-gray-300" />
            </motion.div>
            <motion.h2 className="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              <FiClock className="text-yellow-500" />
              {title} <span className="text-muted-foreground text-sm">({images.length})</span>
            </motion.h2>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation();
                handleRejectAll(images);
              }}
            >
              <FiTrash2 className="mr-1" />
              Reject All
            </Button>
            <Badge
              variant="secondary"
              className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
            >
              Pending Review
            </Badge>
          </div>
        </motion.div>

        <motion.div
          initial={false}
          animate={isFolded ? 'closed' : 'open'}
          variants={foldVariants}
          className="overflow-hidden"
        >
          <div className="xs:grid-cols-3 mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 md:gap-6 lg:grid-cols-5">
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
                className="group relative cursor-pointer overflow-hidden rounded-xl shadow-lg transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:shadow-xl"
              >
                <div className="relative aspect-square">
                  <img
                    src={getFileUrl(img.image_path)}
                    alt="Pending gallery image"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/70 via-black/30 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <h3 className="line-clamp-1 text-lg font-semibold text-white">
                      {img.student_name || 'Anonymous'}
                    </h3>
                    {img.student_batch && (
                      <span className="text-sm text-white/90">Batch {img.student_batch}</span>
                    )}
                    <span className="mt-1 self-start rounded-full bg-yellow-500/90 px-2 py-1 text-xs text-white/80">
                      Pending Approval
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
      {dialog}
      <div className="mb-6 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <h1 className="text-center text-3xl font-bold md:text-left md:text-4xl">
          Pending Gallery Approvals
        </h1>
        <div className="flex w-full justify-center gap-3 md:w-auto md:justify-end">
          {hasAnyPending && (
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={() => {
                const totalCategories = [
                  ...Object.keys(groupedGalleries.events),
                  ...Object.keys(groupedGalleries.categories),
                ].length;

                const currentlyFolded = Object.values(foldedCategories).filter(Boolean).length;

                if (currentlyFolded < totalCategories) {
                  const allFolded: Record<string, boolean> = {};
                  [
                    ...Object.keys(groupedGalleries.events),
                    ...Object.keys(groupedGalleries.categories),
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
              <h1 className="mb-8 flex items-center gap-3 text-2xl font-bold text-gray-800 md:text-3xl dark:text-gray-100">
                <FiCalendar className="text-yellow-500" />
                Event Submissions
              </h1>
              {Object.entries(groupedGalleries.events).map(([title, images]) =>
                renderImageGroup(title, images as GalleryImage[]),
              )}
            </motion.div>
            <Separator className="my-8 bg-gray-200 dark:bg-gray-700" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="mb-8 flex items-center gap-3 text-2xl font-bold text-gray-800 md:text-3xl dark:text-gray-100">
                <FiTag className="text-yellow-500" />
                Category Submissions
              </h1>
              {Object.entries(groupedGalleries.categories).map(([title, images]) =>
                renderImageGroup(title, images as GalleryImage[]),
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
              <FiAlertCircle className="h-12 w-12 text-yellow-500" />
            </div>
            <h3 className="mb-2 text-lg font-medium md:text-xl">No pending approvals</h3>
            <p className="text-muted-foreground max-w-md text-sm md:text-base">
              All gallery submissions have been reviewed. Check back later for new submissions.
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
            <DialogContent className="max-w-4xl overflow-hidden rounded-xl border-0 bg-transparent p-0 shadow-none md:max-w-5xl">
              <div className="relative flex h-screen max-h-[90vh] w-full items-center justify-center">
                {selectedGroup.length > 1 && (
                  <>
                    <button
                      className="absolute top-1/2 left-2 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 md:left-4 md:p-3"
                      onClick={() => navigateImage(-1)}
                    >
                      <FiChevronLeft size={20} />
                    </button>
                    <button
                      className="absolute top-1/2 right-2 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 md:right-4 md:p-3"
                      onClick={() => navigateImage(1)}
                    >
                      <FiChevronRight size={20} />
                    </button>
                  </>
                )}
                <button
                  className="absolute top-2 right-2 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 md:top-4 md:right-4"
                  onClick={() => {
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                  }}
                >
                  <FiX size={20} />
                </button>
                <div className="bg-card relative flex h-full w-full items-center justify-center">
                  <AnimatePresence custom={direction}>
                    <motion.div
                      key={selectedGroup[currentIndex].id}
                      custom={direction}
                      variants={modalVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      className="flex h-full w-full flex-col items-center justify-center p-4 md:p-8"
                    >
                      <div className="relative flex h-full w-full max-w-full flex-col md:max-w-4xl">
                        <div className="flex flex-1 items-center justify-center overflow-hidden">
                          <img
                            src={getFileUrl(selectedGroup[currentIndex].image_path)}
                            alt={selectedGroup[currentIndex].caption || 'Pending gallery image'}
                            className="max-h-full max-w-full rounded-lg object-contain"
                          />
                        </div>
                        <div className="bg-card rounded-b-lg p-4">
                          <h3 className="text-lg font-semibold text-gray-800 md:text-xl dark:text-white">
                            {selectedGroup[currentIndex].caption || 'No caption provided'}
                          </h3>
                          <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-4 text-sm dark:text-gray-300">
                            {selectedGroup[currentIndex].student_name && (
                              <div>
                                <span className="font-medium">Submitted by: </span>
                                {selectedGroup[currentIndex].student_name}
                                {selectedGroup[currentIndex].student_batch && (
                                  <span> (Batch {selectedGroup[currentIndex].student_batch})</span>
                                )}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Status: </span>
                              <Badge
                                variant="secondary"
                                className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                              >
                                Pending Approval
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-col justify-end gap-4 md:flex-row">
                            <Button
                              variant="destructive"
                              onClick={() => handleReject(selectedGroup[currentIndex].id)}
                            >
                              <FiX className="mr-2" /> Reject
                            </Button>
                            <Button onClick={() => handleApprove(selectedGroup[currentIndex].id)}>
                              <FiCheck className="mr-2" /> Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {selectedGroup.length > 1 && (
                  <div className="absolute right-0 bottom-2 left-0 z-10 flex justify-center gap-2 md:bottom-4">
                    {selectedGroup.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDirection(idx > currentIndex ? 1 : -1);
                          setCurrentIndex(idx);
                        }}
                        className={`h-2 w-2 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] md:h-3 md:w-3 ${
                          idx === currentIndex
                            ? 'bg-primary w-4 md:w-6'
                            : 'bg-white/50 hover:bg-white/80'
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
