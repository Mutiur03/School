import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import toast from 'react-hot-toast';
import DeleteConfirmationIcon from '@/components/DeleteConfimationIcon';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import type { Variants } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Upload,
  Image as ImageIcon,
  Calendar,
  Tag,
  Pencil,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { PageHeader, SectionCard } from '@/components';

interface Event {
  id: number;
  title: string;
}

interface Category {
  id: number;
  category: string;
}

interface GalleryImage {
  id: number;
  image_path: string;
  caption: string;
  category: string;
  category_id?: number;
  event_id?: number;
  student_name?: string;
  student_batch?: string;
}

interface GalleryData {
  events: Record<string, GalleryImage[]>;
  categories: Record<string, GalleryImage[]>;
}

interface FormValues {
  category: string | number;
  eventId: string | number;
  caption: string;
  image: string | null;
}

export default function Gallery() {
  const { confirm, dialog } = useConfirmDialog();
  const [files, setFiles] = useState<File[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GalleryImage[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showForm, setShowForm] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editId, setEditId] = useState<number | null>(null);
  const fileref = useRef<HTMLInputElement>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formValues, setFormValues] = useState<FormValues>({
    category: '',
    eventId: '',
    caption: '',
    image: null,
  });
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
        x: { type: 'spring' as const, stiffness: 400, damping: 30 },
        opacity: { duration: 0.3 },
      },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -500 : 500,
      opacity: 0,
      position: 'absolute' as const,
      transition: {
        x: { type: 'spring' as const, stiffness: 400, damping: 30 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4, ease: 'easeOut' as const },
    },
  };

  const foldVariants: Variants = {
    open: {
      opacity: 1,
      height: 'auto',
      transition: {
        height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
        opacity: { duration: 0.2, delay: 0.1 },
      },
    },
    closed: {
      opacity: 0,
      height: 0,
      transition: {
        height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
        opacity: { duration: 0.1 },
      },
    },
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/events/getEvents');
      setEvents(Array.isArray(response.data.data) ? response.data.data : []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchGallery = async () => {
    try {
      const res = await axios.get<GalleryData>('/api/gallery/getGalleries');
      setGalleryData(res.data);
    } catch (err) {
      console.error('Error fetching gallery:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get<Category[]>('/api/gallery/getCategories');
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
    fetchEvents();
    fetchGallery();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      const validFiles = filesArray.filter((file) => {
        if (!file.type.match('image.*')) {
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
      category: '',
      eventId: '',
      caption: '',
      image: null,
    });
    setFiles([]);
    if (fileref.current) {
      fileref.current.value = '';
    }
    setIsEditing(false);
    setEditId(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isEditing) {
      await handleUpdate();
    } else {
      await handleUpload();
    }
  };

  const handleUpload = async () => {
    if (!files.length && !isEditing) {
      toast.error('Please select at least one image');
      return;
    }
    if (!formValues.category && !formValues.eventId) {
      toast.error('Please select either a category or an event');
      return;
    }
    if (Number(formValues.category) === 1 && !formValues.eventId) {
      toast.error('Please select an event for event category');
      return;
    }

    try {
      setUploadProgress(1);
      const keys: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const key = await uploadToR2('/api/gallery/presigned-url', files[i], (pct) => {
          const overall = Math.round(((i + pct / 100) / files.length) * 100);
          setUploadProgress(overall);
        });
        keys.push(key);
      }

      await axios.post('/api/gallery/upload', {
        keys,
        caption: formValues.caption,
        eventId: formValues.eventId || '',
        category: formValues.eventId ? '1' : formValues.category,
        status: 'approved',
      });
      setUploadProgress(100);
      resetForm();
      toast.success('Images uploaded successfully!');
      fetchGallery();
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload images');
    }
  };

  const handleUpdate = async () => {
    if (!formValues.category && !formValues.eventId) {
      toast.error('Please select either a category or an event');
      return;
    }
    if (Number(formValues.category) === 1 && !formValues.eventId) {
      toast.error('Please select an event for event category');
      return;
    }

    try {
      setUploadProgress(1);
      let imageKey: string | undefined;
      if (files.length > 0) {
        imageKey = await uploadToR2('/api/gallery/presigned-url', files[0], (pct) =>
          setUploadProgress(pct),
        );
      }

      await axios.put(`/api/gallery/updateGallery/${editId}`, {
        imageKey,
        caption: formValues.caption,
        eventId: formValues.eventId || '',
        category: formValues.eventId ? '1' : formValues.category,
      });
      setUploadProgress(100);
      toast.success('Image updated successfully!');
      resetForm();
      fetchGallery();
    } catch (error) {
      console.error('Error updating image:', error);
      toast.error('Failed to update image');
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

  const handleActionComplete = (processedId: number) => {
    fetchGallery().then(() => {
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

  const handleRejectAll = async (images: GalleryImage[]) => {
    const ok = await confirm({
      title: 'Delete all images?',
      msg: `Are you sure you want to delete all ${images.length} images?`,
      confirmLabel: 'Delete All',
    });
    if (!ok) return;

    try {
      const ids = images.map((img) => img.id);
      await axios.post('/api/gallery/rejectMultiple', { ids });
      toast.success(`Deleted ${images.length} images successfully!`);
      fetchGallery();
    } catch (error) {
      console.error('Error deleting images:', error);
      toast.error('Failed to delete images');
    }
  };

  const handleCategoryDelete = async (category_id: number) => {
    const ok = await confirm({
      title: 'Delete category?',
      msg: 'Are you sure you want to delete this category?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    try {
      await axios.delete(`/api/gallery/deleteCategoryGallery/${category_id}`);
      toast.success('Images deleted successfully!');
      resetForm();
      fetchGallery();
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete images');
    }
  };

  const handleThumbnailChange = async (id: number) => {
    if (selectedGroup[0].event_id) {
      try {
        await axios.put(`/api/gallery/setEventThumbnail/${selectedGroup[0].event_id}/${id}`);
        toast.success('Thumbnail changed successfully!');
      } catch (error) {
        console.error('Error changing thumbnail:', error);
        toast.error('Failed to change thumbnail');
      }
    } else {
      try {
        await axios.put(`/api/gallery/setCategoryThumbnail/${selectedGroup[0].category_id}/${id}`);
        toast.success('Thumbnail changed successfully!');
      } catch (error) {
        console.error('Error changing thumbnail:', error);
        toast.error('Failed to change thumbnail');
      }
    }
  };

  const renderImageGroup = (title: string, images: GalleryImage[] = []) => {
    const isFolded = foldedCategories[title] || false;
    const groupKey = images[0]?.event_id || images[0]?.category_id || title;

    return (
      <div key={groupKey} className="mb-8">
        <motion.div
          className="bg-muted flex cursor-pointer items-center justify-between rounded-lg p-4 dark:bg-gray-800"
          onClick={() =>
            setFoldedCategories((prev) => ({
              ...prev,
              [title]: !prev[title],
            }))
          }
        >
          <div className="flex items-center gap-4">
            <motion.div animate={{ rotate: isFolded ? 0 : 180 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="text-muted-foreground dark:text-gray-300" />
            </motion.div>
            <motion.h2 className="flex items-center gap-2 text-xl font-semibold text-gray-800 dark:text-gray-100">
              <ImageIcon className="text-primary" />
              {title} <span className="text-muted-foreground text-sm">({images.length})</span>
            </motion.h2>
          </div>
          <div className="flex items-center gap-4">
            <Trash2
              onClick={(e) => {
                e.stopPropagation();
                if (images[0].event_id) {
                  handleRejectAll(images);
                } else {
                  handleCategoryDelete(images[0].category_id!);
                }
              }}
              className="cursor-pointer text-red-500 transition-colors hover:text-red-700"
            />
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
                    alt={img.caption || 'Gallery image'}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex flex-col justify-end bg-linear-to-t from-black/70 via-black/30 to-transparent p-4 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <h3 className="line-clamp-1 text-lg font-semibold text-white">
                      {img.student_name}
                    </h3>
                    {img.student_batch && (
                      <span className="text-sm text-white/90">Batch {img.student_batch}</span>
                    )}
                    <span className="bg-primary/90 mt-1 self-start rounded-full px-2 py-1 text-xs text-white/80">
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[...Array(4)].map((_, j) => (
              <Skeleton key={j} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      {dialog}
      <PageHeader title="Gallery" description="Upload and organize school gallery images.">
        <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
          {galleryData && (
            <Button
              variant="outline"
              className="flex flex-1 items-center gap-2 sm:flex-none"
              onClick={() => {
                const totalCategories = [
                  ...Object.keys(galleryData.events),
                  ...Object.keys(galleryData.categories),
                ].length;
                const currentlyFolded = Object.values(foldedCategories).filter(Boolean).length;
                if (currentlyFolded < totalCategories) {
                  const allFolded: Record<string, boolean> = {};
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
                  <ChevronDown className="transition-transform" />
                  <span className="hidden sm:inline">Show All</span>
                </>
              ) : (
                <>
                  <ChevronUp className="transition-transform" />
                  <span className="hidden sm:inline">Hide All</span>
                </>
              )}
            </Button>
          )}
          {!showForm && (
            <Button onClick={() => setShowForm(true)} className="flex-1 sm:flex-none">
              <Upload className="mr-0 sm:mr-2" />
              <span className="hidden sm:inline">Upload Image</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          )}
        </div>
      </PageHeader>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10 sm:mb-16"
        >
          <SectionCard
            title={isEditing ? 'Edit Image' : 'Upload Images'}
            icon={<Upload size={20} />}
          >
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div className="space-y-2">
                <Label htmlFor="images" className="flex items-center gap-2">
                  <ImageIcon size={16} /> Select Images
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
                    className="border-border hover:border-primary cursor-pointer rounded-lg border-2 border-dashed transition-colors"
                  />
                </div>
                {files.length > 0 && (
                  <p className="text-muted-foreground text-xs sm:text-sm">
                    {files.length} file{files.length !== 1 ? 's' : ''} selected
                  </p>
                )}
                {isEditing && formValues.image && (
                  <div className="mt-2">
                    <p className="text-muted-foreground text-xs sm:text-sm">Current image:</p>
                    <img
                      src={getFileUrl(formValues.image)}
                      alt="Current"
                      className="mt-1 h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20"
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="caption" className="flex items-center gap-2">
                  <ImageIcon /> Caption (optional)
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
                  className="dark:bg-accent border-border focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 sm:text-base dark:border-gray-700"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventId" className="flex items-center gap-2">
                    <Calendar /> Event (optional)
                  </Label>
                  <select
                    id="eventId"
                    name="eventId"
                    value={formValues.eventId}
                    onChange={(e) => {
                      setFormValues({
                        ...formValues,
                        eventId: e.target.value,
                        category: e.target.value ? '1' : '',
                      });
                    }}
                    className="dark:bg-accent focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 sm:text-base"
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
                  <Label htmlFor="category" className="flex items-center gap-2">
                    <Tag /> Category
                  </Label>
                  <select
                    id="category"
                    name="category"
                    value={formValues.category}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        category: e.target.value,
                        eventId: e.target.value === '1' ? formValues.eventId : '',
                      })
                    }
                    className="dark:bg-accent focus:ring-primary w-full rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 sm:text-base"
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
                  <div className="h-2.5 w-full rounded-full bg-gray-200">
                    <div
                      className="bg-primary h-2.5 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-muted-foreground text-right text-xs sm:text-sm">
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
                    ? 'Update Image'
                    : uploadProgress > 0 && uploadProgress < 100
                      ? 'Uploading...'
                      : 'Upload Images'}
                </Button>
              </div>
            </form>
          </SectionCard>
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
              <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-800 sm:gap-3 sm:text-2xl md:text-3xl dark:text-gray-100">
                <Calendar className="text-primary" />
                Event Galleries
              </h1>
              {galleryData.events && Object.keys(galleryData.events).length > 0 ? (
                Object.entries(galleryData.events).map(([title, images]) =>
                  renderImageGroup(title, images),
                )
              ) : (
                <div className="py-8 text-center sm:py-12">
                  <p className="text-muted-foreground">No gallery data available</p>
                </div>
              )}
            </motion.div>
            <Separator className="my-6 bg-gray-200 sm:my-8 dark:bg-gray-700" />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="mb-6 flex items-center gap-2 text-xl font-bold text-gray-800 sm:gap-3 sm:text-2xl md:text-3xl dark:text-gray-100">
                <Tag className="text-primary" />
                Category Galleries
              </h1>
              {galleryData.categories && Object.keys(galleryData.categories).length > 0 ? (
                Object.entries(galleryData.categories).map(([title, images]) =>
                  renderImageGroup(title, images),
                )
              ) : (
                <div className="py-8 text-center sm:py-12">
                  <p className="text-muted-foreground">No gallery data available</p>
                </div>
              )}
            </motion.div>
          </>
        ) : (
          <div className="py-8 text-center sm:py-12">
            <p className="text-muted-foreground">No gallery data available</p>
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
            <DialogContent className="max-w-4xl overflow-hidden rounded-xl border-0 bg-transparent p-0 shadow-none">
              <div className="relative flex h-screen max-h-[90vh] w-full items-center justify-center">
                {selectedGroup.length > 1 && (
                  <>
                    <button
                      className="absolute top-1/2 left-4 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-3 text-white transition-colors hover:bg-black/80"
                      onClick={() => {
                        setDirection(-1);
                        setCurrentIndex((prev) =>
                          prev === 0 ? selectedGroup.length - 1 : prev! - 1,
                        );
                      }}
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <button
                      className="absolute top-1/2 right-4 z-10 -translate-y-1/2 transform rounded-full bg-black/60 p-3 text-white transition-colors hover:bg-black/80"
                      onClick={() => {
                        setDirection(1);
                        setCurrentIndex((prev) =>
                          prev === selectedGroup.length - 1 ? 0 : prev! + 1,
                        );
                      }}
                    >
                      <ChevronRight size={24} />
                    </button>
                  </>
                )}
                <button
                  className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  onClick={() => {
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                  }}
                >
                  <X size={20} />
                </button>
                <button
                  className="absolute top-4 left-4 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80"
                  onClick={() => {
                    const currentImage = selectedGroup[currentIndex];
                    setIsEditing(true);
                    setEditId(currentImage.id);
                    setFormValues({
                      category: currentImage.category_id || '',
                      eventId: currentImage.event_id || '',
                      caption: currentImage.caption,
                      image: currentImage.image_path,
                    });
                    setSelectedGroup([]);
                    setCurrentIndex(null);
                    setDirection(0);
                    setShowForm(true);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <Pencil size={20} />
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
                      className="flex h-full w-full flex-col items-center justify-center p-8"
                    >
                      <div className="relative flex h-full w-full max-w-3xl flex-col">
                        <div className="flex flex-1 items-center justify-center overflow-hidden">
                          <img
                            src={getFileUrl(selectedGroup[currentIndex].image_path)}
                            alt={selectedGroup[currentIndex].caption || 'Gallery image'}
                            className="max-h-full max-w-full rounded-lg object-contain"
                          />
                        </div>
                        <div className="bg-card rounded-b-lg p-4">
                          <div className="text-muted-foreground mt-2 flex flex-wrap justify-between gap-4 text-sm dark:text-gray-300">
                            {selectedGroup[currentIndex].student_name && (
                              <div>
                                <span className="font-medium">Student: </span>
                                {selectedGroup[currentIndex].student_name}
                                {selectedGroup[currentIndex].student_batch && (
                                  <span> (Batch {selectedGroup[currentIndex].student_batch})</span>
                                )}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Category: </span>
                              {selectedGroup[currentIndex].category || 'N/A'}
                            </div>
                            <div>
                              <button
                                className="text-primary hover:underline"
                                onClick={() => {
                                  handleThumbnailChange(selectedGroup[currentIndex].id);
                                }}
                              >
                                Set as Thumbnail
                              </button>
                            </div>
                            <DeleteConfirmationIcon
                              onDelete={() => handleReject(selectedGroup[currentIndex].id)}
                              msg="Are you sure you want to reject this image?"
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                {selectedGroup.length > 1 && (
                  <div className="absolute right-0 bottom-4 left-0 z-10 flex justify-center gap-2">
                    {selectedGroup.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setDirection(idx > currentIndex! ? 1 : -1);
                          setCurrentIndex(idx);
                        }}
                        className={`h-3 w-3 rounded-full transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                          idx === currentIndex ? 'bg-primary w-6' : 'bg-white/50 hover:bg-white/80'
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
