import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

type StatColor = "default" | "amber" | "emerald" | "red" | "blue" | "violet" | "indigo";

interface StatsCardProps {
    label: string;
    value: string | number;
    color?: StatColor;
    icon?: React.ReactNode;
    className?: string;
    loading: boolean;
}

const colorMap: Record<StatColor, { label: string; value: string }> = {
    default: {
        label: "text-muted-foreground",
        value: "text-gray-900 dark:text-white",
    },
    amber: {
        label: "text-amber-500",
        value: "text-amber-600 dark:text-amber-400",
    },
    emerald: {
        label: "text-emerald-500",
        value: "text-emerald-600 dark:text-emerald-400",
    },
    red: {
        label: "text-red-500",
        value: "text-red-600 dark:text-red-400",
    },
    blue: {
        label: "text-primary",
        value: "text-primary dark:text-primary/70",
    },
    violet: {
        label: "text-violet-500",
        value: "text-violet-600 dark:text-violet-400",
    },
    indigo: {
        label: "text-indigo-500",
        value: "text-primary dark:text-indigo-400",
    },
};

/**
 * Reusable stat card for displaying a single metric.
 *
 * Usage:
 * ```tsx
 * <StatsCard label="Total Registrations" value={42} />
 * <StatsCard label="Pending" value={12} color="amber" />
 * <StatsCard label="Approved" value={30} color="emerald" />
 * ```
 */
const StatsCard: React.FC<StatsCardProps> = ({
    label,
    value,
    color = "default",
    icon,
    className = "",
    loading ,
}) => {
    const colors = colorMap[color];

    return (
        <div
            className={`bg-card p-6 rounded-xl border border-border dark:border-gray-700 shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className={`text-sm mb-1 font-medium ${colors.label}`}>{label}</p>
                    {loading ? (
                        <Skeleton className="h-8 w-15 mt-1" />
                    ) : (
                        <h4 className={`text-2xl font-bold ${colors.value}`}>{value}</h4>
                    )}
                </div>
                {icon && (
                    <div className={`p-2 rounded-lg bg-muted/50 dark:bg-gray-700 ${colors.label}`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
