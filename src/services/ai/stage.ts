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

// Hard-to-access states (v0.4 §6.4): flat and shame (and the numb/blank/far-away
// language that maps to flat) need one extra substantive turn before a first shape,
// unless the very first message is unusually rich. They should not be rushed.
export const SLOW_PATH_FAMILIES = new Set<EmotionFamilyId>(['flat', 'shame']);

export interface FirstShapeEvidence {
  userOwnedLabel: boolean;
  concreteSituation: boolean;
  userPhraseOrMetaphor: boolean;
  bodyCue: boolean;
  meaningOrAppraisal: boolean;
  mixedEmotionDistinction: boolean;
  repeatedConfirmation: boolean;
  userAcceptedReflection: boolean;
  /** Count of the five MATERIAL signals — the "is there enough to understand?" measure. */
  materialCount: number;
}

/**
 * The richness signals behind a first shape (v0.4 §6.4). A first shape should
 * arrive only when there is enough USER-OWNED material to produce a meaningful
 * insight, never on a single thin extraction ("that's it?").
 */
export function firstShapeEvidence(ev: EmotionEvent, prev: EmotionEvent | null = null): FirstShapeEvidence {
  const userOwnedLabel = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  const concreteSituation = !!ev.trigger_event;
  const userPhraseOrMetaphor =
    !!(ev.user_phrase && ev.user_phrase.trim()) ||
    (ev.user_words_raw ?? '').trim().split(/\s+/).filter(Boolean).length >= 3;
  const bodyCue = ev.body_cue.length > 0 || ev.behaviour_action.length > 0;
  const meaningOrAppraisal = !!ev.appraisal_thought || ev.need_value.length > 0;
  const mixedEmotionDistinction = ev.mixed_confirmed === 1 || (ev.strands?.length ?? 0) >= 2;
  const repeatedConfirmation =
    !!prev &&
    prev.emotion_family === ev.emotion_family &&
    !!prev.emotion_shade &&
    !!ev.emotion_shade &&
    prev.emotion_shade.toLowerCase() === ev.emotion_shade.toLowerCase();
  const userAcceptedReflection = ev.label_source === 'user_confirmed' || ev.user_confirmation === 'yes';
  const materialCount = [
    concreteSituation,
    userPhraseOrMetaphor,
    bodyCue,
    meaningOrAppraisal,
    mixedEmotionDistinction,
  ].filter(Boolean).length;
  return {
    userOwnedLabel,
    concreteSituation,
    userPhraseOrMetaphor,
    bodyCue,
    meaningOrAppraisal,
    mixedEmotionDistinction,
    repeatedConfirmation,
    userAcceptedReflection,
    materialCount,
  };
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
  const e = firstShapeEvidence(ev, prev);
  // Stability guard (no turn-1 unlocks): the shape must have persisted across a
  // turn, or been explicitly accepted this turn.
  const stabilityOk = e.repeatedConfirmation || e.userAcceptedReflection;
  // Richness threshold (§6.4): at least two MATERIAL signals. Slow-path families
  // need an extra substantive turn (stability) unless the material is very rich.
  const slow = SLOW_PATH_FAMILIES.has(ev.emotion_family);
  const enoughMaterial = slow
    ? e.materialCount >= 3 || (e.repeatedConfirmation && e.materialCount >= 2)
    : e.materialCount >= 2;

  if (!rejected && e.userOwnedLabel && stabilityOk && enoughMaterial) return 'understood';

  return anchor ? 'shaped' : 'named';
}

/** Strong, specific shade-acceptance only (a bare "yeah" must not confirm a shade). */
const ACCEPT_SHADE =
  /\b(yes|yeah|yep|exactly|thats? (it|right|the (one|word))|that fits|that'?s the word|the right word|good word)\b/;

/**
 * Is the SHADE the user's own, not the companion's taxonomy (v0.4 §6.3)? True when
 * the user used the shade word themselves (this turn or earlier), or just accepted
 * the companion's proposed shade. Used to set shade_source so an inferred shade is
 * never stored as user-confirmed.
 */
export function shadeIsUserOwned(
  shade: string | null | undefined,
  userText: string,
  history: { role: 'user' | 'companion'; content: string }[],
  opts?: { proposedShade?: string | null },
): boolean {
  if (!shade || !shade.trim()) return false;
  const w = shade.toLowerCase().trim();
  const said = (text: string) => ` ${text.toLowerCase()} `.includes(` ${w} `) || new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
  if (said(userText)) return true;
  if (history.some((m) => m.role === 'user' && said(m.content))) return true;
  // Accept-branch: a generic acceptance ("exactly", "that's the word") confirms a
  // shade ONLY when it is the same shade that was actually on the table last turn —
  // never a taxonomy word the model just swapped in (the "pulled thin" -> "stretched"
  // drift the gate exists to prevent, §6.3).
  const proposed = (opts?.proposedShade ?? '').toLowerCase().trim();
  if (proposed && proposed === w && ACCEPT_SHADE.test(` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `)) return true;
  return false;
}

// The user is correcting a shade the companion proposed ("no, not dread", "that
// doesn't fit", "wrong word") — NOT a bare "no" (too broad).
const SHADE_REJECT =
  /\b(not (really|quite|it|that|the word)|that'?s not (it|right|the word|quite it)|doesn'?t (fit|feel right|sound right|quite fit)|isn'?t (it|right|the word)|wrong word|no not|not the right word)\b/;

/**
 * Unlock pushback detector (v0.4 §6.3/Phase 3): when the user corrects a shade the
 * companion had in play, return that shade so the caller can mark it rejected. This
 * stops a hypothesis from unlocking and then being rejected a beat later.
 */
export function detectShadeRejection(userText: string, prev: Pick<EmotionEvent, 'emotion_shade'> | null): string | null {
  if (!prev?.emotion_shade) return null;
  const t = ` ${userText.toLowerCase().replace(/[’'`]/g, "'")} `;
  return SHADE_REJECT.test(t) ? prev.emotion_shade : null;
}

// The user is signalling uncertainty rather than emotional content ("not sure",
// "i dont know", "hard to say", "maybe"). Uncertainty is welcome — but it must make
// the companion MORE curious, never more confident: no stage advance, no unlock, no
// memory, no "I know this better now: not sure". (NOT the "not quite" rejection, which
// is handled separately.)
const UNCERTAIN_RX =
  /\b(not sure|no idea|no clue|i dont know|i don'?t know|dunno|idk|hard to say|hard to put|cant tell|cannot tell|cant say|not really sure|not quite sure|unsure|unclear|i can'?t name it|dont have (a|the) word|cant find the word)\b/;
// Bare hedges that read as uncertainty when they are essentially the whole reply.
const HEDGE_RX = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows)[.!?\s]*$/;

/** True when the user's turn is primarily uncertainty (not a feeling or detail). */
export function isUncertain(userText: string): boolean {
  const norm = (userText || '').toLowerCase().replace(/[’'`]/g, "'").trim();
  return UNCERTAIN_RX.test(` ${norm} `) || HEDGE_RX.test(norm);
}

/**
 * Does the event carry a REAL, user-owned emotional anchor (detail beyond a bare
 * label or uncertainty)? Required before a learned moment (first shape / deepening)
 * may be shown or saved, so the companion never "learns" from an empty or unsure
 * turn. A body cue, an urge, a trigger, a meaning, a need, an owned shade, or a
 * confirmed mix all count.
 */
export function hasEmotionAnchor(
  ev: Pick<
    EmotionEvent,
    'body_cue' | 'behaviour_action' | 'trigger_event' | 'appraisal_thought' | 'need_value' | 'shade_source' | 'emotion_shade' | 'mixed_confirmed' | 'strands'
  >,
): boolean {
  const ownedShade = !!ev.emotion_shade && (ev.shade_source === 'user_stated' || ev.shade_source === 'user_confirmed');
  return (
    (ev.body_cue?.length ?? 0) > 0 ||
    (ev.behaviour_action?.length ?? 0) > 0 ||
    !!ev.trigger_event ||
    !!ev.appraisal_thought ||
    (ev.need_value?.length ?? 0) > 0 ||
    ownedShade ||
    ev.mixed_confirmed === 1 ||
    (ev.strands?.length ?? 0) >= 2
  );
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
