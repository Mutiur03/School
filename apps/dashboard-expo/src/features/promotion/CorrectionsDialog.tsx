/** Port of dashboard/src/pages/Admin/CorrectionsDialog.tsx: "Correct mistakes" with a dry run per option. */
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Dialog } from '@/components/ui/Dialog';
import { ErrorState, LoadingState, Notice } from '@/components/ui/states';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import type { CorrectionKey } from '@/lib/api';
import { useApi } from '@/session/ApiProvider';
import { privateQueryKey } from '@/tenant/query-keys';
import { useTenant } from '@/tenant/TenantProvider';
import { blockedCount, CORRECTION_OPTIONS, correctionsMessages } from './model';

export function CorrectionsDialog({
  year,
  open,
  onClose,
}: {
  year: number;
  open: boolean;
  onClose: () => void;
}) {
  const { promotions } = useApi();
  const { resolution } = useTenant();
  const toast = useToast();
  const [chosen, setChosen] = useState<Partial<Record<CorrectionKey, boolean>>>({});
  const q = useQuery({
    queryKey: privateQueryKey(resolution.tenantKey, 'promotion-corrections', year),
    queryFn: ({ signal }) => promotions.correctionsPlan(year, signal),
    enabled: open,
    // A dry run must never be served stale: it decides what gets deleted.
    gcTime: 0,
  });
  const close = () => {
    setChosen({});
    onClose();
  };
  const apply = useAdminMutation({
    mutationFn: (options: Partial<Record<CorrectionKey, boolean>>) =>
      promotions.applyCorrections(year, options),
    invalidate: [['students'], ['promotion-stats'], ['promotion-corrections'], ['dashboard']],
    success: () => null,
    failure: 'Could not apply corrections',
    onSuccess: (r, options) => {
      const [head, ...rest] = correctionsMessages(r, options);
      toast.success(head!);
      for (const line of rest) toast.success(line);
      close();
    },
  });

  const picked = CORRECTION_OPTIONS.filter((o) => chosen[o.key]);
  const preview = q.data;
  const blocked = preview ? blockedCount(preview, chosen) : 0;

  return (
    <Dialog
      open={open}
      onClose={apply.isPending ? () => {} : close}
      title={`Correct mistakes · session ${year}`}
      description="Choose one or more. Nothing changes until you apply, and marks already entered in the next year are never deleted."
      size="lg"
      testID="corrections-dialog"
      footer={
        <>
          <Button variant="outline" label="Cancel" onPress={close} disabled={apply.isPending} />
          <Button
            variant="destructive"
            label={
              apply.isPending
                ? 'Applying…'
                : `Apply ${picked.length || ''} correction${picked.length === 1 ? '' : 's'}`
            }
            disabled={!picked.length || blocked > 0 || apply.isPending}
            onPress={() => apply.mutate(chosen)}
            testID="corrections-apply"
          />
        </>
      }
    >
      {q.isError ? (
        <ErrorState
          title="Couldn't check corrections"
          message={q.error.message}
          onRetry={() => void q.refetch()}
        />
      ) : !preview ? (
        <LoadingState label="Checking what can be corrected…" />
      ) : (
        <View className="gap-3">
          {CORRECTION_OPTIONS.map((o) => {
            const available = preview[o.key].available;
            const marks = o.blocked?.(preview) ?? 0;
            return (
              <View
                key={o.key}
                className={`border-border gap-1 rounded-lg border p-3 ${available ? '' : 'opacity-60'}`}
              >
                <Checkbox
                  checked={!!chosen[o.key]}
                  disabled={!available || apply.isPending}
                  onChange={(v) => setChosen((c) => ({ ...c, [o.key]: v }))}
                  label={o.title}
                  description={available ? o.effect(preview) : o.unavailable}
                  testID={`correction-${o.key}`}
                />
                {available && marks > 0 ? (
                  <Text size="sm" weight="medium" color="destructive" className="ml-7">
                    {`Blocked: ${marks} of those ${preview.newYear} place(s) already have marks. Remove those marks first.`}
                  </Text>
                ) : null}
              </View>
            );
          })}
          {blocked > 0 ? (
            <Notice title="Blocked">
              Uncheck the blocked option or remove the marks first — nothing will be changed while
              it is selected.
            </Notice>
          ) : null}
        </View>
      )}
    </Dialog>
  );
}
