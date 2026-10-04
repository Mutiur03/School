import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
import { uploadToR2 } from '@/lib/uploadToR2';
import {
  TILE_BUTTON,
  TILE_CHECK,
  TILE_CHECK_BOX,
  TILE_GRID,
  TILE_IMG,
  TILE_IMG_SELECTED,
  TILE_MENU,
  TILE_OVERLAY,
} from '@/lib/galleryTile';
import { cn, formatDateWithTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ActionButton, ConfirmationPopup, Popup, SectionCard } from '@/components';
import { filterSelectClassName } from '@/components/FilterSelection';
import { useEvents } from '@/queries/events.queries';

interface Category {
  id: number;
  category: string;
}

interface GalleryImage {
  id: number;
  image_path: string;
  caption: string | null;
  category: string | null;
  category_id: number | null;
  event_id: number | null;
  created_at: string;
  student_name: string | null;
  student_batch: string | null;
}

interface GalleryData {
  events: Record<string, GalleryImage[]>;
  categories: Record<string, GalleryImage[]>;
}

interface Group {
  key: string;
  title: string;
  kind: 'Event' | 'Category';
  images: GalleryImage[];
}

interface FormValues {
  category: string;
  eventId: string;
  caption: string;
  image: string | null;
}

type Confirm = { msg: string; label: string; onConfirm: () => void };

const EMPTY_FORM: FormValues = { category: '', eventId: '', caption: '', image: null };
const MAX_SIZE = 5 * 1024 * 1024;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="block text-sm font-medium">{label}</span>
    {children}
  </label>
);

const FormSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-4">
    <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
      {title}
    </h3>
    {children}
  </section>
);

const CloseButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label="Close"
    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring pointer-coarse:p-2.5 rounded-md p-1 transition-colors focus-visible:outline-none focus-visible:ring-2"
  >
    <X className="h-4 w-4" />
  </button>
);

const navButton =
  'bg-card/90 hover:bg-card focus-visible:ring-ring pointer-coarse:h-11 pointer-coarse:w-11 absolute top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-colors focus-visible:outline-none focus-visible:ring-2';

export default function Gallery() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM);
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ key: string; index: number } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const isEditing = editId !== null;
  const uploading = uploadProgress > 0 && uploadProgress < 100;

  const galleryQuery = useQuery<GalleryData>({
    queryKey: ['gallery', 'approved'],
    queryFn: async () => (await axios.get('/api/gallery/getGalleries')).data,
  });
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['galleryCategories'],
    queryFn: async () => (await axios.get('/api/gallery/getCategories')).data || [],
  });
  const { data: events = [] } = useEvents();

  const groups = useMemo<Group[]>(() => {
    const data = galleryQuery.data;
    if (!data) return [];
    return [
      ...Object.entries(data.events || {}).map(([title, images]) => ({
        key: `event:${title}`,
        title,
        kind: 'Event' as const,
        images,
      })),
      ...Object.entries(data.categories || {}).map(([title, images]) => ({
        key: `category:${title}`,
        title,
        kind: 'Category' as const,
        images,
      })),
    ];
  }, [galleryQuery.data]);

  const totalImages = groups.reduce((n, g) => n + g.images.length, 0);
  const eventCount = groups.filter((g) => g.kind === 'Event').length;
  const categoryCount = groups.length - eventCount;
  const allFolded = groups.length > 0 && groups.every((g) => folded[g.key]);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  const viewerGroup = viewer ? groups.find((g) => g.key === viewer.key) : undefined;
  const viewerIndex =
    viewer && viewerGroup ? Math.min(viewer.index, viewerGroup.images.length - 1) : -1;
  const current = viewerGroup && viewerIndex >= 0 ? viewerGroup.images[viewerIndex] : null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gallery'] });

  const rejectMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 1) await axios.patch(`/api/gallery/reject/${ids[0]}`);
      else await axios.post('/api/gallery/rejectMultiple', { ids });
      return ids.length;
    },
    onSuccess: (n, ids) => {
      toast.success(`Rejected ${plural(n, 'photo')}`);
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
      refresh();
    },
    onError: () => toast.error('Failed to reject photos'),
  });

  const thumbnailMutation = useMutation({
    mutationFn: (img: GalleryImage) =>
      img.event_id
        ? axios.put(`/api/gallery/setEventThumbnail/${img.event_id}/${img.id}`)
        : axios.put(`/api/gallery/setCategoryThumbnail/${img.category_id}/${img.id}`),
    onSuccess: () => toast.success('Thumbnail changed'),
    onError: () => toast.error('Failed to change thumbnail'),
  });

  const askReject = (ids: number[]) =>
    setConfirm({
      msg: `Reject ${plural(ids.length, 'photo')}? ${ids.length === 1 ? 'It moves' : 'They move'} to Rejected, where you can approve or delete ${ids.length === 1 ? 'it' : 'them'}.`,
      label: 'Reject',
      onConfirm: () => rejectMutation.mutate(ids),
    });

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const valid = Array.from(list).filter((file) => {
      if (!file.type.match('image.*')) {
        toast.error(`File ${file.name} is not an image`);
        return false;
      }
      if (file.size > MAX_SIZE) {
        toast.error(`File ${file.name} is too large (max 5MB)`);
        return false;
      }
      return true;
    });
    setFiles((prev) => (isEditing ? valid.slice(0, 1) : [...prev, ...valid]));
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetForm = () => {
    setFormValues(EMPTY_FORM);
    setFiles([]);
    setEditId(null);
    setShowForm(false);
    setUploadProgress(0);
  };

  const startEdit = (img: GalleryImage) => {
    setViewer(null);
    setEditId(img.id);
    setFiles([]);
    setFormValues({
      category: img.category_id ? String(img.category_id) : '',
      eventId: img.event_id ? String(img.event_id) : '',
      caption: img.caption || '',
      image: img.image_path,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isEditing && !files.length) {
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

    const meta = {
      caption: formValues.caption,
      eventId: formValues.eventId || '',
      category: formValues.eventId ? '1' : formValues.category,
    };

    try {
      setUploadProgress(1);
      if (isEditing) {
        const imageKey = files.length
          ? await uploadToR2('/api/gallery/presigned-url', files[0], (pct) =>
              setUploadProgress(Math.max(1, pct)),
            )
          : undefined;
        await axios.put(`/api/gallery/updateGallery/${editId}`, {
          ...(imageKey ? { imageKey } : {}),
          ...meta,
        });
        toast.success('Photo updated');
      } else {
        const keys: string[] = [];
        for (let i = 0; i < files.length; i++) {
          keys.push(
            await uploadToR2('/api/gallery/presigned-url', files[i], (pct) =>
              setUploadProgress(Math.max(1, Math.round(((i + pct / 100) / files.length) * 100))),
            ),
          );
        }
        await axios.post('/api/gallery/upload', { keys, ...meta, status: 'approved' });
        toast.success(`Uploaded ${plural(keys.length, 'photo')}`);
      }
      resetForm();
      refresh();
    } catch (err) {
      console.error(err);
      setUploadProgress(0);
      toast.error(isEditing ? 'Failed to update photo' : 'Failed to upload photos');
    }
  };

  const toggle = (ids: number[], on: boolean) =>
    setSelected((prev) =>
      on ? [...new Set([...prev, ...ids])] : prev.filter((id) => !ids.includes(id)),
    );

  const step = (dir: number) => {
    if (!viewer || !viewerGroup) return;
    const n = viewerGroup.images.length;
    setViewer({ key: viewer.key, index: (viewerIndex + dir + n) % n });
  };

  const tileMenu = (img: GalleryImage, group: Group, index: number) => (
    // modal={false}: items open dialogs; a modal menu would leave pointer-events locked
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <ActionButton
          iconOnly
          label="More actions"
          icon={<MoreHorizontal size={16} />}
          className="bg-card/90 hover:bg-card pointer-coarse:h-10 pointer-coarse:w-10 shadow-sm"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="truncate normal-case tracking-normal">
          {img.caption || group.title}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setViewer({ key: group.key, index })}>
          <Eye /> View
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => startEdit(img)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => thumbnailMutation.mutate(img)}>
          <Star /> Set as {group.kind.toLowerCase()} thumbnail
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => askReject([img.id])}>
          <Ban /> Reject
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gallery</h1>
          <div className="text-muted-foreground mt-1 text-sm tabular-nums">
            {galleryQuery.isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              `${plural(totalImages, 'photo')} · ${plural(eventCount, 'event')} · ${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {groups.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setFolded(
                  allFolded ? {} : Object.fromEntries(groups.map((g) => [g.key, true] as const)),
                )
              }
            >
              <ChevronDown className={cn('transition-transform', !allFolded && 'rotate-180')} />
              {allFolded ? 'Expand all' : 'Collapse all'}
            </Button>
          )}
          <Button type="button" onClick={() => setShowForm(true)}>
            <Upload /> Upload photos
          </Button>
        </div>
      </header>

      <Popup
        open={showForm}
        onOpenChange={(o) => !o && !uploading && resetForm()}
        size="lg"
        aria-labelledby="gallery-form-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <h2 id="gallery-form-title" className="text-base font-semibold">
              {isEditing ? 'Edit photo' : 'Upload photos'}
            </h2>
            <CloseButton onClick={resetForm} />
          </div>

          <div className="max-h-[65vh] space-y-6 overflow-y-auto px-5 py-4">
            <FormSection title={isEditing ? 'Photo' : 'Photos'}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple={!isEditing}
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => addFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  addFiles(e.dataTransfer.files);
                }}
                className="border-border hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col items-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2"
              >
                <Upload size={20} className="text-muted-foreground" />
                <span className="text-sm font-medium">
                  {isEditing ? 'Replace photo' : 'Add photos'}
                </span>
                <span className="text-muted-foreground text-xs">
                  Click or drop {isEditing ? 'an image' : 'images'} here · max 5 MB each
                </span>
              </button>

              {(files.length > 0 || (isEditing && formValues.image)) && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {isEditing && formValues.image && !files.length && (
                    <li className="border-border flex items-center gap-3 rounded-lg border p-2">
                      <img
                        src={getFileUrl(formValues.image)}
                        alt="Current photo"
                        width={48}
                        height={48}
                        className="bg-muted h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">Current photo</p>
                        <p className="text-muted-foreground text-xs">Kept unless you replace it</p>
                      </div>
                    </li>
                  )}
                  {files.map((file, i) => (
                    <li
                      key={`${file.name}-${file.lastModified}-${i}`}
                      className="border-border flex items-center gap-3 rounded-lg border p-2"
                    >
                      <img
                        src={previews[i]}
                        alt={file.name}
                        width={48}
                        height={48}
                        className="bg-muted h-12 w-12 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-muted-foreground text-xs tabular-nums">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploading}
                        onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      >
                        <X /> Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </FormSection>

            <FormSection title="Details">
              <Field label="Caption (optional)">
                <Input
                  value={formValues.caption}
                  onChange={(e) => setFormValues({ ...formValues, caption: e.target.value })}
                  placeholder="Enter caption"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event (optional)">
                  <select
                    value={formValues.eventId}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        eventId: e.target.value,
                        category: e.target.value ? '1' : '',
                      })
                    }
                    className={filterSelectClassName}
                  >
                    <option value="">Select an event</option>
                    {events.map((event) => (
                      <option key={event.id} value={String(event.id)}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Category">
                  <select
                    value={formValues.category}
                    onChange={(e) =>
                      setFormValues({
                        ...formValues,
                        category: e.target.value,
                        eventId: e.target.value === '1' ? formValues.eventId : '',
                      })
                    }
                    className={filterSelectClassName}
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={String(cat.id)}>
                        {cat.category}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </FormSection>
          </div>

          <div className="border-border flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
            {uploading && (
              <div className="mr-auto flex min-w-48 flex-1 items-center gap-3">
                <div
                  role="progressbar"
                  aria-label="Upload progress"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full"
                >
                  <div
                    className="bg-primary h-full rounded-full transition-[width]"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {uploadProgress}%
                </span>
              </div>
            )}
            <Button type="button" variant="ghost" onClick={resetForm} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
              {isEditing
                ? 'Save photo'
                : files.length
                  ? `Upload ${plural(files.length, 'photo')}`
                  : 'Upload photos'}
            </Button>
          </div>
        </form>
      </Popup>

      {galleryQuery.isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <SectionCard>
          <div className="text-muted-foreground flex flex-col items-center gap-3 py-8 text-center text-sm">
            <p>
              {galleryQuery.isError
                ? "Couldn't load the gallery. Try again in a moment."
                : 'No approved photos yet.'}
            </p>
            {!galleryQuery.isError && (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(true)}>
                <Upload /> Upload photos
              </Button>
            )}
          </div>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => {
            const ids = group.images.map((img) => img.id);
            const allSelected = ids.every((id) => selected.includes(id));
            const isFolded = folded[group.key];
            return (
              <SectionCard key={group.key} noPadding>
                <div
                  className={cn(
                    'flex items-center gap-3 px-4 py-3',
                    !isFolded && 'border-border border-b',
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={`Select all photos in ${group.title}`}
                    checked={allSelected}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    className="pointer-coarse:h-5 pointer-coarse:w-5 h-4 w-4"
                  />
                  <button
                    type="button"
                    aria-expanded={!isFolded}
                    onClick={() =>
                      setFolded((prev) => ({ ...prev, [group.key]: !prev[group.key] }))
                    }
                    className="focus-visible:ring-ring pointer-coarse:py-2 flex min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2"
                  >
                    <ChevronDown
                      className={cn(
                        'text-muted-foreground h-4 w-4 shrink-0 transition-transform',
                        isFolded && '-rotate-90',
                      )}
                    />
                    <span className="truncate text-sm font-semibold">{group.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                      {group.kind} · {plural(group.images.length, 'photo')}
                    </span>
                  </button>
                </div>
                {!isFolded && (
                  <ul className={TILE_GRID}>
                    {group.images.map((img, index) => {
                      const isSelected = selected.includes(img.id);
                      const label = img.caption || img.student_name;
                      return (
                        <li key={img.id} className="group/tile relative">
                          <button
                            type="button"
                            onClick={() => setViewer({ key: group.key, index })}
                            className={cn(TILE_BUTTON, isSelected && 'bg-primary/15')}
                          >
                            <img
                              src={getFileUrl(img.image_path)}
                              alt={label || `${group.title} photo`}
                              loading="lazy"
                              width={240}
                              height={240}
                              className={cn(TILE_IMG, isSelected && TILE_IMG_SELECTED)}
                            />
                            <span className={cn(TILE_OVERLAY, label && 'opacity-100')}>
                              {label && (
                                <span className="block truncate text-sm font-medium">{label}</span>
                              )}
                              <span className="block truncate text-xs tabular-nums text-white/80">
                                {formatDateWithTime(img.created_at)}
                              </span>
                            </span>
                          </button>
                          <label
                            className={cn(
                              TILE_CHECK,
                              (isSelected || selected.length > 0) && 'opacity-100',
                            )}
                          >
                            <input
                              type="checkbox"
                              aria-label={`Select ${label || `photo ${index + 1}`}`}
                              checked={isSelected}
                              onChange={(e) => toggle([img.id], e.target.checked)}
                              className="peer sr-only"
                            />
                            <span aria-hidden className={TILE_CHECK_BOX}>
                              <Check strokeWidth={3} />
                            </span>
                          </label>
                          <div className={TILE_MENU}>{tileMenu(img, group, index)}</div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </SectionCard>
            );
          })}
        </div>
      )}

      {/* Spacer pushes the bar to the screen bottom when the page is short */}
      {selected.length > 0 && <div aria-hidden className="min-h-6 flex-1" />}
      {selected.length > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-3 py-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelected([])}
              aria-label="Clear selection"
              className="text-muted-foreground hover:text-foreground hover:bg-muted pointer-coarse:p-2.5 rounded-md p-1"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-sm font-medium tabular-nums">
              {plural(selected.length, 'photo')} selected
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => askReject(selected)}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending ? <Loader2 className="animate-spin" /> : <Ban />} Reject
          </Button>
        </div>
      )}

      {current && viewerGroup && (
        <Popup
          open
          onOpenChange={(o) => !o && setViewer(null)}
          size="full"
          aria-labelledby="gallery-viewer-title"
        >
          <div
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') step(-1);
              if (e.key === 'ArrowRight') step(1);
            }}
          >
            <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
              <h2 id="gallery-viewer-title" className="truncate text-base font-semibold">
                {viewerGroup.title}
                <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
                  {viewerIndex + 1} of {viewerGroup.images.length}
                </span>
              </h2>
              <CloseButton onClick={() => setViewer(null)} />
            </div>
            <div className="bg-muted relative flex h-[60vh] items-center justify-center">
              <img
                src={getFileUrl(current.image_path)}
                alt={current.caption || `${viewerGroup.title} photo`}
                className="max-h-full max-w-full object-contain"
              />
              {viewerGroup.images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() => step(-1)}
                    className={cn(navButton, 'left-3')}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => step(1)}
                    className={cn(navButton, 'right-3')}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            <div className="border-border flex flex-wrap items-center gap-x-4 gap-y-3 border-t px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm', !current.caption && 'text-muted-foreground')}>
                  {current.caption || 'No caption'}
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {[
                    current.category,
                    current.student_name &&
                      `${current.student_name}${current.student_batch ? ` (Batch ${current.student_batch})` : ''}`,
                    formatDateWithTime(current.created_at),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={thumbnailMutation.isPending}
                  onClick={() => thumbnailMutation.mutate(current)}
                >
                  <Star /> Set as thumbnail
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => startEdit(current)}
                >
                  <Pencil /> Edit
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => askReject([current.id])}
                >
                  <Ban /> Reject
                </Button>
              </div>
            </div>
          </div>
        </Popup>
      )}

      <ConfirmationPopup
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
        confirmLabel={confirm?.label}
        msg={confirm?.msg}
      />
    </div>
  );
}
