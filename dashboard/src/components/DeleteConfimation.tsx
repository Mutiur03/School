import type { ReactNode } from 'react';
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
} from '@/components/ui/alert-dialog';
import ActionButton from '@/components/ActionButton';

const DeleteConfirmation = ({
  onDelete,
  msg,
  trigger,
  confirmLabel = 'Confirm Delete',
  title = 'Are you absolutely sure?',
}: {
  onDelete: () => void;
  msg?: string;
  trigger?: ReactNode;
  confirmLabel?: string;
  title?: string;
}) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger ?? <ActionButton action="delete" />}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {msg ||
              'This action cannot be undone. This will permanently delete the item from your database.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-red-600 text-white hover:bg-red-700">
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteConfirmation;
