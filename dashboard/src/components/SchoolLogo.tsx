import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getFileUrl } from '@/lib/backend';
import { cn } from '@/lib/utils';

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
  const resolved =
    src?.trim() ||
    (logo?.trim() && !logo.trim().startsWith('pending:') ? getFileUrl(logo.trim()) : '');

  useEffect(() => {
    setFailed(false);
  }, [resolved]);

  const boxClass = cn(
    'bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md border',
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
    <span className={boxClass}>
      <img
        src={resolved}
        alt={alt}
        className={cn('h-full w-full object-contain', imgClassName)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
