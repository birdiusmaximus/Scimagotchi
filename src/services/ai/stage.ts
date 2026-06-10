/**
 * Deterministic unlock-stage evaluation — the APP owns this; the model only
 * proposes extraction. Rewritten per the engine brief (§13.4): First Shape
 * ("understood") requires a USER-OWNED label plus an anchor, with stability —
 * never a single rich model extraction.
 *
 * Allow understood when ALL hold:
 *   - an emotion family and shade are present, and the shade is not user-rejected
 *   - the label is user-owned: they stated it, or explicitly confirmed it
 *     (label_source !== 'companion_hypothesis')
 *   - at least one anchor exists: body cue, urge, trigger, or meaning/appraisal
 *   - stability: the same family+shade persisted from the previous turn, OR the
 *     user explicitly confirmed the label this turn
 *
 * This fixes both eval failure modes: hypothesis unlocks the user rejects a beat
 * later (calm__24, anger__20), and earned "named" feelings stuck behind the old
 * four-field AND when no separate trigger sentence existed (anger__13).
 */

import type { EmotionEvent, UnlockStage } from '@/types/models';

const RANK: Record<UnlockStage, number> = {
  noticed: 0,
  named: 1,
  shaped: 2,
  understood: 3,
  deepened: 4,
};

export function stageRank(stage: UnlockStage): number {
  return RANK[stage];
}

export function evaluateStage(ev: EmotionEvent, prev: EmotionEvent | null = null): UnlockStage {
  if (!ev.emotion_family) return 'noticed';

  const hasShade = !!ev.emotion_shade;
  const anchor =
    ev.body_cue.length > 0 || ev.behaviour_action.length > 0 || !!ev.trigger_event || !!ev.appraisal_thought;

  if (!hasShade) return anchor ? 'shaped' : 'named';

  const rejected = (ev.user_rejected_shades ?? []).some(
    (s) => s.toLowerCase() === ev.emotion_shade!.toLowerCase(),
  );
  const owned = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  const confirmedNow = ev.label_source === 'user_confirmed' || ev.user_confirmation === 'yes';
  const stable =
    !!prev &&
    prev.emotion_family === ev.emotion_family &&
    !!prev.emotion_shade &&
    prev.emotion_shade.toLowerCase() === ev.emotion_shade!.toLowerCase();

  if (!rejected && owned && anchor && (stable || confirmedNow)) return 'understood';

  return anchor ? 'shaped' : 'named';
}
