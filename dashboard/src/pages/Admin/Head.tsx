import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import axios, { isAxiosError } from 'axios';
import type { ApiResponse } from '@school/shared-schemas';
import { useTeacher } from '@/queries/teacher.queries';
import type { Teacher } from '@/types/teachers';
import { UserRound } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getFileUrl } from '@/lib/backend';
import { toParagraphs } from '@/lib/headMessage';

interface HeadData {
  teacher?: Teacher;
  head_message?: string;
  head_role?: string;
}

const HEAD_ROLE_OPTIONS = [
  { value: 'Headmaster', label: 'Headmaster' },
  { value: 'Headmaster (Incharge)', label: 'Headmaster (Incharge)' },
] as const;

const selectClassName =
  'border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

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
        <div className="flex flex-col items-center gap-3 border-b border-[#d7e2c4] bg-[#e8f0dc]/55 px-4 py-5 sm:w-44 sm:shrink-0 sm:border-r sm:border-b-0">
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
              <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                No photo
              </div>
            )}
          </div>
          <div className="max-w-full min-w-0 text-center">
            <p className="truncate text-sm font-bold text-[#1b2430]" title={name || undefined}>
              {name || 'Headmaster name'}
            </p>
            <p className="text-xs font-medium text-[#4f7c12]">প্রধান শিক্ষক</p>
            <p className="text-[10px] tracking-wide text-[#5c6b5a] uppercase">{role}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-4 py-5">
          <p className="mb-3 text-center text-[10px] font-semibold tracking-[0.16em] text-[#4f7c12] uppercase">
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
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [headRole, setHeadRole] = useState('Headmaster');
  const [message, setMessage] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState({
    teacherId: '',
    role: 'Headmaster',
    message: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { data: teacherData } = useTeacher({});

  const deferredMessage = useDeferredValue(message);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      let fetchError = '';

      try {
        if (isMounted && teacherData) setTeachers(teacherData || []);
      } catch (e) {
        if (isAxiosError(e)) {
          fetchError = e.response?.data?.error || e.message || 'Error loading teachers';
        }
      }

      try {
        const resHead = await axios.get<ApiResponse<HeadData>>('/api/teachers/head-message');
        const headData = resHead.data?.data || {};
        if (isMounted) {
          const teacherId = headData.teacher ? String(headData.teacher.id) : '';
          const role = headData.head_role || 'Headmaster';
          const msg = typeof headData.head_message === 'string' ? headData.head_message : '';
          setSelectedTeacherId(teacherId);
          setHeadRole(role);
          setMessage(msg);
          setSavedSnapshot({ teacherId, role, message: msg });
        }
      } catch (e) {
        if (isAxiosError(e) && !fetchError) {
          fetchError = e.response?.data?.error || e.message || 'Error loading head message';
        }
      }

      if (isMounted && fetchError) setError(fetchError);
      if (isMounted) setLoading(false);
    })();
    return () => {
      isMounted = false;
    };
  }, [teacherData]);

  const dirty =
    selectedTeacherId !== savedSnapshot.teacherId ||
    headRole !== savedSnapshot.role ||
    message !== savedSnapshot.message;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const selectedTeacher = useMemo(
    () => teachers.find((t) => String(t.id) === selectedTeacherId),
    [teachers, selectedTeacherId],
  );

  const previewImage = selectedTeacher?.image ? getFileUrl(selectedTeacher.image) : '';
  const charCount = message.length;
  const paraCount = toParagraphs(message).length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: { teacherId?: string; message?: string; headRole?: string } = {};
      if (selectedTeacherId) payload.teacherId = selectedTeacherId;
      if (message.trim()) payload.message = message.trim();
      if (headRole) payload.headRole = headRole;
      if (Object.keys(payload).length === 0) throw new Error('Nothing to save');
      await axios.post('/api/teachers/head-message', payload);
      setSavedSnapshot({
        teacherId: selectedTeacherId,
        role: headRole,
        message,
      });
      setSuccess('Saved. Public page shows this after refresh.');
    } catch (e) {
      if (isAxiosError(e)) setError(e.response?.data?.error || e.message || 'Request failed');
      else if (e instanceof Error) setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Head Message"
        description="Choose the headmaster and edit the বাণী shown on the public site."
      />

      <div className="mb-4 space-y-2" aria-live="polite">
        {loading ? <p className="text-muted-foreground text-sm">Loading…</p> : null}
        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {success}
          </p>
        ) : null}
        {dirty && !success ? (
          <p className="text-muted-foreground text-xs">Unsaved changes</p>
        ) : null}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <SectionCard title="Editor" icon={<UserRound size={20} aria-hidden />}>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="head-teacher">Teacher</Label>
              <select
                id="head-teacher"
                name="teacherId"
                autoComplete="off"
                value={selectedTeacherId}
                onChange={(e) => {
                  setSelectedTeacherId(e.target.value);
                  setSuccess('');
                }}
                disabled={loading || saving || teachers.length === 0}
                className={selectClassName}
              >
                <option value="">Select teacher…</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {`${teacher.name} (${teacher.designation})`}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Role on public page</legend>
              <div className="flex flex-wrap gap-3">
                {HEAD_ROLE_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="border-input hover:bg-accent/40 inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-[#609513] has-[:checked]:bg-[#e8f0dc]/70"
                  >
                    <input
                      type="radio"
                      name="headRole"
                      value={option.value}
                      checked={headRole === option.value}
                      onChange={(e) => {
                        setHeadRole(e.target.value);
                        setSuccess('');
                      }}
                      disabled={loading || saving}
                      className="accent-[#609513]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label htmlFor="head-message">Message</Label>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {charCount.toLocaleString()} chars · {paraCount} paragraph
                  {paraCount === 1 ? '' : 's'}
                </p>
              </div>
              <Textarea
                id="head-message"
                name="headMessage"
                autoComplete="off"
                rows={12}
                placeholder="Write the headmaster’s message… Use a blank line for a new paragraph."
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setSuccess('');
                }}
                disabled={loading || saving}
                className="min-h-[220px] resize-y leading-relaxed font-normal"
              />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Blank line = new paragraph. One continuous block → site groups about two sentences
                per paragraph (Bangla । or English . ! ?).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={loading || saving || (!selectedTeacherId && !message.trim()) || !dirty}
              >
                {saving ? 'Saving…' : 'Save message'}
              </Button>
              {dirty ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setSelectedTeacherId(savedSnapshot.teacherId);
                    setHeadRole(savedSnapshot.role);
                    setMessage(savedSnapshot.message);
                    setSuccess('');
                    setError('');
                  }}
                >
                  Discard changes
                </Button>
              ) : null}
            </div>
          </form>
        </SectionCard>

        <div className="xl:sticky xl:top-4">
          <SectionCard title="Public page preview">
            <p className="text-muted-foreground mb-3 text-xs">
              Live preview — same layout language as the public page.
            </p>
            <HeadMessagePreview
              name={selectedTeacher?.name || ''}
              role={headRole}
              imageUrl={previewImage}
              message={deferredMessage}
            />
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default Head;
