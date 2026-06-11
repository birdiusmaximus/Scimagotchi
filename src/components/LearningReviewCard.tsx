import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { MemoryCard } from '@/types/models';
import { tintPair } from '@/utils/color';

type Props = {
  cards: MemoryCard[];
  onForget: (id: string) => void;
  onDone: () => void;
};

const DANGER = '#C0506B';

/**
 * Session-end "What I learned" review (brief §7.2). Memory is auto-learned, so
 * this is about TRANSPARENCY, not a save gate: it simply shows what the companion
 * kept from this conversation, in the user's own words, and lets them forget any
 * of it. Warm, never a report card.
 */
export function LearningReviewCard({ cards, onForget, onDone }: Props) {
  return (
    <View style={styles.backdrop}>
      <Glass radius={radii.xl} fill={palette.glassFillStrong} style={styles.card} contentStyle={styles.content}>
        <View style={styles.kickerRow}>
          <Feather name="feather" size={13} color={palette.accentDeep} />
          <Txt variant="small" color={palette.inkSoft} style={styles.kicker}>
            WHAT I LEARNED TODAY
          </Txt>
        </View>
        <Txt variant="body" color={palette.inkSoft} align="center" style={styles.intro}>
          Here is what I kept from this. You can let me forget anything that should not stay.
        </Txt>

        <ScrollView style={styles.list} contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
          {cards.map((c) => {
            const fam = c.emotion_family;
            const color = fam ? FAMILY_COLORS[fam] : palette.inkSoft;
            const label = fam && EMOTION_MAPS[fam] ? EMOTION_MAPS[fam].label.split(/[\s&]/)[0] : null;
            return (
              <View key={c.id} style={styles.item}>
                <View style={[styles.spine, { backgroundColor: color }]} />
                <View style={styles.itemBody}>
                  {label ? (
                    <Txt variant="small" color={color} style={styles.itemLabel}>
                      {label.toUpperCase()}
                    </Txt>
                  ) : null}
                  <Txt variant="label" color={palette.inkOnGlass}>
                    {c.summary}
                  </Txt>
                  {c.user_words.length ? (
                    <Txt variant="small" color={palette.inkSoft} numberOfLines={1}>
                      your words: “{c.user_words[0]}”
                    </Txt>
                  ) : null}
                </View>
                <PressableScale hitSlop={8} onPress={() => onForget(c.id)} style={styles.forget}>
                  <Feather name="trash-2" size={15} color={DANGER} />
                </PressableScale>
              </View>
            );
          })}
        </ScrollView>

        <PressableScale onPress={onDone} style={styles.doneWrap} fill>
          <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.done}>
            <Txt variant="label" color={palette.white} numberOfLines={1}>
              Keep these
            </Txt>
          </LinearGradient>
        </PressableScale>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(60,58,107,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: { width: '100%', maxWidth: 380 },
  content: { padding: spacing.lg, gap: spacing.sm },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  kicker: { letterSpacing: 2 },
  intro: { lineHeight: 21 },
  list: { alignSelf: 'stretch', maxHeight: 280, marginTop: spacing.xs },
  item: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.66)',
    borderTopRightRadius: radii.md,
    borderBottomRightRadius: radii.md,
    overflow: 'hidden',
  },
  spine: { width: 5 },
  itemBody: { flex: 1, paddingVertical: 10, paddingHorizontal: spacing.md, gap: 1 },
  itemLabel: { letterSpacing: 1 },
  forget: { paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center' },
  doneWrap: { alignSelf: 'stretch', marginTop: spacing.xs },
  done: {
    minHeight: 48,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
