import { useState, useEffect } from 'react';
import axios from 'axios';
import { getFileUrl } from '@/lib/backend';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Calendar,
  Tag,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader } from '@/components';
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

type Mode = 'pending' | 'rejected';

const MODE = {
  pending: {
    list: '/api/gallery/pending',
    title: 'Pending Gallery Approvals',
    description: 'Review and approve or reject student gallery submissions.',
    accent: 'text-yellow-500',
    badgeClass: 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    groupBadge: 'Pending Review',
    statusLabel: 'Pending Approval',
    chipClass: 'bg-yellow-500/90',
    emptyTitle: 'No pending approvals',
    emptyDesc: 'All gallery submissions have been reviewed. Check back later for new submissions.',
    bulkLabel: 'Reject All',
    bulkConfirmTitle: 'Reject all images?',
    bulkConfirmLabel: 'Reject All',
    bulkEndpoint: '/api/gallery/rejectMultiple',
    bulkSuccess: (n: number) => `Rejected ${n} images successfully!`,
    bulkError: 'Failed to reject images',
    toastOnFetchError: false as boolean,
  },
  rejected: {
    list: '/api/gallery/rejected',
    title: 'Rejected Gallery Images',
    description: 'Review rejected submissions, approve, or delete permanently.',
    accent: 'text-red-500',
    badgeClass: 'bg-red-500/20 text-red-400 dark:text-red-200',
    groupBadge: 'Rejected',
    statusLabel: 'Rejected',
    chipClass: 'bg-red-500/90',
    emptyTitle: 'No rejected images found',
    emptyDesc: 'All images have been approved or there are no submissions yet.',
    bulkLabel: 'Delete All',
    bulkConfirmTitle: 'Delete all images?',
    bulkConfirmLabel: 'Delete All',
    bulkEndpoint: '/api/gallery/deleteMultiple',
    bulkSuccess: (n: number) => `Deleted ${n} images successfully!`,
    bulkError: 'Failed to delete images',
    toastOnFetchError: true as boolean,
  },
} as const;

export default function GalleryModeration({ mode }: { mode: Mode }) {
  const cfg = MODE[mode];
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

  const fetchGalleries = async () => {
    try {
      const response = await axios.get(cfg.list);
      setGroupedGalleries(response.data || { events: {}, categories: {} });
    } catch (error) {
      console.error('Error fetching galleries:', error);
      if (cfg.toastOnFetchError) toast.error('Failed to load pending galleries');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    fetchGalleries();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when mode changes
  }, [mode]);

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

  const handleDelete = async (id: number) => {
    const ok = await confirm({
      title: 'Delete image?',
      msg: 'Are you sure you want to delete this image?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await axios.delete(`/api/gallery/deleteGallery/${id}`);
      toast.success('Image deleted successfully!');
      handleActionComplete(id);
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleBulk = async (images: GalleryImage[]) => {
    const ok = await confirm({
      title: cfg.bulkConfirmTitle,
      msg: `Are you sure you want to ${mode === 'pending' ? 'reject' : 'delete'} all ${images.length} images?`,
      confirmLabel: cfg.bulkConfirmLabel,
    });
    if (!ok) return;

    try {
      const ids = images.map((img) => img.id);
      await axios.post(cfg.bulkEndpoint, { ids });
      toast.success(cfg.bulkSuccess(images.length));
      fetchGalleries();
    } catch (error) {
      console.error('Error bulk-processing images:', error);
      toast.error(cfg.bulkError);
    }
  };

  const handleActionComplete = (processedId: number) => {
    fetchGalleries().then(() => {
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
          className="bg-muted/40 flex cursor-pointer items-center justify-between rounded-lg p-4 dark:bg-gray-800"
          onClick={() => toggleFoldCategory(title)}
        >
          <div className="flex items-center gap-4">
            <motion.div animate={{ rotate: isFolded ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="text-muted-foreground dark:text-gray-300" />
            </motion.div>
            <motion.h2 className="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              <Clock className={cfg.accent} />
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
                handleBulk(images);
              }}
            >
              <Trash2 className="mr-1" />
              {cfg.bulkLabel}
            </Button>
            <Badge variant="secondary" className={cfg.badgeClass}>
              {cfg.groupBadge}
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
                    alt={img.caption || 'Pending gallery image'}
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
                    <span
                      className={`mt-1 self-start rounded-full ${cfg.chipClass} px-2 py-1 text-xs text-white/80`}
                    >
                      {cfg.statusLabel}
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
  const hasAny = hasEvents || hasCategories;

  const modalStatusBadgeClass =
    mode === 'pending'
      ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400'
      : 'bg-red-500/20 text-red-600 dark:text-red-400';

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader title={cfg.title} description={cfg.description}>
        {hasAny && (
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
                <ChevronDown className="transition-transform" />
                Show All
              </>
            ) : (
              <>
                <ChevronUp className="transition-transform" />
                Hide All
              </>
            )}
          </Button>
        )}
      </PageHeader>

      <div className="space-y-16">
        {isLoading ? (
          renderSkeletonLoader()
        ) : hasAny ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="mb-8 flex items-center gap-3 text-2xl font-bold text-gray-800 md:text-3xl dark:text-gray-100">
                <Calendar className={cfg.accent} />
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
                <Tag className={cfg.accent} />
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
              <AlertCircle className={`h-12 w-12 ${cfg.accent}`} />
            </div>
            <h3 className="mb-2 text-lg font-medium md:text-xl">{cfg.emptyTitle}</h3>
            <p className="text-muted-foreground max-w-md text-sm md:text-base">{cfg.emptyDesc}</p>
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
                    {mode === 'rejected' && (
                      <button
                        className="absolute top-4 left-4 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                        onClick={() => {
                          handleDelete(selectedGroup[currentIndex].id);
                        }}
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                    <button
                      className="absolute top-1/2 left-2 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 md:left-4 md:p-3"
                      onClick={() => navigateImage(-1)}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      className="absolute top-1/2 right-2 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 md:right-4 md:p-3"
                      onClick={() => navigateImage(1)}
                    >
                      <ChevronRight size={20} />
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
                  <X size={20} />
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
                          {mode === 'pending' && (
                            <h3 className="text-lg font-semibold text-gray-800 md:text-xl dark:text-white">
                              {selectedGroup[currentIndex].caption || 'No caption provided'}
                            </h3>
                          )}
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
                              <Badge variant="secondary" className={modalStatusBadgeClass}>
                                {cfg.statusLabel}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-col justify-end gap-4 md:flex-row">
                            {mode === 'pending' && (
                              <Button
                                variant="destructive"
                                onClick={() => handleReject(selectedGroup[currentIndex].id)}
                              >
                                <X className="mr-2" /> Reject
                              </Button>
                            )}
                            <Button onClick={() => handleApprove(selectedGroup[currentIndex].id)}>
                              <Check className="mr-2" /> Approve
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
