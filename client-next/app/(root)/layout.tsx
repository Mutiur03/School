import { RightSidebar } from "@/components/RightSidebar";

export const revalidate = 60;

export default async function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen text-black">
      <br />
      <div className="main-content">
        <div className="content-part-1">{children}</div>

        <div className="content-part-2">
          <div className="secondary-content">
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
