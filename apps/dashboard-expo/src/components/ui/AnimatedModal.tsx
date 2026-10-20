/**
 * Modal with a proper enter/exit animation. RN's built-in `animationType` moves the whole screen,
 * so the dark scrim slides up with a bottom sheet. Here the scrim only fades while the content
 * animates on its own: `sheet` slides up from the bottom, `center` fades and scales in, `popover`
 * fades and drops in a few px. The modal stays mounted until the exit animation has finished.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

type Variant = 'sheet' | 'center' | 'popover';

export function AnimatedModal({
  visible,
  onRequestClose,
  variant,
  scrimOpacity = 0.5,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  variant: Variant;
  /** 0 for no scrim (e.g. a dropdown menu). */
  scrimOpacity?: number;
  /** Full-screen layout: the caller positions its own card (and tap-away catcher) inside. */
  children: ReactNode;
}) {
  const { height } = useWindowDimensions();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => animation.stop();
  }, [visible, progress]);

  const content =
    variant === 'sheet'
      ? {
          transform: [
            { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) },
          ],
        }
      : variant === 'center'
        ? {
            opacity: progress,
            transform: [
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }
        : {
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
            ],
          };

  return (
    <Modal
      transparent
      visible={visible || mounted}
      animationType="none"
      onRequestClose={onRequestClose}
    >
      {scrimOpacity > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: '#000', opacity: Animated.multiply(progress, scrimOpacity) },
          ]}
        />
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, content]}>
        <View style={StyleSheet.absoluteFill}>{children}</View>
      </Animated.View>
    </Modal>
  );
}
