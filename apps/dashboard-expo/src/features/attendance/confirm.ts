import { Alert, Platform } from 'react-native';

/** Discard-changes confirm: window.confirm on web, a native Alert elsewhere. */
export function confirmDiscard(message: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(typeof window === 'undefined' ? true : window.confirm(message));
  }
  return new Promise((resolve) =>
    Alert.alert('Discard unsaved changes?', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Discard & continue', style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
