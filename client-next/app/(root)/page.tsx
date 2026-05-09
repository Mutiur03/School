import { Chart } from "@/components/Chart";
import { ExtraHome } from "@/components/ExtraHome";
import { NoticeBoard } from "@/components/NoticeBoard";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Home() {
  return (
    <>
      <NoticeBoard />
      <Chart />
      <ExtraHome />
    </>
  );
}

