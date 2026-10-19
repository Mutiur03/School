/**
 * The platform access code (server env PLATFORM_ACCESS_CODE). Typed or scanned in the mobile app's
 * school-code box it opens super-admin sign-in; it does not sign anyone in. Hidden until revealed.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Copy, Eye, EyeOff, KeyRound } from 'lucide-react';
import QRCode from 'qrcode';
import { SectionCard } from '@/components';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function PlatformAccessCode() {
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [shown, setShown] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    axios
      .get<{ data: { code: string | null } }>('/api/auth/super_admin/platform-code')
      .then((res) => active && setCode(res.data?.data?.code ?? null))
      .catch(() => active && setCode(null));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!shown || !code) return setQr(null);
    let active = true;
    QRCode.toDataURL(code, { margin: 1, width: 200, errorCorrectionLevel: 'M' })
      .then((url) => active && setQr(url))
      .catch(() => active && setQr(null));
    return () => {
      active = false;
    };
  }, [shown, code]);

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <SectionCard title="App sign-in code" icon={<KeyRound size={20} />}>
      <p className="text-muted-foreground mb-4 text-sm">
        Enter or scan this in the mobile app&apos;s school-code screen to open super-admin sign-in.
        It only opens the sign-in screen; your email and password are still required.
      </p>
      {code === undefined ? (
        <Skeleton className="h-9 w-40" />
      ) : code === null ? (
        <p className="text-muted-foreground text-sm">
          Not configured. Set PLATFORM_ACCESS_CODE on the server to enable it.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted rounded px-3 py-1.5 font-mono text-lg tracking-widest">
              {shown ? code : '•••-••••'}
            </code>
            <Button variant="outline" size="sm" onClick={() => setShown((s) => !s)}>
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {shown ? 'Hide' : 'Show'}
            </Button>
            <Button variant="outline" size="sm" onClick={copy}>
              <Copy className="h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          {shown &&
            (qr ? (
              <img src={qr} alt="QR code for the app sign-in code" width={200} height={200} />
            ) : (
              <Skeleton className="h-[200px] w-[200px]" />
            ))}
        </div>
      )}
    </SectionCard>
  );
}
