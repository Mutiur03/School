/**
 * The one text input. Spec in ./control-spec.ts: a desktop density (web ≥ sm, parity with the
 * web dashboard: 32/40/44px, 14px text) and a touch density (iOS/Android and phone-width web:
 * 40/48/52px, 16px text, 12px radius). States: focus (desktop: border + soft ring; touch: one 2px
 * border, no halo), invalid (red border plus an alert icon),
 * read-only (gray-50 plus a lock icon), disabled (gray-100, muted, 60% opacity).
 *
 * Phone behaviour that every screen inherits:
 *  - `kind` sets the keyboard, autofill, capitalisation and autocorrect for the field
 *    (email, phone, number, password, code, search, ...). Explicit props still win.
 *  - Inside `<FormChain>` the return key is Next / Done and moves through the form.
 *  - Number / phone pads on iOS have no return key, so they get a Next/Done bar above the keyboard.
 *  - Inside KeyboardAwareScrollView a focused field scrolls above the keyboard.
 *
 * Callers pass layout only in `className` (width, flex, text alignment, font-mono). Height,
 * border, radius, padding and colours come from here, so screens can't drift apart.
 */
import { useId, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from 'react';
import {
  InputAccessoryView,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/ThemeProvider';
import {
  CONTROL_PLACEHOLDER,
  WEB_NO_OUTLINE,
  controlBorderInset,
  controlCaretProps,
  controlClassName,
  controlFrameStyle,
  controlIconSlot,
  controlTextStyle,
  inputKindProps,
  isPadKeyboard,
  kindForKeyboard,
  multilineMinHeight,
  useControlTouch,
  type ControlSize,
  type InputKind,
} from './control';
import { useChainedField } from './form-chain';
import { Icon } from './Icon';
import { AlertCircle, Lock } from './icons';
import { useRevealFocusedField } from './KeyboardAwareScrollView';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  size?: ControlSize;
  /** What the field holds: sets keyboard type, inputMode, autofill, capitalisation, autocorrect. */
  kind?: InputKind;
  /** `code`: the school-code / OTP look (lg height, 18px mono, wide tracking, centred). */
  variant?: 'default' | 'code';
  invalid?: boolean;
  /** Multiline only: visible lines before it scrolls (default 4). */
  rows?: number;
  leading?: ReactNode;
  trailing?: ReactNode;
  ref?: Ref<TextInput | null>;
  /** Classes for the outer wrapper when icons are shown (e.g. max-w). */
  containerClassName?: string;
  /** Opt out of FormChain (Next/Done) handling. */
  chain?: boolean;
  /** Built-in alert / lock icon for invalid / read-only (off for narrow cells). Default true. */
  stateIcon?: boolean;
}

export function Input({
  className,
  containerClassName,
  style,
  size: sizeProp = 'md',
  kind,
  variant = 'default',
  invalid,
  rows = 4,
  multiline,
  leading,
  trailing,
  editable,
  readOnly,
  onFocus,
  onBlur,
  ref,
  chain: chainable = true,
  stateIcon: showStateIcon = true,
  ...rest
}: InputProps) {
  const { colors } = useTheme();
  const touch = useControlTouch();
  const [focused, setFocused] = useState(false);
  const inner = useRef<TextInput | null>(null);
  useImperativeHandle(ref, () => inner.current as TextInput, []);
  const accessoryId = useId();
  const code = variant === 'code';
  const size = code ? 'lg' : sizeProp;
  const disabled = editable === false && !readOnly;
  const state = { size, touch, focused, invalid, disabled, readOnly, multiline };
  const kindProps = inputKindProps(
    kind ?? (code ? 'code' : undefined) ?? kindForKeyboard(rest.keyboardType),
  );
  const keyboardType = rest.keyboardType ?? kindProps.keyboardType;

  const ownSubmit = rest.returnKeyType !== undefined || rest.onSubmitEditing !== undefined;
  const chain = useChainedField(
    inner,
    chainable && !multiline && !disabled && !readOnly && !ownSubmit,
  );
  const reveal = useRevealFocusedField();
  const last = chain?.last() ?? false;
  const chainProps: TextInputProps = chain
    ? {
        returnKeyType: last ? chain.submitLabel : 'next',
        submitBehavior: last ? 'blurAndSubmit' : 'submit',
        onSubmitEditing: () => chain.advance(),
      }
    : {};
  const submitAction = chain ? chain.advance : rest.onSubmitEditing;
  const padBar = Platform.OS === 'ios' && isPadKeyboard(keyboardType) && !!submitAction;
  const padLabel = (
    chain ? (last ? 'Done' : 'Next') : rest.returnKeyType === 'next' ? 'Next' : 'Done'
  ) as string;

  // Built-in state icons when the caller has no trailing slot of its own.
  const stateIcon =
    showStateIcon && !trailing && !multiline && !code ? (
      invalid ? (
        <Icon icon={AlertCircle} size={touch ? 18 : 16} color="destructive" />
      ) : readOnly ? (
        <Icon icon={Lock} size={14} color="mutedForeground" />
      ) : null
    ) : null;
  const trail = trailing ?? stateIcon;
  const slot = controlIconSlot(state);
  // The focused touch border is wider; take it out of the padding so text and caret stay put.
  const inset = controlBorderInset(state);

  const input = (
    <TextInput
      ref={inner}
      placeholderTextColor={CONTROL_PLACEHOLDER}
      underlineColorAndroid="transparent"
      {...controlCaretProps(colors)}
      {...kindProps}
      {...chainProps}
      {...rest}
      inputAccessoryViewID={padBar ? accessoryId : rest.inputAccessoryViewID}
      multiline={multiline}
      editable={editable}
      readOnly={readOnly}
      aria-invalid={invalid || undefined}
      accessibilityState={{ disabled }}
      onFocus={(e) => {
        setFocused(true);
        reveal?.();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cn(code ? 'font-mono' : 'font-normal', controlClassName(state), className)}
      style={[
        controlTextStyle(state),
        code ? { fontSize: 18, letterSpacing: 4, textAlign: 'center' as const } : null,
        code && Platform.OS !== 'ios' ? { lineHeight: 28 } : null,
        controlFrameStyle(colors, state),
        multiline ? { minHeight: multilineMinHeight(state, rows) } : null,
        leading ? { paddingLeft: slot - inset } : null,
        trail ? { paddingRight: slot + 4 - inset } : null,
        WEB_NO_OUTLINE,
        style,
      ]}
    />
  );
  const bar = padBar ? (
    <InputAccessoryView nativeID={accessoryId}>
      <View className="border-border bg-muted flex-row justify-end border-t px-2 py-1.5">
        <Pressable
          accessibilityRole="button"
          onPress={() => submitAction?.({} as never)}
          className="min-h-11 justify-center rounded-md px-4 active:opacity-60"
        >
          <Text size="base" weight="semibold" color="primary">
            {padLabel}
          </Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  ) : null;
  if (!leading && !trail)
    return bar ? (
      <>
        {input}
        {bar}
      </>
    ) : (
      input
    );
  return (
    <View className={cn('justify-center', containerClassName)}>
      {input}
      {leading ? (
        <View
          pointerEvents="none"
          className="absolute bottom-0 left-0 top-0 items-center justify-center"
          style={{ width: slot }}
        >
          {leading}
        </View>
      ) : null}
      {trail ? (
        <View
          pointerEvents={trailing ? 'box-none' : 'none'}
          className="absolute bottom-0 right-0 top-0 items-center justify-center"
          style={{ width: slot + 4 }}
        >
          {trail}
        </View>
      ) : null}
      {bar}
    </View>
  );
}

/** `<Textarea>` from the web: a multiline Input. */
export function Textarea(props: Omit<InputProps, 'multiline'>) {
  return <Input multiline {...props} />;
}
