import React from "react";

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
    className = "",
    children,
}) => {
    return (
        <div className={`mb-8 flex items-start justify-between gap-4 flex-wrap ${className}`}>
            <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{title}</h1>
                {description && (
                    <p className="text-muted-foreground dark:text-gray-400 text-sm">{description}</p>
                )}
            </div>
            {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
        </div>
    );
};

export default PageHeader;
