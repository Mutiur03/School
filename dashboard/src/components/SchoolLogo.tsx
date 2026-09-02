import { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

type SchoolLogoProps = {
  logo?: string | null;
  /** Blob preview or other direct URL; takes precedence over `logo`. */
  src?: string | null;
  className?: string;
  imgClassName?: string;
  alt?: string;
};

export function SchoolLogo({ logo, src, className, imgClassName, alt = '' }: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const resolved =
    src?.trim() ||
    (logo?.trim() && !logo.trim().startsWith('pending:') ? getFileUrl(logo.trim()) : '');

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (!resolved) return;
    // Some broken/unreachable image URLs never fire load or error (e.g. blocked
    // cross-origin requests) — without this the skeleton spins forever instead
    // of falling back to the icon.
    timerRef.current = window.setTimeout(() => setFailed(true), 6000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resolved]);

  const clearLoadTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const boxClass = cn(
    'bg-muted relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border',
    className,
  );

  if (!resolved || failed) {
    return (
      <span className={boxClass}>
        <Building2 className="text-muted-foreground h-5 w-5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className={boxClass} aria-busy={!loaded}>
      {!loaded ? <Skeleton className="absolute inset-0 rounded-none" aria-hidden="true" /> : null}
      <img
        src={resolved}
        alt={alt}
        className={cn(
          'h-full w-full object-contain transition-opacity duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
        onLoad={() => {
          clearLoadTimer();
          setLoaded(true);
        }}
        onError={() => {
          clearLoadTimer();
          setFailed(true);
        }}
      />
    </span>
  );
}
