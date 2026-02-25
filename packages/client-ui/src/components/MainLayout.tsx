import * as React from "react";
import { Outlet, useLocation } from "react-router-dom";

export type MainLayoutProps = {
  header?: React.ReactNode;
  navbar?: React.ReactNode;
  topBanner?: React.ReactNode;
  rightSidebar?: React.ReactNode;
  footer?: React.ReactNode;
};

export function MainLayout({
  header,
  navbar,
  topBanner,
  rightSidebar,
  footer,
}: MainLayoutProps) {
  const location = useLocation();

  const routesWithoutSidebar = [
    "/registration/ssc",
    "/reg/ssc",
    "/registration/class-6",
    "/reg/class-6",
    "/admission",
    "/teacher-list",
    "/staff-list",
    "/gallery/*",
  ];

  const shouldHideSidebar = routesWithoutSidebar.some((route) => {
    if (route.endsWith("/*")) {
      const base = route.slice(0, -2);
      return (
        location.pathname === base || location.pathname.startsWith(base + "/")
      );
    }
    return (
      location.pathname === route || location.pathname.startsWith(route + "/")
    );
  });

  return (
    <>
      <div className="container">
        {header}
        {navbar}
        <hr className="border-t border-gray-300" />
        {topBanner}

        <div className="min-h-screen text-black">
          <br />
          <div className={shouldHideSidebar ? "main-content-full" : "main-content"}>
            <div className="content-part-1">
              <Outlet />
            </div>

            {!shouldHideSidebar && rightSidebar ? (
              <div className="content-part-2">
                <div className="secondary-content">{rightSidebar}</div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {footer}
    </>
  );
}
