import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { CompanionOrb } from '@/components/CompanionOrb';
import { Glass } from '@/components/Glass';
import { PressableScale } from '@/components/PressableScale';
import { Txt } from '@/components/Txt';
import { EMOTION_MAPS } from '@/data/emotionMaps';
import { gradients, palette, radii, spacing } from '@/theme/tokens';
import type { EmotionEvent } from '@/types/models';

type Props = {
  event: EmotionEvent;
  onKeepExploring: () => void;
  onDone: () => void;
};

/**
 * The first-shape unlock moment (brief §11.5): the companion changes colour, a
 * short line appears, the record is saved. No fireworks, scores or achievement
 * language — clarity is the reward.
 */
export function EmotionUnlockCard({ event, onKeepExploring, onDone }: Props) {
  const map = event.emotion_family ? EMOTION_MAPS[event.emotion_family] : null;
  const familyWord = map ? map.label.split(' ')[0] : 'This';
  const shapeWord = event.body_cue[0];

  return (
    <View style={styles.backdrop}>
      <Glass radius={radii.xl} fill={palette.glassFillStrong} style={styles.card} contentStyle={styles.content}>
        <CompanionOrb size={88} family={event.emotion_family} />

        <Txt variant="small" color={palette.inkSoft} align="center" style={styles.kicker}>
          FIRST SHAPE
        </Txt>
        <Txt variant="subtitle" align="center">
          {familyWord} has its first shape.
        </Txt>

        {shapeWord ? (
          <Txt variant="body" color={palette.inkSoft} align="center">
            You described it as {shapeWord}
            {event.emotion_shade ? `, closer to ${event.emotion_shade}.` : '.'}
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
          <PressableScale onPress={onKeepExploring} style={[styles.btn, styles.btnGhost]}>
            <Txt variant="label" color={palette.accentDeep}>
              Keep talking
            </Txt>
          </PressableScale>
          <PressableScale onPress={onDone} style={styles.btnGrow}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.btn, styles.btnSolid]}>
              <Txt variant="label" color={palette.white}>
                Leave it here for now
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
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radii.pill, alignItems: 'center' },
  btnGrow: { flexShrink: 1 },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.6)' },
  btnSolid: { overflow: 'hidden' },
});
