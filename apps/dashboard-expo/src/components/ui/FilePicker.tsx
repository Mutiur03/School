/**
 * File card + picker for forms (the dashboard's Notice.tsx file card) and a bare "pick files"
 * button. Picking goes through src/lib/files/pick-file: a hidden `<input type="file">` on web,
 * expo-document-picker / expo-image-picker on native.
 */
import { useState } from 'react';
import { View } from 'react-native';
import type { PickedFile } from '@/lib/api';
import { pickFile, pickFiles } from '@/lib/files/pick-file';
import { Button } from './Button';
import { Icon } from './Icon';
import { ExternalLink, FileText, Upload, XIcon } from './icons';
import { Text } from './Text';

export interface FilePickerProps {
  /** e.g. 'application/pdf,.pdf' or 'image/*' */
  accept: string;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  /** Shown when nothing new is picked, e.g. "Current file" while editing. */
  currentLabel?: string;
  /** Opens the stored file. */
  onOpenCurrent?: () => void;
  label: string;
  disabled?: boolean;
}

export interface PickFilesButtonProps {
  accept: string;
  multiple?: boolean;
  label: string;
  onPick: (files: PickedFile[]) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm';
  testID?: string;
}

/** Runs one picker at a time (a second tap while the sheet is opening does nothing). */
function usePicker() {
  const [open, setOpen] = useState(false);
  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (open) return undefined;
    setOpen(true);
    try {
      return await fn();
    } finally {
      setOpen(false);
    }
  };
  return { open, run };
}

export function FilePicker({
  accept,
  value,
  onChange,
  currentLabel,
  onOpenCurrent,
  label,
  disabled,
}: FilePickerProps) {
  const picker = usePicker();
  const choose = async () => {
    const f = await picker.run(() => pickFile(accept));
    if (f) onChange(f);
  };
  const busy = disabled || picker.open;
  return (
    <View className="gap-2">
      {value || currentLabel ? (
        <View className="border-border flex-row flex-wrap items-center gap-3 rounded-lg border p-3">
          <View className="bg-primary/10 h-10 w-10 items-center justify-center rounded-md">
            <Icon icon={FileText} size={20} color="primary" />
          </View>
          <View className="min-w-[140px] flex-1">
            <Text size="sm" weight="medium" numberOfLines={1}>
              {value ? value.name : currentLabel}
            </Text>
            <Text size="xs" color="mutedForeground">
              {value
                ? `${(value.size / 1024 / 1024).toFixed(2)} MB · uploads when you save`
                : 'Stored file'}
            </Text>
          </View>
          <View className="flex-row gap-1">
            {value ? (
              <Button
                variant="ghost"
                size="sm"
                icon={XIcon}
                label="Remove"
                onPress={() => onChange(null)}
              />
            ) : onOpenCurrent ? (
              <Button
                variant="ghost"
                size="sm"
                icon={ExternalLink}
                label="Open"
                onPress={onOpenCurrent}
              />
            ) : null}
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              label="Replace"
              disabled={busy}
              onPress={choose}
            />
          </View>
        </View>
      ) : (
        <Button
          variant="outline"
          icon={Upload}
          label={`Choose ${label.toLowerCase()}`}
          disabled={busy}
          onPress={choose}
          className="self-start"
        />
      )}
    </View>
  );
}

/** A button that opens the file / photo picker (several files when `multiple`). */
export function PickFilesButton({
  accept,
  multiple,
  label,
  onPick,
  disabled,
  variant = 'default',
  size = 'default',
  testID,
}: PickFilesButtonProps) {
  const picker = usePicker();
  const choose = async () => {
    const files = await picker.run(() => pickFiles(accept, { multiple }));
    if (files?.length) onPick(files);
  };
  return (
    <Button
      variant={variant}
      size={size}
      icon={Upload}
      label={label}
      disabled={disabled || picker.open}
      onPress={choose}
      testID={testID}
    />
  );
}
