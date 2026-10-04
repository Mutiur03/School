import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import axios, { isAxiosError } from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import type { ApiResponse } from '@school/shared-schemas';
import { useTeacher } from '@/queries/teacher.queries';
import type { Teacher } from '@/types/teachers';
import { Eye, Loader2, MessageSquareText, UserRound } from 'lucide-react';
import { SectionCard, filterSelectClassName } from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { getFileUrl } from '@/lib/backend';
import { toParagraphs } from '@/lib/headMessage';
import { cn } from '@/lib/utils';

interface HeadData {
  teacher?: Teacher;
  head_message?: string;
  head_role?: string;
}

type Draft = { teacherId: string; role: string; message: string };

const HEAD_ROLE_OPTIONS = [
  { value: 'Headmaster', label: 'Headmaster' },
  { value: 'Headmaster (Incharge)', label: 'Headmaster (Incharge)' },
] as const;

const HEAD_QUERY_KEY = ['headMessage'];

const errorMessage = (e: unknown, fallback: string) =>
  isAxiosError(e)
    ? e.response?.data?.error || e.message || fallback
    : e instanceof Error
      ? e.message
      : fallback;

const toDraft = (data: HeadData | undefined): Draft => ({
  teacherId: data?.teacher ? String(data.teacher.id) : '',
  role: data?.head_role || 'Headmaster',
  message: typeof data?.head_message === 'string' ? data.head_message : '',
});

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
    {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
  </div>
);

function HeadMessagePreview({
  name,
  role,
  imageUrl,
  message,
}: {
  name: string;
  role: string;
  imageUrl: string;
  message: string;
}) {
  const paragraphs = useMemo(() => toParagraphs(message), [message]);

  return (
    <div className="overflow-hidden rounded-md border border-[#c5d4a8] bg-[#fafcf7] shadow-sm">
      <div
        className="h-1.5 w-full bg-gradient-to-r from-[#3f6b0c] via-[#609513] to-[#7ba428]"
        aria-hidden
      />

      <div className="flex flex-col sm:flex-row">
        <div className="flex flex-col items-center gap-3 border-b border-[#d7e2c4] bg-[#e8f0dc]/55 px-4 py-5 sm:w-44 sm:shrink-0 sm:border-b-0 sm:border-r">
          <div className="h-28 w-24 overflow-hidden rounded-sm border-2 border-[#609513]/50 bg-white">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name || 'Headmaster'}
                width={96}
                height={112}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                No photo
              </div>
            )}
          </div>
          <div className="min-w-0 max-w-full text-center">
            <p className="truncate text-sm font-bold text-[#1b2430]" title={name || undefined}>
              {name || 'Headmaster name'}
            </p>
            <p className="text-xs font-medium text-[#4f7c12]">প্রধান শিক্ষক</p>
            <p className="text-[11px] uppercase tracking-wide text-[#5c6b5a]">{role}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-4 py-5">
          <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-[#4f7c12]">
            প্রধান শিক্ষকের বাণী
          </p>
          <div className="border-l-[3px] border-[#609513] pl-3">
            {paragraphs.length > 0 ? (
              <div className="space-y-3 text-justify text-sm leading-7 text-[#1b2430]">
                {paragraphs.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Start typing to preview the message…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Head() {
  const queryClient = useQueryClient();
  const { data: teacherData, isLoading: teachersLoading } = useTeacher({});
  const teachers: Teacher[] = useMemo(() => teacherData ?? [], [teacherData]);

  const headQuery = useQuery({
    queryKey: HEAD_QUERY_KEY,
    queryFn: async () => {
      const res = await axios.get<ApiResponse<HeadData>>('/api/teachers/head-message');
      return res.data?.data ?? {};
    },
  });

  const saved = useMemo(() => toDraft(headQuery.data), [headQuery.data]);
  // null = no local edits; the form shows the saved values.
  const [edits, setEdits] = useState<Draft | null>(null);
  const draft = edits ?? saved;
  const update = (patch: Partial<Draft>) => setEdits({ ...draft, ...patch });

  const dirty =
    draft.teacherId !== saved.teacherId ||
    draft.role !== saved.role ||
    draft.message !== saved.message;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const selectedTeacher = teachers.find((t) => String(t.id) === draft.teacherId);
  const savedTeacher = headQuery.data?.teacher;
  const deferredMessage = useDeferredValue(draft.message);
  const previewImage = selectedTeacher?.image ? getFileUrl(selectedTeacher.image) : '';
  const charCount = draft.message.length;
  const wordCount = draft.message.trim() ? draft.message.trim().split(/\s+/).length : 0;
  const paraCount = toParagraphs(draft.message).length;

  const saveMutation = useMutation({
    mutationFn: async (values: Draft) => {
      const payload: { teacherId?: string; message?: string; headRole?: string } = {};
      if (values.teacherId) payload.teacherId = values.teacherId;
      if (values.message.trim()) payload.message = values.message.trim();
      if (values.role) payload.headRole = values.role;
      if (Object.keys(payload).length === 0) throw new Error('Nothing to save');
      await axios.post('/api/teachers/head-message', payload);
    },
    onSuccess: () => {
      toast.success('Saved. Public page shows this after refresh.');
      queryClient.setQueryData<HeadData>(HEAD_QUERY_KEY, (old) => ({
        ...old,
        teacher: selectedTeacher ?? old?.teacher,
        head_role: draft.role,
        head_message: draft.message,
      }));
      setEdits(null);
      queryClient.invalidateQueries({ queryKey: HEAD_QUERY_KEY });
    },
    onError: (e) => toast.error(errorMessage(e, 'Request failed')),
  });

  const loading = headQuery.isLoading || teachersLoading;
  const busy = loading || saveMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(draft);
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Message from Head</h1>
        <div className="text-muted-foreground mt-1 text-sm">
          {headQuery.isLoading ? (
            <Skeleton className="h-4 w-56" />
          ) : savedTeacher ? (
            <>
              <span className="text-foreground font-medium">{savedTeacher.name}</span> ·{' '}
              {saved.role} · shown on the public site
            </>
          ) : (
            'No head selected yet. Choose a teacher and write the বাণী for the public site.'
          )}
        </div>
      </header>

      {headQuery.isError && (
        <p className="border-destructive/30 bg-destructive/5 text-destructive mb-4 rounded-lg border px-3 py-2 text-sm">
          {errorMessage(headQuery.error, 'Error loading head message')}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <SectionCard title="Headmaster" icon={<UserRound size={20} aria-hidden />}>
              <div className="space-y-5">
                <Field
                  label="Teacher"
                  hint="Name, designation and photo come from the teacher's profile."
                >
                  <select
                    name="teacherId"
                    autoComplete="off"
                    value={draft.teacherId}
                    onChange={(e) => update({ teacherId: e.target.value })}
                    disabled={busy || teachers.length === 0}
                    className={cn(filterSelectClassName, 'pointer-coarse:h-11')}
                  >
                    <option value="">Select teacher…</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {`${teacher.name} (${teacher.designation})`}
                      </option>
                    ))}
                  </select>
                </Field>

                <fieldset className="space-y-1.5">
                  <legend className="mb-1.5 text-sm font-medium">Role on public page</legend>
                  <div className="flex flex-wrap gap-2">
                    {HEAD_ROLE_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="border-border hover:bg-muted pointer-coarse:py-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors has-[:checked]:border-[#609513] has-[:checked]:bg-[#e8f0dc]/70"
                      >
                        <input
                          type="radio"
                          name="headRole"
                          value={option.value}
                          checked={draft.role === option.value}
                          onChange={(e) => update({ role: e.target.value })}
                          disabled={busy}
                          className="pointer-coarse:h-5 pointer-coarse:w-5 h-4 w-4 accent-[#609513]"
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            </SectionCard>

            <SectionCard title="Message" icon={<MessageSquareText size={20} aria-hidden />}>
              {loading ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <Field
                  label="বাণী"
                  hint="Blank line = new paragraph. One continuous block → the site groups about two sentences per paragraph (Bangla । or English . ! ?)."
                >
                  <Textarea
                    name="headMessage"
                    autoComplete="off"
                    rows={12}
                    placeholder="Write the headmaster’s message… Use a blank line for a new paragraph."
                    value={draft.message}
                    onChange={(e) => update({ message: e.target.value })}
                    disabled={busy}
                    className="min-h-[220px] resize-y leading-relaxed"
                  />
                  <span className="text-muted-foreground block text-right text-xs tabular-nums">
                    {charCount.toLocaleString()} chars · {wordCount.toLocaleString()} word
                    {wordCount === 1 ? '' : 's'} · {paraCount} paragraph
                    {paraCount === 1 ? '' : 's'}
                  </span>
                </Field>
              )}
            </SectionCard>
          </div>

          <div className="xl:sticky xl:top-4">
            <SectionCard
              title="Preview"
              description="How the public page will show it."
              icon={<Eye size={20} aria-hidden />}
            >
              <HeadMessagePreview
                name={selectedTeacher?.name || ''}
                role={draft.role}
                imageUrl={previewImage}
                message={deferredMessage}
              />
            </SectionCard>
          </div>
        </div>

        {dirty && (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="bg-card border-border sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-2 shadow-lg"
          >
            <p className="text-sm font-medium">Unsaved changes</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => setEdits(null)}
                className="pointer-coarse:h-10"
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={busy || (!draft.teacherId && !draft.message.trim())}
                className="pointer-coarse:h-10"
              >
                {saveMutation.isPending && <Loader2 className="animate-spin" />}
                Save message
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default Head;
