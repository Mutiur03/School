/**
 * Quick "add account head" from inside the voucher form, replicating
 * dashboard/src/pages/Admin/Accounts/QuickHeadPopup.tsx: Name (with a same-name warning), Type
 * unless the field fixes it, Cash / bank for assets, opening balance (+ As of when the school has
 * no opening date yet) and bank details. The new head is selected in the row that asked for it.
 * Live data: POST /api/acc-heads (admin, school from the session).
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { mutationErrorMessage } from '@/features/admin/errors';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import {
  ACC_TYPES,
  OPENING_SIDE,
  OPENING_TYPES,
  TYPE_LABELS,
  quickHeadClash,
  quickHeadDefaults,
  quickHeadInput,
  type QuickHeadPreset,
} from '@/features/accounts/model';
import { MONEY_KEYS, useAccHeads, useFinanceKey } from '@/features/finance/queries';
import { MoneyInput } from '@/features/finance/ui';
import type { AccHeadType } from '@school/shared-schemas';
import { useApi } from '@/session/ApiProvider';

export function QuickHeadDialog({
  preset,
  onCreated,
  onClose,
}: {
  preset: QuickHeadPreset;
  onCreated: (id: number) => void;
  onClose: () => void;
}) {
  const { accounts } = useApi();
  const toast = useToast();
  const qc = useQueryClient();
  const key = useFinanceKey();
  const flight = useSingleFlight();
  const headsQ = useAccHeads();
  const heads = headsQ.data ?? [];
  const [f, setF] = useState(() => quickHeadDefaults(preset, heads));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasOpeningDate = heads.some((h) => h.opening_date);
  const isCash = f.type === 'asset' && f.cashBank;
  const clash = quickHeadClash(heads, f.name);
  const opening = OPENING_TYPES.includes(f.type);

  const submit = () =>
    void flight.run(async () => {
      const r = quickHeadInput(f, heads);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setBusy(true);
      try {
        const id = await accounts.createHead(r.input);
        for (const k of MONEY_KEYS) void qc.invalidateQueries({ queryKey: key(...k) });
        // wait for the list so the new head is an option before it is selected
        const fresh = await headsQ.refetch();
        const created =
          id ?? fresh.data?.find((h) => h.name.toLowerCase() === r.input.name.toLowerCase())?.id;
        toast.success('Account head added.');
        if (created) onCreated(created);
        onClose();
      } catch (e) {
        toast.error(mutationErrorMessage(e, 'Failed to add the head.'));
      } finally {
        setBusy(false);
      }
    });

  return (
    <Dialog
      open
      onClose={() => (busy ? undefined : onClose())}
      title={isCash ? 'New cash / bank account' : `New ${TYPE_LABELS[f.type].toLowerCase()} head`}
      size="md"
      testID="quick-head"
      footer={
        <>
          <Button variant="outline" label="Cancel" onPress={onClose} disabled={busy} />
          <Button
            label={busy ? 'Adding…' : 'Add head'}
            onPress={submit}
            disabled={busy || !f.name.trim() || !!clash}
            testID="quick-head-submit"
          />
        </>
      }
    >
      <Field
        label="Name"
        required
        error={
          clash
            ? `"${clash.name}" already exists (${TYPE_LABELS[clash.type]}). Use a different name.`
            : (error ?? undefined)
        }
      >
        <Input
          value={f.name}
          onChangeText={(name) => setF({ ...f, name })}
          placeholder={isCash ? 'e.g. Sonali Bank A/C' : 'e.g. Tuition Fee'}
          maxLength={100}
          accessibilityLabel="Name"
          autoFocus
          testID="quick-head-name"
        />
      </Field>
      {!preset.type ? (
        <Field label="Type" required>
          <Select
            label="Type"
            value={f.type}
            onChange={(type: AccHeadType) => setF({ ...f, type })}
            options={ACC_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
          />
        </Field>
      ) : null}
      {!preset.type && f.type === 'asset' ? (
        <Checkbox
          checked={f.cashBank}
          onChange={(cashBank) => setF({ ...f, cashBank })}
          label="Cash / bank account"
        />
      ) : null}
      {opening ? (
        <FieldRow>
          <Field label={`Opening balance (${OPENING_SIDE[f.type] ?? ''})`}>
            <MoneyInput
              value={f.opening}
              onChange={(o) => setF({ ...f, opening: o })}
              label="Opening balance"
              allowNegative
            />
          </Field>
          {!hasOpeningDate && f.opening.trim() ? (
            <Field label="As of">
              <DateInput
                label="As of"
                value={f.openingDate}
                onChange={(openingDate) => setF({ ...f, openingDate })}
              />
            </Field>
          ) : null}
        </FieldRow>
      ) : null}
      {isCash ? (
        <FieldRow>
          <Field label="Bank name">
            <Input
              value={f.bankName}
              onChangeText={(bankName) => setF({ ...f, bankName })}
              placeholder="Leave empty for cash"
              accessibilityLabel="Bank name"
            />
          </Field>
          <Field label="Account no.">
            <Input
              value={f.accountNo}
              onChangeText={(accountNo) => setF({ ...f, accountNo })}
              accessibilityLabel="Account no."
            />
          </Field>
        </FieldRow>
      ) : null}
    </Dialog>
  );
}
