/**
 * School codes, replicating dashboard/src/pages/Admin/SchoolCodes.tsx: "Codes the mobile app uses
 * to find your school before signing in", role hint select + Create code, the Codes card
 * ("N active of M") with Code / Role / Created / Status and QR code / Revoke actions, the QR
 * dialog and the revoke confirmation.
 * Live data: GET/POST /api/school-codes, DELETE /api/school-codes/:id (Nest, admin only; the
 * school comes from the host + token).
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { PageLayout } from '@/components/layout/PageLayout';
import { ActionButton } from '@/components/ui/ActionButton';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Dialog } from '@/components/ui/Dialog';
import { Ban, Plus, QrCode } from '@/components/ui/icons';
import { SectionCard } from '@/components/ui/SectionCard';
import { Select } from '@/components/ui/Select';
import { ErrorState } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { formatBillingDate } from '@/features/billing/model';
import { ROLE_LABEL, qrMatrix, qrPath } from '@/features/school-codes/qr';
import type { RoleHint, SchoolCode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';

const STATUS_CLASS: Record<SchoolCode['status'], { box: string; text: string }> = {
  active: { box: 'bg-emerald-50 border-emerald-600/20', text: 'text-emerald-700' },
  revoked: { box: 'bg-red-50 border-red-600/20', text: 'text-red-700' },
  expired: { box: 'bg-gray-50 border-gray-500/20', text: 'text-gray-600' },
};

function StatusPill({ status }: { status: SchoolCode['status'] }) {
  const c = STATUS_CLASS[status];
  return (
    <View className={cn('self-start rounded-md border px-2 py-0.5', c.box)}>
      <Text size="xs" weight="medium" className={cn('capitalize', c.text)}>
        {status}
      </Text>
    </View>
  );
}

export function CodeQr({ code, size = 240 }: { code: string; size?: number }) {
  const m = useMemo(() => qrMatrix(code), [code]);
  const total = m.size + 2;
  return (
    <View accessibilityLabel={`QR code for ${code}`} testID="school-code-qr">
      <Svg width={size} height={size} viewBox={`0 0 ${total} ${total}`}>
        <Rect x={0} y={0} width={total} height={total} fill="#ffffff" />
        <Path d={qrPath(m, 1)} fill="#000000" />
      </Svg>
    </View>
  );
}

export function SchoolCodesScreen() {
  const { schoolCodes } = useApi();
  const { resolution } = useTenant();
  const [role, setRole] = useState<RoleHint | ''>('');
  const [qrFor, setQrFor] = useState<SchoolCode | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<SchoolCode | null>(null);

  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'school-codes'),
    queryFn: ({ signal }) => schoolCodes.list(signal),
  });
  const codes = q.data ?? [];
  const active = codes.filter((c) => c.status === 'active').length;

  const create = useAdminMutation({
    mutationFn: (r: RoleHint | null) => schoolCodes.create(r),
    invalidate: [['school-codes']],
    success: 'School code created',
    failure: 'Error creating school code',
  });
  const revoke = useAdminMutation({
    mutationFn: (id: number) => schoolCodes.revoke(id),
    invalidate: [['school-codes']],
    success: 'School code revoked',
    failure: 'Error revoking school code',
    onSuccess: () => setRevokeTarget(null),
  });

  const actions = (c: SchoolCode) => (
    <View className="flex-row gap-0.5">
      <ActionButton
        icon={QrCode}
        label={`QR code for ${c.code}`}
        tone="blue"
        disabled={c.status !== 'active'}
        onPress={() => setQrFor(c)}
      />
      <ActionButton
        icon={Ban}
        label={`Revoke ${c.code}`}
        tone="red"
        disabled={c.status !== 'active'}
        onPress={() => setRevokeTarget(c)}
      />
    </View>
  );
  const columns: Column<SchoolCode>[] = [
    {
      key: 'code',
      label: 'Code',
      className: 'min-w-0 flex-1',
      render: (c) => (
        <Text size="sm" weight="semibold" className="font-mono tracking-wider">
          {c.code}
        </Text>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      className: 'w-32',
      render: (c) => <Text size="sm">{c.role_hint ? ROLE_LABEL[c.role_hint] : 'Any'}</Text>,
    },
    {
      key: 'created',
      label: 'Created',
      className: 'w-36',
      render: (c) => (
        <Text size="sm" color="mutedForeground" tabular>
          {formatBillingDate(c.created_at)}
        </Text>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'w-28',
      render: (c) => <StatusPill status={c.status} />,
    },
    { key: 'actions', label: ' ', className: 'w-[88px]', align: 'right', render: actions },
  ];

  return (
    <PageLayout
      title="School codes"
      description="Codes the mobile app uses to find your school before signing in."
      actions={
        <>
          <Select
            label="Role hint for the new code"
            value={role}
            onChange={setRole}
            options={[
              { value: '', label: 'Any role' },
              ...(Object.keys(ROLE_LABEL) as RoleHint[]).map((r) => ({
                value: r,
                label: ROLE_LABEL[r],
              })),
            ]}
            className="w-36"
          />
          <Button
            icon={Plus}
            label={create.isPending ? 'Creating…' : 'Create code'}
            disabled={create.isPending}
            onPress={() => create.mutate(role || null)}
            testID="create-code"
          />
        </>
      }
      onRefresh={() => void q.refetch()}
      refreshing={q.isRefetching}
    >
      {q.isError && !q.data ? (
        <ErrorState
          title="Couldn't load school codes."
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : (
        <SectionCard
          title="Codes"
          description={q.isPending ? undefined : `${active} active of ${codes.length}`}
          noPadding
        >
          <DataTable
            testID="school-codes"
            rows={codes}
            columns={columns}
            rowKey={(c) => c.id}
            loading={q.isPending}
            empty="No codes yet. Create one and share it with teachers, students or other admins."
            renderMobile={(c) => (
              <View className="flex-row items-center gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text size="sm" weight="semibold" className="font-mono tracking-wider">
                    {c.code}
                  </Text>
                  <Text size="xs" color="mutedForeground" tabular>
                    {c.role_hint ? ROLE_LABEL[c.role_hint] : 'Any role'} ·{' '}
                    {formatBillingDate(c.created_at)}
                  </Text>
                </View>
                <StatusPill status={c.status} />
                {actions(c)}
              </View>
            )}
          />
        </SectionCard>
      )}

      <Dialog
        open={qrFor !== null}
        onClose={() => setQrFor(null)}
        title="School code QR"
        size="md"
        testID="school-code-qr-dialog"
      >
        {qrFor ? (
          <View className="items-center gap-3">
            <CodeQr code={qrFor.code} />
            <Text size="xl" weight="bold" className="font-mono tracking-widest">
              {qrFor.code}
            </Text>
            <Text size="sm" color="mutedForeground" className="text-center">
              Scan in the School Dashboard app, or type the code
              {qrFor.role_hint
                ? ` (opens ${ROLE_LABEL[qrFor.role_hint].toLowerCase()} sign-in)`
                : ''}
              .
            </Text>
          </View>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={revokeTarget !== null}
        title="Revoke school code?"
        message={`${revokeTarget?.code ?? ''} will stop working in the app immediately. People already signed in stay signed in.`}
        confirmLabel="Revoke"
        busy={revoke.isPending}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => revokeTarget && revoke.mutate(revokeTarget.id)}
      />
    </PageLayout>
  );
}
