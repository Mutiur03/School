import { HomePage } from "@school/client-ui";
import { useEffect } from "react";
import { schoolConfig } from "@/lib/info";

function Home() {
  useEffect(() => {
    document.title = schoolConfig.name.en;
  }, []);
  return <HomePage documentTitle={schoolConfig.name.en} />;
}

export default Home;
