import Chart from "@/components/Chart";
import ExtraHome from "@/components/ExtraHome";
import NoticeBoard from "@/components/NoticeBoard";
import { useEffect } from "react";
import { schoolConfig } from "@/lib/info";

function Home() {
  useEffect(() => {
    document.title = schoolConfig.name.en;
  }, []);
  return (
    <>
      <NoticeBoard />
      <Chart />
      <ExtraHome />
    </>
  );
}

export default Home;
