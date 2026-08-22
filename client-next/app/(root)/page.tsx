import { Suspense } from 'react';
import { Chart } from '@/components/Chart';
import { ExtraHome } from '@/components/ExtraHome';
import { NoticeBoard } from '@/components/NoticeBoard';
import { fetchSchoolConfig } from '@/queries/school.queries';

export const revalidate = 60;

export default async function Home() {
  const school = await fetchSchoolConfig();

  return (
    <>
      <NoticeBoard />
      <Chart school={school} />
      <Suspense fallback={null}>
        <ExtraHome />
      </Suspense>
    </>
  );
}
