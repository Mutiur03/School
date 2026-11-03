/**
 * Portrait photo slot for student / teacher forms: shows the current or just-picked photo, a
 * placeholder when empty, upload / replace, and a two-step remove (tap, then confirm). Web also
 * accepts a dropped image on the whole slot.
 */
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useDropZone } from '@/hooks/useDropZone';
import type { PickedFile } from '@/lib/api';
import { pickFile } from '@/lib/files/pick-file';
import { cn } from '@/lib/utils';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';
import { Trash2, Upload, User } from './icons';

export interface PhotoFieldProps {
  /** Stored photo URL, if any. */
  url?: string | null;
  /** A photo picked but not uploaded yet (add flow); wins over `url`. */
  picked?: PickedFile | null;
  /** Called with the chosen image. */
  onPick: (file: PickedFile) => void;
  /** Called after the user confirms removal. */
  onRemove: () => void;
  /** Upload / removal in flight. */
  busy?: boolean;
  /** Under the buttons, e.g. "JPG or PNG, up to 2 MB." */
  hint?: string;
  /** What the slot is for, used in labels. Default "photo". */
  noun?: string;
  testID?: string;
}

/** Preview source for a picked file: the cached native uri, or an object URL on web. */
export function usePreview(file: PickedFile | null | undefined) {
  const src = useMemo(
    () => file?.uri ?? (file && typeof URL !== 'undefined' ? URL.createObjectURL(file.body) : null),
    [file],
  );
  useEffect(
    () => () => {
      if (src && !file?.uri) URL.revokeObjectURL(src);
    },
    [src, file],
  );
  return src;
}

export function PhotoField({
  url,
  picked,
  onPick,
  onRemove,
  busy,
  hint,
  noun = 'photo',
  testID,
}: PhotoFieldProps) {
  const [confirming, setConfirming] = useState(false);
  const [opening, setOpening] = useState(false);
  const preview = usePreview(picked);
  const shown = preview ?? url ?? null;
  const locked = !!busy || opening;

  // A new photo or a finished removal cancels a pending confirm.
  useEffect(() => setConfirming(false), [shown, busy]);

  const choose = async () => {
    if (locked) return;
    setOpening(true);
    try {
      const f = await pickFile('image/*');
      if (f) onPick(f);
    } finally {
      setOpening(false);
    }
  };
  const drop = useDropZone('image/*', (files) => files[0] && onPick(files[0]), {
    disabled: locked,
  });

  return (
    <View
      ref={drop.ref}
      testID={testID}
      className={cn(
        'flex-row flex-wrap items-center gap-4 rounded-xl',
        drop.over && 'bg-primary/5',
      )}
    >
      <View
        className={cn(
          'bg-muted aspect-[7/9] w-24 overflow-hidden rounded-lg',
          shown
            ? 'border-border border'
            : 'border-border items-center justify-center border border-dashed',
          drop.over && 'border-primary',
        )}
      >
        {shown ? (
          <Image
            source={{ uri: shown }}
            accessibilityLabel={`Current ${noun}`}
            resizeMode="cover"
            className="h-full w-full"
          />
        ) : (
          <View className="items-center gap-1.5 px-2">
            <Icon icon={User} size={28} color="mutedForeground" />
            <Text size="xs" color="mutedForeground" className="text-center">
              {drop.over ? 'Drop to add' : `No ${noun}`}
            </Text>
          </View>
        )}
        {busy ? (
          <View className="absolute inset-0 items-center justify-center bg-black/40">
            <ActivityIndicator color="#fff" />
          </View>
        ) : null}
      </View>

      <View className="min-w-[160px] flex-1 gap-2">
        {picked ? (
          <View>
            <Text size="sm" weight="medium" numberOfLines={1}>
              {picked.name}
            </Text>
            <Text size="xs" color="mutedForeground">
              {(picked.size / 1024 / 1024).toFixed(2)} MB · uploads when you save
            </Text>
          </View>
        ) : null}
        <View className="flex-row flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Upload}
            label={busy ? 'Saving…' : shown ? `Replace ${noun}` : `Upload ${noun}`}
            disabled={locked}
            onPress={() => void choose()}
            testID={testID ? `${testID}-pick` : undefined}
          />
          {shown && !confirming ? (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              label="Remove"
              disabled={locked}
              onPress={() => setConfirming(true)}
              testID={testID ? `${testID}-remove` : undefined}
            />
          ) : null}
          {confirming ? (
            <>
              <Button
                variant="destructive"
                size="sm"
                label={`Remove ${noun}`}
                disabled={locked}
                onPress={onRemove}
                testID={testID ? `${testID}-confirm` : undefined}
              />
              <Button variant="ghost" size="sm" label="Keep" onPress={() => setConfirming(false)} />
            </>
          ) : null}
        </View>
        {hint ? (
          <Text size="xs" color="mutedForeground">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
