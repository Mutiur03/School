/** react-hook-form Controller + Field + Input, the RN version of `<Input {...register(name)} />`. */
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { Field } from '@/components/ui/Field';
import { Input, type InputProps } from '@/components/ui/Input';

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  required,
  hint,
  transform,
  ...input
}: {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  required?: boolean;
  hint?: string;
  /** Applied to typed text before it is stored (e.g. upper-case a section). */
  transform?: (text: string) => string;
} & Omit<InputProps, 'value' | 'onChangeText' | 'onBlur' | 'invalid'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field label={label} required={required} hint={hint} error={fieldState.error?.message}>
          <Input
            {...input}
            accessibilityLabel={label}
            value={field.value == null ? '' : String(field.value)}
            onChangeText={(t) => field.onChange(transform ? transform(t) : t)}
            onBlur={field.onBlur}
            ref={field.ref}
            invalid={!!fieldState.error}
          />
        </Field>
      )}
    />
  );
}
