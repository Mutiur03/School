import React, { useEffect } from "react";

type PopupSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface PopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    size?: PopupSize;
    className?: string;
}

const sizeClasses: Record<PopupSize, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-5xl",
};

const Popup = ({ open, onOpenChange, children, size = "full", className = "" }: PopupProps) => {
    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [open, onOpenChange]);

    // Prevent body scroll while open
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => onOpenChange(false)}
        >
            <div
                className={`bg-white text-gray-900 dark:bg-gray-800 dark:text-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto overflow-hidden ${sizeClasses[size]} ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

export default Popup;
