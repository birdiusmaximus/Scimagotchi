import { StyleSheet, View } from 'react-native';

import { Txt } from '@/components/Txt';
import { EMOTION_MAPS, FAMILY_COLORS } from '@/data/emotionMaps';
import { PROGRESS_RANK } from '@/services/ai/progressionEngine';
import { useStore } from '@/state/store';
import { palette, spacing } from '@/theme/tokens';
import type { EmotionFamilyId, EmotionProgressStage } from '@/types/models';
import { withAlpha } from '@/utils/color';

const FAMILIES: EmotionFamilyId[] = ['joy', 'calm', 'fear', 'pressure', 'anger', 'sadness', 'hurt', 'shame', 'flat'];

// Kind, non-grade stage words (brief §9.4 / §13.2 — internal ranks, gentle copy).
const STAGE_WORD: Record<EmotionProgressStage, string> = {
  unseen: 'new',
  noticed: 'noticed',
  named: 'named',
  first_shape: 'first shape',
  rooted: 'taking root',
  distinguished: 'distinct',
  returning: 'returning',
  deepened: 'deepened',
};

/**
 * Each family as a small living mark whose presence grows with what the companion
 * has learned to recognise (brief §9.4): faint and small when unseen, fuller and
 * ringed once it has a first shape, with a soft glow when it has returned/deepened.
 * Companion growth tied to what the user taught it, never a score.
 */
function Mark({ family, stage }: { family: EmotionFamilyId; stage: EmotionProgressStage }) {
  const rank = PROGRESS_RANK[stage];
  const color = FAMILY_COLORS[family];
  const seen = rank >= PROGRESS_RANK.noticed;
  const shaped = rank >= PROGRESS_RANK.first_shape;
  const returning = rank >= PROGRESS_RANK.returning;

  const dot = 13 + Math.min(rank, 7) * 2.4; // 13 → 30
  const opacity = 0.2 + (Math.min(rank, 7) / 7) * 0.8;

  return (
    <View style={styles.cell}>
      <View style={[styles.slot, shaped ? { borderColor: withAlpha(color, 0.55), borderWidth: 1.5 } : null]}>
        <View
          style={{
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: withAlpha(color, opacity),
            boxShadow: returning ? `0px 0px 10px 1px ${withAlpha(color, 0.55)}` : undefined,
          }}
        />
      </View>
      <Txt variant="small" color={seen ? palette.inkOnGlass : palette.inkSoft} numberOfLines={1}>
        {EMOTION_MAPS[family].label.split(/[\s&]/)[0]}
      </Txt>
      {seen ? (
        <Txt variant="small" color={palette.inkSoft} style={styles.stage} numberOfLines={1}>
          {STAGE_WORD[stage]}
        </Txt>
      ) : null}
    </View>
  );
}

export function EmotionProgressMap() {
  const progress = useStore((s) => s.progress);
  return (
    <View style={styles.grid}>
      {FAMILIES.map((f) => (
        <Mark key={f} family={f} stage={progress[f]?.current_stage ?? 'unseen'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  cell: { width: '31%', alignItems: 'center', gap: 3 },
  slot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(120,120,160,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  stage: { letterSpacing: 0.3 },
});
