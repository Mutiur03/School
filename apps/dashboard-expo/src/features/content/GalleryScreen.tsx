/**
 * Gallery, replicating dashboard/src/pages/Admin/{Gallery,GalleryModeration}.tsx in one screen
 * with three modes:
 * - approved (/gallery/upload): albums by event / category, upload (admin uploads are approved),
 *   edit caption / album / image, set album thumbnail, reject;
 * - pending (/gallery/pending): approve or reject student uploads;
 * - rejected (/gallery/rejected): approve again or delete for good.
 * Albums fold, select-all per album, a bulk bar and a photo viewer with previous / next.
 * Live data: /api/gallery/* (src/lib/api/gallery.ts), events from /api/events/getEvents.
 */
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { FilePicker, PickFilesButton } from '@/components/ui/FilePicker';
import { Icon } from '@/components/ui/Icon';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Pencil,
  Trash2,
  XCircle,
  XIcon,
} from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { plural } from '@/features/admin/errors';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { fileUrl } from '@/features/student/components';
import {
  EVENTS_CATEGORY_ID,
  imageFileError,
  placementError,
  uploader,
  type GalleryGroup,
  type GalleryImage,
  type GalleryPlacement,
  type GalleryStatus,
  type PickedFile,
} from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { dayOf, gallerySummary, keepExisting, toggleAll } from './model';

const TITLES: Record<GalleryStatus, string> = {
  approved: 'Gallery',
  pending: 'Approve photos',
  rejected: 'Rejected photos',
};

interface EditForm extends GalleryPlacement {
  /** null = upload new photos. */
  image: GalleryImage | null;
  caption: string;
  files: PickedFile[];
  replace: PickedFile | null;
}

type Confirm = {
  title: string;
  message: string;
  label: string;
  ids: number[];
  kind: 'reject' | 'delete';
};

export function GalleryScreen({ mode }: { mode: GalleryStatus }) {
  const { gallery, events } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const [viewer, setViewer] = useState<{ group: string; index: number } | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'gallery', mode),
    queryFn: ({ signal }) => gallery.list(mode, signal),
  });
  const groups = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => setSelected((s) => keepExisting(s, groups)), [groups]);
  const categories = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'gallery', 'categories'),
    queryFn: ({ signal }) => gallery.categories(signal),
    enabled: mode === 'approved',
  });
  const eventList = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'events'),
    queryFn: ({ signal }) => events.list(signal),
    enabled: mode === 'approved',
  });

  const done = (ids: readonly number[]) => {
    setSelected((s) => new Set([...s].filter((id) => !ids.includes(id))));
    setConfirm(null);
    setViewer(null);
  };
  const approve = useAdminMutation({
    mutationFn: async (ids: number[]) => {
      await gallery.approve(ids);
      return ids;
    },
    invalidate: [['gallery']],
    success: (ids) => `Approved ${plural(ids.length, 'photo')}`,
    failure: 'Failed to approve photos',
    onSuccess: done,
  });
  const reject = useAdminMutation({
    mutationFn: async (ids: number[]) => {
      await gallery.reject(ids);
      return ids;
    },
    invalidate: [['gallery']],
    success: (ids) => `Rejected ${plural(ids.length, 'photo')}`,
    failure: 'Failed to reject photos',
    onSuccess: done,
  });
  const remove = useAdminMutation({
    mutationFn: async (ids: number[]) => {
      await gallery.remove(ids);
      return ids;
    },
    invalidate: [['gallery']],
    success: (ids) => `Deleted ${plural(ids.length, 'photo')}`,
    failure: 'Failed to delete photos',
    onSuccess: done,
  });
  const thumb = useAdminMutation({
    mutationFn: (v: { group: GalleryGroup; id: number }) => gallery.setThumbnail(v.group, v.id),
    invalidate: [['gallery']],
    success: 'Thumbnail changed',
    failure: 'Failed to change thumbnail',
  });
  const save = useAdminMutation({
    mutationFn: async (f: EditForm) => {
      if (f.image) {
        await gallery.update(f.image.id, f.caption, f, f.replace);
        return 0;
      }
      return gallery.upload(f.files, f.caption, f);
    },
    invalidate: [['gallery']],
    success: (n) => (n ? `Uploaded ${plural(n, 'photo')}` : 'Photo updated'),
    failure: form?.image ? 'Failed to update photo' : 'Failed to upload photos',
    onSuccess: () => setForm(null),
  });
  const busy = approve.isPending || reject.isPending || remove.isPending;

  const askReject = (ids: number[]) =>
    mode === 'pending' && ids.length === 1
      ? reject.mutate(ids)
      : setConfirm({
          kind: 'reject',
          ids,
          label: 'Reject',
          title: 'Reject photos?',
          message:
            mode === 'approved'
              ? `Reject ${plural(ids.length, 'photo')}? ${ids.length === 1 ? 'It moves' : 'They move'} to Rejected, where you can approve or delete ${ids.length === 1 ? 'it' : 'them'}.`
              : `Reject ${plural(ids.length, 'photo')}? They move to Rejected.`,
        });
  const askDelete = (ids: number[]) =>
    setConfirm({
      kind: 'delete',
      ids,
      label: 'Delete',
      title: 'Delete photos?',
      message: `Permanently delete ${plural(ids.length, 'photo')}? This can't be undone.`,
    });

  const openUpload = () =>
    setForm({ image: null, caption: '', eventId: '', categoryId: '', files: [], replace: null });
  const openEdit = (img: GalleryImage) =>
    setForm({
      image: img,
      caption: img.caption,
      eventId: img.eventId ? String(img.eventId) : '',
      categoryId: img.categoryId ? String(img.categoryId) : '',
      files: [],
      replace: null,
    });
  const addFiles = (picked: PickedFile[]) => {
    if (!form) return;
    const ok: PickedFile[] = [];
    for (const f of picked) {
      const err = imageFileError(f);
      if (err) toast.error(err);
      else ok.push(f);
    }
    setForm({ ...form, files: [...form.files, ...ok] });
  };
  const submit = () => {
    if (!form) return;
    if (!form.image && form.files.length === 0) {
      toast.error('Please select at least one image');
      return;
    }
    const err = placementError(form);
    if (err) {
      toast.error(err);
      return;
    }
    save.mutate(form);
  };

  const viewerGroup = viewer ? groups.find((g) => g.id === viewer.group) : undefined;
  const viewerIndex =
    viewerGroup && viewer ? Math.min(viewer.index, viewerGroup.images.length - 1) : -1;
  const current = viewerGroup && viewerIndex >= 0 ? viewerGroup.images[viewerIndex]! : null;
  const ids = [...selected];
  const allFolded = groups.length > 0 && groups.every((g) => folded[g.id]);

  const bulk = ids.length ? (
    <ActionBar
      label={`${plural(ids.length, 'photo')} selected`}
      onClear={() => setSelected(new Set())}
      clearLabel="Clear selection"
      testID="gallery-bulk"
    >
      {mode !== 'approved' ? (
        <Button
          size="sm"
          icon={Check}
          label="Approve"
          onPress={() => approve.mutate(ids)}
          disabled={busy}
        />
      ) : null}
      {mode !== 'rejected' ? (
        <Button
          size="sm"
          variant="outline"
          icon={XCircle}
          label="Reject"
          onPress={() => askReject(ids)}
          disabled={busy}
        />
      ) : (
        <Button
          size="sm"
          variant="destructive"
          icon={Trash2}
          label="Delete"
          onPress={() => askDelete(ids)}
          disabled={busy}
        />
      )}
    </ActionBar>
  ) : null;

  return (
    <PageLayout
      title={TITLES[mode]}
      description={q.isPending ? 'Loading…' : gallerySummary(groups, mode)}
      actions={
        <View className="flex-row gap-2">
          {groups.length ? (
            <Button
              variant="outline"
              label={allFolded ? 'Expand all' : 'Collapse all'}
              onPress={() =>
                setFolded(allFolded ? {} : Object.fromEntries(groups.map((g) => [g.id, true])))
              }
            />
          ) : null}
          {mode === 'approved' ? (
            <Button
              icon={ImageIcon}
              label="Upload photos"
              onPress={openUpload}
              testID="gallery-upload"
            />
          ) : null}
        </View>
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
      footer={bulk}
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't load the gallery"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : q.isPending ? (
        <Skeleton height={240} />
      ) : groups.length === 0 ? (
        <EmptyState
          message={
            mode === 'approved'
              ? 'No photos yet.'
              : mode === 'pending'
                ? 'No photos waiting for review.'
                : 'No rejected photos.'
          }
        />
      ) : (
        groups.map((g) => {
          const gIds = g.images.map((i) => i.id);
          const allOn = gIds.every((id) => selected.has(id));
          return (
            <SectionCard key={g.id} testID={`album-${g.id}`}>
              <View className="gap-3">
                <View className="flex-row flex-wrap items-center gap-3">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${folded[g.id] ? 'Expand' : 'Collapse'} ${g.title}`}
                    onPress={() => setFolded((f) => ({ ...f, [g.id]: !f[g.id] }))}
                    className="min-w-0 flex-1 flex-row items-center gap-2"
                  >
                    <View style={{ transform: [{ rotate: folded[g.id] ? '-90deg' : '0deg' }] }}>
                      <Icon icon={ChevronDown} size={18} color="mutedForeground" />
                    </View>
                    <Text weight="semibold" numberOfLines={1} className="shrink">
                      {g.title}
                    </Text>
                    <Text size="xs" color="mutedForeground">
                      {`${g.kind === 'event' ? 'Event' : 'Category'} · ${plural(g.images.length, 'photo')}`}
                    </Text>
                  </Pressable>
                  <Checkbox
                    checked={allOn}
                    onChange={() => setSelected((s) => toggleAll(s, gIds))}
                    label="Select all"
                    accessibilityLabel={`Select all photos in ${g.title}`}
                  />
                </View>
                {folded[g.id] ? null : (
                  <View className="flex-row flex-wrap gap-2">
                    {g.images.map((img, index) => {
                      const on = selected.has(img.id);
                      return (
                        <View key={img.id} className="h-28 w-28 md:h-36 md:w-36">
                          <Pressable
                            accessibilityRole="imagebutton"
                            accessibilityLabel={img.caption || `Photo ${index + 1} in ${g.title}`}
                            onPress={() => setViewer({ group: g.id, index })}
                            className={`bg-muted h-full w-full overflow-hidden rounded-lg border-2 ${on ? 'border-primary' : 'border-transparent'}`}
                          >
                            <Image
                              source={{ uri: fileUrl(img.key) ?? undefined }}
                              className="h-full w-full"
                              resizeMode="cover"
                            />
                          </Pressable>
                          <View className="absolute left-1.5 top-1.5 rounded bg-white/90">
                            <Checkbox
                              checked={on}
                              onChange={() =>
                                setSelected((s) => {
                                  const n = new Set(s);
                                  if (n.has(img.id)) n.delete(img.id);
                                  else n.add(img.id);
                                  return n;
                                })
                              }
                              label=""
                              accessibilityLabel={`Select photo ${index + 1} in ${g.title}`}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            </SectionCard>
          );
        })
      )}

      <Dialog
        open={current !== null}
        onClose={() => setViewer(null)}
        title={viewerGroup?.title ?? 'Photo'}
        description={
          current && viewerGroup
            ? `${viewerIndex + 1} of ${viewerGroup.images.length} · ${uploader(current)} · ${dayOf(current.createdAt)}`
            : undefined
        }
        size="xl"
        testID="gallery-viewer"
        footer={
          current && viewerGroup ? (
            <>
              <View className="mr-auto flex-row gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  icon={ChevronLeft}
                  accessibilityLabel="Previous photo"
                  disabled={viewerIndex <= 0}
                  onPress={() => setViewer({ group: viewerGroup.id, index: viewerIndex - 1 })}
                />
                <Button
                  variant="outline"
                  size="icon"
                  icon={ChevronRight}
                  accessibilityLabel="Next photo"
                  disabled={viewerIndex >= viewerGroup.images.length - 1}
                  onPress={() => setViewer({ group: viewerGroup.id, index: viewerIndex + 1 })}
                />
              </View>
              {mode === 'approved' ? (
                <>
                  <Button
                    variant="outline"
                    label={thumb.isPending ? 'Saving…' : 'Set as thumbnail'}
                    disabled={thumb.isPending || viewerGroup.refId == null}
                    onPress={() => thumb.mutate({ group: viewerGroup, id: current.id })}
                  />
                  <Button
                    variant="outline"
                    icon={Pencil}
                    label="Edit"
                    onPress={() => {
                      setViewer(null);
                      openEdit(current);
                    }}
                  />
                </>
              ) : (
                <Button
                  icon={Check}
                  label="Approve"
                  disabled={busy}
                  onPress={() => approve.mutate([current.id])}
                />
              )}
              {mode === 'rejected' ? (
                <Button
                  variant="destructive"
                  icon={Trash2}
                  label="Delete"
                  disabled={busy}
                  onPress={() => askDelete([current.id])}
                />
              ) : (
                <Button
                  variant="outline"
                  icon={XCircle}
                  label="Reject"
                  disabled={busy}
                  onPress={() => askReject([current.id])}
                />
              )}
            </>
          ) : null
        }
      >
        {current ? (
          <>
            <View className="bg-muted aspect-[4/3] w-full overflow-hidden rounded-lg">
              <Image
                source={{ uri: fileUrl(current.key) ?? undefined }}
                className="h-full w-full"
                resizeMode="contain"
              />
            </View>
            {current.caption ? <Text size="sm">{current.caption}</Text> : null}
          </>
        ) : null}
      </Dialog>

      <Dialog
        open={form !== null}
        onClose={() => (save.isPending ? undefined : setForm(null))}
        title={form?.image ? 'Edit photo' : 'Upload photos'}
        testID="gallery-form"
        footer={
          <>
            <Button
              variant="outline"
              label="Cancel"
              onPress={() => setForm(null)}
              disabled={save.isPending}
            />
            <Button
              label={
                save.isPending
                  ? 'Saving…'
                  : form?.image
                    ? 'Save changes'
                    : `Upload${form?.files.length ? ` ${plural(form.files.length, 'photo')}` : ''}`
              }
              onPress={submit}
              disabled={save.isPending}
              testID="gallery-submit"
            />
          </>
        }
      >
        {form ? (
          <>
            {form.image ? (
              <Field label="Photo" hint="Optional: pick a new image to replace it.">
                <FilePicker
                  label="Photo"
                  accept="image/*"
                  value={form.replace}
                  onChange={(f) => {
                    const err = f ? imageFileError(f) : null;
                    if (err) toast.error(err);
                    else setForm({ ...form, replace: f });
                  }}
                  currentLabel="Current photo"
                />
              </Field>
            ) : (
              <Field label="Photos" required hint="Images up to 5 MB each.">
                <View className="gap-2">
                  {form.files.length ? (
                    <View className="flex-row flex-wrap gap-2">
                      {form.files.map((f, i) => (
                        <View
                          key={`${f.name}-${i}`}
                          className="border-border flex-row items-center gap-1 rounded-md border px-2 py-1"
                        >
                          <Text size="xs" numberOfLines={1} className="max-w-40">
                            {f.name}
                          </Text>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            icon={XIcon}
                            accessibilityLabel={`Remove ${f.name}`}
                            onPress={() =>
                              setForm({ ...form, files: form.files.filter((_, j) => j !== i) })
                            }
                          />
                        </View>
                      ))}
                    </View>
                  ) : null}
                  <View className="self-start">
                    <PickFilesButton
                      accept="image/*"
                      multiple
                      variant="outline"
                      label="Choose images"
                      onPick={addFiles}
                      testID="gallery-pick"
                    />
                  </View>
                </View>
              </Field>
            )}
            <Field label="Caption (optional)">
              <Input
                value={form.caption}
                onChangeText={(caption) => setForm({ ...form, caption })}
                placeholder="Enter caption"
                accessibilityLabel="Caption"
              />
            </Field>
            <Field label="Event (optional)">
              <Select
                label="Event"
                value={form.eventId}
                options={[
                  { value: '', label: 'No event' },
                  ...(eventList.data ?? []).map((e) => ({ value: String(e.id), label: e.title })),
                ]}
                onChange={(eventId) =>
                  setForm({
                    ...form,
                    eventId,
                    categoryId: eventId
                      ? EVENTS_CATEGORY_ID
                      : form.categoryId === EVENTS_CATEGORY_ID
                        ? ''
                        : form.categoryId,
                  })
                }
              />
            </Field>
            <Field label="Category" required={!form.eventId}>
              <Select
                label="Category"
                value={form.categoryId || null}
                placeholder="Select a category"
                disabled={!!form.eventId}
                options={(categories.data ?? []).map((c) => ({
                  value: String(c.id),
                  label: c.name,
                }))}
                onChange={(categoryId) =>
                  setForm({
                    ...form,
                    categoryId,
                    eventId: categoryId === EVENTS_CATEGORY_ID ? form.eventId : '',
                  })
                }
              />
            </Field>
          </>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.label ?? 'Confirm'}
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm &&
          (confirm.kind === 'reject' ? reject.mutate(confirm.ids) : remove.mutate(confirm.ids))
        }
      />
    </PageLayout>
  );
}
