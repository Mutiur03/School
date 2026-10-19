import { useWindowDimensions } from 'react-native';
import { breakpoints } from '@/theme/tokens';

/**
 * mobile  < 768: bottom tabs (the web dashboard hides its sidebar behind a burger here)
 * desktop >= 768: persistent 250px sidebar, exactly like the web dashboard's `md:` layout
 */
export type Breakpoint = 'mobile' | 'desktop';

export function breakpointForWidth(width: number): Breakpoint {
  return width >= breakpoints.md ? 'desktop' : 'mobile';
}

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  return breakpointForWidth(width);
}

/** Tailwind-style width checks (`sm:`, `lg:`) for page-level grids and padding. */
export function useMinWidth(key: keyof typeof breakpoints): boolean {
  const { width } = useWindowDimensions();
  return width >= breakpoints[key];
}
