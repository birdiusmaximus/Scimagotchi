import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { gradients, palette, radii } from '@/theme/tokens';
import { withAlpha } from '@/utils/color';

/**
 * Low-friction continuation chips offered after the companion reflects without
 * asking a question (engine brief §7.3, §16.2). One tap to keep going, gently
 * correct, or close — agency without typing. Each takes one hue from the brand
 * gradient (pink / violet / blue), kept translucent so they read as soft glass
 * rather than solid buttons, while still lifting off the discussion window.
 */
const [BRAND_PINK, BRAND_VIOLET, BRAND_BLUE] = gradients.brand;
const TINTS: Record<'keep' | 'notQuite' | 'done', readonly [string, string]> = {
  keep: [withAlpha(BRAND_PINK, 0.42), withAlpha(BRAND_PINK, 0.22)],
  notQuite: [withAlpha(BRAND_VIOLET, 0.42), withAlpha(BRAND_VIOLET, 0.22)],
  done: [withAlpha(BRAND_BLUE, 0.42), withAlpha(BRAND_BLUE, 0.22)],
};

export function ChatChips({
  onKeepGoing,
  onNotQuite,
  onDone,
}: {
  onKeepGoing: () => void;
  onNotQuite: () => void;
  onDone: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.row}>
      <Chip label="Keep going" colors={TINTS.keep} onPress={onKeepGoing} />
      <Chip label="Not quite" colors={TINTS.notQuite} onPress={onNotQuite} />
      <Chip label="I’m done" colors={TINTS.done} onPress={onDone} />
    </Animated.View>
  );
}

function Chip({
  label,
  colors,
  onPress,
}: {
  label: string;
  colors: readonly [string, string];
  onPress: () => void;
}) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.94}>
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
        <Txt variant="small" color={palette.inkOnGlass}>
          {label}
        </Txt>
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: 2, paddingBottom: 8 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    overflow: 'hidden',
  },
});
