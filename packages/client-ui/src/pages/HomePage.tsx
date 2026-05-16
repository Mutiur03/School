import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { ExtraHome } from "@/components/ExtraHome";
import { NoticeBoard } from "@/components/NoticeBoard";
import { Chart } from "@/components/Chart";
import { useSchoolConfig } from "@/context/school";
import { useCitizenCharter,  useRoutinePDF, useSyllabuses } from "@/hooks/useSchoolData";
import { getFileUrl } from "@/lib/backend";

export type HomePageProps = {
  noticesLimit?: number;
};

export function Home() {
  const school = useSchoolConfig();
  const queryClient = useQueryClient();

  useEffect(() => {
    document.title = school?.name?.en || "Home";
  }, [school]);

  const getLatestSyllabusForClass = async (classNum: number) => {
    const currentSyllabuses = await useSyllabuses(queryClient);
    const list = (currentSyllabuses as any[]).filter((s: any) => s.class === classNum);
    if (list.length > 0) {
      const latest = list.reduce(
        (max: any, cur: any) => (cur.year > max.year ? cur : max),
        list[0],
      );
      window.open(getFileUrl(latest.pdf_url), "_blank", "noopener,noreferrer");
    }
  };

  const openRootineInNewTab = async (e: any) => {
    e.preventDefault();
    const pdfUrl = await useRoutinePDF(queryClient);
    if (pdfUrl) {
      window.open(getFileUrl(pdfUrl), "_blank", "noopener,noreferrer");
    }
  };

  const openCitizenCharterInNewTab = async () => {
    const url = await useCitizenCharter(queryClient);
    if (url) {
      window.open(getFileUrl(url), "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      <NoticeBoard />
      <Chart
        onRoutineClick={openRootineInNewTab}
        onSyllabusClick={getLatestSyllabusForClass}
        onCitizenCharterClick={openCitizenCharterInNewTab}
      />
      <ExtraHome />
    </>
  );
}
