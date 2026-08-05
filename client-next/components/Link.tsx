import NextLink from "next/link";
import type { ComponentProps } from "react";

type LinkProps = ComponentProps<typeof NextLink>;

/**
 * App-wide Link: prefetch off by default.
 * force-dynamic pages refetch on click anyway; background prefetch
 * just multiplies Vercel + API load.
 * Opt in with prefetch={true} when a specific link should warm up.
 */
export default function Link({ prefetch = false, ...props }: LinkProps) {
  return <NextLink prefetch={prefetch} {...props} />;
}
