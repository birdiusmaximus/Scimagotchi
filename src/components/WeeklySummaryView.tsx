import { StyleSheet, View } from 'react-native';

import { CompanionOrb } from '@/components/CompanionOrb';
import { Glass } from '@/components/Glass';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { palette, radii, spacing } from '@/theme/tokens';
import type { WeeklySummary } from '@/types/models';
import { prettyWeekRange } from '@/utils/date';

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt variant="subtitle" align="center">
        {n}
      </Txt>
      <Txt variant="small" color={palette.inkSoft} align="center">
        {label}
      </Txt>
    </View>
  );
}

/** The companion's weekly reflection — used in Patterns and the login modal. */
export function WeeklySummaryView({ summary }: { summary: WeeklySummary }) {
  const hasData = summary.checkin_count > 0 || summary.emotions_introduced.length > 0;

  return (
    <Glass radius={radii.xl} fill={palette.glassFillStrong} contentStyle={styles.card}>
      <CompanionOrb size={92} />

      <Txt variant="small" color={palette.inkSoft} align="center" style={styles.kicker}>
        THIS WEEK
      </Txt>
      <Txt variant="subtitle" align="center">
        {prettyWeekRange(summary.week_start)}
      </Txt>

      <Txt variant="body" color={palette.inkOnGlass} align="center" style={styles.narrative}>
        {summary.companion_summary}
      </Txt>

      {summary.emotions_introduced.length ? (
        <View style={styles.chips}>
          {summary.emotions_introduced.map((f) => (
            <View key={f} style={[styles.emoChip, { borderColor: FAMILY_COLORS[f] }]}>
              <View style={[styles.dot, { backgroundColor: FAMILY_COLORS[f] }]} />
              <Txt variant="small" color={palette.inkOnGlass}>
                {EMOTION_MAPS[f].label}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      {hasData ? (
        <View style={styles.stats}>
          <Stat n={summary.checkin_count} label={summary.checkin_count === 1 ? 'check-in' : 'check-ins'} />
          <Stat
            n={summary.emotions_first_shape.length}
            label={summary.emotions_first_shape.length === 1 ? 'first shape' : 'first shapes'}
          />
          <Stat
            n={summary.key_user_phrases.length}
            label={summary.key_user_phrases.length === 1 ? 'phrase' : 'phrases'}
          />
        </View>
      ) : null}

      {summary.key_user_phrases.length ? (
        <View style={styles.phrases}>
          <Txt variant="small" color={palette.inkSoft}>
            In your words
          </Txt>
          {summary.key_user_phrases.map((p, i) => (
            <Txt key={i} variant="body" color={palette.inkOnGlass}>
              “{p}”
            </Txt>
          ))}
        </View>
      ) : null}

      {/* Honest scope — never present sparse data as a whole week (§17.1). */}
      {summary.caveat ? (
        <Txt variant="small" color={palette.inkSoft} align="center" style={styles.caveat}>
          {summary.caveat}
        </Txt>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: spacing.lg, gap: spacing.xs },
  kicker: { letterSpacing: 2, marginTop: spacing.sm },
  narrative: { marginTop: spacing.sm, lineHeight: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md },
  emoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.lg },
  stat: { alignItems: 'center', minWidth: 64 },
  phrases: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: radii.md,
    padding: spacing.md,
  },
  caveat: { marginTop: spacing.md, fontStyle: 'italic', opacity: 0.85, lineHeight: 18 },
});
