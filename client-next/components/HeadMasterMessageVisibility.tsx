"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type HeadMasterMessageVisibilityProps = {
  children: ReactNode;
};

export function HeadMasterMessageVisibility({
  children,
}: HeadMasterMessageVisibilityProps) {
  const pathname = usePathname();

  if (pathname !== "/" && pathname !== "") return null;

  return <>{children}</>;
}
