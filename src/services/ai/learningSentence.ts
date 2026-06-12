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
import type { EmotionEvent, EmotionFamilyId, MixedRelation } from '@/types/models';
import { stripEmDashes } from '@/utils/text';

export type LearningKind = 'first_shape' | 'deepened' | 'mixed';

// Uncertainty and identity-level self-condemnation must never appear in a learned
// summary (brief §6,7): the companion can notice how shame speaks, but it never
// stores or dramatises "I am bad" as a truth. IDENTITY_CONDEMNATION is exported so
// the memory layer blocks the same phrases from durable storage.
const HOLLOW_RX = /\b(not sure|no idea|no clue|i don'?t know|dunno|idk|hard to say|unsure|unclear|i can'?t name it)\b/i;
export const IDENTITY_CONDEMNATION =
  /\b(bad person|terrible person|horrible person|awful person|not good enough|not enough|a failure|fundamentally flawed|worthless|unlovable|defective|something (is )?wrong with me|broken inside|i (hate|despise) myself|a burden to)\b/i;

/** A short, non-clinical phrase for how two strands relate. */
function relationWord(rel: MixedRelation | null | undefined): string {
  switch (rel) {
    case 'foreground_background':
      return 'one in front and one underneath';
    case 'protective_layer':
      return 'one guarding the other';
    case 'oscillating':
      return 'each taking its turn';
    case 'simultaneous':
      return 'both at once';
    default:
      return '';
  }
}

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

function finish(s: string): string {
  const t = stripEmDashes(s).replace(/\s+/g, ' ').trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** True when two user fragments say essentially the same thing — so the sentence
 *  never echoes one fragment twice ("...like X, especially when X"). */
function samey(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const nb = b.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (!na || !nb) return false;
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;
  const aw = new Set(na.split(' '));
  const bw = new Set(nb.split(' '));
  let inter = 0;
  for (const w of aw) if (bw.has(w)) inter++;
  const union = new Set([...aw, ...bw]).size;
  return union > 0 && inter / union >= 0.6;
}

/** A phrase reads badly embedded as "<fam> can feel like <phrase>" when it is a
 *  single word, a dangling comparative ("than stress"), or just restates the
 *  family word ("pressure than stress" under "pressure"). Drop it from the
 *  "feels like" frame and let a cleaner, context-led template take over. */
function weakPhrase(phrase: string, fam: string): boolean {
  const p = phrase.toLowerCase().trim();
  if (!p || p === fam) return true;
  if (p.split(/\s+/).length < 2) return true;
  if (/^(than|more than|less than|rather than|like|vs|versus|not)\b/.test(p)) return true;
  return new RegExp(`^${fam}\\b\\s+(than|vs|versus|or|not|more|less)\\b`).test(p);
}

/**
 * Compose the learning sentence for an unlock ceremony, in restrained forms (brief §6):
 *   first shape -> "[Emotion] has a first shape here: [user-owned felt anchor]."
 *   deepened    -> "This became more specific: [distinction / felt anchor]."
 *   mixed       -> "Two feelings are present: [A] and [B], with [relationship]."
 * The anchor is the FELT quality (body, impulse, the user's metaphor, or meaning),
 * never a scene description and never identity-level self-condemnation.
 */
export function composeLearningSentence(ev: EmotionEvent, kind: LearningKind = 'first_shape'): string {
  const fam = familyWord(ev.emotion_family);
  const Fam = fam.charAt(0).toUpperCase() + fam.slice(1);
  const rawPhrase = frag(ev.user_phrase ?? ev.user_words_raw ?? '');
  const phrase = isUncertain(rawPhrase) || IDENTITY_CONDEMNATION.test(rawPhrase) ? '' : rawPhrase;
  const goodPhrase = !!phrase && !weakPhrase(phrase, fam);
  const context = frag(ev.trigger_event ?? '', 70);

  if (kind === 'mixed') {
    const fams = [...new Set((ev.strands ?? []).map((s) => s.family))].slice(0, 2).map(familyWord);
    if (fams.length >= 2 && fams[0] !== fams[1]) {
      const rel = relationWord(ev.mixed_relation);
      return finish(`Two feelings are present: ${fams[0]} and ${fams[1]}, ${rel || 'and neither has to win'}`);
    }
    return finish('Two feelings are here at once, and neither has to win');
  }

  // The felt anchor: the user's own metaphor first, then body, impulse, or meaning —
  // skipping any identity-level self-judgement ("I'm a bad person").
  const candidates = [
    goodPhrase ? phrase : '',
    frag(ev.body_cue?.[0] ?? '', 60),
    frag(ev.behaviour_action?.[0] ?? '', 60),
    frag(ev.appraisal_thought ?? '', 60),
  ];
  const feltAnchor = candidates.find((c) => c && !IDENTITY_CONDEMNATION.test(c)) ?? '';

  if (kind === 'deepened') {
    if (feltAnchor) return finish(`This became more specific: ${feltAnchor}`);
    if (context) return finish(`This became more specific, the way it comes up when ${context}`);
    return finish(`I know this ${fam} a little better now than I did before`);
  }

  // first_shape
  if (feltAnchor) return finish(`${Fam} has a first shape here: ${feltAnchor}`);
  if (context) return finish(`${Fam} is starting to take shape, around ${context}`);
  return finish(`This is the first shape of ${fam} you've shown me`);
}

/**
 * Copy-quality gate (brief §13): an unlock ceremony only shows if the learned sentence
 * is genuinely clean — not hollow/uncertain, not identity-reinforcing, and not the bare
 * generic fallback (which means nothing real was learned). Callers suppress the modal
 * and keep progress internal when this returns false.
 */
export function summaryIsClean(summary: string, _ev?: EmotionEvent): boolean {
  const s = (summary ?? '').trim();
  if (!s) return false;
  if (HOLLOW_RX.test(s) || isUncertain(s)) return false;
  if (IDENTITY_CONDEMNATION.test(s)) return false;
  // The bare fallbacks mean no real felt anchor was captured — don't dramatise them.
  if (/first shape of \w+ you'?ve shown me\.?$/i.test(s)) return false;
  if (/a little better now than i did before\.?$/i.test(s)) return false;
  return true;
}
