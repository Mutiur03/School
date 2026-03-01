import React from "react";
import { CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";

type StatusVariant = "approved" | "rejected" | "pending" | "active" | "inactive" | string;

interface StatusBadgeProps {
    status: StatusVariant;
    /** Override the display label. Defaults to capitalized status string. */
    label?: string;
    className?: string;
}

const statusConfig: Record<string, { icon: React.ReactNode; className: string; label: string }> = {
    approved: {
        icon: <CheckCircle2 size={12} />,
        className:
            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
        label: "Approved",
    },
    rejected: {
        icon: <XCircle size={12} />,
        className: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        label: "Rejected",
    },
    pending: {
        icon: <AlertCircle size={12} />,
        className: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
        label: "Pending",
    },
    active: {
        icon: <CheckCircle2 size={12} />,
        className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
        label: "Active",
    },
    inactive: {
        icon: <Clock size={12} />,
        className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
        label: "Inactive",
    },
};

/**
 * Reusable status badge with icon.
 *
 * Built-in statuses: `approved`, `rejected`, `pending`, `active`, `inactive`.
 * Falls back to a neutral gray badge for unknown statuses.
 *
 * Usage:
 * ```tsx
 * <StatusBadge status="approved" />
 * <StatusBadge status="pending" />
 * <StatusBadge status="rejected" label="Denied" />
 * ```
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = "" }) => {
    const config = statusConfig[status.toLowerCase()] ?? {
        icon: <AlertCircle size={12} />,
        className: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
        label: status,
    };

    return (
        <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className} ${className}`}
        >
            {config.icon}
            {label ?? config.label}
        </span>
    );
};

export default StatusBadge;
