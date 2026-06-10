import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientBackground } from '@/components/GradientBackground';
import { IconButton } from '@/components/IconButton';
import { useGoBack } from '@/hooks/useGoBack';
import { Txt } from '@/components/Txt';
import { WeeklySummaryView } from '@/components/WeeklySummaryView';
import { buildWeeklySummary } from '@/services/weeklySummary';
import { palette, spacing } from '@/theme/tokens';
import type { WeeklySummary } from '@/types/models';
import { prettyWeekRange, startOfWeek } from '@/utils/date';

export default function PatternsScreen() {
  const goBack = useGoBack();
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [summary, setSummary] = useState<WeeklySummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      buildWeeklySummary(weekStart)
        .then((s) => {
          if (active) setSummary(s);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [weekStart]),
  );

  const shift = (days: number) =>
    setWeekStart((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + days);
      return n;
    });

  const isThisWeek = weekStart.getTime() >= startOfWeek().getTime();

  return (
    <View style={styles.root}>
      <GradientBackground />
      <SafeAreaView style={styles.safe}>
        <View style={styles.bar}>
          <IconButton name="chevron-left" onPress={goBack} />
          <Txt variant="subtitle">Patterns</Txt>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.weekNav}>
          <Pressable onPress={() => shift(-7)} hitSlop={10}>
            <Feather name="chevron-left" size={22} color={palette.inkOnGlass} />
          </Pressable>
          <Txt variant="label" color={palette.inkOnGlass}>
            {prettyWeekRange(weekStart.toISOString())}
          </Txt>
          <Pressable onPress={() => shift(7)} hitSlop={10} disabled={isThisWeek}>
            <Feather name="chevron-right" size={22} color={isThisWeek ? palette.glassBorder : palette.inkOnGlass} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {summary ? <WeeklySummaryView summary={summary} /> : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: spacing.lg },
  bar: { paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  scroll: { paddingVertical: spacing.lg },
});
