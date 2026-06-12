/**
 * Companion visual state (engine brief §18) — a deterministic mapping from app
 * state to what the orb should communicate. Animation expresses emotional
 * clarity, never reward (no confetti, no trophies, no pet suffering).
 */

import type { EmotionEvent, EmotionFamilyId, EmotionProgress, EmotionProgressStage, UnlockStage } from '@/types/models';

/**
 * How fully the orb wears a feeling's hue at each in-conversation unlock stage (#2/#3):
 * barely there when first noticed, building as it unlocks, full only when deepened. Used
 * for the live tint in chat and for the slow colour fade when returning home.
 */
export function tintLevelForStage(stage: UnlockStage | null | undefined): number {
  switch (stage) {
    case 'deepened':
      return 1;
    case 'understood':
      return 0.82;
    case 'shaped':
      return 0.6;
    case 'named':
      return 0.4;
    case 'noticed':
      return 0.22;
    default:
      return 0.2;
  }
}

export type CompanionVisualState =
  | 'idle_calm'
  | 'searching'
  | 'uncertain'
  | 'stabilising'
  | 'first_shape'
  | 'mixed_strands'
  | 'returning_shape'
  | 'deepened'
  | 'safety_receded';

export interface VisualInputs {
  safetyVisible: boolean;
  safetyCheckPending: boolean;
  sending: boolean;
  unlockShowing: boolean;
  draftEvent: EmotionEvent | null;
  progressStage: EmotionProgressStage | null; // current family's progression
}

/** Priority-ordered selection: safety always wins; clarity states beat ambience. */
export function selectVisualState(s: VisualInputs): CompanionVisualState {
  if (s.safetyVisible || s.safetyCheckPending) return 'safety_receded';
  if (s.unlockShowing) return 'first_shape';
  if (s.sending) return 'searching';
  if ((s.draftEvent?.strands?.length ?? 0) >= 2) return 'mixed_strands';
  if (s.progressStage === 'deepened') return 'deepened';
  if (s.progressStage === 'returning') return 'returning_shape';
  // The feeling is taking a clear shape: a user-owned family + shade, settling
  // toward (but not yet at) a first shape (§6.3 step 3).
  const d = s.draftEvent;
  if (d?.emotion_family && d?.emotion_shade && (d.label_source === 'user_stated' || d.label_source === 'user_confirmed')) {
    return 'stabilising';
  }
  if (d && !d.emotion_family) return 'uncertain';
  return 'idle_calm';
}

/** The families to tint with for the current state (foreground first; max 2). */
export function visualTintFamilies(draftEvent: EmotionEvent | null): EmotionFamilyId[] {
  if (!draftEvent) return [];
  const strands = draftEvent.strands ?? [];
  if (strands.length >= 2) {
    const fg = strands.find((x) => x.salience === 'foreground') ?? strands[0];
    const bg = strands.find((x) => x.family !== fg.family);
    return bg ? [fg.family, bg.family] : [fg.family];
  }
  return draftEvent.emotion_family ? [draftEvent.emotion_family] : [];
}

/** Convenience selector over the app store shape (kept loose to avoid coupling). */
export function selectOrbVisual(s: {
  safety: { visible: boolean };
  safetyCheck: unknown;
  sending: boolean;
  unlock: unknown;
  draftEvent: EmotionEvent | null;
  progress: Partial<Record<EmotionFamilyId, EmotionProgress>>;
}): { visual: CompanionVisualState; tintFamilies: EmotionFamilyId[] } {
  const family = s.draftEvent?.emotion_family ?? null;
  const progressStage = family ? (s.progress[family]?.current_stage ?? null) : null;
  return {
    visual: selectVisualState({
      safetyVisible: s.safety.visible,
      safetyCheckPending: !!s.safetyCheck,
      sending: s.sending,
      unlockShowing: !!s.unlock,
      draftEvent: s.draftEvent,
      progressStage,
    }),
    tintFamilies: visualTintFamilies(s.draftEvent),
  };
}
