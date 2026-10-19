/** Password field: Input with a show/hide eye inside the field (one look for every form). */
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Icon } from './Icon';
import { Eye, EyeOff } from './icons';
import { Input, type InputProps } from './Input';

export function PasswordInput({
  label,
  shown,
  onToggleShown,
  kind = 'password',
  ...props
}: Omit<InputProps, 'secureTextEntry' | 'trailing' | 'kind'> & {
  /** `new-password` for set/change forms (autofill offers a generated password). */
  kind?: 'password' | 'new-password';
  /** Accessible name; the eye reads "Show <label>" / "Hide <label>". */
  label: string;
  /** Controlled visibility (e.g. one toggle for two fields); uncontrolled when omitted. */
  shown?: boolean;
  onToggleShown?: () => void;
}) {
  const [own, setOwn] = useState(false);
  const visible = shown ?? own;
  const toggle = onToggleShown ?? (() => setOwn((v) => !v));
  const name = label.toLowerCase();
  return (
    <Input
      kind={kind}
      {...props}
      accessibilityLabel={label}
      secureTextEntry={!visible}
      trailing={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? `Hide ${name}` : `Show ${name}`}
          onPress={toggle}
          hitSlop={6}
          className="h-10 w-10 items-center justify-center rounded-md active:opacity-60"
        >
          <Icon icon={visible ? EyeOff : Eye} size={18} color="mutedForeground" />
        </Pressable>
      }
    />
  );
}
