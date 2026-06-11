import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hitSlop?: number;
  disabled?: boolean;
  /** Let the inner wrapper fill the touch target (so a flex:1 child stretches to it). */
  fill?: boolean;
};

/**
 * A Pressable that springs its content down slightly on press — the small tactile
 * detail that makes taps feel premium. `style` lays out the touch target; the
 * inner content scales. Pass `fill` when the child should stretch to the target
 * (e.g. equal-width/height buttons in a row).
 */
export function PressableScale({ children, onPress, onLongPress, style, scaleTo = 0.92, hitSlop, disabled, fill }: Props) {
  const s = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      disabled={disabled}
      style={style}
      onPressIn={() => {
        // Snap down quickly so the press registers instantly…
        s.value = withTiming(scaleTo, { duration: 90, easing: Easing.out(Easing.quad) });
      }}
      onPressOut={() => {
        // …then spring back with a little overshoot so it feels alive.
        s.value = withSpring(1, { damping: 9, stiffness: 380, mass: 0.6 });
      }}
    >
      <Animated.View style={fill ? [animated, { flex: 1 }] : animated}>{children}</Animated.View>
    </Pressable>
  );
}
