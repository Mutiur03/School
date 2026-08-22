import NextLink from 'next/link';
import type { ComponentProps } from 'react';

type LinkProps = ComponentProps<typeof NextLink>;

/** Paths that should prefetch on viewport. Edit this list to expand later. */
const PREFETCH_PATHS = ['/', '/notices', '/at-a-glance'] as const;

const PREFETCH_PATH_SET = new Set<string>(PREFETCH_PATHS);

function hrefPathname(href: LinkProps['href']): string {
  if (typeof href === 'string') return href.split(/[?#]/)[0] ?? '';
  if (typeof href === 'object' && href && 'pathname' in href) {
    return href.pathname ?? '';
  }
  return '';
}

/**
 * App-wide Link: prefetch off by default.
 * Paths in `PREFETCH_PATHS` are prefetched unless `prefetch` is set explicitly.
 */
export default function Link({ prefetch, href, ...props }: LinkProps) {
  return (
    <NextLink
      prefetch={prefetch ?? PREFETCH_PATH_SET.has(hrefPathname(href))}
      href={href}
      {...props}
    />
  );
}
