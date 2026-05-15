import { Chart } from "@/components/Chart";
import { ExtraHome } from "@/components/ExtraHome";
import { NoticeBoard } from "@/components/NoticeBoard";
import { fetchSchoolConfig } from "@/queries/school.queries";


export default async function Home() {
  const school = await fetchSchoolConfig();

  return (
    <>
      <NoticeBoard />
      <Chart school={school} />
      <ExtraHome />
    </>
  );
}
