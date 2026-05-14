import { NoticeBoard } from "@/components/NoticeBoard";

export const revalidate = 60;

export default function Home() {
  return (
    <>
      <NoticeBoard />
    </>
  );
}
