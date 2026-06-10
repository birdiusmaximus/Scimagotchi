import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeInLeft,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { palette, radii } from '@/theme/tokens';

function Dot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 })), -1),
    );
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.55, transform: [{ translateY: -v.value * 3 }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** The companion "thinking" while a reply is composed. */
export function TypingBubble() {
  return (
    <Animated.View entering={FadeInLeft.springify().damping(20).mass(0.7)} style={styles.row}>
      <Glass radius={radii.lg} fill={palette.glassFillStrong} style={styles.bubble} contentStyle={styles.content}>
        <Dot delay={0} />
        <Dot delay={160} />
        <Dot delay={320} />
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-start', marginVertical: 5 },
  bubble: { borderBottomLeftRadius: 6 },
  content: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 16, paddingHorizontal: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.inkSoft },
});
