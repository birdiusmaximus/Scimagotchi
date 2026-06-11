import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { palette, radii, spacing } from '@/theme/tokens';

/**
 * A gentle, tentative invitation to pick up a previously-saved thread (engine
 * brief §6 returning_pattern, §12.5). Only shown when a confirmed memory exists;
 * always dismissible. Never asserts a pattern as fact — it offers a comparison.
 */
export function ReturningThread({
  summary,
  onPickUp,
  onDismiss,
}: {
  summary: string;
  onPickUp: () => void;
  onDismiss: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(450)}>
      <Glass radius={radii.lg} fill={palette.glassFill} contentStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.kickerRow}>
            <Feather name="bookmark" size={12} color={palette.accentDeep} />
            <Txt variant="small" color={palette.inkSoft} style={styles.kicker}>
              PICK UP WHERE WE LEFT OFF
            </Txt>
          </View>
          <PressableScale hitSlop={10} onPress={onDismiss}>
            <Feather name="x" size={15} color={palette.inkSoft} />
          </PressableScale>
        </View>

        <Txt variant="body" color={palette.inkOnGlass} style={styles.summary} numberOfLines={2}>
          {summary}
        </Txt>

        <PressableScale onPress={onPickUp} style={styles.cta}>
          <View style={styles.ctaRow}>
            <Txt variant="label" color={palette.accentDeep}>
              Stay with this
            </Txt>
            <Feather name="arrow-right" size={15} color={palette.accentDeep} />
          </View>
        </PressableScale>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: 9, paddingHorizontal: spacing.md, gap: 3 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kickerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kicker: { letterSpacing: 1.2 },
  summary: { lineHeight: 20 },
  cta: { alignSelf: 'flex-start', marginTop: 1 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
