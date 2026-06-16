/**
 * Typed conversational moments (emotion-strands roadmap, Phase 3).
 *
 * Not every meaningful turn is an "unlock". A feeling can move to a different
 * family (anger -> shame), two feelings can be confirmed at once, a settling
 * feeling can arrive after hard work, the user can surface an internal rule, or
 * decide to actually do something. This classifies WHAT just happened so the rest
 * of the engine can treat each moment on its own terms instead of forcing every
 * turn through the single "unlocked?" gate.
 *
 * Deterministic — the model proposes the event; this code disposes. Pure module
 * (no React/RN imports) so the eval harness can bundle and test it.
 */

import type { EmotionEvent } from '@/types/models';
import { isDifficultFamily, isPositiveFamily } from '@/services/ai/companionPose';
import type { StrandAdvance } from '@/services/ai/progressionEngine';
import { PROGRESS_RANK } from '@/services/ai/progressionEngine';
import { hasEmotionAnchor, isUncertain } from '@/services/ai/stage';
import { EXIT_CUE, NAMING_BOUNDARY } from '@/services/ai/responsePolicy';

export type MomentType =
  | 'unlocked' // a first shape formed — the existing unlock ceremony
  | 'clarified' // the feeling got sharper or corrected, without a new unlock
  | 'hidden_rule' // an internal rule/belief surfaced ("I'm not allowed to take up space")
  | 'mixed_found' // two feelings confirmed co-present this turn
  | 'shift' // the focus moved to a different feeling than the turn before
  | 'landing' // a settling feeling (calm/relief/joy) arrived after difficult work
  | 'repair_intention' // the user decided to do something ("I think I'll call my brother")
  | 'held_unnamed'; // real material surfaced but the feeling stays unnamed — a valid resting place, not a failure

// A decision to act toward someone — the moment a feeling turns into an intention.
const REPAIR_RX =
  /\b(i'?ll|i will|i'?m gonna|i'?m going to|i wanna|i want to|i think i'?ll|i think i might|i might|maybe i'?ll|i need to|i should(?: probably)?|i'?m going to try to|i'?ve decided to|i'?m ready to)\s+(call|phone|ring|text|message|msg|tell|talk to|speak to|ask|reach out|reach back|apologi[sz]e|say (?:something|sorry)|write to|email|see|visit|let .{1,20} know|check in (?:on|with)|make (?:it )?up|sort (?:it|things) out)\b/i;

// An internal rule the user lives by — usually the thing under the feeling.
const HIDDEN_RULE_RX =
  /\b(i'?m not allowed|not allowed to|i'?m not supposed to|i'?m supposed to|i have to be|i always have to|i'?m the one who has to|i must (?:be|always)|if i .{0,32}\b(?:then|she|he|they|i'?m|people|everyone)\b|i can'?t (?:let|ever|be seen|show|afford to)|i'?m the (?:one who|kind who|type who)|i'?m not the (?:kind|type)|i'?m only (?:ok|okay|fine|allowed) (?:if|when)|i'?m a burden|i shouldn'?t (?:need|feel|want|have to)|i'?m too much|i can'?t be the (?:difficult|needy|selfish))/i;

/** Did the user own a NEW shade/phrase this turn (a sharpening, not a fresh start)? */
function ownedSomethingNew(ev: EmotionEvent, prev: EmotionEvent | null): boolean {
  const ownsLabel = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  const ownsShade = ev.shade_source === 'user_stated' || ev.shade_source === 'user_confirmed';
  if (!ownsLabel && !ownsShade) return false;
  const shadeChanged = !!ev.emotion_shade && ev.emotion_shade !== (prev?.emotion_shade ?? null);
  const phraseChanged = !!ev.user_phrase && ev.user_phrase !== (prev?.user_phrase ?? null);
  return shadeChanged || phraseChanged;
}

/** A correction landed this turn (the user rejected a shade that wasn't rejected before). */
function newlyRejected(ev: EmotionEvent, prev: EmotionEvent | null): boolean {
  const before = new Set(prev?.user_rejected_shades ?? []);
  return (ev.user_rejected_shades ?? []).some((s) => !before.has(s));
}

/**
 * Classify the moment(s) this turn represents. Returns every type that applies
 * (a turn can be both a shift AND a landing, or unlocked AND clarified). Order is
 * stable: unlocked, mixed_found, shift, landing, clarified, hidden_rule,
 * repair_intention — most structural first.
 */
export function classifyMoments(
  turn: { event: EmotionEvent; unlocked: boolean },
  prevEvent: EmotionEvent | null,
  strandAdvance: StrandAdvance | null,
  userText: string,
): MomentType[] {
  const ev = turn.event;
  const out: MomentType[] = [];
  const text = ` ${(userText ?? '').toLowerCase().replace(/[’]/g, "'")} `;

  if (turn.unlocked) out.push('unlocked');

  // Two feelings confirmed co-present, newly this turn.
  if (ev.mixed_confirmed === 1 && (prevEvent?.mixed_confirmed ?? 0) !== 1) out.push('mixed_found');

  // The focus moved to a genuinely different feeling than the turn before — and the
  // previous feeling was real (the user had named/stated it), so this is a move, not
  // a first naming.
  const prevReal = !!prevEvent?.emotion_family && prevEvent.label_source != null;
  const curReal = !!ev.emotion_family && ev.label_source != null;
  if (prevReal && curReal && ev.emotion_family !== prevEvent!.emotion_family) out.push('shift');

  // A settling feeling arrived after difficult work: the current feeling is positive
  // and either the turn before was a difficult feeling, or a difficult strand has
  // already taken shape this conversation.
  const workedAStrand = (strandAdvance?.results ?? []).some(
    (r) => isDifficultFamily(r.progress.emotion_family) && PROGRESS_RANK[r.to] >= PROGRESS_RANK.first_shape,
  );
  if (isPositiveFamily(ev.emotion_family) && (isDifficultFamily(prevEvent?.emotion_family) || workedAStrand)) {
    out.push('landing');
  }

  // The feeling got sharper or corrected without a new unlock.
  if (!turn.unlocked && (ownedSomethingNew(ev, prevEvent) || newlyRejected(ev, prevEvent))) out.push('clarified');

  // An internal rule surfaced (in the user's words or the model's read of the thought).
  const ruleHay = `${text}${' '}${(ev.appraisal_thought ?? '').toLowerCase()}`;
  if (HIDDEN_RULE_RX.test(ruleHay)) out.push('hidden_rule');

  // The user decided to do something about it.
  if (REPAIR_RX.test(text)) out.push('repair_intention');

  // Held Unnamed (review action 3): real material surfaced (there's an anchor) but the
  // feeling was never owned, and the user is holding it lightly or winding down. A valid
  // resting place — "I learned the edge of something, but not its name yet" — not a miss.
  const owned = ev.label_source === 'user_stated' || ev.label_source === 'user_confirmed';
  if (!turn.unlocked && !owned && hasEmotionAnchor(ev) && (isUncertain(userText) || EXIT_CUE.test(userText ?? '') || NAMING_BOUNDARY.test(userText ?? ''))) {
    out.push('held_unnamed');
  }

  return out;
}
