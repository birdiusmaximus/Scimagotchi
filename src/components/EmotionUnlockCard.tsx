import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { CompanionOrb } from '@/components/CompanionOrb';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { CompanionVisualState } from '@/services/ai/companionVisualState';
import type { UnlockKind } from '@/state/store';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent, EmotionFamilyId } from '@/types/models';

type Props = {
  event: EmotionEvent;
  kind?: UnlockKind;
  onKeepExploring: () => void;
  onDone: () => void;
};

const familyHead = (f: EmotionFamilyId | null | undefined) =>
  f && EMOTION_MAPS[f] ? EMOTION_MAPS[f].label.split(/[\s&]/)[0] : null;

/**
 * The companion's learning ceremonies (brief §6.4–6.6): a first shape, a deepening
 * of a feeling it already knew, or a confirmed mix of two. The companion changes
 * colour and a short line appears. No fireworks, scores or achievement language;
 * it grows CLEARER, not happier.
 */
export function EmotionUnlockCard({ event, kind = 'first_shape', onKeepExploring, onDone }: Props) {
  const familyWord = familyHead(event.emotion_family) ?? 'This';
  const shapeWord = event.body_cue[0];

  // Per-ceremony copy + the orb's expressive state.
  let kicker = 'FIRST SHAPE';
  let headline = `${familyWord} has its first shape.`;
  let body: string | null = shapeWord
    ? `You described it as ${shapeWord}${event.emotion_shade ? `, closer to ${event.emotion_shade}.` : '.'}`
    : null;
  let orbVisual: CompanionVisualState = 'first_shape';
  let tintFamilies: EmotionFamilyId[] | undefined;

  if (kind === 'deepened') {
    kicker = 'DEEPENED';
    headline = `${familyWord} deepened.`;
    body = event.emotion_shade
      ? `Today you showed me a different shade of it: ${event.emotion_shade}.`
      : 'A familiar feeling, with a little more shape now.';
    orbVisual = 'deepened';
  } else if (kind === 'mixed') {
    const fams = [...new Set((event.strands ?? []).map((s) => s.family))].slice(0, 2);
    const words = fams.map(familyHead).filter(Boolean) as string[];
    kicker = 'TWO FEELINGS';
    headline = words.length >= 2 ? `${words[0]} and ${words[1]} can sit together.` : 'Two feelings can sit together.';
    body = 'I am learning that neither one has to win.';
    orbVisual = 'mixed_strands';
    if (fams.length) tintFamilies = fams;
  }

  return (
    <View style={styles.backdrop}>
      <Glass radius={radii.xl} fill={palette.glassFillStrong} style={styles.card} contentStyle={styles.content}>
        <CompanionOrb size={88} family={event.emotion_family} visual={orbVisual} tintFamilies={tintFamilies} />

        <Txt variant="small" color={palette.inkSoft} align="center" style={styles.kicker}>
          {kicker}
        </Txt>
        <Txt variant="subtitle" align="center">
          {headline}
        </Txt>

        {body ? (
          <Txt variant="body" color={palette.inkSoft} align="center">
            {body}
          </Txt>
        ) : null}

        {event.memory_note ? (
          <View style={styles.note}>
            <Txt variant="label" color={palette.inkOnGlass} align="center">
              {event.memory_note}
            </Txt>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PressableScale onPress={onKeepExploring} style={styles.btnSlot} fill>
            <View style={[styles.btn, styles.btnGhost]}>
              <Txt variant="label" color={palette.accentDeep} numberOfLines={1}>
                Keep talking
              </Txt>
            </View>
          </PressableScale>
          <PressableScale onPress={onDone} style={styles.btnSlot} fill>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, styles.btnSolid]}>
              <Txt variant="label" color={palette.white} numberOfLines={1}>
                Leave it here
              </Txt>
            </LinearGradient>
          </PressableScale>
        </View>
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
  card: { width: '100%', maxWidth: 360 },
  content: { alignItems: 'center', padding: spacing.lg, gap: spacing.sm },
  kicker: { letterSpacing: 2, marginTop: spacing.xs },
  note: {
    marginTop: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  actions: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginTop: spacing.sm },
  btnSlot: { flex: 1 },
  btn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.6)' },
  btnSolid: { overflow: 'hidden' },
});
