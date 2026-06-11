/**
 * Companion learning sentences (v0.4 §6.5). When a first shape forms, the companion
 * says what it has LEARNED, in the user's own language, so an unlock feels like a
 * shared discovery rather than a label being filed. Deterministic and testable:
 * the template is chosen by the evidence actually present, never at random.
 *
 * Hard rules (§6.5): use the user's words, never overclaim, no therapy language,
 * never imply a symptom improved, no "you are someone who…", and no em dashes. It
 * should sound like the companion understands a little better, not like a verdict.
 */

import { EMOTION_MAPS } from '@/data/emotionMaps';
import { isUncertain } from '@/services/ai/stage';
import type { EmotionEvent, EmotionFamilyId } from '@/types/models';
import { stripEmDashes } from '@/utils/text';

export type LearningKind = 'first_shape' | 'deepened' | 'mixed';

/** The plain head word of a family ("pressure", "sadness"), lower-cased for mid-sentence use. */
function familyWord(f: EmotionFamilyId | null | undefined): string {
  return f && EMOTION_MAPS[f] ? EMOTION_MAPS[f].label.split(/[\s&]/)[0].toLowerCase() : 'this';
}

/** Trim a user fragment for embedding: drop surrounding quotes and trailing punctuation. */
function frag(s: string | null | undefined, max = 90): string {
  let t = (s ?? '').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/[\s,;:.!?]+$/g, '').trim();
  if (t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '').trim();
  return t;
}

/** A short texture/meaning fragment from the body, appraisal, or need, if any. */
function textureOf(ev: EmotionEvent): string {
  return frag(ev.body_cue?.[0] ?? ev.appraisal_thought ?? ev.need_value?.[0] ?? '', 60);
}

function finish(s: string): string {
  const t = stripEmDashes(s).replace(/\s+/g, ' ').trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * Compose the learning sentence for an unlock ceremony. `kind` selects the family
 * of templates; within first_shape the wording varies by what the user actually
 * gave (their phrase, the situation, a body/meaning texture), so repeated unlocks
 * never read identically.
 */
export function composeLearningSentence(ev: EmotionEvent, kind: LearningKind = 'first_shape'): string {
  const fam = familyWord(ev.emotion_family);
  // Never build a "learned" sentence from uncertainty ("not sure") — drop it and
  // fall back to a phrase-free template (a last guard; the modal shouldn't even show).
  const rawPhrase = frag(ev.user_phrase ?? ev.user_words_raw ?? '');
  const phrase = isUncertain(rawPhrase) ? '' : rawPhrase;
  const context = frag(ev.trigger_event ?? '', 70);
  const texture = textureOf(ev);

  if (kind === 'mixed') {
    const fams = [...new Set((ev.strands ?? []).map((s) => s.family))].slice(0, 2).map(familyWord);
    if (fams.length >= 2 && fams[0] !== fams[1]) {
      return finish(`I am learning that ${fams[0]} and ${fams[1]} can sit in you at the same time, and neither has to win`);
    }
    return finish('I am learning that more than one feeling can sit in you at once, and neither has to win');
  }

  if (kind === 'deepened') {
    if (phrase && context) return finish(`I know this a little better now: ${phrase}, the way it comes up when ${context}`);
    if (phrase) return finish(`I know this a little better now: ${phrase}`);
    return finish(`I know this ${fam} a little better now than I did before`);
  }

  // first_shape — pick the richest template the evidence supports.
  if (phrase && context) return finish(`I think I'm learning that for you, ${fam} can feel like ${phrase}, especially when ${context}`);
  if (phrase && texture) return finish(`This one has a shape now: ${phrase}, with ${texture} in it, not just ${fam}`);
  if (phrase) return finish(`I think this is the first shape of ${fam} you've shown me: ${phrase}`);
  if (context) return finish(`I think this is the first shape of ${fam} you've shown me, the way it comes up when ${context}`);
  return finish(`I think this is the first shape of ${fam} you've shown me`);
}
