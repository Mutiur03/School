import React from "react";
import { cn } from "@/lib/utils";
import { Eye, Pencil, Trash2, Upload, RotateCw } from "lucide-react";

type ActionVariant = "blue" | "emerald" | "gray" | "red" | "amber";
type ActionType = "view" | "edit" | "delete" | "photo" | "reactivate";

const variantClasses: Record<ActionVariant, string> = {
    blue: "text-blue-700 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:hover:bg-blue-900/30",
    emerald: "text-emerald-700 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/10 dark:text-emerald-300 dark:hover:bg-emerald-900/30",
    gray: "text-gray-700 bg-muted hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600",
    red: "text-red-700 bg-red-100 hover:bg-red-200 dark:bg-red-900/10 dark:text-red-300 dark:hover:bg-red-900/30",
    amber: "text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:hover:bg-amber-900/30",
};

const actionDefaults: Record<ActionType, { variant: ActionVariant; icon: React.ReactNode; label: string }> = {
    view: { variant: "blue", icon: <Eye size={14} />, label: "View" },
    edit: { variant: "emerald", icon: <Pencil size={14} />, label: "Edit" },
    delete: { variant: "red", icon: <Trash2 size={14} />, label: "Delete" },
    photo: { variant: "gray", icon: <Upload size={14} />, label: "Photo" },
    reactivate: { variant: "amber", icon: <RotateCw size={14} />, label: "Reactivate" },
};

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    action?: ActionType;
    variant?: ActionVariant;
    icon?: React.ReactNode;
    label?: string;
    asLabel?: boolean;
    htmlFor?: string;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
    ({ action, variant, icon, label, className, children, asLabel, htmlFor, ...props }, ref) => {
        const defaults = action ? actionDefaults[action] : null;
        const resolvedVariant = variant ?? defaults?.variant ?? "gray";
        const resolvedIcon = icon ?? defaults?.icon;
        const resolvedLabel = label ?? defaults?.label;

        const base = "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-sm transition-colors cursor-pointer";

        const content = (
            <>
                {resolvedIcon}
                {resolvedLabel ?? children}
            </>
        );

        if (asLabel) {
            return (
                <label
                    htmlFor={htmlFor}
                    className={cn(base, variantClasses[resolvedVariant], className)}
                >
                    {content}
                </label>
            );
        }

        return (
            <button
                ref={ref}
                type="button"
                className={cn(base, variantClasses[resolvedVariant], className)}
                {...props}
            >
                {content}
            </button>
        );
    }
);

ActionButton.displayName = "ActionButton";

export default ActionButton;

