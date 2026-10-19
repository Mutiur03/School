/**
 * Sliding pill behind the active bottom tab (web). A CSS transform transition gives the same
 * 220ms ease-out slide as the native Reanimated version without adding Reanimated to the web
 * bundle (~0.8 MB); `motion-reduce:transition-none` honours prefers-reduced-motion.
 */
import { View } from 'react-native';
import { PILL, pillX, type IndicatorProps } from './tab-indicator-geometry';

export function ActiveIndicator({ index, count, width }: IndicatorProps) {
  return (
    <View
      pointerEvents="none"
      testID="tab-indicator"
      className="bg-primary/10 absolute left-0 rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none"
      style={{ ...PILL, transform: [{ translateX: pillX(index, count, width) }] }}
    />
  );
}
