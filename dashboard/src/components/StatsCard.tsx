import React from "react";

type StatColor = "default" | "amber" | "emerald" | "red" | "blue" | "violet" | "indigo";

interface StatsCardProps {
    label: string;
    value: string | number;
    color?: StatColor;
    icon?: React.ReactNode;
    className?: string;
}

const colorMap: Record<StatColor, { label: string; value: string }> = {
    default: {
        label: "text-gray-500",
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
        label: "text-blue-500",
        value: "text-blue-600 dark:text-blue-400",
    },
    violet: {
        label: "text-violet-500",
        value: "text-violet-600 dark:text-violet-400",
    },
    indigo: {
        label: "text-indigo-500",
        value: "text-indigo-600 dark:text-indigo-400",
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
}) => {
    const colors = colorMap[color];

    return (
        <div
            className={`bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm ${className}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className={`text-sm mb-1 font-medium ${colors.label}`}>{label}</p>
                    <h4 className={`text-2xl font-bold ${colors.value}`}>{value}</h4>
                </div>
                {icon && (
                    <div className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700 ${colors.label}`}>
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsCard;
