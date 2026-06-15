/**
 * The five-way emotional OUTCOME of a turn (v3.1 keystone).
 *
 * The engine used to collapse every turn into a binary "unlocked?". That hid four
 * other things the companion can legitimately understand: that it found only the
 * EDGE of a feeling, that the user chose to HOLD it unnamed, that it has a bare
 * HYPOTHESIS the user never owned, or that it met a NEW FORM of a feeling already
 * known. Naming these as distinct outcomes is what lets the engine — and the
 * evaluator — stop treating a wise "let's leave this unnamed" as a failed unlock,
 * and lets memory stay strict (only `understood` and `new_facet` may persist).
 *
 * Pure + deterministic; FIRST MATCH WINS, so the result is mutually exclusive. The
 * held_unnamed condition is computed here from the same predicate classifyMoments
 * uses, so the outcome can be decided at the orchestration layer (store / eval
 * server) without the moments array — which only the eval server builds.
 */

import { EXIT_CUE } from '@/services/ai/responsePolicy';
import { hasEmotionAnchor, isUncertain } from '@/services/ai/stage';
import { PROGRESS_RANK } from '@/services/ai/progressionEngine';
import type { EmotionEvent, EmotionOutcome, EmotionProgressStage } from '@/types/models';

export interface OutcomeInput {
  /** The final unlocked flag for the turn (after blockUnlock + coherence backstop). */
  unlocked: boolean;
  event: EmotionEvent;
  /** The user's message this turn (for the held-unnamed uncertain/exit read). */
  userText: string;
  /** The active family's progression stage BEFORE this turn (advanceResult.from). */
  progressBefore: EmotionProgressStage | null;
  /** Whether a facet (form) was added or enriched for the active family this turn. */
  facetsGrew: boolean;
}

export function evaluateOutcome(input: OutcomeInput): EmotionOutcome | null {
  const { unlocked, event: ev, userText, progressBefore, facetsGrew } = input;

  // 1) Nothing to record: no feeling in play, savouring (enjoyed at face value, do_not_store),
  //    or a safety-sensitive turn (owned by the safety layer, never an emotional outcome).
  if (!ev.emotion_family || ev.do_not_store === 1 || ev.safety_flag !== 'none') return null;

  // 2) A genuine first shape — the ONLY place 'understood' is minted. It inherits every
  //    upstream unlock gate (ownership, stability, feeling signal, blockUnlock). A family
  //    can first-shape only once; re-meeting an established one is rule 3.
  if (unlocked) return 'understood';

  // 3) A new / enriched FORM of an ALREADY-established emotion = constellation growth,
  //    not a first unlock. Gated on the family already being past first_shape, so this can
  //    never fire on the way TO understood (where unlocked would have caught it).
  if (facetsGrew && progressBefore && PROGRESS_RANK[progressBefore] >= PROGRESS_RANK.first_shape) {
    return 'new_facet';
  }

  const owned = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';

  // 4) Held unnamed — real material surfaced but the label was never user-owned AND the
  //    user is uncertain or winding down. A SUCCESSFUL resting place, not a failed unlock.
  //    (Same predicate as momentType's held_unnamed; stricter than edge_found, so first.)
  if (!owned && hasEmotionAnchor(ev) && (isUncertain(userText) || EXIT_CUE.test(userText ?? ''))) {
    return 'held_unnamed';
  }

  // 5) Edge found — an anchor (body cue / trigger / meaning / urge / owned shade / mixed)
  //    is present but the family label was never user-owned. The positive read of "we saw
  //    the outline but didn't put a name to it".
  if (!owned && hasEmotionAnchor(ev)) return 'edge_found';

  // 6) Hypothesis — the companion floated a label the user never owned, with no real anchor
  //    behind it (an anchor would have made it edge_found above).
  if (ev.label_source === 'companion_hypothesis') return 'hypothesis';

  // 7) In progress — a feeling is named/owned but nothing durable formed yet.
  return null;
}
