import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmationPopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    title?: string;
    msg?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "destructive" | "default" | "outline";
}

const ConfirmationPopup = ({
    open,
    onOpenChange,
    onConfirm,
    title = "Are you absolutely sure?",
    msg,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "destructive",
}: ConfirmationPopupProps) => {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {msg || "This action cannot be undone."}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        className={cn(
                            variant === "destructive"
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground"
                        )}
                    >
                        {confirmLabel}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default ConfirmationPopup;
