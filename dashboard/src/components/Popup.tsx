import React, { useEffect, useId, useRef } from "react";

type PopupSize = "sm" | "md" | "lg" | "xl" | "2xl" | "full";

interface PopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    size?: PopupSize;
    className?: string;
    /** Accessible name when children don't include a visible title */
    "aria-label"?: string;
    "aria-labelledby"?: string;
}

const sizeClasses: Record<PopupSize, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-5xl",
};

const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Popup = ({
    open,
    onOpenChange,
    children,
    size = "full",
    className = "",
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
}: PopupProps) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);
    const titleId = useId();

    useEffect(() => {
        if (!open) return;

        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const focusFirst = () => {
            const root = dialogRef.current;
            if (!root) return;
            const focusable = root.querySelectorAll<HTMLElement>(FOCUSABLE);
            (focusable[0] ?? root).focus();
        };
        // Wait a frame so content is mounted
        const raf = requestAnimationFrame(focusFirst);

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onOpenChange(false);
                return;
            }
            if (e.key !== "Tab" || !dialogRef.current) return;
            const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
            if (focusable.length === 0) {
                e.preventDefault();
                dialogRef.current.focus();
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKey);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
            lastFocusedRef.current?.focus();
        };
    }, [open, onOpenChange]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            style={{ overscrollBehavior: "contain" }}
            onClick={() => onOpenChange(false)}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={ariaLabel}
                aria-labelledby={ariaLabelledBy ?? (!ariaLabel ? titleId : undefined)}
                tabIndex={-1}
                className={`bg-white text-gray-900 dark:bg-gray-800 dark:text-white rounded-xl shadow-xl w-full max-h-[90vh] overflow-y-auto outline-none ${sizeClasses[size]} ${className}`}
                style={{ overscrollBehavior: "contain" }}
                onClick={(e) => e.stopPropagation()}
            >
                {!ariaLabel && !ariaLabelledBy ? (
                    <span id={titleId} className="sr-only">
                        Dialog
                    </span>
                ) : null}
                {children}
            </div>
        </div>
    );
};

export default Popup;
