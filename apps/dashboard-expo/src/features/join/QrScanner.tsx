/** Native QR scanner for school codes (expo-camera). Only QR codes, back camera, scan once. */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { parseScannedCode } from '@/lib/api';

export interface QrScannerProps {
  onCode: (code: string) => void;
  onCancel: () => void;
}

export function QrScanner({ onCode, onCancel }: QrScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [invalid, setInvalid] = useState(false);
  const handled = useRef(false);
  const insets = useSafeAreaInsets();

  if (!permission) return <LoadingState label="Starting camera…" />;

  if (!permission.granted) {
    return (
      <AuthLayout
        title="Camera access"
        description="Allow camera access to scan your school's QR code, or type the code instead."
      >
        {permission.canAskAgain ? (
          <Button size="lg" label="Allow camera" onPress={() => void requestPermission()} />
        ) : (
          <Text size="sm" color="mutedForeground">
            Camera access is turned off. You can enable it in Settings.
          </Text>
        )}
        <Button size="lg" variant="outline" label="Type the code instead" onPress={onCancel} />
      </AuthLayout>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const code = parseScannedCode(data);
          if (!code) {
            setInvalid(true);
            return;
          }
          handled.current = true;
          onCode(code);
        }}
      />
      <View
        className="absolute left-4 right-4 gap-3"
        style={{ bottom: 24 + insets.bottom }}
        pointerEvents="box-none"
      >
        <View className="bg-card rounded-xl p-4">
          <Text size="sm" weight="medium">
            {invalid
              ? "That QR code isn't a school code."
              : "Point the camera at your school's QR code."}
          </Text>
        </View>
        <Button size="lg" variant="outline" label="Type the code instead" onPress={onCancel} />
      </View>
    </View>
  );
}
