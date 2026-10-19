/**
 * One exam result, replicating dashboard/src/pages/Students/MarkSheetDisplay.tsx: exam hero
 * with "Download marksheet", Subjects / Total marks cards, subject marks table with Total.
 * The web shows marks only (no grade/GPA), so this does too.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Download,
  FileText,
  Loader2,
  Share2,
} from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorMessage, ErrorState, LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { Hero, MarksTable, StatsCard } from '@/features/student/components';
import { openMarksheet } from '@/features/student/share-marksheet';
import { useMyId, useMyMarks, useMyProfile, usePublishedExams } from '@/features/student/hooks';
import { isApiError, totalMarks } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';

const GENERIC = 'Could not download marksheet. Try again in a moment.';
const webMessage = (e: unknown) => (isApiError(e) ? e.message : GENERIC);
/** Native: friendly offline text; server 4xx messages (e.g. not published) as-is; no raw 5xx internals. */
const nativeMessage = (e: unknown) => {
  if (!isApiError(e)) return GENERIC;
  if (e.kind === 'network' || e.kind === 'timeout')
    return "Couldn't reach the server. Check your connection and try again.";
  return (e.status ?? 0) >= 500 || !e.message ? GENERIC : e.message;
};

function DownloadMarksheet({ year, exam }: { year: number; exam: string }) {
  const { student } = useApi();
  const studentId = useMyId();
  const [busy, setBusy] = useState<'view' | 'share' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const openWeb = async (id: number) => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the PDF.
    const tab = typeof window !== 'undefined' ? window.open('', '_blank') : null;
    try {
      const blob = await student.marksheetPdf({ studentId: id, year, exam });
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      if (tab) tab.location.href = url;
      else window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      tab?.close();
      throw e;
    }
  };

  const open = async (mode: 'view' | 'share' = 'view') => {
    if (!studentId || inFlight.current) return; // double-tap guard
    inFlight.current = true;
    setBusy(mode);
    setError(null);
    try {
      if (Platform.OS === 'web') {
        await openWeb(studentId);
      } else {
        const r = await openMarksheet(student, { studentId, year, exam }, mode);
        if (r === 'unavailable') setError("This device can't open or share the PDF.");
      }
    } catch (e) {
      setError(Platform.OS === 'web' ? webMessage(e) : nativeMessage(e));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <View className="items-start gap-2">
      <View className="flex-row flex-wrap gap-2">
        <Button
          testID="download-marksheet"
          icon={busy === 'view' ? Loader2 : Download}
          label={
            busy === 'view'
              ? 'Opening PDF…'
              : Platform.OS === 'web'
                ? 'Download marksheet'
                : 'View marksheet'
          }
          disabled={busy !== null || !studentId}
          onPress={() => void open('view')}
        />
        {Platform.OS !== 'web' ? (
          <Button
            testID="share-marksheet"
            variant="outline"
            icon={busy === 'share' ? Loader2 : Share2}
            label={busy === 'share' ? 'Preparing…' : 'Share'}
            disabled={busy !== null || !studentId}
            onPress={() => void open('share')}
          />
        ) : null}
      </View>
      {error ? (
        <View className="max-w-[320px]" testID="marksheet-error">
          <ErrorMessage message={error} />
        </View>
      ) : null}
    </View>
  );
}

export default function StudentResultDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exam: string; year?: string }>();
  const exam = typeof params.exam === 'string' ? params.exam : '';
  const year = Number(params.year) || new Date().getFullYear();
  const profile = useMyProfile(year);
  const exams = usePublishedExams(year);
  const published = exams.data?.some((e) => e.exam_name === exam) ?? false;
  const marks = useMyMarks(year, published ? exam : null);
  const rows = marks.data ?? [];
  const notPublished =
    (exams.isSuccess && !published) || (isApiError(marks.error) && marks.error.status === 403);

  const back = (
    <Button
      variant="ghost"
      size="sm"
      icon={ArrowLeft}
      label="All results"
      onPress={() => router.navigate('/student/results')}
    />
  );

  let body;
  if (exams.isPending || (published && marks.isPending)) {
    body = <LoadingState label="Loading your marks…" />;
  } else if (notPublished) {
    body = (
      <View
        className="border-border bg-muted/30 items-center rounded-xl border border-dashed px-6 py-12"
        testID="not-published"
      >
        <Text weight="medium">This result is not published yet</Text>
        <Text size="sm" color="mutedForeground" className="mt-1 text-center">
          Marks will appear here after the school publishes this exam result.
        </Text>
      </View>
    );
  } else if (exams.isError || marks.isError) {
    const err = exams.error ?? marks.error;
    body = (
      <ErrorState
        title="Couldn't load this result"
        message={err?.message}
        onRetry={() => {
          void exams.refetch();
          void marks.refetch();
        }}
      />
    );
  } else if (rows.length === 0) {
    body = (
      <SectionCard className="border-dashed">
        <View className="items-center px-6 py-10" testID="no-marks">
          <View className="bg-muted mb-4 h-12 w-12 items-center justify-center rounded-full">
            <Icon icon={FileText} size={24} color="mutedForeground" />
          </View>
          <Text weight="medium">No marks for this exam yet</Text>
          <Text size="sm" color="mutedForeground" className="mt-1 max-w-md text-center">
            Marks may not be published yet, or your teacher has not entered them. Check back later
            or ask your class teacher.
          </Text>
        </View>
      </SectionCard>
    );
  } else {
    body = (
      <>
        <Hero testID="result-hero">
          <View className="flex-row flex-wrap items-start justify-between gap-4">
            <View className="min-w-[200px] flex-1">
              <Text size="sm" weight="medium" color="primary">
                Exam result
              </Text>
              <Text size="2xl" weight="bold" className="mt-1" testID="result-exam">
                {exam}
              </Text>
              <Text size="sm" color="mutedForeground" className="mt-1">
                Session {year}
                {profile.data ? ` · ${profile.data.name}` : ''}
              </Text>
              {profile.data ? (
                <View className="mt-3 flex-row gap-2">
                  <Badge variant="secondary" label={`Class ${profile.data.class}`} />
                  <Badge variant="secondary" label={`Roll ${profile.data.roll}`} />
                </View>
              ) : null}
            </View>
            <DownloadMarksheet year={year} exam={exam} />
          </View>
        </Hero>
        <View className="flex-row gap-3">
          <StatsCard
            label="Subjects"
            value={rows.length}
            color="blue"
            icon={BookOpen}
            testID="stat-subjects"
          />
          <StatsCard
            label="Total marks"
            value={totalMarks(rows)}
            color="emerald"
            icon={Award}
            testID="stat-total-marks"
          />
        </View>
        <SectionCard
          title="Subject marks"
          description="Marks recorded for each subject in this exam."
          icon={<Icon icon={FileText} size={20} color="primary" />}
          noPadding
        >
          <MarksTable rows={rows} />
        </SectionCard>
      </>
    );
  }

  return (
    <PageLayout
      title="My results"
      actions={back}
      onRefresh={() => {
        void exams.refetch();
        void marks.refetch();
      }}
      refreshing={marks.isRefetching}
    >
      {body}
    </PageLayout>
  );
}
