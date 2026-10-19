/**
 * Form field frame: label above (red `*` when required), the control, then helper text or an
 * error with an alert icon below. Desktop matches the web admin forms (`text-sm` label,
 * `text-xs` messages); touch uses a 14px label and 13px messages with more room under the label.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/utils';
import { useControlTouch } from './control';
import { Icon } from './Icon';
import { AlertCircle } from './icons';
import { Text } from './Text';

export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const touch = useControlTouch();
  return (
    <View className={cn('min-w-0', touch ? 'gap-2' : 'gap-1.5', className)}>
      <Text size="sm" weight="medium">
        {label}
        {required ? <Text color="destructive"> *</Text> : null}
      </Text>
      {children}
      {error ? <FieldError message={error} /> : hint ? <FieldHint>{hint}</FieldHint> : null}
    </View>
  );
}

/** `grid grid-cols-1 sm:grid-cols-N gap-4`: children wrap into N columns on wide screens. */
export function FieldRow({ cols = 2, children }: { cols?: 2 | 3 | 4; children: ReactNode }) {
  const basis = { 2: 'sm:basis-[47%]', 3: 'sm:basis-[30%]', 4: 'sm:basis-[22%]' }[cols];
  return (
    <View className="flex-row flex-wrap gap-4">
      {(Array.isArray(children) ? children : [children]).map((child, i) =>
        child ? (
          <View key={i} className={cn('min-w-0 grow basis-full', basis)}>
            {child}
          </View>
        ) : null,
      )}
    </View>
  );
}

/** FormSection from StudentList.tsx: small caps heading above a group of fields. */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="gap-3">
      <Text size="xs" weight="semibold" caps color="mutedForeground">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Error line under a control: alert icon + message (announced as an alert). */
export function FieldError({ message, testID }: { message: string; testID?: string }) {
  const touch = useControlTouch();
  return (
    <View className="flex-row items-start gap-1.5" accessibilityRole="alert" testID={testID}>
      <View className={touch ? 'pt-[3px]' : 'pt-[1px]'}>
        <Icon icon={AlertCircle} size={touch ? 14 : 13} color="destructive" />
      </View>
      <Text
        size="xs"
        color="destructive"
        className={cn('shrink', touch && 'text-[13px] leading-5')}
      >
        {message}
      </Text>
    </View>
  );
}

/** Helper line under a control. */
export function FieldHint({ children }: { children: ReactNode }) {
  const touch = useControlTouch();
  return (
    <Text size="xs" color="mutedForeground" className={cn(touch && 'text-[13px] leading-5')}>
      {children}
    </Text>
  );
}
