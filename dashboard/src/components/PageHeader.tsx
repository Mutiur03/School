import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Reusable page header with title, optional description, and optional right-side actions.
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Class Six Registration"
 *   description="Manage student registrations for Class Six."
 * />
 * ```
 */
const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  className = '',
  children,
}) => {
  return (
    <div className={`mb-8 flex flex-wrap items-start justify-between gap-4 ${className}`}>
      <div>
        <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        {description && (
          <p className="text-muted-foreground text-sm dark:text-gray-400">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
};

export default PageHeader;
