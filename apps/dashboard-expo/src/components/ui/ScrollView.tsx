import type { ComponentProps, ComponentType } from 'react';
import { ScrollView as RNScrollView } from 'react-native';

/**
 * React Native's ScrollView, typed with NativeWind's `contentContainerClassName`.
 * RN 0.86's generated types declare `ScrollViewProps` as a type alias, which the module
 * augmentation in `nativewind/types` cannot extend; the runtime mapping works regardless (this is
 * the same component, so NativeWind's JSX runtime still recognises it).
 */
export const ScrollView = RNScrollView as unknown as ComponentType<
  ComponentProps<typeof RNScrollView> & { contentContainerClassName?: string }
>;
