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

import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { EmotionEvent, EmotionFamilyId, UnlockStage } from '@/types/models';

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

/** Affirmation of a label the companion already proposed ("yeah, that's it"). */
const AFFIRM_LABEL =
  /\b(yes|yeah|yep|yup|exactly|totally|definitely|for sure|that'?s it|that'?s right|spot on|pretty much|sounds right|that fits|fits|correct)\b/;

/**
 * A feeling is the user's to name (engine brief §8.1). The model may PROPOSE a
 * family from a described situation, but it cannot mark the label as theirs
 * unless they actually own it: they used a word for this family themselves (this
 * turn or earlier), or they affirmed a family already in play. The cloud mapper
 * uses this to downgrade an unearned user_stated/user_confirmed claim back to a
 * hypothesis, so the First-Shape gate holds and the companion confirms before
 * any first shape forms. Applies to every family.
 */
export function labelIsUserOwned(
  fam: EmotionFamilyId,
  userText: string,
  history: { role: 'user' | 'companion'; content: string }[],
  prev: Pick<EmotionEvent, 'emotion_family'> | null,
): boolean {
  const named = (text: string) => {
    const t = ` ${text.toLowerCase()} `;
    return EMOTION_MAPS[fam].familyKeywords.some((w) => t.includes(w));
  };
  if (named(userText)) return true;
  if (history.some((m) => m.role === 'user' && named(m.content))) return true;
  if (prev?.emotion_family === fam && AFFIRM_LABEL.test(` ${userText.toLowerCase()} `)) return true;
  return false;
}

/**
 * Capture-fidelity helper (brief §5.5): did the user just explicitly CONFIRM the
 * family the companion already had in play? Used by the cloud mapper to upgrade
 * label_source to user_confirmed even when the model under-reported it, so an
 * accepted label consolidates to "understood" instead of getting stuck at shaped.
 * Covers bare affirmations ("yeah, that's it") and accept-phrases ("that's
 * closer", "i think it is", "probably") of a candidate already on the table.
 */
// STRONG, label-specific acceptances only — a bare "yeah" must NOT consolidate a
// first shape (that would be a premature unlock). These clearly accept a proposal.
const ACCEPT_LABEL =
  /\b(thats? (it|right|closer|the one|exactly it)|that fits|that does fit|i think (it is|its|thats) (it|right)?|probably (that|it)|yeah thats (it|right)|yes thats (it|right))\b/;

export function userConfirmsLabel(userText: string, prev: Pick<EmotionEvent, 'emotion_family'> | null): boolean {
  if (!prev?.emotion_family) return false;
  const t = ` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `;
  return ACCEPT_LABEL.test(t);
}
