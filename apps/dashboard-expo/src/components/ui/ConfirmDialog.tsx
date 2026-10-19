/** Port of dashboard/src/components/ConfirmationPopup.tsx: message + Cancel / destructive confirm. */
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Text } from './Text';

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel,
  busy,
  tone = 'destructive',
  onConfirm,
  onClose,
}: {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  tone?: 'destructive' | 'default';
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      size="md"
      testID="confirm-dialog"
      footer={
        <>
          <Button
            testID="confirm-dialog-cancel"
            variant="outline"
            label="Cancel"
            onPress={onClose}
            disabled={busy}
          />
          <Button
            testID="confirm-dialog-confirm"
            variant={tone}
            label={confirmLabel}
            onPress={onConfirm}
            disabled={busy}
          />
        </>
      }
    >
      <Text size="sm" color="mutedForeground">
        {message}
      </Text>
    </Dialog>
  );
}
