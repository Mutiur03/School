import { useState } from 'react';
import { ACC_HEAD_TYPES, accHeadFormSchema, type AccHeadType } from '@school/shared-schemas';
import { Input } from '@/components/ui/input';
import { useAccHeads, useCreateAccHead } from '@/queries/accounts.queries';
import { Field, FormPopup } from './ui';
import { TYPE_LABELS, selectClass } from './heads';

export type QuickHead = {
  /** Locks the type when the field only accepts one (income row, cash/bank picker...). */
  type?: AccHeadType;
  cashBank?: boolean;
  onCreated: (id: number) => void;
};

/** Minimal "add account head" form for use inside other forms, so nobody has to leave them. */
const QuickHeadPopup = ({ preset, onClose }: { preset: QuickHead; onClose: () => void }) => {
  const create = useCreateAccHead();
  const { data: heads = [] } = useAccHeads();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccHeadType>(preset.type ?? 'expense');
  const [cashBank, setCashBank] = useState(preset.cashBank ?? false);
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');

  const isCash = type === 'asset' && cashBank;
  // Names are unique per school. Say so before the server does; case-insensitive to also stop look-alikes.
  const clash = heads.find((h) => h.name.toLowerCase() === name.trim().toLowerCase());
  const parsed = accHeadFormSchema.safeParse({
    name,
    code: '',
    type,
    parent_id: '',
    is_cash_bank: isCash,
    bank_name: isCash ? bankName : '',
    account_no: isCash ? accountNo : '',
    is_active: true,
  });

  const onSubmit = async (e: React.FormEvent) => {
    // The portal's React tree sits inside the voucher <form>: don't let this submit reach it.
    e.preventDefault();
    e.stopPropagation();
    if (!parsed.success) return;
    try {
      const res = (await create.mutateAsync(parsed.data)) as { data: { data: { id: number } } };
      preset.onCreated(res.data.data.id);
      onClose();
    } catch {
      // onError already toasts
    }
  };

  return (
    <FormPopup
      open
      onClose={onClose}
      title={isCash ? 'New cash / bank account' : `New ${TYPE_LABELS[type].toLowerCase()} head`}
      onSubmit={onSubmit}
      saving={create.isPending}
      disabled={!parsed.success || !!clash}
      submitLabel="Add head"
      size="md"
    >
      <Field
        label="Name"
        required
        error={
          clash &&
          `"${clash.name}" already exists (${TYPE_LABELS[clash.type]}). Use a different name.`
        }
      >
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={isCash ? 'e.g. Sonali Bank A/C' : 'e.g. Tuition Fee'}
        />
      </Field>
      {!preset.type && (
        <Field label="Type" required>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccHeadType)}
            className={selectClass}
          >
            {ACC_HEAD_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
      )}
      {!preset.type && type === 'asset' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cashBank}
            onChange={(e) => setCashBank(e.target.checked)}
            className="h-4 w-4"
          />
          Cash / bank account
        </label>
      )}
      {isCash && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank name">
            <Input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Leave empty for cash"
            />
          </Field>
          <Field label="Account no.">
            <Input value={accountNo} onChange={(e) => setAccountNo(e.target.value)} />
          </Field>
        </div>
      )}
    </FormPopup>
  );
};

export default QuickHeadPopup;
