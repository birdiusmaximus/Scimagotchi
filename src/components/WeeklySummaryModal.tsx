import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Txt } from '@/components/Txt';
import { WeeklySummaryView } from '@/components/WeeklySummaryView';
import { palette, radii, spacing } from '@/theme/tokens';
import type { WeeklySummary } from '@/types/models';

type Props = {
  summary: WeeklySummary;
  onClose: () => void;
};

/**
 * Start-of-week login presentation of the weekly summary. A gentle, exit-able
 * overlay — never blocking, never guilt-inducing.
 */
export function WeeklySummaryModal({ summary, onClose }: Props) {
  return (
    <View style={styles.overlay}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <WeeklySummaryView summary={summary} />
          <Pressable onPress={onClose} style={({ pressed }) => [styles.close, { opacity: pressed ? 0.85 : 1 }]}>
            <Txt variant="label" color={palette.white}>
              Continue
            </Txt>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(60,58,107,0.42)',
    zIndex: 900,
  },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.lg },
  close: {
    alignSelf: 'center',
    backgroundColor: palette.accent,
    borderRadius: radii.pill,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
  },
});
