/**
 * Visible-reply ownership gate (engine brief v0.3 §5.1).
 *
 * The deterministic stage gate (stage.ts) protects the unlock + the saved record,
 * but the user experiences the SPOKEN sentence, not the metadata. So the model can
 * still slip an assertion of a feeling the person has not named or accepted, e.g.
 * "that is hurt" or "the shame underneath". This module detects that slip on the
 * outgoing reply so the engine can repair it (ideally a constrained re-call;
 * deterministic softening as a fallback). Pure module — no React/RN imports — so
 * the eval harness can bundle and test it.
 */

import { EMOTION_MAPS } from '@/data/emotionMaps';
import type { EmotionEvent } from '@/types/models';

const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The specific words at stake for this turn: the shade + the family's headword. */
function emotionWordsFor(event: EmotionEvent): string[] {
  const out: string[] = [];
  if (event.emotion_shade) out.push(event.emotion_shade.toLowerCase());
  if (event.emotion_family) out.push(EMOTION_MAPS[event.emotion_family].label.split(/[\s&]/)[0].toLowerCase());
  return [...new Set(out)].map(escapeRx).filter(Boolean);
}

/** Tentative markers — a sentence carrying one is already owned-safe. */
const TENTATIVE =
  /(might|maybe|perhaps|could be|i wonder|wondering|not sure|or is it|or not|does (that|this) fit|or something else|don'?t want to name|seems like it (might|could)|i think it (might|could)|possibly|if (that|it) fits|leave it unnamed|keep it unnamed|don'?t have to name)/i;

/** Declarative frames that ASSERT an emotion word (built per turn for the words at stake). */
function declarativeFrames(words: string[]): RegExp[] {
  const W = `(?:${words.join('|')})`;
  return [
    new RegExp(`\\b(?:this|that|it)(?:'s| is| was) (?:a |an |the |some |a kind of |a sort of )?${W}\\b`, 'i'),
    new RegExp(`\\b(?:you are|you're|youre) (?:feeling )?${W}\\b`, 'i'),
    new RegExp(`\\b(?:carries|holding|full of|comes from) (?:some |the )?${W}\\b`, 'i'),
    new RegExp(`\\bthe ${W} (?:underneath|under it|beneath|is the centre|is the heart|is clear|here is clear)\\b`, 'i'),
    new RegExp(`\\b(?:the )?shape of (?:${W}|being |feeling )`, 'i'),
    new RegExp(`\\b${W} is (?:the centre|the heart|clear|underneath|what'?s here)\\b`, 'i'),
  ];
}

const sentences = (reply: string): string[] => reply.split(/(?<=[.!?])\s+/);

/**
 * True when the reply states the turn's (companion-hypothesised) feeling as fact
 * in a sentence that has no tentative hedge.
 */
export function replyContainsDeclarativeEmotionAssertion(reply: string, event: EmotionEvent): boolean {
  const words = emotionWordsFor(event);
  if (!words.length) return false;
  const frames = declarativeFrames(words);
  return sentences(reply).some((s) => !TENTATIVE.test(s) && frames.some((rx) => rx.test(s)));
}

/**
 * The reply needs ownership repair when the label is NOT user-owned yet the reply
 * declaratively asserts it. (When the user already owns the label, assertions are fine.)
 */
export function needsOwnershipRepair(reply: string, event: EmotionEvent, isOwned: boolean): boolean {
  if (isOwned) return false;
  if (!event.emotion_family && !event.emotion_shade) return false;
  return replyContainsDeclarativeEmotionAssertion(reply, event);
}

/**
 * Deterministic FALLBACK softener (used only if a constrained re-call is
 * unavailable or also slips): rewrite the assertive frames into tentative ones.
 * Best-effort and conservative; the re-call produces more natural text.
 */
export function softenUnownedEmotionReply(reply: string, event: EmotionEvent): string {
  const words = emotionWordsFor(event);
  if (!words.length) return reply;
  const W = `(?:${words.join('|')})`;
  let r = reply;
  // "this is X" / "that's X" / "it was X" → "this might be X"
  r = r.replace(
    new RegExp(`\\b(this|that|it)(?:'s| is| was) ((?:a |an |the |some |a kind of |a sort of )?${W})\\b`, 'gi'),
    (_m, subj, rest) => `${subj} might be ${rest}`,
  );
  // "you are X" / "you're X" → "you might be feeling X"
  r = r.replace(new RegExp(`\\b(?:you are|you're|youre) (?:feeling )?(${W})\\b`, 'gi'), (_m, w) => `you might be feeling ${w}`);
  // "the X underneath / at the centre" → "maybe some X"
  r = r.replace(new RegExp(`\\bthe (${W}) (underneath|under it|beneath|is the centre|is the heart|is clear)\\b`, 'gi'), (_m, w) => `maybe some ${w}`);
  // "X is the centre/heart/clear" → "there might be X here"
  r = r.replace(new RegExp(`\\b(${W}) is (?:the centre|the heart|clear|underneath|what'?s here)\\b`, 'gi'), (_m, w) => `there might be ${w} here`);
  return r;
}
