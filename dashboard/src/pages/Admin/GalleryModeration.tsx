import { useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
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

interface GalleryImage {
  id: number;
  image_path: string;
  caption: string | null;
  category: string | null;
  event_id: number | null;
  category_id: number | null;
  created_at: string;
  student_name: string | null;
  student_batch: string | null;
}

interface GroupedGalleries {
  events: Record<string, GalleryImage[]>;
  categories: Record<string, GalleryImage[]>;
}

interface Group {
  key: string;
  title: string;
  kind: 'Event' | 'Category';
  images: GalleryImage[];
}

type Mode = 'pending' | 'rejected';
type Confirm = { msg: string; label: string; onConfirm: () => void };

const MODE = {
  pending: {
    list: '/api/gallery/pending',
    title: 'Pending photos',
    summary: 'waiting for review',
    empty: 'No photos waiting for review.',
  },
  rejected: {
    list: '/api/gallery/rejected',
    title: 'Rejected photos',
    summary: 'rejected',
    empty: 'No rejected photos.',
  },
} as const;

const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;

const uploader = (img: GalleryImage) =>
  img.student_name
    ? `${img.student_name}${img.student_batch ? ` (Batch ${img.student_batch})` : ''}`
    : 'Admin';

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

export default function GalleryModeration({ mode }: { mode: Mode }) {
  const cfg = MODE[mode];
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<number[]>([]);
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ key: string; index: number } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const galleryQuery = useQuery<GroupedGalleries>({
    queryKey: ['gallery', mode],
    queryFn: async () => (await axios.get(cfg.list)).data,
  });

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
  const allFolded = groups.length > 0 && groups.every((g) => folded[g.key]);

  const viewerGroup = viewer ? groups.find((g) => g.key === viewer.key) : undefined;
  const viewerIndex =
    viewer && viewerGroup ? Math.min(viewer.index, viewerGroup.images.length - 1) : -1;
  const current = viewerGroup && viewerIndex >= 0 ? viewerGroup.images[viewerIndex] : null;

  const onDone = (msg: string, ids: number[]) => {
    toast.success(msg);
    setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    queryClient.invalidateQueries({ queryKey: ['gallery'] });
  };

  // No bulk approve endpoint: one request per photo.
  const approveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => axios.patch(`/api/gallery/approve/${id}`)));
      return ids.length;
    },
    onSuccess: (n, ids) => onDone(`Approved ${plural(n, 'photo')}`, ids),
    onError: () => {
      toast.error('Failed to approve photos');
      queryClient.invalidateQueries({ queryKey: ['gallery'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 1) await axios.patch(`/api/gallery/reject/${ids[0]}`);
      else await axios.post('/api/gallery/rejectMultiple', { ids });
      return ids.length;
    },
    onSuccess: (n, ids) => onDone(`Rejected ${plural(n, 'photo')}`, ids),
    onError: () => toast.error('Failed to reject photos'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      if (ids.length === 1) await axios.delete(`/api/gallery/deleteGallery/${ids[0]}`);
      else await axios.post('/api/gallery/deleteMultiple', { ids });
      return ids.length;
    },
    onSuccess: (n, ids) => onDone(`Deleted ${plural(n, 'photo')}`, ids),
    onError: () => toast.error('Failed to delete photos'),
  });

  const busy = approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

  const approve = (ids: number[]) => approveMutation.mutate(ids);
  // Rejecting one photo is reversible and quick; bulk reject and every delete ask first.
  const reject = (ids: number[]) =>
    ids.length === 1
      ? rejectMutation.mutate(ids)
      : setConfirm({
          msg: `Reject ${plural(ids.length, 'photo')}? They move to Rejected.`,
          label: 'Reject',
          onConfirm: () => rejectMutation.mutate(ids),
        });
  const remove = (ids: number[]) =>
    setConfirm({
      msg: `Permanently delete ${plural(ids.length, 'photo')}? This can't be undone.`,
      label: 'Delete',
      onConfirm: () => deleteMutation.mutate(ids),
    });

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
          {uploader(img)}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setViewer({ key: group.key, index })}>
          <Eye /> View
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => approve([img.id])}>
          <CheckCircle2 /> Approve
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {mode === 'pending' ? (
          <DropdownMenuItem variant="destructive" onSelect={() => reject([img.id])}>
            <Ban /> Reject
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem variant="destructive" onSelect={() => remove([img.id])}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const actionButtons = (ids: number[]) => (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => approve(ids)}
      >
        {approveMutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
        Approve
      </Button>
      {mode === 'pending' ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => reject(ids)}
        >
          {rejectMutation.isPending ? <Loader2 className="animate-spin" /> : <Ban />}
          Reject
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => remove(ids)}
        >
          {deleteMutation.isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
          Delete
        </Button>
      )}
    </>
  );

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col p-4 sm:p-6 lg:p-8">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{cfg.title}</h1>
          <div className="text-muted-foreground mt-1 text-sm tabular-nums">
            {galleryQuery.isLoading ? (
              <Skeleton className="h-4 w-48" />
            ) : (
              `${plural(totalImages, 'photo')} ${cfg.summary} · ${plural(groups.length, 'album')}`
            )}
          </div>
        </div>
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
      </header>

      {galleryQuery.isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <SectionCard>
          <p className="text-muted-foreground py-8 text-center text-sm">
            {galleryQuery.isError ? "Couldn't load photos. Try again in a moment." : cfg.empty}
          </p>
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
                      return (
                        <li key={img.id} className="group/tile relative">
                          <button
                            type="button"
                            onClick={() => setViewer({ key: group.key, index })}
                            className={cn(TILE_BUTTON, isSelected && 'bg-primary/15')}
                          >
                            <img
                              src={getFileUrl(img.image_path)}
                              alt={img.caption || `Photo by ${uploader(img)}`}
                              loading="lazy"
                              width={240}
                              height={240}
                              className={cn(TILE_IMG, isSelected && TILE_IMG_SELECTED)}
                            />
                            {/* Uploader always shown: reviewers need it */}
                            <span className={cn(TILE_OVERLAY, 'opacity-100')}>
                              <span className="block truncate text-sm font-medium">
                                {uploader(img)}
                              </span>
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
                              aria-label={`Select photo by ${uploader(img)}`}
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
          <div className="flex gap-2">{actionButtons(selected)}</div>
        </div>
      )}

      {current && viewerGroup && (
        <Popup
          open
          onOpenChange={(o) => !o && setViewer(null)}
          size="full"
          aria-labelledby="moderation-viewer-title"
        >
          <div
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') step(-1);
              if (e.key === 'ArrowRight') step(1);
            }}
          >
            <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-3">
              <h2 id="moderation-viewer-title" className="truncate text-base font-semibold">
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
                alt={current.caption || `Photo by ${uploader(current)}`}
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
                  {[uploader(current), current.category, formatDateWithTime(current.created_at)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">{actionButtons([current.id])}</div>
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
