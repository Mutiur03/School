import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";

const LogoutConfirmation = ({ onClick, sidebarExpanded }) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div className="absolute bottom-0 left-0 w-full px-4 py-2 border-t border-border bg-sidebar">
          <button
            className={`flex items-center w-full px-3 py-2 rounded-md transition-all duration-200 hover:inset-1 hover:inset-ring ${
              sidebarExpanded ? "gap-3" : "justify-center"
            }`}
          >
            <LogOut className="flex-shrink-0 h-4 w-4 text-lg" />
            {sidebarExpanded && (
              <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                Logout
              </span>
            )}
          </button>
        </div>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be logged out of your account. This action cannot be
            undone. To log out, click the "Logout" button.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onClick}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Logout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LogoutConfirmation;
