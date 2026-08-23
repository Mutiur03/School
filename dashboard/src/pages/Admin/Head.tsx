import React, { useEffect, useState } from 'react';
import axios, { isAxiosError } from 'axios';
import type { ApiResponse } from '@school/shared-schemas';
import { useTeacher } from '@/queries/teacher.queries';
import type { Teacher } from '@/types/teachers';
import { UserRound } from 'lucide-react';
import { PageHeader, SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

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

function Head() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [headRole, setHeadRole] = useState<string>('Headmaster');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const { data: teacherData } = useTeacher({});

  useEffect(() => {
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError('');
      setSuccess('');
      let fetchError = '';

      try {
        if (isMounted && teacherData) {
          setTeachers(teacherData || []);
        }
      } catch (e) {
        if (isAxiosError(e))
          fetchError = e.response?.data?.error || e.message || 'Error loading teachers';
      }

      try {
        const resHead = await axios.get<ApiResponse<HeadData>>('/api/teachers/head-message');
        const headData = resHead.data?.data || {};
        console.log(headData);

        if (isMounted) {
          if (headData?.teacher) setSelectedTeacherId(headData.teacher.id.toString());
          if (typeof headData?.head_message === 'string') setMessage(headData.head_message);
          if (headData?.head_role) setHeadRole(headData.head_role);
        }
      } catch (e) {
        if (isAxiosError(e))
          if (!fetchError) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload: { teacherId?: string; message?: string; headRole?: string } = {};
      if (selectedTeacherId) payload.teacherId = selectedTeacherId;
      if (message.trim()) payload.message = message.trim();
      if (headRole) payload.headRole = headRole;
      if (Object.keys(payload).length === 0) throw new Error('Nothing to save');
      await axios.post('/api/teachers/head-message', payload);
      setSuccess('Saved');
    } catch (e) {
      if (isAxiosError(e)) setError(e.response?.data?.error || e.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="Head Message"
        description="Select the headmaster and update the message displayed on the public site."
      />

      {loading && <div className="text-muted-foreground mb-4 text-sm">Loading...</div>}
      {error && <div className="mb-4 text-sm text-red-600">{error}</div>}
      {success && <div className="mb-4 text-sm text-green-600">{success}</div>}

      <SectionCard title="Headmaster Details" icon={<UserRound size={20} />}>
        <form onSubmit={handleSubmit} className="grid max-w-2xl gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Teacher</span>
            <select
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={loading || teachers.length === 0}
              className={selectClassName}
            >
              <option value="">-- Select --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {`${teacher.name} (${teacher.designation})`}
                </option>
              ))}
            </select>
          </label>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Headmaster Role</legend>
            <div className="flex flex-wrap gap-4">
              {HEAD_ROLE_OPTIONS.map((option) => (
                <label key={option.value} className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="headRole"
                    value={option.value}
                    checked={headRole === option.value}
                    onChange={(e) => setHeadRole(e.target.value)}
                    disabled={loading}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="head-message" className="text-sm font-medium">
              Message
            </label>
            <Textarea
              id="head-message"
              rows={5}
              placeholder="Write a message from the head..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Button type="submit" disabled={loading || (!selectedTeacherId && !message.trim())}>
              Save All
            </Button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

export default Head;
