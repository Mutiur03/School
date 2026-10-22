/**
 * One exam result on its own screen (deep link / back from the marksheet), replicating
 * dashboard/src/pages/Students/MarkSheetDisplay.tsx. The same view shows inline on My results.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PageLayout } from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from '@/components/ui/icons';
import { ResultView } from '@/features/student/ResultView';

export default function StudentResultDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ exam: string; year?: string }>();
  const exam = typeof params.exam === 'string' ? params.exam : '';
  const year = Number(params.year) || new Date().getFullYear();
  return (
    <PageLayout
      title="My results"
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={ArrowLeft}
          label="All results"
          onPress={() => router.navigate('/student/results')}
        />
      }
    >
      <ResultView year={year} exam={exam} />
    </PageLayout>
  );
}
