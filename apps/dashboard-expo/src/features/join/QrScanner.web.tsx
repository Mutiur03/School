/** Web build: no camera scanning (keeps expo-camera out of the web bundle); type the code. */
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import type { QrScannerProps } from './QrScanner';

export function QrScanner({ onCancel }: QrScannerProps) {
  return (
    <AuthLayout
      title="Scan QR code"
      description="QR scanning is available in the mobile app. On the web, type your school code."
    >
      <Button size="lg" label="Type the code" onPress={onCancel} />
    </AuthLayout>
  );
}
