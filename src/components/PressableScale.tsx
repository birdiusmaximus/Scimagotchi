import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '@/hooks/useReducedMotion';

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

const PRESS_EASE = Easing.out(Easing.quad);
// Springy release with a touch of overshoot so the button feels alive coming back.
const RELEASE_SPRING = { damping: 11, stiffness: 340, mass: 0.7 } as const;

/**
 * A Pressable with premium tactile feedback: it snaps down on press, keeps sinking
 * very slightly while held (so a hold reads differently from a tap), softly dims,
 * then springs back with a little overshoot on release. Reduced-motion shrinks the
 * movement to a faint, non-bouncy dip. `style` lays out the touch target; the inner
 * content animates. Pass `fill` when the child should stretch to the target.
 */
export function PressableScale({ children, onPress, onLongPress, style, scaleTo = 0.92, hitSlop, disabled, fill }: Props) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1); // press scale
  const hold = useSharedValue(0); // 0..1 deepen while held
  const dim = useSharedValue(0); // 0..1 press dim

  // Soften everything for reduced motion: a faint dip, no deepen, no overshoot.
  const downTo = reduced ? 0.98 : scaleTo;
  const holdExtra = reduced ? 0 : 0.02;
  const dimTo = reduced ? 0.04 : 0.1;

  const animated = useAnimatedStyle(() => ({
    opacity: 1 - dim.value * dimTo,
    transform: [{ scale: s.value - hold.value * holdExtra }],
  }));

  const pressIn = () => {
    cancelAnimation(s);
    cancelAnimation(hold);
    // Snap down quickly so the press registers instantly…
    s.value = withTiming(downTo, { duration: 90, easing: PRESS_EASE });
    dim.value = withTiming(1, { duration: 120, easing: PRESS_EASE });
    // …then keep sinking a hair if the finger stays down (the "hold" read).
    hold.value = withTiming(1, { duration: 460, easing: Easing.inOut(Easing.quad) });
  };
  const pressOut = () => {
    cancelAnimation(s);
    cancelAnimation(hold);
    // …and spring back with a little overshoot so it feels alive.
    s.value = reduced ? withTiming(1, { duration: 130, easing: PRESS_EASE }) : withSpring(1, RELEASE_SPRING);
    hold.value = withTiming(0, { duration: 220, easing: PRESS_EASE });
    dim.value = withTiming(0, { duration: 200, easing: PRESS_EASE });
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hitSlop}
      disabled={disabled}
      style={style}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={fill ? [animated, { flex: 1 }] : animated}>{children}</Animated.View>
    </Pressable>
  );
}
