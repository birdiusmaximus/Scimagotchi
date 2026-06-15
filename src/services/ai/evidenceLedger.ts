/**
 * Evidence ledger (review actions 1 & 2) — what the USER has actually contributed,
 * tracked apart from what the companion proposed. The unlock gate uses it to require a
 * user-OWNED concrete detail before a first shape, so a feeling is never "understood"
 * off bare agreement, echoed words, or the companion's own extractions. Notice fast,
 * learn slow: the model may extract richly, but a shape is only earned from the
 * person's own words.
 *
 * Pure module (no React/RN imports) so the eval harness can bundle and test it.
 */

import type { EmotionEvent } from '@/types/models';
import { EMOTION_MAPS } from '@/data/emotionMaps';

type Turn = { role: 'user' | 'companion'; content: string };

const STOP = new Set(
  ('the a an and or but so of to in on at for with about from into onto over under as it its this that these those there here ' +
    'is are was were be been being am im i me my we us our you your he she they them his her their just really very quite too also ' +
    'even still only feel feels feeling felt like dont cant not no yes yeah well kind sorta sort bit more most much many lot lots ' +
    'thing things stuff get got getting going gonna want wanted need needed know knew think thought guess maybe sure okay ok')
    .split(/\s+/),
);

function contentWords(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/'/g, ''))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** The user's own words across the conversation (this turn + their prior turns), lowercased. */
function userCorpus(userText: string, history: Turn[]): string {
  const parts = [userText, ...(history ?? []).filter((m) => m.role === 'user').map((m) => m.content)];
  return ` ${parts.join('  ').toLowerCase()} `;
}

// Words that are NOT a real felt signal: vague/not-located shades, and hedge/uncertainty
// tokens that the emotion maps happen to list as routing keywords ("dunno", "nothing").
const VAGUE = /^(foggy|fog|blurry|blurred|hazy|fuzzy|murky|cloudy|unclear|undefined|indistinct|unnameable|unnamed|vague|off|weird|strange|odd|funny|something|blank|dunno|idk|nothing|meh|whatever|unsure|nope|nah|nope)$/i;

// Every family's own feeling words (joy, scared, furious, grieving, ashamed, …), minus
// vague ones — a word from here, voiced by the user, is them naming a real feeling.
const EMOTION_WORDS = new RegExp(
  `\\b(${[...new Set(Object.values(EMOTION_MAPS).flatMap((m) => m.familyKeywords))]
    .filter((w) => w && !VAGUE.test(w))
    .map((w) => w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')})\\b`,
  'i',
);

// A body sensation, an urge/behaviour, or a vivid felt descriptor — the language a
// person uses when they are actually IN the feeling, which bare agreement, hedging and
// echoing never produce. This is the felt signal a first shape must rest on.
const CONCRETE_FELT =
  /\b(chest|throat|stomach|gut|belly|heart|shoulders?|jaw|neck|head|hands?|arms?|legs?|skin|ribs?|body|tight(ness)?|tense|clench\w*|heavy|heaviness|hollow|empt\w*|ache|aching|achy|weight|knot\w*|sick|nause\w*|shak\w*|trembl\w*|buzz\w*|burn\w*|hot|cold|numb|frozen|freeze|froze|racing|pounding|breath\w*|sink\w*|pit|lump|spinning|wired|restless|cry\w*|tears|sob\w*|scream\w*|shout\w*|snap\w*|hide|hiding|hid|run\w*|flee|disappear\w*|withdraw\w*|curl\w*|reaching|drained|exhaust\w*|worn out|trapped|stuck|small|invisible|unseen|left out|forgotten|erased|afterthought)\b/i;

/** Did a salient word of this extracted field appear in one of the user's SUBSTANTIVE turns? */
function fieldFromSubstantiveUser(fieldText: string | null | undefined, substantive: string): boolean {
  const ws = contentWords(fieldText);
  if (!ws.length) return false;
  return ws.some((w) => new RegExp(`\\b${w}s?\\b`).test(substantive));
}

const BARE = /^(yeah?|yep|yes|exactly|totally|for sure|right|you'?re right|that ?one|that'?s the one|true|mm+|ok(ay)?|sure|definitely|absolutely|i guess|that fits|that'?s it|you got it|you nailed it)[\s.,!]*$/i;
const HEDGE_ONLY = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows|i dont know|i don'?t know|both maybe|neither|i cant tell|i can'?t tell)[\s.,!?]*$/i;

/**
 * Does the conversation carry a FELT detail the USER actually voiced — a body cue, an
 * urge, or an owned non-vague feeling word — not just the model's extraction or a
 * situation? A first shape is earned from this (review actions 1, 9): notice fast,
 * learn slow. Bare agreement, hedging, echoes and trigger-only talk never satisfy it.
 */
export function hasUserOwnedConcreteDetail(
  ev: Pick<EmotionEvent, 'body_cue' | 'behaviour_action' | 'appraisal_thought' | 'user_phrase' | 'emotion_shade' | 'shade_source'>,
  userText: string,
  history: Turn[],
): boolean {
  const corpus = userCorpus(userText, history);
  // 1) The user voiced a body sensation / urge / vivid felt word in their own words.
  if (CONCRETE_FELT.test(corpus)) return true;
  // 2) The user voiced a real (non-vague) feeling word themselves — naming the feeling,
  //    not just agreeing to one. (Covers user_stated shades and richer feeling language.)
  if (EMOTION_WORDS.test(corpus)) return true;
  if (ev.shade_source === 'user_stated' && ev.emotion_shade && !VAGUE.test(ev.emotion_shade.trim())) return true;
  // The substantive user turns (not agreement/hedging) — where real content lives.
  const substantive = ` ${[userText, ...(history ?? []).filter((m) => m.role === 'user').map((m) => m.content)]
    .filter((m) => { const n = m.toLowerCase().replace(/[’'`]/g, "'").trim(); return n && !BARE.test(n) && !HEDGE_ONLY.test(n); })
    .join('  ')
    .toLowerCase()} `;
  // 3) A substantive personal phrase (>=3 content words) the user voiced in a real turn.
  if (ev.user_phrase) {
    const pw = contentWords(ev.user_phrase);
    if (pw.length >= 3 && !VAGUE.test(ev.user_phrase.trim()) && pw.filter((w) => new RegExp(`\\b${w}\\b`).test(substantive)).length >= 2) return true;
  }
  // 4) An extracted body cue / urge whose words came from a substantive user turn — the
  //    meaning/situation alone (trigger) deliberately does NOT count toward a felt shape.
  const feltFields = [...(ev.body_cue ?? []), ...(ev.behaviour_action ?? [])].filter(Boolean);
  if (feltFields.some((f) => fieldFromSubstantiveUser(f, substantive))) return true;
  return false;
}

// High-intensity feeling words. Preserving the user's intensity (review #6) means
// never quietly storing/reflecting a milder synonym than the word they actually used.
export const INTENSE_FEELING =
  /\b(furious|livid|enraged|seething|raging|terrified|petrified|panicking|panicked|frantic|desperate|devastated|heartbroken|gutted|crushed|shattered|hollow|numb|empty|broken|drowning|suffocating|despairing|hopeless|worthless|trapped|excruciating|unbearable|agony|agonising|destroyed)\b/i;

// The user said it has eased — the ONLY licence to soften their named intensity.
export const SOFTENING_CUE =
  /\b(calmer|calming down|less (angry|scared|sad|upset|intense|bad)|not as (angry|scared|bad|intense)|easing|eased|settling|settled down|fading|wearing off|better now|a bit better|relief|relieved|lighter now)\b/i;

/** The strongest feeling word the user voiced in this turn (or null) — used to keep
 *  their intensity from being downgraded to a milder synonym. */
export function intenseUserWord(userText: string): string | null {
  const m = (userText ?? '').match(INTENSE_FEELING);
  return m ? m[0].toLowerCase() : null;
}

/**
 * Has the user ORIGINATED at least one felt/feeling word across the whole conversation
 * — one they voiced that was NOT already in the companion's immediately-preceding reply
 * (i.e. not an echo)? The conversation-level ownership gate (review #1/#2): a first
 * shape needs the user to have brought something of their own, never only echoed/agreed.
 * Closes the shallow-agreement case that the turn-local gate can't (the user echoes the
 * companion's words back, which "presence" checks accept but origination does not).
 */
export function userHasOriginated(history: Turn[], currentUserText: string): boolean {
  const turns = [...(history ?? []), { role: 'user' as const, content: currentUserText ?? '' }];
  const feltRx = new RegExp(`${CONCRETE_FELT.source}|${EMOTION_WORDS.source}`, 'gi');
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].role !== 'user') continue;
    const utext = (turns[i].content || '').toLowerCase().replace(/[’'`]/g, "'");
    const words = (utext.match(feltRx) || []).map((w) => w.toLowerCase().trim()).filter(Boolean);
    if (!words.length) continue;
    const prevCompanion = [...turns.slice(0, i)].reverse().find((x) => x.role === 'companion');
    const prevText = (prevCompanion?.content || '').toLowerCase();
    // originated if a felt word the user used did NOT appear in the companion's last reply
    if (words.some((w) => !new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(prevText))) return true;
  }
  return false;
}

/**
 * True when the user is genuinely RE-OWNING `word` in their text — it appears AND is not
 * inside a negation/rejection of it. "not empty", "no, not empty", "don't feel empty" are
 * REJECTING the word, not reintroducing it, so they must not lift a rejected-shade
 * quarantine (review #7: re-entry must be the user owning it again, never the word merely
 * surfacing as it is pushed away). The negator window stops at a clause break so "not
 * anxious, more empty" still counts as owning "empty".
 */
export function reintroducesWord(word: string, userText: string): boolean {
  const w = (word ?? '').toLowerCase().trim();
  if (!w) return false;
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const txt = (userText ?? '').replace(/[’'`]/g, "'");
  if (!new RegExp(`\\b${esc}\\b`, 'i').test(txt)) return false;
  const negated = new RegExp(`\\b(not|no|never|isn'?t|wasn'?t|aren'?t|ain'?t|don'?t|dont|hardly)\\b[^.!?,]{0,14}\\b${esc}\\b`, 'i');
  return !negated.test(txt);
}

export interface EvidenceLedger {
  concreteFromUser: boolean; // the gate signal — at least one user-voiced concrete detail
  userTurns: number;
  bareAgreementTurns: number; // turns that were only assent ("yeah", "exactly")
  uncertaintyTurns: number; // turns that were only hedging
  rejectedWords: string[]; // shades the user has pushed away
}

const BARE_AGREEMENT =
  /^(yeah?|yep|yes|exactly|totally|for sure|right|you'?re right|that ?one|that'?s the one|true|mm+|ok(ay)?|sure|definitely|absolutely|i guess|that fits|that'?s it|you got it|you nailed it)[\s.,!]*$/i;
const HEDGE = /^(maybe|kind of|kinda|sort of|sorta|i guess|not really|dunno|idk|unsure|hard to say|hmm|who knows|i dont know|i don'?t know)[\s.,!?]*$/i;

/**
 * Build the per-conversation ledger from the user's turns + the latest event. Used for
 * observability/eval; the engine gate itself only needs hasUserOwnedConcreteDetail.
 */
export function buildLedger(ev: EmotionEvent, userText: string, history: Turn[]): EvidenceLedger {
  const userMsgs = [...(history ?? []).filter((m) => m.role === 'user').map((m) => m.content), userText];
  const norm = (s: string) => s.toLowerCase().replace(/[’'`]/g, "'").trim();
  return {
    concreteFromUser: hasUserOwnedConcreteDetail(ev, userText, history),
    userTurns: userMsgs.length,
    bareAgreementTurns: userMsgs.filter((m) => BARE_AGREEMENT.test(norm(m))).length,
    uncertaintyTurns: userMsgs.filter((m) => HEDGE.test(norm(m))).length,
    rejectedWords: [...(ev.user_rejected_shades ?? [])],
  };
}
