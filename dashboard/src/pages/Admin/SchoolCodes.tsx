/**
 * School codes: short join codes (e.g. ABC-7K4Q) the mobile app uses to find this school before
 * login. Admins create them with an optional role hint, show them as a QR code, and revoke them.
 */
import { useEffect, useState } from 'react';
import { Ban, Loader2, Plus, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import {
  ConfirmationPopup,
  PageHeader,
  Popup,
  SectionCard,
  filterSelectClassName,
} from '@/components';
import ActionButton from '@/components/ActionButton';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  useCreateSchoolCode,
  useRevokeSchoolCode,
  useSchoolCodes,
  type SchoolCode,
  type SchoolCodeRole,
} from '@/queries/school-codes.queries';

const ROLE_LABEL: Record<SchoolCodeRole, string> = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
};

const STATUS_CLASS: Record<SchoolCode['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  revoked: 'bg-red-50 text-red-700 ring-red-600/20',
  expired: 'bg-gray-50 text-gray-600 ring-gray-500/20',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** The QR holds only the code itself; the app resolves it like a typed code. */
const CodeQr = ({ code }: { code: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(code, { margin: 1, width: 240, errorCorrectionLevel: 'M' })
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(null));
    return () => {
      active = false;
    };
  }, [code]);
  return src ? (
    <img src={src} alt={`QR code for ${code}`} width={240} height={240} className="mx-auto" />
  ) : (
    <Skeleton className="mx-auto h-60 w-60" />
  );
};

export default function SchoolCodes() {
  const { data: codes = [], isLoading, isError, refetch } = useSchoolCodes();
  const createCode = useCreateSchoolCode();
  const revokeCode = useRevokeSchoolCode();
  const [role, setRole] = useState<SchoolCodeRole | ''>('');
  const [qrFor, setQrFor] = useState<SchoolCode | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SchoolCode | null>(null);

  const active = codes.filter((c) => c.status === 'active').length;

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <PageHeader
        title="School codes"
        description="Codes the mobile app uses to find your school before signing in."
      >
        <select
          aria-label="Role hint for the new code"
          value={role}
          onChange={(e) => setRole(e.target.value as SchoolCodeRole | '')}
          className={filterSelectClassName}
        >
          <option value="">Any role</option>
          {(Object.keys(ROLE_LABEL) as SchoolCodeRole[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <Button
          onClick={() => createCode.mutate(role ? { role_hint: role } : {})}
          disabled={createCode.isPending}
        >
          {createCode.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Create code
        </Button>
      </PageHeader>

      <SectionCard
        title="Codes"
        description={isLoading ? undefined : `${active} active of ${codes.length}`}
        noPadding
      >
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="text-muted-foreground flex items-center justify-between gap-4 p-4 text-sm">
            Couldn&apos;t load school codes.
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : codes.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">
            No codes yet. Create one and share it with teachers, students or other admins.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-foreground/70 text-left text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Code</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Created</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id} className="border-border border-t">
                    <td className="px-4 py-2 font-mono font-medium tracking-wider">{c.code}</td>
                    <td className="px-4 py-2">{c.role_hint ? ROLE_LABEL[c.role_hint] : 'Any'}</td>
                    <td className="text-muted-foreground px-4 py-2">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
                          STATUS_CLASS[c.status],
                        )}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-0.5">
                        <ActionButton
                          icon={<QrCode size={14} />}
                          label="QR code"
                          variant="blue"
                          disabled={c.status !== 'active'}
                          onClick={() => setQrFor(c)}
                        />
                        <ActionButton
                          icon={<Ban size={14} />}
                          label="Revoke"
                          variant="red"
                          disabled={c.status !== 'active'}
                          onClick={() => setRevokeTarget(c)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Popup
        open={!!qrFor}
        onOpenChange={(open) => !open && setQrFor(null)}
        aria-label="School code QR"
      >
        {qrFor && (
          <div className="space-y-3 p-6 text-center">
            <CodeQr code={qrFor.code} />
            <p className="font-mono text-2xl font-semibold tracking-widest">{qrFor.code}</p>
            <p className="text-muted-foreground text-sm">
              Scan in the School Dashboard app, or type the code
              {qrFor.role_hint
                ? ` (opens ${ROLE_LABEL[qrFor.role_hint].toLowerCase()} sign-in)`
                : ''}
              .
            </p>
          </div>
        )}
      </Popup>

      <ConfirmationPopup
        open={!!revokeTarget}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        title="Revoke school code?"
        msg={`${revokeTarget?.code ?? ''} will stop working in the app immediately. People already signed in stay signed in.`}
        confirmLabel="Revoke"
        onConfirm={() => {
          if (revokeTarget) revokeCode.mutate(revokeTarget.id);
          setRevokeTarget(null);
        }}
      />
    </div>
  );
}
