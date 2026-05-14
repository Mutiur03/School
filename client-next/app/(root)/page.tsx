import { NoticeBoard } from "@/components/NoticeBoard";

export const dynamic = "force-dynamic";
export const runtime = "edge";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Home() {
  return (
    <>
      <NoticeBoard />
    </>
  );
}
