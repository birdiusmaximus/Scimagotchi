/**
 * Deterministic unlock-stage evaluation. The APP owns this — the AI proposes
 * extraction, but whether an emotion is "Understood" (first shape) is decided here
 * from the brief's criteria (§7.5): family + shade + a felt shape (body or urge) +
 * a trigger/context.
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

export function evaluateStage(ev: EmotionEvent): UnlockStage {
  if (!ev.emotion_family) return 'noticed';
  const hasShade = !!ev.emotion_shade;
  const hasShape = ev.body_cue.length > 0 || ev.behaviour_action.length > 0;
  const hasTrigger = !!ev.trigger_event;
  if (hasShade && hasShape && hasTrigger) return 'understood';
  if (hasShape) return 'shaped';
  return 'named';
}
