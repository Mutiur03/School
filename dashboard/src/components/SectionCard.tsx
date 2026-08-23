import React from 'react';

interface SectionCardProps {
  title?: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  /** If true, removes the default padding inside the card body */
  noPadding?: boolean;
  /** Optional slot rendered in the card header alongside the title */
  headerAction?: React.ReactNode;
}

/**
 * Reusable white card container matching the dashboard design system.
 *
 * Usage:
 * ```tsx
 * <SectionCard title="Registration Settings" icon={<Settings size={20} className="text-primary" />}>
 *   <p>content here</p>
 * </SectionCard>
 *
 * // Without padding (e.g., for tables):
 * <SectionCard noPadding>
 *   <table>...</table>
 * </SectionCard>
 * ```
 */
const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  description,
  children,
  className = '',
  noPadding = false,
  headerAction,
}) => {
  const hasHeader = title || icon || description || headerAction;

  return (
    <div
      className={`bg-card border-border rounded-xl border shadow-sm dark:border-gray-700 ${noPadding ? 'overflow-x-clip' : 'overflow-hidden'} ${className}`}
    >
      {hasHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="flex items-center gap-2">
            {icon && <span className="text-primary shrink-0">{icon}</span>}
            <div>
              {title && (
                <h3 className="text-lg leading-tight font-semibold text-gray-900 dark:text-white">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-muted-foreground mt-0.5 text-sm dark:text-gray-400">
                  {description}
                </p>
              )}
            </div>
          </div>
          {headerAction && (
            <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:shrink-0 sm:items-end">
              {headerAction}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? '' : hasHeader ? 'px-6 pb-6' : 'p-6'}>{children}</div>
    </div>
  );
};

export default SectionCard;
