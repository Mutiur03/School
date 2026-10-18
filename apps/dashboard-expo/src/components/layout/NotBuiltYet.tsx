import { Construction } from '@/components/ui/icons';
import { PageLayout } from '@/components/layout/PageLayout';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/states';

/** Placeholder for admin pages that exist in the web dashboard but not in this app yet. */
export function NotBuiltYet({ title, webPath }: { title: string; webPath: string | null }) {
  return (
    <PageLayout title={title}>
      <SectionCard testID="not-built-yet">
        <EmptyState
          icon={Construction}
          title="Not built in the Expo app yet"
          message={
            webPath
              ? `Use the web dashboard (${webPath}) until this page moves here.`
              : 'This page moves here in a later milestone.'
          }
        />
      </SectionCard>
    </PageLayout>
  );
}
