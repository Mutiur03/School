/**
 * Message from Head, replicating dashboard/src/pages/Admin/Head.tsx: subtitle with the saved
 * head ("{name} · {role} · shown on the public site"), the Headmaster card (teacher select +
 * role radio), the Message card (বাণী, 12 rows, chars / words / paragraphs counter), the green
 * Preview card as the public page shows it, and the "Unsaved changes" bar (Discard / Save).
 * Live data: GET /api/teachers/head-message (public, this school), POST (admin), teachers from
 * GET /api/teachers.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionBar } from '@/components/ui/ActionBar';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Eye, MessageSquareText, UserRound } from '@/components/ui/icons';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { ErrorMessage, Skeleton } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import {
  messageCounter,
  sameDraft,
  toParagraphs,
  type HeadDraft,
} from '@/features/head-message/model';
import { fileUrl } from '@/features/student/components';
import { HEAD_ROLES, headMessageBody, type HeadMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const toDraft = (h: HeadMessage | undefined): HeadDraft => ({
  teacherId: h?.teacher?.id ?? null,
  role: h?.role || HEAD_ROLES[0],
  message: h?.message ?? '',
});

function Preview({
  name,
  role,
  image,
  message,
}: {
  name: string;
  role: string;
  image: string | null;
  message: string;
}) {
  const paragraphs = useMemo(() => toParagraphs(message), [message]);
  return (
    <View
      className="overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50"
      testID="head-preview"
    >
      <View className="h-1.5 bg-emerald-600" />
      <View className="gap-4 p-4">
        <View className="flex-row items-center gap-4">
          {image ? (
            <Image
              source={{ uri: image }}
              accessibilityLabel={name || 'Headmaster'}
              className="h-28 w-24 rounded-lg border border-emerald-200 bg-white"
            />
          ) : (
            <View className="h-28 w-24 items-center justify-center rounded-lg border border-dashed border-emerald-300 bg-white">
              <Text size="xs" color="mutedForeground">
                No photo
              </Text>
            </View>
          )}
          <View className="min-w-0 flex-1 gap-0.5">
            <Text size="base" weight="bold" numberOfLines={2} className="text-emerald-900">
              {name || 'Headmaster name'}
            </Text>
            <Text size="sm" weight="medium" className="text-emerald-800">
              প্রধান শিক্ষক
            </Text>
            <Text size="xs" className="text-emerald-700">
              {role}
            </Text>
          </View>
        </View>
        <View className="gap-2">
          <Text size="sm" weight="semibold" className="text-emerald-900">
            প্রধান শিক্ষকের বাণী
          </Text>
          <View className="gap-2 rounded-lg bg-white p-3">
            {paragraphs.length > 0 ? (
              paragraphs.map((p, i) => (
                <Text key={i} size="sm" className="leading-6">
                  {p}
                </Text>
              ))
            ) : (
              <Text size="sm" color="mutedForeground">
                Start typing to preview the message…
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function RoleRadio({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-2" role="radiogroup" aria-label="Role on public page">
      <Text size="sm" weight="medium">
        Role on public page
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {HEAD_ROLES.map((r) => {
          const on = r === value;
          return (
            <Pressable
              key={r}
              role="radio"
              aria-checked={on}
              accessibilityState={{ checked: on, disabled }}
              disabled={disabled}
              onPress={() => onChange(r)}
              className={cn(
                'flex-row items-center gap-2 rounded-lg border px-3 py-2',
                on ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <View
                className={cn(
                  'h-4 w-4 items-center justify-center rounded-full border',
                  on ? 'border-primary' : 'border-control',
                )}
              >
                {on ? <View className="bg-primary h-2 w-2 rounded-full" /> : null}
              </View>
              <Text size="sm">{r}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function HeadMessageScreen() {
  const { teachers } = useApi();
  const { resolution } = useTenant();
  const queryClient = useQueryClient();
  const toast = useToast();
  const headKey = privateQueryKey(resolution.tenantKey, 'head-message');
  const headQ = useQuery({
    queryKey: headKey,
    queryFn: ({ signal }) => teachers.headMessage(signal),
  });
  const teachersQ = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'teachers', { all: true }),
    queryFn: ({ signal }) => teachers.list({ page: 1, limit: 200 }, signal),
    staleTime: 60_000,
  });
  const list = teachersQ.data?.rows ?? [];

  const saved = useMemo(() => toDraft(headQ.data), [headQ.data]);
  const [edits, setEdits] = useState<HeadDraft | null>(null);
  const draft = edits ?? saved;
  const dirty = !sameDraft(draft, saved);
  const update = (patch: Partial<HeadDraft>) => setEdits({ ...draft, ...patch });
  const deferred = useDeferredValue(draft.message);
  const selected = list.find((t) => t.id === draft.teacherId) ?? null;
  const previewName =
    selected?.name ??
    (draft.teacherId === headQ.data?.teacher?.id ? (headQ.data?.teacher?.name ?? '') : '');
  const previewImage = fileUrl(
    selected?.image ??
      (draft.teacherId === headQ.data?.teacher?.id ? headQ.data?.teacher?.image : null),
  );

  const save = useMutation({
    mutationFn: async (d: HeadDraft) => {
      const body = headMessageBody(d);
      if (!body) throw new Error('Nothing to save');
      await teachers.saveHeadMessage(body);
    },
    onSuccess: () => {
      toast.success('Saved. Public page shows this after refresh.');
      setEdits(null);
      void queryClient.invalidateQueries({ queryKey: headKey });
    },
    onError: (e) => toast.error(mutationErrorMessage(e, 'Request failed')),
  });

  const loading = headQ.isPending || teachersQ.isPending;
  const busy = loading || save.isPending;
  const head = headQ.data?.teacher;

  return (
    <PageLayout
      title="Message from Head"
      description={
        headQ.isPending
          ? 'Loading…'
          : head
            ? `${head.name} · ${saved.role} · shown on the public site`
            : 'No head selected yet. Choose a teacher and write the বাণী for the public site.'
      }
      onRefresh={() => void headQ.refetch()}
      refreshing={headQ.isRefetching}
      footer={
        dirty ? (
          <ActionBar label="Unsaved changes" testID="head-unsaved">
            <Button
              variant="ghost"
              size="sm"
              label="Discard"
              disabled={save.isPending}
              onPress={() => setEdits(null)}
            />
            <Button
              size="sm"
              label={save.isPending ? 'Saving…' : 'Save message'}
              disabled={save.isPending || (!draft.teacherId && !draft.message.trim())}
              onPress={() => save.mutate(draft)}
              testID="head-save"
            />
          </ActionBar>
        ) : null
      }
    >
      {headQ.isError ? (
        <ErrorMessage message={mutationErrorMessage(headQ.error, 'Error loading head message')} />
      ) : null}
      <View className="flex-row flex-wrap gap-6">
        <View className="min-w-[300px] flex-[3] gap-6">
          <SectionCard
            title="Headmaster"
            icon={<Icon icon={UserRound} size={20} color="primary" />}
          >
            <View className="gap-4">
              <Field
                label="Teacher"
                hint="Name, designation and photo come from the teacher's profile."
              >
                <Select
                  label="Teacher"
                  value={draft.teacherId ?? 0}
                  onChange={(id) => update({ teacherId: id || null })}
                  disabled={busy || list.length === 0}
                  options={[
                    { value: 0, label: 'Select teacher…' },
                    ...list.map((t) => ({
                      value: t.id,
                      label: t.designation ? `${t.name} (${t.designation})` : t.name,
                    })),
                  ]}
                  testID="head-teacher"
                />
              </Field>
              <RoleRadio value={draft.role} onChange={(role) => update({ role })} disabled={busy} />
            </View>
          </SectionCard>
          <SectionCard
            title="Message"
            icon={<Icon icon={MessageSquareText} size={20} color="primary" />}
          >
            {loading ? (
              <Skeleton height={240} />
            ) : (
              <Field
                label="বাণী"
                hint="Blank line = new paragraph. One continuous block → the site groups about two sentences per paragraph (Bangla । or English . ! ?)."
              >
                <Input
                  accessibilityLabel="বাণী"
                  multiline
                  numberOfLines={12}
                  placeholder="Write the headmaster’s message… Use a blank line for a new paragraph."
                  value={draft.message}
                  onChangeText={(message) => update({ message })}
                  editable={!busy}
                  rows={11}
                  testID="head-message-input"
                />
                <Text size="xs" color="mutedForeground" tabular className="mt-1">
                  {messageCounter(draft.message)}
                </Text>
              </Field>
            )}
          </SectionCard>
        </View>
        <View className="min-w-[300px] flex-[2]">
          <SectionCard
            title="Preview"
            description="How the public page will show it."
            icon={<Icon icon={Eye} size={20} color="primary" />}
          >
            <Preview name={previewName} role={draft.role} image={previewImage} message={deferred} />
          </SectionCard>
        </View>
      </View>
    </PageLayout>
  );
}
