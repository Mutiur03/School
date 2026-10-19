/** QR scanner (native). On web QrScanner renders a "type it instead" fallback. */
import { useRouter } from 'expo-router';
import { QrScanner } from '@/features/join/QrScanner';

export default function ScanScreen() {
  const router = useRouter();
  return (
    <QrScanner
      onCode={(code) => router.replace({ pathname: '/join', params: { code, auto: '1' } })}
      onCancel={() => router.replace('/join')}
    />
  );
}
