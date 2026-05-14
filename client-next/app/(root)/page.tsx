import { NoticeBoard } from "@/components/NoticeBoard";

export const revalidate = 60;
export const runtime = "edge";

export default function Home() {
  return (
    <>
      <NoticeBoard />
    </>
  );
}
