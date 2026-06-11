import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmotionProgressMap } from '@/components/EmotionProgressMap';
import { GradientBackground } from '@/components/GradientBackground';
import { Glass } from '@/components/Glass';
import { IconButton } from '@/components/IconButton';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { useGoBack } from '@/hooks/useGoBack';
import { emotionEventsRepo } from '@/services/db/repos';
import { buildWeeklySummary } from '@/services/weeklySummary';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { EmotionFamilyId, WeeklySummary } from '@/types/models';
import { tintPair, withAlpha } from '@/utils/color';
import { prettyWeekRange, startOfWeek } from '@/utils/date';

type FamilyCounts = Partial<Record<EmotionFamilyId, number>>;

function SectionLabel({ children }: { children: string }) {
  return (
    <Txt variant="small" color={palette.inkSoft} style={styles.sectionLabel}>
      {children.toUpperCase()}
    </Txt>
  );
}

/** One headline figure — a white card with a gradient icon chip and a big numeral. */
function StatTile({
  icon,
  tint,
  n,
  label,
}: {
  icon: keyof typeof Feather.glyphMap;
  tint: string;
  n: number;
  label: string;
}) {
  return (
    <View style={styles.statTile}>
      <LinearGradient colors={tintPair(tint)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}>
        <Feather name={icon} size={15} color={palette.white} />
      </LinearGradient>
      <Txt font="condensed" color={palette.ink} style={styles.statNum}>
        {n}
      </Txt>
      <Txt variant="small" color={palette.inkSoft}>
        {label}
      </Txt>
    </View>
  );
}

/** One feeling's share of the week — a labelled, family-coloured bar. */
function FeelingBar({ family, count, max }: { family: EmotionFamilyId; count: number; max: number }) {
  const pct = max > 0 ? Math.max(0.14, count / max) : 0;
  const color = FAMILY_COLORS[family];
  return (
    <View style={styles.barBlock}>
      <View style={styles.barTop}>
        <View style={[styles.barDot, { backgroundColor: color }]} />
        <Txt variant="small" color={palette.inkOnGlass} style={{ flex: 1 }} numberOfLines={1}>
          {EMOTION_MAPS[family].label}
        </Txt>
        <Txt variant="small" color={palette.inkSoft}>
          {count}
        </Txt>
      </View>
      <View style={styles.barTrack}>
        <LinearGradient
          colors={tintPair(color)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.barFill, { width: `${Math.round(pct * 100)}%` }]}
        />
      </View>
    </View>
  );
}

export default function PatternsScreen() {
  const goBack = useGoBack();
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [familyCounts, setFamilyCounts] = useState<FamilyCounts>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      buildWeeklySummary(weekStart)
        .then((s) => active && setSummary(s))
        .catch(() => {});

      // Per-family frequency for the distribution chart (computed here so the
      // WeeklySummary payload stays lean).
      const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      emotionEventsRepo
        .all()
        .then((evs) => {
          if (!active) return;
          const counts: FamilyCounts = {};
          for (const e of evs) {
            if (e.do_not_store || !e.emotion_family) continue;
            const t = new Date(e.timestamp).getTime();
            if (t >= start.getTime() && t < end.getTime()) {
              counts[e.emotion_family] = (counts[e.emotion_family] ?? 0) + 1;
            }
          }
          setFamilyCounts(counts);
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

  const ranked = (Object.entries(familyCounts) as [EmotionFamilyId, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  const maxCount = ranked.length ? ranked[0][1] : 0;
  const hasData = !!summary && (summary.checkin_count > 0 || summary.emotions_introduced.length > 0);

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
          {!summary ? null : !hasData ? (
            <Animated.View entering={FadeInDown.duration(400)}>
              <Glass radius={radii.xl} fill={palette.glassFillStrong} contentStyle={styles.emptyCard}>
                <Txt variant="subtitle" align="center">
                  This week is still open
                </Txt>
                <Txt variant="body" color={palette.inkSoft} align="center" style={styles.emptyBody}>
                  When you check in and name what you feel, your patterns gather here, in your own words.
                </Txt>
              </Glass>
            </Animated.View>
          ) : (
            <>
              {/* Headline figures */}
              <Animated.View entering={FadeInDown.duration(400)}>
                <SectionLabel>This week</SectionLabel>
                <View style={styles.statGrid}>
                  <StatTile icon="message-circle" tint="#9E6CF1" n={summary.checkin_count} label={summary.checkin_count === 1 ? 'check-in' : 'check-ins'} />
                  <StatTile icon="compass" tint="#6E8BF5" n={summary.emotions_introduced.length} label={summary.emotions_introduced.length === 1 ? 'feeling met' : 'feelings met'} />
                  <StatTile icon="award" tint="#E07BB0" n={summary.emotions_first_shape.length} label={summary.emotions_first_shape.length === 1 ? 'first shape' : 'first shapes'} />
                  <StatTile icon="bookmark" tint="#5FBFA6" n={summary.saved_count} label={summary.saved_count === 1 ? 'moment kept' : 'moments kept'} />
                </View>
              </Animated.View>

              {/* Feeling distribution */}
              {ranked.length ? (
                <Animated.View entering={FadeInDown.duration(400).delay(80)}>
                  <SectionLabel>How the week felt</SectionLabel>
                  <Glass radius={radii.lg} fill={palette.glassFillStrong} contentStyle={styles.distCard}>
                    {ranked.map(([f, n]) => (
                      <FeelingBar key={f} family={f} count={n} max={maxCount} />
                    ))}
                  </Glass>
                </Animated.View>
              ) : null}

              {/* Companion reflection */}
              <Animated.View entering={FadeInDown.duration(400).delay(160)}>
                <SectionLabel>Reflection</SectionLabel>
                <View style={styles.reflectCard}>
                  <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reflectHeader}>
                    <Feather name="feather" size={14} color={palette.white} />
                    <Txt variant="small" color="rgba(255,255,255,0.95)" style={styles.reflectKicker}>
                      WHAT I LEARNED
                    </Txt>
                  </LinearGradient>
                  <View style={styles.reflectBody}>
                    <Txt variant="body" color={palette.inkOnGlass} style={styles.narrative}>
                      {summary.companion_summary}
                    </Txt>
                    {summary.companion_learning_statement ? (
                      <View style={styles.learning}>
                        <Txt variant="label" color={palette.accentDeep}>
                          {summary.companion_learning_statement}
                        </Txt>
                      </View>
                    ) : null}
                    {summary.caveat ? (
                      <Txt variant="small" color={palette.inkSoft} style={styles.caveat}>
                        {summary.caveat}
                      </Txt>
                    ) : null}
                  </View>
                </View>
              </Animated.View>

              {/* In your words */}
              {summary.key_user_phrases.length ? (
                <Animated.View entering={FadeInDown.duration(400).delay(240)}>
                  <SectionLabel>In your words</SectionLabel>
                  <View style={styles.phrasesCard}>
                    {summary.key_user_phrases.map((p, i) => (
                      <View key={i} style={[styles.phraseRow, i > 0 && styles.phraseDivider]}>
                        <View style={styles.quoteBar} />
                        <Txt variant="body" color={palette.inkOnGlass} style={{ flex: 1 }}>
                          “{p}”
                        </Txt>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              ) : null}
            </>
          )}

          {/* Companion growth across all our talks (not week-scoped) — §9.4. */}
          <Animated.View entering={FadeInDown.duration(400).delay(120)}>
            <SectionLabel>What I’ve learned to recognise</SectionLabel>
            <Glass radius={radii.lg} fill={palette.glassFillStrong} contentStyle={styles.mapCard}>
              <EmotionProgressMap />
            </Glass>
          </Animated.View>
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
  scroll: { paddingVertical: spacing.lg, gap: spacing.xs },

  sectionLabel: { letterSpacing: 1.4, marginTop: spacing.md, marginBottom: spacing.xs, marginLeft: spacing.xs },

  // Stat tiles
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statTile: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    padding: spacing.md,
    gap: 2,
    boxShadow: '0px 8px 20px rgba(95,90,160,0.10)',
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    boxShadow: '0px 4px 10px rgba(95,90,160,0.18)',
  },
  statNum: { fontSize: 34, lineHeight: 38, fontWeight: '600' },

  // Distribution
  distCard: { padding: spacing.md, gap: spacing.md },
  mapCard: { paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
  barBlock: { gap: 6 },
  barTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barDot: { width: 9, height: 9, borderRadius: 5 },
  barTrack: { height: 10, borderRadius: radii.pill, backgroundColor: 'rgba(95,90,160,0.10)', overflow: 'hidden' },
  barFill: { height: 10, borderRadius: radii.pill },

  // Reflection
  reflectCard: { borderRadius: radii.lg, overflow: 'hidden', boxShadow: '0px 10px 26px rgba(95,90,160,0.16)' },
  reflectHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: spacing.md },
  reflectKicker: { letterSpacing: 2 },
  reflectBody: { backgroundColor: 'rgba(255,255,255,0.78)', padding: spacing.md },
  narrative: { lineHeight: 24 },
  learning: {
    marginTop: spacing.sm,
    backgroundColor: withAlpha(palette.accent, 0.12),
    borderRadius: radii.md,
    padding: spacing.md,
  },
  caveat: { marginTop: spacing.sm, fontStyle: 'italic', opacity: 0.85, lineHeight: 18 },

  // Phrases
  phrasesCard: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: spacing.md,
    boxShadow: '0px 8px 20px rgba(95,90,160,0.10)',
  },
  phraseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12 },
  phraseDivider: { borderTopWidth: 1, borderTopColor: 'rgba(120,120,160,0.12)' },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: palette.accent },

  // Empty
  emptyCard: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyBody: { lineHeight: 22, marginTop: 4 },
});
