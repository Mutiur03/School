/**
 * System status: real (non-mock) diagnostics for the foundation — config, tenant resolution,
 * branding source, session state and a live API probe against GET /api/school.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { PageLayout } from '@/components/layout/PageLayout';
import { StatusBadge, type StatusKind } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { ErrorMessage } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { appConfig, configIssues } from '@/config/env';
import { isApiError } from '@/lib/api';
import { useApi, useSession } from '@/session/ApiProvider';
import { useTenant } from '@/tenant/TenantProvider';

function Row({ label, value, tone }: { label: string; value: string; tone?: StatusKind }) {
  return (
    <View className="border-border flex-row flex-wrap items-center gap-3 border-t py-2.5">
      <Text size="sm" weight="medium" color="mutedForeground" className="w-40">
        {label}
      </Text>
      {tone ? (
        <StatusBadge status={tone} label={value} />
      ) : (
        <Text size="sm" className="min-w-40 flex-1" selectable>
          {value}
        </Text>
      )}
    </View>
  );
}

type Probe =
  | { state: 'idle' | 'running' }
  | { state: 'ok'; detail: string }
  | { state: 'error'; detail: string };

export default function SystemStatusScreen() {
  const { school } = useApi();
  const tenant = useTenant();
  const session = useSession();
  const [probe, setProbe] = useState<Probe>({ state: 'idle' });

  const runProbe = async () => {
    setProbe({ state: 'running' });
    try {
      const info = await school.getPublicInfo();
      setProbe({ state: 'ok', detail: `Resolved school #${info.id}: ${info.name}` });
    } catch (error) {
      const detail = isApiError(error)
        ? `${error.kind}${error.status ? ` ${error.status}` : ''}: ${error.message}`
        : String(error);
      setProbe({ state: 'error', detail });
    }
  };

  return (
    <PageLayout
      title="System status"
      description="Expo-only diagnostics: live configuration and connectivity for this build. Not mock data."
    >
      <SectionCard title="Build configuration">
        <Row
          label="Environment"
          value={appConfig.appEnv}
          tone={appConfig.appEnv === 'production' ? 'active' : 'pending'}
        />
        <Row label="Platform" value={appConfig.platform} />
        <Row label="API base URL" value={appConfig.apiBaseUrl || '(same origin)'} />
        <Row label="CDN URL" value={appConfig.cdnUrl || '(not set)'} />
        {configIssues.map((issue) => (
          <Row key={issue.message} label={issue.key} value={issue.message} tone="rejected" />
        ))}
      </SectionCard>

      <SectionCard title="Tenant">
        <Row label="Tenant key" value={tenant.resolution.tenantKey} />
        <Row label="Resolved from" value={tenant.resolution.source} />
        <Row
          label="Branding"
          value={tenant.source}
          tone={
            tenant.source === 'server'
              ? 'active'
              : tenant.source === 'cache'
                ? 'approved'
                : 'inactive'
          }
        />
        <Row label="Display name" value={tenant.branding.displayName} />
        {tenant.error ? <Row label="Branding error" value={tenant.error} tone="rejected" /> : null}
      </SectionCard>

      <SectionCard title="Session">
        <Row
          label="Status"
          value={session.status}
          tone={
            session.status === 'authenticated'
              ? 'active'
              : session.status === 'unknown'
                ? 'pending'
                : 'inactive'
          }
        />
        <Row label="Role" value={session.user?.role ?? '—'} />
      </SectionCard>

      <SectionCard
        title="API connectivity"
        description="Calls GET /api/school through the shared API client."
      >
        <View className="flex-row flex-wrap items-center gap-3">
          <Button
            label={probe.state === 'running' ? 'Checking…' : 'Run check'}
            disabled={probe.state === 'running'}
            onPress={runProbe}
            testID="api-probe"
          />
          {probe.state === 'ok' ? <StatusBadge status="approved" label={probe.detail} /> : null}
          {probe.state === 'error' ? <ErrorMessage message={probe.detail} /> : null}
        </View>
      </SectionCard>
    </PageLayout>
  );
}
