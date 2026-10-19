/**
 * Sliding pill behind the active bottom tab (native). Reanimated is already in the native bundle
 * (NativeWind's runtime loads it), so this adds no weight there. Web uses TabIndicator.web.tsx.
 */
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PILL, pillX, type IndicatorProps } from './tab-indicator-geometry';

export function ActiveIndicator({ index, count, width }: IndicatorProps) {
  const reduceMotion = useReducedMotion();
  const target = pillX(index, count, width);
  const x = useSharedValue(target);
  const opacity = useSharedValue(0);
  const placed = useRef(false);

  useEffect(() => {
    if (!placed.current || reduceMotion) {
      // First measurement or reduced motion: jump into place without animating.
      x.value = target;
      opacity.value = 1;
      placed.current = true;
    } else {
      x.value = withTiming(target, { duration: 220, easing: Easing.out(Easing.cubic) });
    }
  }, [target, reduceMotion, x, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: x.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="tab-indicator"
      style={[{ position: 'absolute', left: 0, ...PILL }, style]}
    >
      <View className="bg-primary/10 flex-1 rounded-full" />
    </Animated.View>
  );
}
