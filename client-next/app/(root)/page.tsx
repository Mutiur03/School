import { Chart } from "@/components/Chart";
import { ExtraHome } from "@/components/ExtraHome";
import { NoticeBoard } from "@/components/NoticeBoard";

export default function Home() {
  return (
    <>
      <NoticeBoard />
      <Chart />
      <ExtraHome />
    </>
  );
}

