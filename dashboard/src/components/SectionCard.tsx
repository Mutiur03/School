import React from "react";

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
 * <SectionCard title="Registration Settings" icon={<Settings size={20} className="text-blue-500" />}>
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
    className = "",
    noPadding = false,
    headerAction,
}) => {
    const hasHeader = title || icon || description || headerAction;

    return (
        <div
            className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}
        >
            {hasHeader && (
                <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        {icon && (
                            <span className="shrink-0 text-blue-500">{icon}</span>
                        )}
                        <div>
                            {title && (
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                                    {title}
                                </h3>
                            )}
                            {description && (
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                    {description}
                                </p>
                            )}
                        </div>
                    </div>
                    {headerAction && (
                        <div className="flex items-center gap-2 shrink-0">{headerAction}</div>
                    )}
                </div>
            )}
            <div className={noPadding ? "" : hasHeader ? "px-6 pb-6" : "p-6"}>{children}</div>
        </div>
    );
};

export default SectionCard;
