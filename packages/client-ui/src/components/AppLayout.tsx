import * as React from "react";

import { Footer } from "./Footer";
import { Header } from "./Header";
import { MainLayout } from "./MainLayout";
import { Navbar } from "./Navbar";
import { RightSidebar } from "./RightSidebar";
import { TopBanner } from "./TopBanner";

export type AppLayoutProps = {
  header?: React.ReactNode;
  navbar?: React.ReactNode;
  topBanner?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  footer?: React.ReactNode;
};

export function AppLayout({
  header,
  navbar,
  topBanner,
  rightSidebar,
  footer,
}: AppLayoutProps) {
  return (
    <MainLayout
      header={header ?? <Header />}
      navbar={navbar ?? <Navbar />}
      topBanner={topBanner ?? <TopBanner />}
      rightSidebar={rightSidebar ?? <RightSidebar />}
      footer={footer ?? <Footer />}
    />
  );
}
