import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorMessageProps {
    message?: string | null;
    /** "inline" = small text under a field (default), "block" = card-style alert box */
    variant?: "inline" | "block";
    className?: string;
}

const ErrorMessage = ({
    message,
    variant = "inline",
    className,
}: ErrorMessageProps) => {
    if (!message) return null;

    if (variant === "block") {
        return (
            <div
                role="alert"
                className={cn(
                    "flex items-start gap-3 rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive",
                    className
                )}
            >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{message}</span>
            </div>
        );
    }

    return (
        <p role="alert" className={cn("text-xs text-destructive", className)}>
            {message}
        </p>
    );
};

export default ErrorMessage;
