/**
 * New / edit voucher, replicating dashboard/src/pages/Admin/Accounts/VoucherForm.tsx: the Income /
 * Expense / Transfer / Journal modes (simple forms, or the journal grid; an edited voucher that
 * doesn't fit a simple form opens in the grid so nothing is lost), Date / Reference / Narration,
 * and the "Dr · Cr · Balanced" footer. Lines are built in integer paisa (voucher-model.ts), so
 * Dr = Cr is exact; Save asks for confirmation and can't be sent twice (the server has no
 * idempotency key for vouchers, so this guard is what stops a double post).
 * Not ported: the web's quick "+" add-head popup (add heads under Account Heads).
 */
import { voucherFormSchema, type VoucherType } from '@school/shared-schemas';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DateInput } from '@/components/ui/DateInput';
import { Dialog } from '@/components/ui/Dialog';
import { Field, FieldRow } from '@/components/ui/Field';
import { Plus, Trash2 } from '@/components/ui/icons';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { useAdminMutation } from '@/features/admin/useAdminMutation';
import { useSingleFlight } from '@/features/admin/useSingleFlight';
import {
  VOUCHER_LABEL,
  VOUCHER_MODES,
  headOptions,
  type QuickHeadPreset,
} from '@/features/accounts/model';
import { QuickHeadDialog } from '@/features/accounts/QuickHeadDialog';
import {
  blankGrid,
  blankRow,
  buildVoucher,
  gridFromVoucher,
  toSimple,
  voucherConfirmMessage,
  type AmountRow,
  type GridRow,
} from '@/features/accounts/voucher-model';
import { MONEY_KEYS, useAccHeads, useCostCenters } from '@/features/finance/queries';
import { MoneyInput } from '@/features/finance/ui';
import { todayYmd } from '@/features/holidays/model';
import { voucherBody, type AccHead, type Voucher, type VoucherInput } from '@/lib/api';
import { formatMoney } from '@/lib/money/money';
import { cn } from '@/lib/utils';
import { useApi } from '@/session/ApiProvider';

/** Edit needs the heads to pick the right form, so wait for them. */
export function VoucherForm({
  voucher,
  onClose,
}: {
  voucher: Voucher | null;
  onClose: () => void;
}) {
  const heads = useAccHeads();
  if (voucher && !heads.isSuccess) return null;
  return <VoucherEditor voucher={voucher} heads={heads.data ?? []} onClose={onClose} />;
}

function VoucherEditor({
  voucher,
  heads,
  onClose,
}: {
  voucher: Voucher | null;
  heads: AccHead[];
  onClose: () => void;
}) {
  const { accounts } = useApi();
  const flight = useSingleFlight();
  const centers = useCostCenters();
  const [simple] = useState(() => (voucher ? toSimple(voucher, heads) : null));
  const [type, setType] = useState<VoucherType>(voucher?.type ?? 'receipt');
  const [date, setDate] = useState(voucher?.date ?? todayYmd());
  const [reference, setReference] = useState(voucher?.reference ?? '');
  const [narration, setNarration] = useState(voucher?.narration ?? '');
  const [cashId, setCashId] = useState<number | null>(simple?.cashId ?? null);
  const [rows, setRows] = useState<AmountRow[]>(simple?.rows ?? [blankRow()]);
  const [transfer, setTransfer] = useState(
    simple?.transfer ?? { from: null, to: null, amount: '' },
  );
  const [grid, setGrid] = useState<GridRow[]>(
    voucher ? gridFromVoucher(voucher) : [blankGrid(), blankGrid()],
  );
  const [confirming, setConfirming] = useState(false);
  const [quick, setQuick] = useState<
    (QuickHeadPreset & { onCreated: (id: number) => void }) | null
  >(null);

  const useGrid = type === 'journal' || (voucher !== null && !simple);
  // heads already on this voucher stay selectable even if since deactivated
  const used = new Set(voucher?.lines.map((l) => l.head_id));
  const gridHeads = heads.filter((h) => h.is_active || used.has(h.id));
  const cashHeads = gridHeads.filter((h) => h.is_cash_bank);
  const rowHeads = gridHeads.filter((h) => h.type === (type === 'receipt' ? 'income' : 'expense'));
  const ccOptions = [
    { value: 0, label: '—' },
    ...(centers.data ?? []).filter((c) => c.is_active).map((c) => ({ value: c.id, label: c.name })),
  ];

  const built = buildVoucher({
    type,
    date,
    narration,
    reference,
    useGrid,
    cashId,
    rows,
    transfer,
    grid,
  });
  // the same zod schema the web validates with: belt and braces over the paisa checks above
  const schemaIssue = built.issue
    ? null
    : (() => {
        const r = voucherFormSchema.safeParse(voucherBody(built.input));
        return r.success ? null : (r.error.issues[0]?.message ?? 'Check the voucher');
      })();
  const issue = built.issue ?? schemaIssue;

  const save = useAdminMutation({
    mutationFn: (input: VoucherInput) =>
      voucher ? accounts.updateVoucher(voucher.id, input) : accounts.createVoucher(input),
    invalidate: MONEY_KEYS,
    success: voucher ? `Voucher ${voucher.voucher_no} saved.` : 'Voucher saved.',
    failure: 'Failed to save the voucher.',
    onSuccess: () => {
      setConfirming(false);
      onClose();
    },
  });
  const busy = save.isPending;
  const submit = () =>
    void flight.run(() => save.mutateAsync(built.input)).catch(() => setConfirming(false));

  const setRow = (i: number, patch: Partial<AmountRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setGridRow = (i: number, patch: Partial<GridRow>) =>
    setGrid((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const headSelect = (
    label: string,
    value: number | null,
    onChange: (v: number | null) => void,
    list: AccHead[],
    grouped = false,
    preset?: QuickHeadPreset,
  ) => (
    <View className="flex-row items-center gap-1">
      <View className="min-w-0 flex-1">
        <Select
          label={label}
          value={value ?? 0}
          onChange={(v) => onChange(v || null)}
          placeholder="Select head…"
          options={[
            { value: 0, label: 'Select head…' },
            ...(grouped ? headOptions(list) : list.map((h) => ({ value: h.id, label: h.name }))),
          ]}
        />
      </View>
      {preset ? (
        <Button
          variant="ghost"
          size="icon-sm"
          icon={Plus}
          accessibilityLabel={`New head for ${label}`}
          disabled={busy}
          onPress={() => setQuick({ ...preset, onCreated: (id) => onChange(id) })}
          testID="quick-head-open"
        />
      ) : null}
    </View>
  );
  const removeBtn = (onPress: () => void, disabled: boolean) => (
    <Button
      variant="ghost"
      size="icon-sm"
      icon={Trash2}
      accessibilityLabel="Remove row"
      onPress={onPress}
      disabled={disabled || busy}
    />
  );
  const headerCell = (label: string, cls: string) => (
    <Text size="xs" weight="semibold" caps className={cn('text-foreground/70', cls)}>
      {label}
    </Text>
  );

  return (
    <>
      <Dialog
        open
        onClose={() => (busy ? undefined : onClose())}
        title={voucher ? `Edit voucher ${voucher.voucher_no}` : 'New voucher'}
        size="full"
        testID="voucher-form"
        footer={
          <View className="w-full flex-row flex-wrap items-center justify-end gap-2">
            <Text size="sm" tabular className="mr-auto" testID="voucher-balance">
              {`Dr ${formatMoney(built.debit)} · Cr ${formatMoney(built.credit)}`}
              {issue ? (
                <Text size="sm" color="destructive">{` · ${issue}`}</Text>
              ) : (
                <Text size="sm" className="text-emerald-600">
                  {' '}
                  · Balanced
                </Text>
              )}
            </Text>
            <Button variant="outline" label="Cancel" onPress={onClose} disabled={busy} />
            <Button
              label={voucher ? 'Save changes' : 'Save voucher'}
              disabled={!!issue || busy}
              onPress={() => setConfirming(true)}
              testID="voucher-save"
            />
          </View>
        }
      >
        {!voucher ? (
          <View role="tablist" className="bg-muted flex-row self-start rounded-lg p-1">
            {VOUCHER_MODES.map((m) => (
              <Pressable
                key={m.type}
                role="tab"
                aria-selected={type === m.type}
                onPress={() => setType(m.type)}
                className={cn('rounded-md px-3 py-1.5', type === m.type && 'bg-background')}
                testID={`mode-${m.type}`}
              >
                <Text
                  size="sm"
                  weight="medium"
                  color={type === m.type ? 'foreground' : 'mutedForeground'}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <FieldRow cols={3}>
          <Field label="Date" required>
            <DateInput label="Date" value={date} onChange={setDate} />
          </Field>
          <Field label="Reference">
            <Input
              value={reference}
              onChangeText={setReference}
              placeholder="Receipt / cheque no."
              maxLength={100}
              accessibilityLabel="Reference"
            />
          </Field>
          <Field label="Narration">
            <Input
              value={narration}
              onChangeText={setNarration}
              maxLength={500}
              accessibilityLabel="Narration"
            />
          </Field>
        </FieldRow>

        {useGrid ? (
          <View className="gap-2" testID="voucher-grid">
            <View className="bg-muted hidden flex-row gap-2 rounded-md px-2 py-2 md:flex">
              {headerCell('Head', 'min-w-0 flex-1')}
              {headerCell('Debit', 'w-32 text-right')}
              {headerCell('Credit', 'w-32 text-right')}
              {headerCell('Cost center', 'w-40')}
              {headerCell('Note', 'w-40')}
              <View className="w-8" />
            </View>
            {grid.map((r, i) => (
              <View
                key={i}
                className="border-border flex-row flex-wrap items-center gap-2 border-b pb-2 md:flex-nowrap md:border-b-0 md:pb-0"
              >
                <View className="min-w-[220px] flex-1">
                  {headSelect(
                    `Row ${i + 1} head`,
                    r.head_id,
                    (v) => setGridRow(i, { head_id: v }),
                    gridHeads,
                    true,
                    {},
                  )}
                </View>
                <View className="w-32">
                  <MoneyInput
                    label={`Row ${i + 1} debit`}
                    placeholder="Debit"
                    value={r.debit}
                    onChange={(t) => setGridRow(i, t ? { debit: t, credit: '' } : { debit: '' })}
                  />
                </View>
                <View className="w-32">
                  <MoneyInput
                    label={`Row ${i + 1} credit`}
                    placeholder="Credit"
                    value={r.credit}
                    onChange={(t) => setGridRow(i, t ? { credit: t, debit: '' } : { credit: '' })}
                  />
                </View>
                <View className="w-40">
                  <Select
                    label="Cost center"
                    value={r.cost_center_id ?? 0}
                    onChange={(v) => setGridRow(i, { cost_center_id: v || null })}
                    options={ccOptions}
                  />
                </View>
                <View className="w-40">
                  <Input
                    value={r.note}
                    onChangeText={(t) => setGridRow(i, { note: t })}
                    placeholder="Note"
                    maxLength={255}
                    accessibilityLabel={`Row ${i + 1} note`}
                  />
                </View>
                {removeBtn(() => setGrid((g) => g.filter((_, j) => j !== i)), grid.length <= 2)}
              </View>
            ))}
            <View className="border-border flex-row flex-wrap items-center gap-2 border-t pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={Plus}
                label="Add row"
                onPress={() => setGrid((g) => [...g, blankGrid()])}
                disabled={busy}
              />
              <Text size="sm" weight="semibold" tabular className="ml-auto">
                {`Dr ${formatMoney(built.debit)} · Cr ${formatMoney(built.credit)}`}
              </Text>
              {built.difference ? (
                <Text
                  size="sm"
                  color="destructive"
                  tabular
                >{`Difference ${formatMoney(built.difference)}`}</Text>
              ) : null}
            </View>
          </View>
        ) : type === 'contra' ? (
          <FieldRow cols={3}>
            <Field label="From account" required>
              {headSelect(
                'From account',
                transfer.from,
                (v) => setTransfer({ ...transfer, from: v }),
                cashHeads,
                false,
                { type: 'asset', cashBank: true },
              )}
            </Field>
            <Field label="To account" required>
              {headSelect(
                'To account',
                transfer.to,
                (v) => setTransfer({ ...transfer, to: v }),
                cashHeads,
                false,
                { type: 'asset', cashBank: true },
              )}
            </Field>
            <Field label="Amount" required>
              <MoneyInput
                label="Amount"
                value={transfer.amount}
                onChange={(t) => setTransfer({ ...transfer, amount: t })}
                testID="transfer-amount"
              />
            </Field>
          </FieldRow>
        ) : (
          <>
            <View className="sm:max-w-sm">
              <Field
                label={type === 'receipt' ? 'Receive into (cash / bank)' : 'Pay from (cash / bank)'}
                required
              >
                {headSelect('Cash / bank', cashId, setCashId, cashHeads, false, {
                  type: 'asset',
                  cashBank: true,
                })}
              </Field>
            </View>
            <View className="gap-2" testID="voucher-rows">
              <View className="bg-muted hidden flex-row gap-2 rounded-md px-2 py-2 md:flex">
                {headerCell(type === 'receipt' ? 'Income head' : 'Expense head', 'min-w-0 flex-1')}
                {headerCell('Amount', 'w-36 text-right')}
                {headerCell('Cost center', 'w-44')}
                <View className="w-8" />
              </View>
              {rows.map((r, i) => (
                <View key={i} className="flex-row flex-wrap items-center gap-2 md:flex-nowrap">
                  <View className="min-w-[220px] flex-1">
                    {headSelect(
                      `Row ${i + 1} head`,
                      r.head_id,
                      (v) => setRow(i, { head_id: v }),
                      rowHeads,
                      false,
                      { type: type === 'receipt' ? 'income' : 'expense' },
                    )}
                  </View>
                  <View className="w-36">
                    <MoneyInput
                      label={`Row ${i + 1} amount`}
                      value={r.amount}
                      onChange={(t) => setRow(i, { amount: t })}
                      testID={`row-amount-${i}`}
                    />
                  </View>
                  <View className="w-44">
                    <Select
                      label="Cost center"
                      value={r.cost_center_id ?? 0}
                      onChange={(v) => setRow(i, { cost_center_id: v || null })}
                      options={ccOptions}
                    />
                  </View>
                  {removeBtn(() => setRows((rs) => rs.filter((_, j) => j !== i)), rows.length <= 1)}
                </View>
              ))}
              <View className="border-border flex-row items-center gap-2 border-t pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  label="Add row"
                  onPress={() => setRows((rs) => [...rs, blankRow()])}
                  disabled={busy}
                />
                <Text
                  size="sm"
                  weight="semibold"
                  tabular
                  className="ml-auto"
                >{`Total ${formatMoney(built.debit)}`}</Text>
              </View>
            </View>
          </>
        )}
      </Dialog>
      <ConfirmDialog
        open={confirming}
        tone="default"
        title={voucher ? 'Save voucher changes?' : 'Post this voucher?'}
        message={voucherConfirmMessage(built, VOUCHER_LABEL[type], voucher?.voucher_no ?? null)}
        confirmLabel={busy ? 'Saving…' : voucher ? 'Save changes' : 'Post voucher'}
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
      />
      {quick ? (
        <QuickHeadDialog
          preset={quick}
          onCreated={quick.onCreated}
          onClose={() => setQuick(null)}
        />
      ) : null}
    </>
  );
}
